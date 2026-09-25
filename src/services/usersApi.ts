import { API_BASE, authHeaders, handleResponse } from './apiClient';

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export const usersApi = {
  async list(): Promise<{ success: boolean; data: DirectoryUser[] }> {
    return handleResponse(await fetch(`${API_BASE}/users`, { headers: authHeaders() }));
  },
};
