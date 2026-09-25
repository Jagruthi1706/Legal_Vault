import React from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '../../components/common/Breadcrumb';

export const BlockchainLogsPage: React.FC = () => (
  <div className="space-y-6 max-w-5xl mx-auto">
    <Breadcrumb items={[{ label: 'Audit trail' }]} />
    <div className="p-6 bg-surface border rounded-xl space-y-2">
      <h1 className="text-xl font-extrabold font-heading">Case-scoped audit trail</h1>
      <p className="text-xs text-foreground-muted">
        Audit logs are case-scoped and append-only. Open an authorized case workspace to view activity, verifications, and tamper comparisons. This page does not invent system-wide logs.
      </p>
      <Link to="/app/cases" className="text-xs font-semibold underline">Go to cases</Link>
    </div>
  </div>
);
