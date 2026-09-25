import React from 'react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { useAuth } from '../../contexts/AuthContext';

export const JudgmentDraftPage: React.FC = () => {
  const { role } = useAuth();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb items={[{ label: 'Judicial Judgment Workbench' }]} />
      <div className="p-6 bg-surface border rounded-xl space-y-2">
        <h1 className="text-xl font-extrabold font-heading">Judgment drafting</h1>
        <p className="text-xs text-foreground-muted">
          HSM digital signature and automated judgment drafting are not configured.
          {role === 'judge'
            ? ' Official document review remains available in the assigned case workspace.'
            : ' This workbench does not issue judgments.'}
        </p>
      </div>
    </div>
  );
};
