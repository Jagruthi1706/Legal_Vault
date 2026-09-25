import React from 'react';
import { Sparkles } from 'lucide-react';
import { Case } from '../../types';
import { Card } from '../common/Card';

interface AISummaryTabProps {
  currentCase: Case;
}

export const AISummaryTab: React.FC<AISummaryTabProps> = ({ currentCase }) => {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-surface-subtle border text-foreground flex items-start gap-3">
        <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-heading font-extrabold text-sm">Case-scoped AI</h4>
          <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
            Outcome probabilities, disposal timelines, and invented precedent counts are not generated. Use the case workspace copilot, which answers only from authorized records and licensed authorities.
          </p>
        </div>
      </div>
      <Card className="p-4 text-xs text-foreground-muted">
        Case: {currentCase.caseNumber} — {currentCase.title}. Synthetic AI findings for this panel are disabled.
      </Card>
    </div>
  );
};
