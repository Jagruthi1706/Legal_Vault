import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface BlockchainBadgeProps {
  hash?: string;
  blockNumber?: number;
  verified?: boolean;
  className?: string;
  compact?: boolean;
}

export const BlockchainBadge: React.FC<BlockchainBadgeProps> = ({
  hash,
  blockNumber,
  verified = false,
  className,
  compact = false,
}) => {
  const label = compact
    ? verified ? 'Anchored' : 'Custody'
    : hash
      ? `Tx ${hash.slice(0, 10)}…`
      : blockNumber
        ? `Block #${blockNumber}`
        : 'No on-chain record';

  return (
    <div className={clsx('inline-flex items-center gap-1.5 rounded-full border border-info/20 bg-info-soft px-2.5 py-1 font-mono text-[11px] text-info', className)}>
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="max-w-[180px] truncate">{label}</span>
    </div>
  );
};
