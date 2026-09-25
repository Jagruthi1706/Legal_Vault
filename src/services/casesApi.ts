import { API_BASE, authHeaders, handleResponse } from './apiClient';
import { AuditRecord, CaseListResponse, DocumentComparison, VerificationRecord } from '../types/api';

export const casesApi = {
  async getCases(): Promise<CaseListResponse> {
    const res = await fetch(`${API_BASE}/cases`, {
      headers: authHeaders(),
    });
    return handleResponse<CaseListResponse>(res);
  },

  async getCaseById(caseId: string): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_BASE}/cases/${caseId}`, {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  async createCase(data: {
    caseNumber: string;
    title: string;
    description?: string;
    caseType?: string;
    status?: string;
  }): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_BASE}/cases`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getAudit(caseId: string): Promise<{ success: boolean; data: AuditRecord[] }> {
    return handleResponse(await fetch(`${API_BASE}/cases/${caseId}/audit`, { headers: authHeaders() }));
  },
  async getVerifications(caseId: string): Promise<{ success: boolean; data: VerificationRecord[] }> {
    return handleResponse(await fetch(`${API_BASE}/cases/${caseId}/verifications`, { headers: authHeaders() }));
  },
  async getComparisons(caseId: string): Promise<{ success: boolean; data: DocumentComparison[] }> {
    return handleResponse(await fetch(`${API_BASE}/cases/${caseId}/comparisons`, { headers: authHeaders() }));
  },
  async assignJudge(caseId: string, judgeId: string): Promise<{ success: boolean; data: any }> {
    return handleResponse(await fetch(`${API_BASE}/cases/${caseId}/assigned-judge`, { method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ judgeId }) }));
  },
};
