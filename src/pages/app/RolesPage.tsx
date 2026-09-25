import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { useAuth } from '../../contexts/AuthContext';

export const RolesPage: React.FC = () => {
  const { user } = useAuth();
  const matrix = [
    { role: 'CLIENT', allowed: ['View permitted cases and documents', 'Upload permitted evidence'], restricted: ['Custody anchoring', 'Official verification', 'Tamper detection', 'User management'] },
    { role: 'LAWYER', allowed: ['View and manage permitted cases', 'Upload and submit evidence', 'Anchor document custody hashes'], restricted: ['Official verification', 'Tamper detection', 'User management'] },
    { role: 'JUDGE', allowed: ['View assigned cases', 'Review evidence', 'Verify blockchain integrity', 'Perform tamper detection'], restricted: ['User management', 'Alter blockchain history'] },
    { role: 'ADMIN', allowed: ['System-wide visibility', 'User management', 'Role management', 'Audit and system monitoring'], restricted: ['Official judicial verification', 'Tamper detection', 'Alter blockchain history'] }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb items={[{ label: 'Roles & Permission Matrix' }]} />

      <div className="p-6 bg-surface border border-border rounded-xl shadow-xs space-y-2">
        <h1 className="text-xl font-extrabold font-heading text-foreground">
          Role-Based Access Control (RBAC)
        </h1>
        <p className="text-xs text-foreground-muted">
          Authenticated role: <strong>ROLE: {user?.role.toUpperCase() ?? 'UNKNOWN'}</strong>. Restrictions are enforced by the backend; interface visibility is informational.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matrix.map((item, idx) => (
          <div key={idx} className="p-5 bg-surface border border-border rounded-xl space-y-3">
            <h3 className="font-heading font-extrabold text-sm text-foreground">
              {item.role} Persona
            </h3>
            <div className="space-y-1.5 text-xs text-foreground">
              {item.allowed.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{p}</span>
                </div>
              ))}
              {item.restricted.map((p, i) => (
                <div key={`restricted-${i}`} className="flex items-center gap-2 text-foreground-muted">
                  <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
