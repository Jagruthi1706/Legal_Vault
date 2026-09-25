import React from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';

export const CalendarPage: React.FC = () => (
  <div className="mx-auto max-w-5xl space-y-6">
    <Breadcrumb items={[{ label: 'Calendar' }]} />
    <div className="rounded-xl border border-lv-border bg-lv-surface p-6">
      <h1 className="font-heading text-xl font-extrabold">Hearing calendar</h1>
      <p className="mt-1 text-xs text-lv-muted">A court cause-list integration is not configured. Authorized case activity remains available in each workspace.</p>
    </div>
    <EmptyState
      title="Not configured"
      description="Legal Vault does not invent hearing dates. When a calendar source is connected, listings will appear here."
      action={<Link to="/app/cases"><Button size="sm" variant="outline">Open cases</Button></Link>}
    />
  </div>
);
