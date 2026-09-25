import React from 'react';
import { Check, Minus } from 'lucide-react';

export interface TrustItem {
  label: string;
  ok: boolean;
  detail?: string;
}

export const TrustChecklist: React.FC<{ title: string; items: TrustItem[]; tone?: 'success' | 'chain' | 'ai' }> = ({
  title,
  items,
}) => (
  <div className="rounded-[8px] border border-border bg-surface-subtle p-3">
    <div className="lv-label mb-2">{title}</div>
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-2 text-xs text-foreground">
          {item.ok ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-label="complete" />
          ) : (
            <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-label="not recorded" />
          )}
          <span>
            {item.label}
            {item.detail && <span className="ml-1 text-foreground-muted">· {item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  </div>
);
