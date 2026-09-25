import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="flex items-start gap-2 rounded-[8px] border border-danger/20 bg-danger-soft px-3 py-3 text-xs text-danger">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
    <span>{message}</span>
  </div>
);
