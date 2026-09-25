import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldCheck,
  Scale,
  Zap,
  Copy,
  Check,
  Pin,
  Mic,
  Download,
  BookOpen,
  Trash2,
  ChevronRight,
  Info
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { useCopilot } from '../../contexts/CopilotContext';
import { Button } from '../../components/common/Button';
import toast from 'react-hot-toast';
import { CopilotComposer } from '../../components/copilot/CopilotComposer';
import { MessageAttachmentList } from '../../components/copilot/MessageAttachmentList';

export const AICopilotPage: React.FC = () => {
  const { messages, sendMessage, isThinking, clearChat, activeCaseContext } = useCopilot();
  const lastAssistant = [...messages].reverse().find((item) => item.sender === 'assistant');
  const providerLabel = lastAssistant?.providerMode === 'GEMINI' ? 'AI · GEMINI' : lastAssistant?.providerMode === 'OPENAI' ? 'AI · OPENAI' : lastAssistant?.providerMode === 'MOCK' ? 'AI · DEVELOPMENT MODE' : 'AI · SERVER PROVIDER';
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Response copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTogglePin = (id: string) => {
    if (pinnedId === id) {
      setPinnedId(null);
      toast('Unpinned conversation item', { icon: '📌' });
    } else {
      setPinnedId(id);
      toast.success('Pinned conversation item to active workspace');
    }
  };

  const handleVoiceDictation = () => {
    toast.error('Voice dictation is not configured.');
  };

  const handleExportChat = () => {
    const chatText = messages
      .map((m) => `[${m.timestamp}] ${m.sender.toUpperCase()}:\n${m.text}\n`)
      .join('\n----------------------------------------\n');

    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LegalVault_AI_Research_Export_${Date.now()}.txt`;
    a.click();
    toast.success('AI Research Thread exported as .TXT');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb items={[{ label: 'Judicial AI Assistant' }]} />

      {/* Header */}
      <div className="p-6 bg-surface border border-border rounded-2xl shadow-2xs space-y-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold font-heading text-foreground uppercase tracking-tight flex items-center gap-2">
              Legal Vault AI Workspace
              <span className="rounded bg-lv-ai/15 px-2 py-0.5 font-mono text-[10px] font-bold text-lv-ai">
                {providerLabel}
              </span>
            </h1>
            <p className="text-xs text-foreground-muted">
              {activeCaseContext
                ? `Case-scoped copilot for ${activeCaseContext.caseNumber || activeCaseContext.caseId}.`
                : 'Ask a question or attach a file. Open a case workspace for case-scoped analysis of authorized records.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportChat} leftIcon={<Download className="w-3.5 h-3.5" />}>
            Export Thread
          </Button>
          <Button variant="ghost" size="sm" onClick={clearChat} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
            Clear History
          </Button>
        </div>
      </div>

      {/* Unified AI Chat Canvas */}
      <div className="bg-surface border border-border rounded-2xl p-6 min-h-[540px] flex flex-col justify-between shadow-xs space-y-6">
        <div className="space-y-5 overflow-y-auto max-h-[580px] pr-2">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {msg.sender === 'user' ? (
                <div className="flex flex-col items-end gap-2">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <MessageAttachmentList attachments={msg.attachments} />
                  )}
                  <div className="max-w-[80%] bg-primary text-white p-4 rounded-2xl rounded-tr-xs text-xs font-medium shadow-2xs">
                    {msg.text}
                    <div className="text-[9px] opacity-60 text-right mt-1 font-mono">
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div
                    className={`flex-1 bg-surface-subtle border p-4 rounded-2xl rounded-tl-xs space-y-3 text-xs transition-all ${
                      pinnedId === msg.id
                        ? 'border-primary shadow-sm'
                        : 'border-border'
                    }`}
                  >
                    {/* Pinned Tag */}
                    {pinnedId === msg.id && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-foreground uppercase tracking-wider font-mono">
                        <Pin className="w-3.5 h-3.5 fill-current" />
                        Pinned Precedent Research Analysis
                      </div>
                    )}

                    {/* Text Output */}
                    <div className="text-foreground leading-relaxed whitespace-pre-wrap font-sans text-xs">
                      {msg.text || (
                        <span className="animate-pulse text-foreground-muted">
                          Waiting for the mock provider…
                        </span>
                      )}
                    </div>

                    {/* Statutory Legal Authorities */}
                    {((msg.legalSources && msg.legalSources.length > 0) ||
                      (msg.applicableLaws && msg.applicableLaws.length > 0)) && (
                      <div className="pt-2 border-t border-border">
                        <div className="text-[10px] font-bold text-foreground-muted mb-1 uppercase tracking-wider flex items-center gap-1 font-heading">
                          <Scale className="w-3.5 h-3.5 text-foreground" />
                          Applicable Statutory Provisions
                        </div>
                        <p className="text-[9px] text-foreground-muted mb-1.5 font-mono">
                          Source: Statutory legal authority
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(msg.legalSources && msg.legalSources.length > 0
                            ? msg.legalSources
                            : (msg.applicableLaws ?? [])
                          ).map((law, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded bg-surface text-foreground text-[10px] font-mono font-bold border border-border"
                            >
                              {law}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Judicial Precedent Sources (actual precedents only — never case/attachment chunks) */}
                    {msg.precedentSources && msg.precedentSources.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <div className="text-[10px] font-bold text-foreground-muted mb-1 uppercase tracking-wider flex items-center gap-1 font-heading">
                          <BookOpen className="w-3.5 h-3.5 text-foreground" />
                          Judicial Precedent Sources & Citations
                        </div>
                        <p className="text-[9px] text-foreground-muted mb-1.5 font-mono">
                          Source: Judicial precedent
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.precedentSources.map((src, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded bg-surface-subtle text-foreground text-[10px] font-mono font-medium border border-border"
                            >
                              {src}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Actions & Confidence */}
                    <div className="flex items-center justify-between pt-2 border-t border-border text-[10px] text-foreground-muted">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleTogglePin(msg.id)}
                          className={`flex items-center gap-1 font-medium transition-colors ${
                            pinnedId === msg.id ? 'text-foreground font-bold' : 'hover:text-foreground'
                          }`}
                        >
                          <Pin className="w-3 h-3" />
                          <span>{pinnedId === msg.id ? 'Pinned' : 'Pin'}</span>
                        </button>

                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Response</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Follow up Suggestions */}
                    {msg.suggestedActions && (
                      <div className="pt-2 space-y-1.5">
                        <div className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-foreground" />
                          Suggested Research Follow-Ups
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.suggestedActions.map((action, i) => (
                            <button
                              key={i}
                              onClick={() => sendMessage(action)}
                              className="text-left px-3 py-2 rounded-xl bg-surface border border-border text-[11px] text-foreground hover:border-primary transition-all flex items-center justify-between group font-medium"
                            >
                              <span className="truncate">{action}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-foreground-muted group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Thinking Indicator */}
          {isThinking && (
            <div className="flex items-center gap-2.5 text-xs text-foreground font-medium p-4 bg-surface-subtle rounded-xl border border-border animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin text-foreground" />
              <span>Retrieving authorized case documents…</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="pt-4 border-t border-border">
          <CopilotComposer className="space-y-3" />
          <div className="flex items-center justify-between text-[10px] text-foreground-muted mt-2 font-mono">
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3 text-foreground" />
              Development mock or OpenAI provider · no legal advice
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
