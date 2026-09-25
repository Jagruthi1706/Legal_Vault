import { AIRuntimeConfig, getAIConfig } from '../../config/ai.config';
import { GeminiProvider } from './gemini.provider';
import { MockAIProvider } from './mock-ai.provider';
import { OpenAIProvider } from './openai.provider';
import { AIProvider, AIProviderMode } from './types';

export interface ResolvedAIProvider {
  provider: AIProvider;
  mode: AIProviderMode;
  warnings: string[];
  model?: string;
}

export const resolveAIProvider = (
  config: AIRuntimeConfig = getAIConfig(),
  deps: {
    mock?: () => AIProvider;
    openai?: (config: AIRuntimeConfig) => AIProvider;
    gemini?: (config: AIRuntimeConfig) => AIProvider;
  } = {},
): ResolvedAIProvider => {
  const mock = deps.mock ?? (() => new MockAIProvider());
  const openai = deps.openai ?? ((value) => new OpenAIProvider(value));
  const gemini = deps.gemini ?? ((value) => new GeminiProvider(value));

  if (config.provider === 'openai') {
    if (!config.apiKey) {
      return {
        provider: mock(),
        mode: 'MOCK',
        warnings: ['AI_PROVIDER=openai but OPENAI_API_KEY is missing. Using MockAIProvider.'],
        model: config.model,
      };
    }
    return {
      provider: openai(config),
      mode: 'OPENAI',
      warnings: [],
      model: config.model,
    };
  }

  if (config.provider === 'gemini') {
    if (!config.apiKey) {
      return {
        provider: mock(),
        mode: 'MOCK',
        warnings: ['AI_PROVIDER=gemini but GEMINI_API_KEY is missing. Using MockAIProvider.'],
        model: config.model,
      };
    }
    return {
      provider: gemini(config),
      mode: 'GEMINI',
      warnings: [],
      model: config.model,
    };
  }

  return {
    provider: mock(),
    mode: 'MOCK',
    warnings: ['AI_PROVIDER=mock. Using the deterministic development provider.'],
    model: config.model,
  };
};
