import { API_BASE, authHeaders, handleResponse } from './apiClient';
import { DocumentListResponse, DocumentMetadata } from '../types/api';
import { DocumentComparison, VerificationRecord } from '../types/api';

export interface TamperCheckResult {
  status: 'UNMODIFIED' | 'TAMPERED' | string;
  hashMatches: boolean;
  originalHash: string;
  candidateHash: string;
  candidateFileName: string;
  candidateMimeType?: string;
  candidateFileSize?: number;
  originalDocumentId: string;
  originalFileName: string;
  originalAnchored: boolean;
  network: string;
  chainId: number;
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  explorerTxUrl: string | null;
  candidatePersisted: boolean;
  blockchainTransactionCreated: boolean;
  message: string;
  onChain?: {
    exists: boolean;
    referenceId: string;
    actor: string;
    eventType: string;
    timestamp: number;
  } | null;
}

export const documentsApi = {
  async getDocuments(caseId?: string): Promise<DocumentListResponse> {
    const params = caseId ? `?caseId=${encodeURIComponent(caseId)}` : '';
    const res = await fetch(`${API_BASE}/documents${params}`, {
      headers: authHeaders(),
    });
    return handleResponse<DocumentListResponse>(res);
  },

  async getDocumentById(documentId: string): Promise<{ success: boolean; data: DocumentMetadata }> {
    const res = await fetch(`${API_BASE}/documents/${documentId}`, {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  async uploadDocument(
    file: File,
    caseId: string,
    documentType: string = 'EVIDENCE',
    description?: string,
  ): Promise<{ success: boolean; data: DocumentMetadata }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caseId', caseId);
    formData.append('documentType', documentType);
    if (description) formData.append('description', description);

    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return handleResponse(res);
  },

  /**
   * Read-only tamper comparison against an already-anchored original.
   * Persists only the resulting comparison facts; candidate bytes are never
   * persisted and no candidate blockchain transaction is created.
   */
  async tamperCheck(
    originalDocumentId: string,
    candidateFile: File,
  ): Promise<{ success: boolean; data: TamperCheckResult }> {
    const formData = new FormData();
    formData.append('file', candidateFile);

    const res = await fetch(`${API_BASE}/documents/${originalDocumentId}/tamper-check`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return handleResponse(res);
  },
  async createJudicialVerification(documentId: string, data: { evidenceId?: string; judicialDecision?: 'ACCEPTED' | 'REJECTED'; decisionReason?: string }): Promise<{ success: boolean; data: VerificationRecord }> {
    return handleResponse(await fetch(`${API_BASE}/documents/${documentId}/judicial-verifications`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(data) }));
  },
  async getComparisons(documentId: string): Promise<{ success: boolean; data: DocumentComparison[] }> {
    return handleResponse(await fetch(`${API_BASE}/documents/${documentId}/comparisons`, { headers: authHeaders() }));
  },
  async download(documentId: string, fileName: string): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/download`, { headers: authHeaders() });
    if (!res.ok) {
      throw new Error('Download is unavailable for this document.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'document.bin';
    link.click();
    URL.revokeObjectURL(url);
  },
};
