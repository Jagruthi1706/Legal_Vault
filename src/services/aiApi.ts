import { API_BASE, authHeaders, handleResponse } from './apiClient';

export type AIOperation = 'answer' | 'summarize' | 'analyze_evidence' | 'research' | 'compare_authorities';
export type AIGroundingStatus = 'grounded' | 'partial' | 'unavailable';
export type AIProviderMode = 'MOCK' | 'OPENAI' | 'GEMINI';

export interface AICitation {
  documentId: string;
  documentName: string;
  chunkId: string;
  pageOrSection: string;
  relevance: number;
  sourceType?: 'document' | 'evidence' | 'case_record' | 'legal_authority';
  evidenceId?: string;
  source?: string;
  citation?: string;
  court?: string;
  jurisdiction?: string;
  date?: string;
  sourceUrl?: string;
  license?: string;
}

export interface LegalSource extends AICitation {
  scope: 'LEGAL_AUTHORITY';
  provenance?: {
    source: string;
    sourceUrl: string;
    license: string;
    court?: string;
    citation?: string;
    jurisdiction: string;
    judgmentDate?: string;
    documentType: string;
  };
  /** Lifecycle metadata (effectiveFrom, effectiveTo, currentStatus) when available. */
  temporal?: {
    currentStatus: string;
    effectiveFrom: string;
    effectiveTo: string;
  };
}

export interface AIResponse {
  answer: string;
  facts?: string[];
  explanation?: string;
  unsupported?: string[];
  mode: AIProviderMode;
  status?: AIGroundingStatus;
  confidence?: number;
  warnings?: string[];
  operation?: AIOperation;
  citations: AICitation[];
  sources: Array<AICitation & { caseId: string; text: string }>;
  caseSources?: AICitation[];
  legalSources?: LegalSource[];
  /** Judicial precedent sources (authorityKind = judicial_precedent).
   *  Separate from legalSources (statutory) so the UI can distinguish them. */
  precedentSources?: LegalSource[];
  caseId: string;
}

export const aiApi = {
  chat: async (caseId: string, query: string, operation: AIOperation = 'answer'): Promise<AIResponse> =>
    handleResponse(
      await fetch(`${API_BASE}/cases/${caseId}/ai/chat`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query, operation }),
      }),
    ),
  summarize: async (caseId: string): Promise<AIResponse> =>
    handleResponse(
      await fetch(`${API_BASE}/cases/${caseId}/ai/summarize`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: '{}',
      }),
    ),
  analyzeEvidence: async (caseId: string, query = 'Explain the evidence in this case.'): Promise<AIResponse> =>
    handleResponse(
      await fetch(`${API_BASE}/cases/${caseId}/ai/analyze-evidence`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query, operation: 'analyze_evidence' }),
      }),
    ),
  research: async (caseId: string, query = 'Find legal authorities relevant to this case.'): Promise<AIResponse> =>
    handleResponse(
      await fetch(`${API_BASE}/cases/${caseId}/ai/research`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query, operation: 'research' }),
      }),
    ),
  compareAuthorities: async (caseId: string, query = 'Compare authorized case facts against retrieved legal authorities.'): Promise<AIResponse> =>
    handleResponse(
      await fetch(`${API_BASE}/cases/${caseId}/ai/chat`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query, operation: 'compare_authorities' }),
      }),
    ),
  chatWithAttachments: async (
    caseId: string,
    query: string,
    files: File[],
    operation: AIOperation = 'answer',
  ): Promise<AIResponse> => {
    const formData = new FormData();
    formData.append('query', query);
    formData.append('operation', operation);
    for (const file of files) {
      formData.append('attachments', file);
    }
    return handleResponse(
      await fetch(`${API_BASE}/cases/${caseId}/ai/chat-with-attachments`, {
        method: 'POST',
        headers: authHeaders({}),
        body: formData,
      }),
    );
  },
  chatNoCase: async (
    query: string,
    files: File[],
    operation: AIOperation = 'answer',
  ): Promise<AIResponse> => {
    const formData = new FormData();
    formData.append('query', query);
    formData.append('operation', operation);
    for (const file of files) {
      formData.append('attachments', file);
    }
    return handleResponse(
      await fetch(`${API_BASE}/ai/chat-with-attachments`, {
        method: 'POST',
        headers: authHeaders({}),
        body: formData,
      }),
    );
  },
  status: async (caseId: string): Promise<{ mode?: string; model?: string; warnings?: string[]; caseId: string }> =>
    handleResponse(
      await fetch(`${API_BASE}/cases/${caseId}/ai/status`, {
        headers: authHeaders(),
      }),
    ),
};
