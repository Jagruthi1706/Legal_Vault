import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setStoredToken } from '../../services/apiClient';
import { authApi } from '../../services/authApi';
import { getRoleHomePath, mapBackendRole } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export const OAuthCallbackPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      toast.error('Google authentication did not return a Legal Vault session.');
      navigate('/login', { replace: true });
      return;
    }

    setStoredToken(token);
    
    // Use role-based navigation to match LoginPage behavior
    authApi.me()
      .then((res) => {
        const role = mapBackendRole(res.data.role);
        window.location.replace(getRoleHomePath(role));
      })
      .catch(() => {
        // Fallback to generic /app if role lookup fails
        window.location.replace('/app');
      });
  }, [navigate, params]);

  return (
    <div className="py-12 px-4 text-center text-xs text-foreground-muted">
      Finishing Google sign-in...
    </div>
  );
};
