import React from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';

export const DraftGeneratorPage: React.FC = () => (
  <div className="mx-auto max-w-5xl space-y-6">
    <Breadcrumb items={[{ label: 'AI Legal Draft Generator' }]} />
    <div className="rounded-xl border border-lv-border bg-lv-surface p-6">
      <h1 className="font-heading text-xl font-extrabold">Legal draft generator</h1>
      <p className="mt-1 text-xs text-lv-muted">Automatic petition drafting is not a live capability. This page is an intentional configuration boundary, not a broken feature.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-lv-border bg-lv-surface p-4 text-xs">
        <h2 className="font-heading font-extrabold">Current</h2>
        <p className="mt-2 text-lv-muted">Case-scoped copilot can summarize authorized records and retrieve licensed authorities with sources.</p>
      </div>
      <div className="rounded-xl border border-lv-border bg-lv-surface p-4 text-xs">
        <h2 className="font-heading font-extrabold">Unavailable</h2>
        <p className="mt-2 text-lv-muted">Court-ready petition generation, invented facts, and unsigned filings are not offered.</p>
      </div>
      <div className="rounded-xl border border-lv-border bg-lv-surface p-4 text-xs">
        <h2 className="font-heading font-extrabold">Future</h2>
        <p className="mt-2 text-lv-muted">Grounded drafting templates could be added later without inventing evidence or citations.</p>
      </div>
    </div>
    <EmptyState
      title="Drafting not configured"
      description="Use the case workspace copilot for grounded answers. It will not generate fake petitions."
      action={<Link to="/app/cases"><Button size="sm" variant="ai">Open case copilot</Button></Link>}
    />
  </div>
);
