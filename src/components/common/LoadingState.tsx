import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center gap-2 py-6 text-xs text-foreground-muted" role="status" aria-live="polite">
    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
    {label}
  </div>
);
