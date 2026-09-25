import React from 'react';

export const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-1 gap-1 border-b border-border py-2 last:border-b-0 sm:grid-cols-[128px_1fr] sm:gap-3">
    <div className="text-[11px] text-foreground-muted">{label}</div>
    <div className="min-w-0 break-words text-xs text-foreground">{children}</div>
  </div>
);
