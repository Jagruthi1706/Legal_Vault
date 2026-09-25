import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  User,
  Briefcase,
  Scale,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

type EntryRole = 'client' | 'lawyer' | 'judge';

interface RoleOption {
  role: EntryRole;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'client',
    label: 'Client',
    description: 'For people seeking legal assistance',
    icon: <User className="w-6 h-6" />,
  },
  {
    role: 'lawyer',
    label: 'Lawyer',
    description: 'For legal professionals and case work',
    icon: <Briefcase className="w-6 h-6" />,
  },
  {
    role: 'judge',
    label: 'Judge',
    description: 'For judicial workflows and legal research',
    icon: <Scale className="w-6 h-6" />,
  },
];

const RoleSelectionPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<EntryRole | null>(null);
  const [searchParams] = useSearchParams();

  const returnTo = searchParams.get('returnTo');

  const handleRoleSelect = (role: EntryRole) => {
    setSelectedRole(role);
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
  };

  const roleLabel = selectedRole
    ? ROLE_OPTIONS.find((r) => r.role === selectedRole)?.label ?? selectedRole
    : null;

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-[#0B0B0B] dark:bg-[#F3F3F2] text-white dark:text-[#111111] flex items-center justify-center mx-auto shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold font-heading text-foreground">
            Welcome to Legal Vault
          </h1>
          <p className="text-sm text-foreground-muted">
            {selectedRole
              ? `Continue as ${roleLabel}`
              : 'Choose your role to continue'}
          </p>
        </div>

        {/* Role Selection View */}
        {!selectedRole && (
          <div className="space-y-3">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.role}
                type="button"
                onClick={() => handleRoleSelect(option.role)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-surface hover:bg-surface-subtle hover:border-primary/40 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-foreground group-hover:text-primary transition-colors shrink-0">
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {option.label}
                  </div>
                  <div className="text-xs text-foreground-muted">
                    {option.description}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:text-primary transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Login / Signup View (after role selected) */}
        {selectedRole && (
          <div className="space-y-4">
            {/* Selected role indicator */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-foreground-muted">Choose Role:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold">
                {ROLE_OPTIONS.find((r) => r.role === selectedRole)?.icon}
                {roleLabel}
              </span>
            </div>

            {/* Auth option buttons */}
            <div className="space-y-3">
              <Link to={`/login?role=${selectedRole}`} className="block">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Log In
                </Button>
              </Link>

              <Link to={`/register?role=${selectedRole}`} className="block">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Sign Up
                </Button>
              </Link>
            </div>

            {/* Back to role selection */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleBackToRoles}
                className="inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Choose another role
              </button>
            </div>
          </div>
        )}

        {/* Back to landing */}
        <div className="text-center">
          <Link
            to={returnTo && returnTo.startsWith('/') ? returnTo : '/'}
            className="text-xs text-foreground-muted hover:text-foreground underline transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionPage;
