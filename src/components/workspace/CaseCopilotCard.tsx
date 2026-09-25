import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '../common/Button';
import { TrustChecklist } from '../common/TrustChecklist';
import { useCopilot } from '../../contexts/CopilotContext';
import { aiApi, type AIOperation } from '../../services/aiApi';
import { CopilotComposer } from '../copilot/CopilotComposer';

const GROUPS: Array<{ label: string; items: Array<{ label: string; prompt: string; operation: AIOperation }> }> = [
  {
    label: 'Understand',
    items: [
      { label: 'Summarize case', prompt: 'Summarize this case from authorized records.', operation: 'summarize' },
      { label: 'Summarize evidence', prompt: 'Summarize the selected evidence in this case.', operation: 'analyze_evidence' },
    ],
  },
  {
    label: 'Research',
    items: [
      { label: 'Find legal authorities', prompt: 'Find Supreme Court or High Court judgments relevant to this case concerning bail and personal liberty.', operation: 'research' },
      { label: 'Explain authorities', prompt: 'Explain the retrieved legal authorities without treating them as binding on this case.', operation: 'research' },
      { label: 'Compare facts to authorities', prompt: 'Compare authorized case facts against retrieved legal authorities. Do not treat retrieval as binding precedent.', operation: 'compare_authorities' },
    ],
  },
];

const providerCopy = (mode?: string) => {
  if (mode === 'GEMINI') return 'AI · GEMINI';
  if (mode === 'OPENAI') return 'AI · OPENAI';
  if (mode === 'MOCK') return 'AI · DEVELOPMENT MODE';
  return 'AI · SERVER PROVIDER';
};

export const CaseCopilotCard: React.FC<{
  caseId: string;
  caseNumber: string;
  title: string;
}> = ({ caseId, caseNumber, title }) => {
  const { sendMessage, messages, isThinking, lastError, setIsOpen, isOpen } = useCopilot();
  const [prompt, setPrompt] = useState('');
  const [serverMode, setServerMode] = useState<string>();
  const lastAssistant = [...messages].reverse().find((item) => item.sender === 'assistant');
  const mode = lastAssistant?.providerMode || serverMode;

  useEffect(() => {
    void aiApi.status(caseId).then((res) => setServerMode(res.mode)).catch(() => undefined);
  }, [caseId]);

  return (
    <section className="space-y-3 rounded-[10px] border border-primary/20 bg-ai-soft/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-ai" /> Case AI Copilot
          </h2>
          <p className="mt-1 text-xs text-foreground-muted">
            Working on <span className="font-mono font-semibold">{caseNumber}</span> — {title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-lv-ai/30 bg-lv-ai/10 px-2 py-0.5 font-mono text-[10px] font-bold text-lv-ai">
            {providerCopy(mode)}
          </span>
          <Button size="sm" variant="outline" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? 'Hide panel' : 'Open panel'}
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-lv-faint">
        Case-scoped only. This copilot cannot authorize, mutate records, or verify blockchain facts. Not legal advice.
      </p>

      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="lv-label">{group.label}</div>
          <div className="flex flex-wrap gap-2">
            {group.items.map((action) => (
              <Button key={action.label} size="sm" variant="secondary" disabled={isThinking} onClick={() => sendMessage(action.prompt, action.operation)}>
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ))}

      <CopilotComposer compact className="space-y-2" />

      {isThinking && (
        <div className="flex items-center gap-2 text-xs text-lv-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Retrieving authorized case documents and licensed authorities…
        </div>
      )}
      {lastError && <div className="rounded border border-lv-danger/30 p-2 text-xs text-lv-danger">{lastError}</div>}

      {lastAssistant && (
        <div className="space-y-3 border-t border-lv-border pt-3 text-xs">
          <TrustChecklist
            title="AI trust"
            tone="ai"
            items={[
              { label: 'Case sources', ok: (lastAssistant.caseSources?.length || 0) > 0, detail: String(lastAssistant.caseSources?.length || 0) },
              { label: 'Legal authorities', ok: (lastAssistant.legalSources?.length || 0) > 0, detail: String(lastAssistant.legalSources?.length || 0) },
              { label: 'Unsupported claims', ok: true, detail: String(lastAssistant.unsupported?.length || 0) },
              { label: 'Citation coverage', ok: (lastAssistant.caseSources?.length || 0) + (lastAssistant.legalSources?.length || 0) > 0, detail: String((lastAssistant.caseSources?.length || 0) + (lastAssistant.legalSources?.length || 0)) },
            ]}
          />
          <Section title="AI analysis" body={lastAssistant.explanation || lastAssistant.text} />
          {lastAssistant.facts && lastAssistant.facts.length > 0 && <List title="Facts from sources" items={lastAssistant.facts} />}
          <List title="Case evidence" items={lastAssistant.caseSources || []} empty="No case evidence sources were returned." />
          <List title="Legal authorities" items={lastAssistant.legalSources || []} empty="No licensed authorities were returned." />
          <List title="Limitations" items={lastAssistant.unsupported?.length ? lastAssistant.unsupported : lastAssistant.status === 'unavailable' ? [lastAssistant.text] : lastAssistant.warnings || []} empty="No limitations were flagged." />
          {lastAssistant.warnings?.map((warning) => (
            <p key={warning} className="text-[10px] text-lv-warning">{warning}</p>
          ))}
        </div>
      )}
    </section>
  );
};

const Section: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div>
    <div className="lv-label">{title}</div>
    <div className="whitespace-pre-wrap leading-relaxed">{body}</div>
  </div>
);

const List: React.FC<{ title: string; items: string[]; empty?: string }> = ({ title, items, empty }) => (
  <div>
    <div className="lv-label">{title}</div>
    {items.length ? (
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="rounded bg-lv-elevated px-2 py-0.5 font-mono text-[10px]">{item}</span>
        ))}
      </div>
    ) : (
      <p className="text-[10px] text-lv-faint">{empty}</p>
    )}
  </div>
);
