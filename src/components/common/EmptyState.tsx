import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action }) => (
  <div className="rounded-[8px] border border-dashed border-border bg-surface-subtle px-5 py-8 text-center">
    <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-[6px] border border-border bg-surface text-foreground-muted">
      {icon || <Inbox className="h-4 w-4" aria-hidden />}
    </div>
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground-muted">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
