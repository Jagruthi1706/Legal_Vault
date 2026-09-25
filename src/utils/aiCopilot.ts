import type { AIMessage } from '../types';
import type { AIResponse } from '../services/aiApi';

export const mapAIResponseToMessage = (result: AIResponse, timestamp: string): AIMessage => ({
  id: `ai-${Date.now()}`,
  sender: 'assistant',
  text: result.answer,
  timestamp,
  sources: (result.caseSources ?? result.citations).map((item) => `${item.documentName} — ${item.pageOrSection}`),
  caseSources: (result.caseSources ?? result.citations.filter((item) => item.sourceType !== 'legal_authority')).map((item) => `${item.documentName} — ${item.pageOrSection}`),
  legalSources: (result.legalSources ?? []).map((item) => {
    const court = item.court ? `${item.court} · ` : '';
    const citation = item.citation ? ` · ${item.citation}` : '';
    return `${court}${item.documentName}${citation}`;
  }),
  precedentSources: (result.precedentSources ?? []).map((item) => {
    const court = item.court ? `${item.court} · ` : '';
    const citation = item.citation ? ` · ${item.citation}` : '';
    return `${court}${item.documentName}${citation}`;
  }),
  facts: result.facts,
  explanation: result.explanation,
  unsupported: result.unsupported,
  confidenceScore: result.confidence,
  warnings: result.warnings,
  status: result.status,
  providerMode: result.mode,
  // Preserve temporal metadata from the first legal source (if available)
  temporal: result.legalSources?.[0]?.temporal,
});

export const caseScopedEmptyState = (caseId?: string) =>
  caseId
    ? null
    : 'Open a case workspace to use case-scoped AI. The copilot cannot search other cases.';
