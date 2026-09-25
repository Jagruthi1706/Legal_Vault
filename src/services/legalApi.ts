import { API_BASE, authHeaders, handleResponse } from './apiClient';

export interface LegalProvenanceRecord {
  source: string;
  sourceUrl: string;
  license: string;
  court?: string;
  caseName?: string;
  caseNumber?: string;
  judgmentDate?: string;
  citation?: string;
  documentType: string;
  jurisdiction: string;
  attribution?: string;
}

export interface LegalSearchHit {
  id: string;
  title: string;
  excerpt?: string;
  relevance: number;
  pageOrSection?: string;
  provenance: LegalProvenanceRecord;
}

export interface LegalSearchQuery {
  query: string;
  court?: string;
  documentType?: 'judgment' | 'statute' | 'other';
  jurisdiction?: string;
  sort?: 'relevance' | 'date';
}

export const legalApi = {
  search: async (input: LegalSearchQuery): Promise<{ success: boolean; data: LegalSearchHit[] }> =>
    handleResponse(
      await fetch(`${API_BASE}/legal/search`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(input),
      }),
    ),
  getById: async (id: string): Promise<{ success: boolean; data: { id: string; title: string; text: string; provenance: LegalProvenanceRecord } }> =>
    handleResponse(await fetch(`${API_BASE}/legal/${encodeURIComponent(id)}`, { headers: authHeaders() })),
  provenance: async (): Promise<{ success: boolean; data: unknown }> =>
    handleResponse(await fetch(`${API_BASE}/legal/provenance`, { headers: authHeaders() })),
};
