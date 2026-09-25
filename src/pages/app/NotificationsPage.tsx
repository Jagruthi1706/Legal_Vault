import React from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';

export const NotificationsPage: React.FC = () => (
  <div className="mx-auto max-w-4xl space-y-6">
    <Breadcrumb items={[{ label: 'Notification Center' }]} />
    <div className="rounded-xl border border-lv-border bg-lv-surface p-5">
      <h1 className="font-heading text-xl font-extrabold">Notifications</h1>
      <p className="mt-2 text-xs text-lv-muted">
        A push/notification service is not configured. Case activity, audit events, verifications, and tamper comparisons remain in each authorized case workspace.
      </p>
    </div>
    <EmptyState
      title="Inbox not configured"
      description="No notification records are stored. Open a case workspace to review real activity."
      action={<Link to="/app/cases"><Button size="sm" variant="outline">Open cases</Button></Link>}
    />
  </div>
);
