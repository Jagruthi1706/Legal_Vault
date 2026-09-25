import { env } from './env';

export type AIProviderName = 'mock' | 'openai' | 'gemini';

export interface AIRuntimeConfig {
  provider: AIProviderName;
  apiKey?: string;
  model: string;
  embeddingModel: string;
  timeoutMs: number;
  maxRetries: number;
  vectorStore: 'memory' | 'postgres';
}

export const DEFAULT_AI_MODEL = 'gpt-4o-mini';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const getAIConfig = (): AIRuntimeConfig => {
  const provider = env.AI_PROVIDER;
  return {
    provider,
    // Keys stay backend-only. Each provider reads its own key variable.
    apiKey:
      (provider === 'gemini' ? env.GEMINI_API_KEY : env.OPENAI_API_KEY)?.trim() || undefined,
    // The generic AI_MODEL default is an OpenAI model; when Gemini is the active
    // provider without an explicit gemini model override, use the Gemini default.
    model:
      provider === 'gemini' && !env.AI_MODEL.startsWith('gemini')
        ? DEFAULT_GEMINI_MODEL
        : env.AI_MODEL,
    embeddingModel: env.AI_EMBEDDING_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
    maxRetries: env.AI_MAX_RETRIES,
    vectorStore: env.VECTOR_STORE,
  };
};
