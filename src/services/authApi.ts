import { API_BASE, authHeaders, handleResponse, setStoredToken } from './apiClient';

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: AuthUserResponse;
    token: string;
  };
}

export const authApi = {
  googleLoginUrl(): string {
    return `${API_BASE}/auth/google`;
  },

  /**
   * Reports whether Google sign-in is provisioned on the backend.
   *
   * Google OAuth requires externally provisioned Google Cloud credentials.
   * When they are absent the backend reports `enabled: false` and the UI must
   * say so plainly instead of offering a button that cannot succeed.
   */
  async googleStatus(): Promise<{ success: boolean; data: { provider: string; enabled: boolean } }> {
    const res = await fetch(`${API_BASE}/auth/google/status`);
    return handleResponse(res);
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<LoginResponse>(res);
    setStoredToken(data.data.token);
    return data;
  },

  async me(): Promise<{ success: boolean; data: AuthUserResponse }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  logout(): void {
    setStoredToken(null);
  },
};
