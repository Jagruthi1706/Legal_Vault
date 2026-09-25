import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { authApi } from '../services/authApi';
import { getStoredToken, setStoredToken } from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  token: string | null;
  login: (email: string, password: string) => Promise<UserRole>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const mapBackendRole = (role: string): UserRole => {
  switch (role.toUpperCase()) {
    case 'CLIENT':
    case 'CITIZEN': // legacy DB value; API now exposes CLIENT.
      return 'client';
    case 'LAWYER':
      return 'lawyer';
    case 'JUDGE':
      return 'judge';
    case 'ADMIN':
      return 'admin';
    default:
      return 'invalid';
  }
};

export const getRoleHomePath = (role: UserRole): string => ({
  client: '/app/client',
  lawyer: '/app/lawyer',
  judge: '/app/judge',
  admin: '/app/admin',
}[role] || '/app/forbidden');

const toFrontendUser = (data: {
  id: string;
  email: string;
  name: string;
  role: string;
}): User => ({
  id: data.id,
  email: data.email,
  name: data.name,
  role: mapBackendRole(data.role),
  verified: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<UserRole>('invalid');
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const hydrateFromToken = useCallback(async () => {
    const stored = getStoredToken();
    if (!stored) {
      setToken(null);
      setUser(null);
      setRoleState('invalid');
      setIsLoading(false);
      return;
    }

    try {
      const me = await authApi.me();
      const mapped = toFrontendUser(me.data);
      setToken(stored);
      setUser(mapped);
      setRoleState(mapped.role);
      setAuthError(null);
    } catch {
      setStoredToken(null);
      setToken(null);
      setUser(null);
      setRoleState('invalid');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrateFromToken();
  }, [hydrateFromToken]);

  const login = async (email: string, password: string): Promise<UserRole> => {
    setAuthError(null);
    await authApi.login(email, password);
    // Do not trust any client-held role (including the login payload). The
    // authenticated backend identity endpoint is authoritative.
    const me = await authApi.me();
    const mapped = toFrontendUser(me.data);
    const stored = getStoredToken();
    setToken(stored);
    setUser(mapped);
    setRoleState(mapped.role);
    return mapped.role;
  };

  const logout = () => {
    authApi.logout();
    setToken(null);
    setUser(null);
    setRoleState('invalid');
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        login,
        logout,
        isAuthenticated: Boolean(token && user),
        isLoading,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
