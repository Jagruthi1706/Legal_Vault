import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { AIService, deriveLegalRetrievalQuery } from '../src/services/ai/ai.service';
import { MockAIProvider } from '../src/services/ai/mock-ai.provider';
import { CaseRetrievalService } from '../src/services/ai/retrieval.service';
import { LocalLegalKnowledgeSource } from '../src/services/ai/legal/local-knowledge.source';
import { InMemoryVectorStore } from '../src/services/ai/vector/in-memory.store';
import { LocalEmbeddingClient } from '../src/services/ai/vector/embeddings';
import {
  AIProvider,
  AIGenerateInput,
  AISummarizeInput,
} from '../src/services/ai/types';
import {
  extractContentTerms,
  termOccurs,
  RELEVANCE_RATIO,
} from '../src/services/ai/relevance';

/**
 * Focused tests for Stage 9:
 *  - deriveLegalRetrievalQuery(): the attachment-aware Legal KB retrieval query
 *    keeps legal markers/concepts and citation numbers while dropping document
 *    names, dates and narrative wording.
 *  - The attachment paths (chatNoCase, chatWithAttachments) use the derived
 *    query ONLY for authority retrieval; the full user question, CASE_DOCUMENT
 *    facts and LEGAL_AUTHORITY stay separate and unchanged.
 */

const ARTICLE_21_TEXT =
  'Article 21 of the Constitution of India: No person shall be deprived of his life or personal liberty except according to procedure established by law.';

const article21Authority = {
  id: 'IND-CONST-ART021-V2',
  title: 'Constitution of India, Article 21',
  text: ARTICLE_21_TEXT,
  provenance: {
    source: 'India Code',
    sourceUrl: 'https://www.indiacode.nic.in/',
    license: 'Government of India public legislative text',
    documentType: 'statute' as const,
    jurisdiction: 'India',
    citation: 'Constitution of India, Art. 21',
  },
  relevance: 0.9,
  chunkId: 'IND-CONST-ART021-V2:kb:0',
  pageOrSection: 'Article 21',
};

/**
 * Deterministic stand-in for LocalLegalKnowledgeSource that applies the SAME
 * topical-relevance gate the real source uses, so tests stay hermetic.
 */
const buildLegalSource = (): LocalLegalKnowledgeSource => {
  const source = new LocalLegalKnowledgeSource(
    new InMemoryVectorStore(),
    new LocalEmbeddingClient(),
    [],
  );
  (
    source as unknown as {
      search: (q: string, f?: unknown) => Promise<unknown[]>;
    }
  ).search = async (query: string) => {
    const terms = extractContentTerms(query);
    const hay = ARTICLE_21_TEXT.toLowerCase();
    if (terms.length === 0) return [article21Authority];
    const matched = terms.filter((t) => termOccurs(t, hay)).length;
    if (matched > 0 && matched / terms.length >= RELEVANCE_RATIO)
      return [article21Authority];
    return [];
  };
  return source;
};

type ProviderInput = AIGenerateInput | AISummarizeInput;
class RecordingProvider implements AIProvider {
  public lastInput: ProviderInput | null = null;
  private readonly inner = new MockAIProvider();
  async generateAnswer(input: AIGenerateInput) {
    this.lastInput = input;
    return this.inner.generateAnswer(input);
  }
  async research(input: AIGenerateInput) {
    this.lastInput = input;
    return this.inner.research(input);
  }
  async summarize(input: AISummarizeInput) {
    this.lastInput = input;
    return this.inner.summarize(input);
  }
  async analyzeEvidence(input: AIGenerateInput) {
    this.lastInput = input;
    return this.inner.analyzeEvidence(input);
  }
}

const cases = {
  canAccessCase: async (_caseId: string, _userId: string, _role: string) => true,
  getCaseByIdForUser: async () => ({
    id: 'case-1',
    caseNumber: 'CN-1',
    title: 'Contract dispute',
    description: '',
    evidence: [],
  }),
};

const retriever = new CaseRetrievalService(cases, {
  getDocumentsForUser: async () => [],
  getDocumentContent: async () => null,
});

const MEHTA_QUERY =
  'According to the attached document, what happened to Kiran Mehta, and why might Article 21 be relevant? Clearly distinguish the facts in the document from the legal authority.';

const mehtaAttachment = {
  buffer: Buffer.from(
    'On 14 April 2026 Kiran Mehta was detained at the municipal building and a temporary restriction on movement was imposed.',
  ),
  originalName: 'incident.txt',
  mimeType: 'text/plain',
};
test('deriveLegalRetrievalQuery: Keeran Mehta question focuses on Article 21 and drops names/dates', () => {
  const derived = deriveLegalRetrievalQuery(MEHTA_QUERY);
  assert.equal(derived, 'article 21', 'document-specific terms must be filtered out');
  assert.ok(!derived.includes('kiran') && !derived.includes('mehta'), 'party names must not leak into retrieval');
  assert.ok(!derived.includes('april') && !derived.includes('2026'), 'dates must not leak into retrieval');
});

test('deriveLegalRetrievalQuery: Article/section/statute references are preserved', () => {
  const derived = deriveLegalRetrievalQuery(
    'Under Section 149 of the Limitation Act can the delay be condoned?',
  );
  assert.ok(derived.includes('section'), 'section marker must be preserved');
  assert.ok(derived.includes('149'), 'section number must be preserved');
  assert.ok(derived.includes('limitation'), 'statute name term must be preserved');
  assert.ok(derived.includes('delay'), 'doctrinal term must be preserved');
});

test('deriveLegalRetrievalQuery: generic question with no legal signal returns the full query', () => {
  const derived = deriveLegalRetrievalQuery('What is the weather forecast in Mumbai?');
  assert.equal(derived, 'What is the weather forecast in Mumbai?', 'fallback must keep the original query');
});

test('deriveLegalRetrievalQuery: law/laws markers are recognized and not dropped', () => {
  const derived = deriveLegalRetrievalQuery('what are the laws involved in this case');
  assert.ok(derived.includes('laws'), 'laws marker must be preserved in the derived query');
  assert.ok(!derived.includes('what') && !derived.includes('involved'), 'non-legal filler terms must be filtered out');
  assert.notEqual(derived, 'what are the laws involved in this case', 'must NOT fall back to the full unprocessed question');
});

test('deriveLegalRetrievalQuery: singular law marker is also recognized', () => {
  const derived = deriveLegalRetrievalQuery('what law applies to this dispute');
  assert.ok(derived.includes('law'), 'law marker must be preserved in the derived query');
  assert.notEqual(derived, 'what law applies to this dispute', 'must NOT fall back to the full unprocessed question');
});

test('Attachment question: names/dates do not prevent Article 21 retrieval; contexts stay separate', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(MEHTA_QUERY, [mehtaAttachment]);

  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(
    gen.legalContext && gen.legalContext.length > 0,
    'legal authority must be retrieved despite names/dates in the question',
  );
  assert.ok(
    gen.legalContext.every((c) => c.scope === 'LEGAL_AUTHORITY'),
    'legal context must stay LEGAL_AUTHORITY',
  );
  assert.ok(
    gen.caseContext?.some((c) => /kiran/i.test(c.text)),
    'uploaded document facts must reach case context',
  );
  assert.ok(
    gen.caseContext?.every((c) => c.scope !== 'LEGAL_AUTHORITY'),
    'case context must not contain legal authority (separation)',
  );
  assert.equal(
    gen.userQuery,
    MEHTA_QUERY,
    'full user question must reach the provider unchanged',
  );
  assert.ok(result.legalSources.length > 0, 'grounded answer carries legal sources');
  assert.ok(result.caseSources.length > 0, 'grounded answer carries case sources');
  assert.notEqual(result.status, 'unavailable');
});

test('Attachment question: irrelevant document facts do not block legal retrieval', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'Kiran Mehta went to the municipal building gate at noon, and is Article 21 relevant to his freedom?',
    [mehtaAttachment],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen.legalContext && gen.legalContext.length > 0, 'legal authority should still be retrieved');
  assert.ok(result.legalSources.length > 0);
});

test('Generic unrelated question does not falsely retrieve authorities', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase('What is the weather forecast in Mumbai?', [mehtaAttachment]);
  const gen = provider.lastInput as AIGenerateInput;
  assert.equal(gen.legalContext?.length, 0, 'no authority for an unrelated question');
  assert.equal(result.legalSources.length, 0, 'no legal source may be fabricated');
});

test('Standalone Legal KB question (no attachments) still grounded from legal authority', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'What does Article 21 of the Constitution of India protect?',
    [],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen.legalContext?.length > 0, 'standalone legal question still retrieves authority');
  assert.notEqual(result.status, 'unavailable');
});

test('Case-scoped chatWithAttachments retrieves Article 21 and keeps CASE_DOCUMENT separate', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatWithAttachments(
    'case-1',
    'u1',
    'LAWYER',
    'According to the attached document, what happened to Kiran Mehta, and why might Article 21 be relevant?',
    [mehtaAttachment],
    'answer',
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen.legalContext?.length > 0, 'case-scoped attachment path must retrieve legal authority');
  assert.ok(gen.caseContext?.some((c) => /kiran/i.test(c.text)), 'attachment facts must reach case context');
  assert.ok(gen.legalContext?.every((c) => c.scope === 'LEGAL_AUTHORITY'));
  assert.ok(gen.caseContext?.every((c) => c.scope !== 'LEGAL_AUTHORITY'));
  assert.notEqual(result.status, 'unavailable');
});