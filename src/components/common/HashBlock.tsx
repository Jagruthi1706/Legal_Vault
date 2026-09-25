import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { clsx } from 'clsx';

export const HashBlock: React.FC<{
  label?: string;
  value?: string | null;
  className?: string;
}> = ({ label = 'SHA-256', value, className }) => {
  const [copied, setCopied] = useState(false);
  if (!value) {
    return <div className={clsx('lv-tech px-3 py-2 text-[11px] text-foreground-muted', className)}>Hash unavailable</div>;
  }

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={clsx('lv-tech px-3 py-2', className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="lv-label">{label}</span>
        <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 text-[11px] text-foreground-muted hover:text-foreground" aria-label="Copy hash">
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code className="block break-all text-[11px] leading-relaxed text-foreground">{value}</code>
    </div>
  );
};
