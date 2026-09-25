import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  Trash2,
  X,
  BookOpen,
  Scale,
  ShieldCheck,
  Zap,
  Bot,
  User,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Info,
  Mic,
  Pin,
  MessageSquare,
  History,
  Paperclip,
  Upload,
  FileIcon,
} from 'lucide-react';
import { useCopilot } from '../../contexts/CopilotContext';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { CopilotComposer } from '../copilot/CopilotComposer';
import { MessageAttachmentList } from '../copilot/MessageAttachmentList';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const AICopilotPanel: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    messages,
    sendMessage,
    isThinking,
    clearChat,
    panelWidth,
    setPanelWidth,
    activeCaseContext,
  } = useCopilot();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // Handle panel width resizer drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const handleMouseMove = (event: MouseEvent) => {
      const newWidth = window.innerWidth - event.clientX;
      if (newWidth >= 320 && newWidth <= 640) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

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
      toast.success('Pinned conversation item');
    }
  };

  const handleVoiceClick = () => {
    setIsListening(true);
    toast('Voice listening simulation active...', { icon: '🎙️' });
    setTimeout(() => {
      setIsListening(false);
      toast('Voice dictation is not configured.', { icon: '🎙️' });
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <aside
      style={{ width: `${panelWidth}px` }}
      className="relative flex flex-col h-screen bg-surface border-l border-border z-20 shrink-0 select-none transition-all duration-75 shadow-lg"
    >
      {/* Resizer Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={clsx(
          'absolute left-0 top-0 bottom-0 z-30 w-1.5 cursor-col-resize transition-colors hover:bg-primary',
          isResizing && 'bg-primary'
        )}
        title="Drag to resize AI Copilot panel"
      />

      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border bg-surface-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-xs">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              Case AI Copilot
              <span className="rounded border border-primary/20 bg-ai-soft px-1.5 font-mono text-[9px] font-semibold text-ai">
                {(() => {
                  const mode = [...messages].reverse().find((item) => item.providerMode)?.providerMode;
                  if (mode === 'GEMINI') return 'AI · GEMINI';
                  if (mode === 'OPENAI') return 'AI · OPENAI';
                  if (mode === 'MOCK') return 'AI · DEVELOPMENT MODE';
                  return 'AI · SERVER PROVIDER';
                })()}
              </span>
            </div>
            <div className="text-[10px] text-foreground-muted">
              {activeCaseContext?.caseNumber
                ? `Case ${activeCaseContext.caseNumber}`
                : 'No case selected'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={clsx(
              'rounded-[7px] p-1.5 text-foreground-muted transition-colors duration-150 hover:bg-surface-subtle hover:text-foreground',
              showHistory && 'bg-surface-subtle text-foreground'
            )}
            title="Recent Chat Sessions"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={clearChat}
            className="rounded-[7px] p-1.5 text-foreground-muted transition-colors duration-150 hover:bg-surface-subtle hover:text-foreground"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-[7px] p-1.5 text-foreground-muted transition-colors duration-150 hover:bg-surface-subtle hover:text-foreground"
            title="Close AI Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recent Chats Drawer Dropdown */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border bg-surface-subtle p-3 text-xs space-y-2 overflow-hidden"
          >
            <div className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-foreground" />
              Development provider
            </div>
            <p className="text-[11px] text-foreground-muted">
              With a case open, this copilot answers only from that case's authorized documents and trusted legal authorities. Without a case, it can answer general legal questions from the built-in trusted knowledge base or questions about files you attach.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
        {messages.length === 0 && !isThinking && (
          <div className="p-3 rounded-xl border border-border bg-surface-subtle text-[11px] text-foreground-muted space-y-1">
            <div className="font-bold text-foreground uppercase tracking-wider text-[10px]">Case-scoped mock copilot</div>
            <p>
              {activeCaseContext
                ? `Ask about ${activeCaseContext.caseNumber || 'this case'}. Answers use only authorized case documents.`
                : 'Open a case workspace to ask case-scoped questions. This provider cannot search other cases or the web.'}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* User message */}
            {msg.sender === 'user' ? (
              <div className="flex flex-col items-end gap-2">
                {msg.attachments && msg.attachments.length > 0 && (
                  <MessageAttachmentList attachments={msg.attachments} />
                )}
                <div className="max-w-[85%] bg-primary text-white p-3.5 rounded-2xl rounded-tr-xs font-medium shadow-2xs">
                  {msg.text}
                  <div className="text-[9px] opacity-60 text-right mt-1 font-mono">
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ) : (
              /* Assistant message */
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div
                  className={clsx(
                    'flex-1 bg-surface-subtle border p-3.5 rounded-2xl rounded-tl-xs space-y-3 transition-all',
                    pinnedId === msg.id
                      ? 'border-primary shadow-sm'
                      : 'border-border'
                  )}
                >
                  {/* Pinned Tag */}
                  {pinnedId === msg.id && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-foreground uppercase tracking-wider">
                      <Pin className="w-3 h-3 fill-current" />
                      Pinned Analysis
                    </div>
                  )}

                  {/* Text */}
                  <div className="text-foreground leading-relaxed whitespace-pre-wrap font-sans text-xs">
                    {msg.text}
                  </div>

                  {/* Applicable Laws Pills */}
                  {msg.applicableLaws && msg.applicableLaws.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="text-[10px] font-bold text-foreground-muted mb-1.5 uppercase tracking-wider flex items-center gap-1 font-heading">
                        <Scale className="w-3 h-3 text-foreground" />
                        Applicable Statutory Provisions
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.applicableLaws.map((law, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-surface text-foreground text-[10px] font-mono font-semibold border border-border"
                          >
                            {law}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sources Badges */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="text-[10px] font-bold text-foreground-muted mb-1.5 uppercase tracking-wider flex items-center gap-1 font-heading">
                        <BookOpen className="w-3 h-3 text-foreground" />
                        Case source documents
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((src, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-surface-subtle text-foreground text-[10px] font-mono border border-border"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.legalSources && msg.legalSources.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="text-[10px] font-bold text-foreground-muted mb-1.5 uppercase tracking-wider flex items-center gap-1 font-heading">
                        <Scale className="w-3 h-3 text-foreground" />
                        Legal authorities
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.legalSources.map((src, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-primary text-white text-[10px] font-mono"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.warnings && msg.warnings.length > 0 && (
                    <div className="text-[10px] text-foreground-muted space-y-0.5">
                      {msg.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  )}

                  {/* Footer Meta & Confidence */}
                  <div className="flex items-center justify-between pt-2 border-t border-border text-[10px] text-foreground-muted">
                    {(msg.status || msg.confidenceScore) && (
                      <span className="flex items-center gap-1 font-mono text-success dark:text-emerald-400 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-success" />
                        {msg.status ? msg.status : 'status'}
                        {msg.confidenceScore ? ` · ${(msg.confidenceScore * 100).toFixed(0)}%` : ''}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePin(msg.id)}
                        className={clsx(
                          'p-1 rounded hover:text-foreground transition-colors',
                          pinnedId === msg.id ? 'text-foreground' : 'text-foreground-muted'
                        )}
                        title="Pin Conversation"
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="p-1 rounded hover:text-foreground transition-colors"
                        title="Copy Answer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <span className="font-mono">{msg.timestamp}</span>
                    </div>
                  </div>

                  {/* Suggested Quick Questions */}
                  {msg.suggestedActions && (
                    <div className="pt-2 space-y-1">
                      <div className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3 text-foreground" />
                        Suggested Follow-Up
                      </div>
                      <div className="space-y-1">
                        {msg.suggestedActions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => sendMessage(action)}
                            className="w-full text-left px-2.5 py-1.5 rounded bg-surface border border-border text-[11px] text-foreground hover:border-primary transition-all flex items-center justify-between group font-medium"
                          >
                            <span className="truncate">{action}</span>
                            <ChevronRight className="w-3 h-3 text-foreground-muted group-hover:translate-x-0.5 transition-transform" />
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
          <div className="flex items-center gap-2 text-xs text-foreground font-medium p-3 bg-surface-subtle rounded-xl border border-border animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin text-foreground" />
            <span>Processing your question…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-border bg-surface-subtle space-y-3">
        <CopilotComposer />
        <div className="text-[10px] text-foreground-muted text-center mt-2 flex items-center justify-center gap-1 font-mono">
          <Info className="w-3 h-3 text-foreground-muted" />
          <span>Not legal advice · case evidence and authorities stay separate</span>
        </div>
      </div>
    </aside>
  );
};
