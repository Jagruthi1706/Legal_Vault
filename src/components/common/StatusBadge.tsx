import React from 'react';
import { clsx } from 'clsx';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const toneFor = (status: string) => {
  const value = status.toUpperCase().replace(/\s+/g, '_');
  if (['ANCHORED', 'CONFIRMED', 'VERIFIED', 'ACCEPTED', 'UNMODIFIED', 'ACTIVE', 'CLOSED', 'DISPOSED'].includes(value)) {
    return 'border-success/20 bg-success-soft text-success';
  }
  if (['TAMPERED', 'REJECTED', 'HASH_MISMATCH', 'MISMATCH', 'MODIFIED', 'FAILED'].includes(value)) {
    return 'border-danger/20 bg-danger-soft text-danger';
  }
  if (['FILED', 'UPLOADED', 'INFO'].includes(value)) {
    return 'border-info/20 bg-info-soft text-info';
  }
  if (['PENDING', 'DRAFT', 'HEARING', 'UNDER_REVIEW', 'NOT_ANCHORED', 'SUBMITTED'].includes(value)) {
    return 'border-warning/20 bg-warning-soft text-warning';
  }
  return 'border-border bg-surface-subtle text-foreground-muted';
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full border font-medium uppercase tracking-wide whitespace-nowrap',
      toneFor(status),
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
    )}
  >
    {status.replace(/_/g, ' ')}
  </span>
);
