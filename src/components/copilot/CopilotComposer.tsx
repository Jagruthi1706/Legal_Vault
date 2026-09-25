import React, { useEffect, useRef, useState } from 'react';
import { FileIcon, Plus, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCopilot } from '../../contexts/CopilotContext';
import { Button } from '../common/Button';
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_FILES, validateAttachmentFiles } from './copilotComposerUtils';

interface CopilotComposerProps {
  compact?: boolean;
  className?: string;
}

/** Vertical growth cap for the question entry field (~8 lines at text-xs). */
const MAX_TEXTAREA_HEIGHT_PX = 160;

export const CopilotComposer: React.FC<CopilotComposerProps> = ({ compact = false, className = '' }) => {
  const { sendMessage, isThinking, activeCaseContext } = useCopilot();
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-growing question entry: one visual line for short questions, expanding
  // (up to the cap) as the question becomes longer so long legal questions stay
  // readable while typing. Purely visual — the submitted string is unchanged.
  useEffect(() => {
    const entry = textAreaRef.current;
    if (!entry) return;
    entry.style.height = 'auto';
    entry.style.height = `${Math.min(entry.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [input]);

  const handleAttachClick = () => {
    if (isThinking) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);
    const validation = validateAttachmentFiles(nextFiles, selectedFiles);

    if (validation.errors.length > 0) {
      validation.errors.forEach((message) => toast.error(message));
    }

    setSelectedFiles(validation.valid);

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((current) => current.filter((_, entryIndex) => entryIndex !== index));
  };

  const submitMessage = () => {
    if (!input.trim() || isThinking) return;

    sendMessage(input, 'answer', selectedFiles);
    setInput('');
    setSelectedFiles([]);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitMessage();
  };

  // Preserves the previous single-line input behavior: Enter submits the
  // question exactly as before. Shift+Enter inserts a newline so long
  // multi-line questions can be composed comfortably.
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  const placeholderText = activeCaseContext
    ? 'Ask a question about the case...'
    : 'Ask a question, or attach a file to analyze it...';

  return (
    <div className={className}>
      {selectedFiles.length > 0 && (
        <div className="mb-3 rounded-xl border border-border bg-surface-subtle p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
            Selected files ({selectedFiles.length}/{MAX_ATTACHMENT_FILES})
          </div>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-[11px]">
                <div className="flex min-w-0 items-center gap-2">
                  <FileIcon className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                  <span className="truncate text-foreground">{file.name}</span>
                  <span className="shrink-0 text-foreground-muted">({(file.size / (1024 * 1024)).toFixed(1)}MB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className="shrink-0 rounded p-0.5 text-foreground-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
                  aria-label={`Remove ${file.name}`}
                  title="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <div className={`flex items-center gap-2 ${compact ? 'sm:flex-row' : ''}`}>
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={isThinking}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-lg font-bold text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Add attachment"
            title="Upload file"
          >
            <Plus className="h-4 w-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={handleFileChange}
            className="hidden"
            disabled={isThinking}
          />

          <textarea
            ref={textAreaRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholderText}
            disabled={isThinking}
            className="max-h-40 w-full resize-none rounded-xl border border-border bg-surface-subtle px-3 py-2.5 text-xs text-foreground placeholder-foreground-muted transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!input.trim() || isThinking}
            rightIcon={<Send className="h-3.5 w-3.5" />}
          >
            Query AI
          </Button>
        </div>
      </form>
    </div>
  );
};