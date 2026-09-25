import React from 'react';
import { ExternalLink, Gavel, Award } from 'lucide-react';
import { ReferencedJudgment } from '../../types';

interface JudgmentsTabProps {
  judgments: ReferencedJudgment[];
}

export const JudgmentsTab: React.FC<JudgmentsTabProps> = ({ judgments }) => {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-foreground-muted uppercase tracking-wider font-heading">
        Referenced Landmark Judgments & Precedents
      </div>

      <div className="space-y-3">
        {judgments.map((rj) => (
          <div
            key={rj.id}
            className="p-4 rounded-xl bg-surface border border-border space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-extrabold text-foreground">
                {rj.citation}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#FAFAF8] dark:bg-[#222225] border border-border text-[10px] font-medium text-foreground-muted">
                {rj.court} • {rj.bench}
              </span>
            </div>

            <h4 className="font-heading font-extrabold text-xs text-foreground">
              {rj.title}
            </h4>

            <div className="p-2.5 rounded bg-surface-subtle border-l-2 border-l-[#111111] dark:border-l-white text-xs text-foreground-muted italic leading-relaxed">
              <strong className="not-italic text-foreground font-semibold block text-[10px] uppercase font-mono mb-0.5">
                Ratio Decidendi:
              </strong>
              "{rj.ratioDecidendi}"
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
