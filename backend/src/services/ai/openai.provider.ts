import { z } from 'zod';
import { AIRuntimeConfig } from '../../config/ai.config';
import {
  assembleAnswer,
  caseChunksOf,
  legalChunksOf,
  precedentChunksOf,
  unavailableAnswer,
} from './answer.assembler';
import {
  AIAnswer,
  AIGenerateInput,
  AIProvider,
  AISummarizeInput,
} from './types';

const modelJsonSchema = z.object({
  answer: z.string(),
  facts: z.array(z.string()).default([]),
  explanation: z.string().default(''),
  unsupported: z.array(z.string()).default([]),
  status: z.enum(['grounded', 'partial', 'unavailable']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const formatContext = (label: string, chunks: ReturnType<typeof caseChunksOf>): string => {
  if (chunks.length === 0) {
    return `${label}\n(none retrieved)`;
  }
  return [
    label,
    ...chunks.map((chunk, index) => {
      const citation = chunk.provenance?.citation ? ` citation=${chunk.provenance.citation}` : '';
      const court = chunk.provenance?.court ? ` court=${chunk.provenance.court}` : '';
      return `[${index + 1}] id=${chunk.documentId} name=${chunk.documentName}${court}${citation}\n${chunk.text}`;
    }),
  ].join('\n\n');
};

export class OpenAIProvider implements AIProvider {
  constructor(
    private readonly config: Pick<AIRuntimeConfig, 'apiKey' | 'model'> & { timeoutMs?: number; maxRetries?: number },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generateAnswer(input: AIGenerateInput): Promise<AIAnswer> {
    return this.complete(input, input.operation ?? 'answer');
  }

  async summarize(input: AISummarizeInput): Promise<AIAnswer> {
    return this.complete({ ...input, userQuery: 'Summarize the authorized case records.' }, 'summarize');
  }

  async analyzeEvidence(input: AIGenerateInput): Promise<AIAnswer> {
    return this.complete(input, 'analyze_evidence');
  }

  async research(input: AIGenerateInput): Promise<AIAnswer> {
    return this.complete(input, input.operation ?? 'research');
  }

  private async complete(input: AIGenerateInput | AISummarizeInput, operation: AIAnswer['operation']): Promise<AIAnswer> {
    const caseContext = caseChunksOf({ context: 'context' in input ? input.context : [], caseContext: input.caseContext });
    const legalContext = legalChunksOf({ legalContext: input.legalContext });
    const precedentContext = precedentChunksOf({ precedentContext: input.precedentContext });
    const warnings = [`OpenAI provider (${this.config.model}). API key is backend-only.`];

    if (!this.config.apiKey) {
      return unavailableAnswer(operation, 'OPENAI', [...warnings, 'OPENAI_API_KEY is missing.']);
    }

    if (caseContext.length === 0 && legalContext.length === 0 && precedentContext.length === 0) {
      return unavailableAnswer(operation, 'OPENAI', warnings);
    }

    const userQuery = 'userQuery' in input ? input.userQuery : 'Summarize the authorized case records.';
    const body = {
      model: this.config.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${input.applicationInstructions}\nRespond as JSON with keys answer, facts, explanation, unsupported, status, confidence. Use only supplied sources. Never call tools. Never perform privileged application actions.`,
        },
        {
          role: 'user',
          content: [
            formatContext('CASE EVIDENCE:', caseContext),
            formatContext('LEGAL AUTHORITIES:', legalContext),
            formatContext('JUDICIAL PRECEDENTS:', precedentContext),
            `USER QUESTION:\n${userQuery}`,
            `OPERATION:\n${operation}`,
          ].join('\n\n'),
        },
      ],
    };

    try {
      const response = await this.fetchWithRetry(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const reason = response.status === 429 ? 'Provider rate-limited the request.' : `Provider error (${response.status}).`;
        return unavailableAnswer(operation, 'OPENAI', [...warnings, reason]);
      }
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        return unavailableAnswer(operation, 'OPENAI', [...warnings, 'Provider returned an empty response.']);
      }
      const parsed = modelJsonSchema.safeParse(JSON.parse(content));
      if (!parsed.success) {
        return unavailableAnswer(operation, 'OPENAI', [...warnings, 'Provider response was not valid structured output.']);
      }
      return assembleAnswer({
        operation,
        mode: 'OPENAI',
        caseContext,
        legalContext,
        precedentContext,
        answer: parsed.data.answer,
        facts: parsed.data.facts,
        explanation: parsed.data.explanation,
        unsupported: parsed.data.unsupported,
        status: parsed.data.status,
        confidence: parsed.data.confidence,
        warnings,
        userQuery,
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'AbortError' || error.message.includes('abort'));
      return unavailableAnswer(operation, 'OPENAI', [...warnings, timedOut ? 'Provider request timed out.' : 'Provider request failed.']);
    }
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    const timeoutMs = this.config.timeoutMs ?? 20_000;
    const maxRetries = this.config.maxRetries ?? 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt >= maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Provider request failed.');
  }
}
