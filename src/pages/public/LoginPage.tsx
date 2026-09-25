import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, ArrowRight, User, Briefcase, Scale } from 'lucide-react';
import { getRoleHomePath, useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common/Button';
import toast from 'react-hot-toast';
import { authApi } from '../../services/authApi';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  client: <User className="w-3.5 h-3.5" />,
  lawyer: <Briefcase className="w-3.5 h-3.5" />,
  judge: <Scale className="w-3.5 h-3.5" />,
};

export const DEMO_ACCOUNT_EMAILS = {
  client: 'client@example.com',
  lawyer: 'lawyer@example.com',
  judge: 'meera.srinivasan@example.com',
  admin: 'admin@example.com',
} as const;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const isDevelopment = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Google OAuth needs credentials provisioned in Google Cloud. Until they exist
  // the backend reports enabled:false and we must not present a button that
  // dead-ends without explanation.
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

  const selectedRole = searchParams.get('role');
  const oauthError = searchParams.get('error');

  useEffect(() => {
    let cancelled = false;
    void authApi
      .googleStatus()
      .then((res) => {
        if (!cancelled) setGoogleEnabled(Boolean(res.data?.enabled));
      })
      .catch(() => {
        if (!cancelled) setGoogleEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!oauthError) return;
    const message = {
      google_not_configured: 'Google sign-in is not configured on this deployment. Use email and password.',
      google_denied: 'Google sign-in was cancelled.',
      google_invalid_callback: 'Google sign-in response could not be validated. Please try again.',
      google_token_exchange_failed: 'Google sign-in could not be completed. Please try again.',
      google_email_unverified: 'That Google account has no verified email address.',
    }[oauthError] || `Google sign-in failed (${oauthError}).`;
    toast.error(message);
  }, [oauthError]);

  const googleErrorMessage = oauthError
    ? {
        google_not_configured: 'Google sign-in is not configured on this deployment. Use email and password.',
        google_denied: 'Google sign-in was cancelled.',
        google_invalid_callback: 'Google sign-in response could not be validated. Please try again.',
        google_token_exchange_failed: 'Google sign-in could not be completed. Please try again.',
        google_email_unverified: 'That Google account has no verified email address.',
      }[oauthError] || `Google sign-in failed (${oauthError}).`
    : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const authenticatedRole = await login(email.trim(), password);
      toast.success('Authenticated with Legal Vault backend');
      navigate(getRoleHomePath(authenticatedRole));
    } catch (err: any) {
      toast.error(err?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-12 px-4 max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-[#0B0B0B] dark:bg-[#F3F3F2] text-white dark:text-[#111111] flex items-center justify-center mx-auto shadow-md">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold font-heading text-foreground">
          Log in
        </h1>
        {selectedRole && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold">
            {ROLE_ICONS[selectedRole]}
            Role: {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
          </div>
        )}
        {!selectedRole && (
          <p className="text-xs text-foreground-muted">
            Backend session required for Ethereum Sepolia document anchoring
          </p>
        )}
      </div>

      <form
        onSubmit={handleLogin}
        className="p-6 bg-surface border border-border rounded-2xl space-y-4 text-xs shadow-xs"
      >
        <div>
          <label className="block font-semibold mb-1 text-foreground">
            Email / Username
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border text-foreground"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-foreground">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border text-foreground"
          />
        </div>

        {isDevelopment && (
          <div className="space-y-2">
            <p className="text-[11px] text-foreground-muted leading-relaxed">Development demo accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Demo Client', DEMO_ACCOUNT_EMAILS.client],
                ['Demo Lawyer', DEMO_ACCOUNT_EMAILS.lawyer],
                ['Demo Judge', DEMO_ACCOUNT_EMAILS.judge],
                ['Demo Administrator', DEMO_ACCOUNT_EMAILS.admin],
              ].map(([label, accountEmail]) => (
                <button
                  key={accountEmail}
                  type="button"
                  onClick={() => {
                    setEmail(accountEmail);
                    setPassword('password123');
                  }}
                  className="rounded-lg border border-border px-2 py-2 text-left text-[11px] font-semibold text-foreground-muted hover:bg-surface-subtle hover:text-foreground"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="primary"
          type="submit"
          className="w-full"
          isLoading={submitting}
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          Log In
        </Button>

        {googleErrorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {googleErrorMessage}
          </p>
        )}

        {googleEnabled === false ? (
          <div className="space-y-1">
            <Button variant="outline" type="button" className="w-full" disabled>
              Continue with Google
            </Button>
            <p className="text-center text-[10px] text-foreground-muted">
              Not configured — requires external Google OAuth credentials.
            </p>
          </div>
        ) : (
          <Button
            variant="outline"
            type="button"
            className="w-full"
            isLoading={googleEnabled === null}
            onClick={() => {
              window.location.href = authApi.googleLoginUrl();
            }}
          >
            Continue with Google
          </Button>
        )}

        <div className="flex items-center justify-between text-[11px]">
          <Link to="/forgot-password" className="text-foreground-muted hover:text-foreground underline">
            Forgot password?
          </Link>
          <Link to={selectedRole ? `/register?role=${selectedRole}` : '/register'} className="text-foreground-muted hover:text-foreground">
            Don&apos;t have an account? <span className="underline">Sign Up</span>
          </Link>
        </div>
      </form>

      <div className="text-center">
        <Link to="/role-selection" className="text-xs text-foreground-muted hover:text-foreground inline-flex items-center gap-1.5">
          Choose another role
        </Link>
      </div>

      <div className="text-center">
        <Link to="/" className="text-xs text-foreground-muted hover:text-foreground underline">
          Back to home
        </Link>
      </div>
    </div>
  );
};
