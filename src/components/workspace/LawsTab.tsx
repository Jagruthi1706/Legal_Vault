import React from 'react';
import { BookOpen, Scale, Sparkles } from 'lucide-react';
import { ApplicableLaw } from '../../types';

interface LawsTabProps {
  laws: ApplicableLaw[];
}

export const LawsTab: React.FC<LawsTabProps> = ({ laws }) => {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-foreground-muted uppercase tracking-wider font-heading">
        Applicable Statutory Acts & Sections
      </div>

      <div className="space-y-2.5">
        {laws.map((law, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-xl bg-surface border border-border space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-foreground">
                {law.code}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-subtle text-foreground text-[10px] font-mono font-semibold border border-[#E7E5E4] dark:border-[#333]">
                Relevance: {(law.relevanceScore * 100).toFixed(0)}%
              </span>
            </div>

            <div className="text-xs font-semibold text-foreground">
              {law.title}
            </div>

            <p className="text-xs text-foreground-muted leading-relaxed">
              {law.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
