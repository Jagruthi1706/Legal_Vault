import React from 'react';
import { clsx } from 'clsx';

export const PageHeader: React.FC<{
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ kicker, title, description, actions }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0">
      {kicker && <div className="lv-label mb-1">{kicker}</div>}
      <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-[22px]">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-xs text-foreground-muted">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="lv-label mb-2">{children}</div>
);

export const Tabs: React.FC<{
  tabs: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}> = ({ tabs, value, onChange }) => (
  <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={value === tab.id}
        onClick={() => onChange(tab.id)}
        className={clsx(
          'shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors duration-150',
          value === tab.id
            ? 'border-primary text-foreground'
            : 'border-transparent text-foreground-muted hover:text-foreground',
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
