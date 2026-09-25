import React, { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { MessageAttachment } from '../../types';
import { attachmentKind, attachmentKindLabel, attachmentSizeLabel } from './copilotComposerUtils';

/**
 * Renders the attachments of a sent user message as compact clickable file
 * cards, displayed above the message text, and opens an in-app preview dialog
 * on click.
 *
 * Purely presentational: opening a preview never triggers an AI request. The
 * preview uses a local object URL created from the already-selected File and
 * revoked as soon as the dialog closes (no upload, no new storage).
 *
 * PDFs render in the browser's native PDF viewer inside an iframe. Other
 * formats (e.g. DOCX) cannot be rendered natively by the browser, so the
 * dialog shows the file details with an honest download action instead of
 * pretending a rendered preview exists.
 */
export const MessageAttachmentList: React.FC<{ attachments: MessageAttachment[] }> = ({
  attachments,
}) => {
  const [preview, setPreview] = useState<MessageAttachment | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // One object URL at a time: created when the preview opens, revoked when it
  // closes (or when the component unmounts) so no blob URL leaks.
  useEffect(() => {
    if (!preview) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(preview.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  const previewIsPdf = preview ? attachmentKind(preview.name, preview.mimeType) === 'pdf' : false;
  const previewMeta = preview
    ? `${attachmentKindLabel(preview.name, preview.mimeType)}${
        preview.size > 0 ? ` · ${attachmentSizeLabel(preview.size)}` : ''
      }`
    : undefined;

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        {attachments.map((attachment, index) => (
          <button
            key={`${attachment.name}-${index}`}
            type="button"
            onClick={() => setPreview(attachment)}
            title="Open preview"
            aria-label={`Preview ${attachment.name}`}
            className="flex max-w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-left shadow-2xs transition-colors duration-150 hover:border-primary"
          >
            <FileText className="h-4 w-4 shrink-0 text-foreground-muted" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {attachment.name}
              </span>
              <span className="block font-mono text-[10px] text-foreground-muted">
                {attachmentKindLabel(attachment.name, attachment.mimeType)}
                {attachment.size > 0 ? ` · ${attachmentSizeLabel(attachment.size)}` : ''}
              </span>
            </span>
          </button>
        ))}
      </div>

      <Dialog
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.name ?? ''}
        description={previewMeta}
        maxWidth="4xl"
      >
        {preview && objectUrl && previewIsPdf ? (
          <iframe
            src={objectUrl}
            title={preview.name}
            className="h-[70vh] w-full rounded-md border border-border"
          />
        ) : (
          preview !== null && (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-foreground-muted">
                In-browser preview is not available for this file type. Download the original file
                to view it — the chat stays open behind this dialog.
              </p>
              <a
                href={objectUrl ?? '#'}
                download={preview.name}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition-colors duration-150 hover:border-primary"
              >
                <Download className="h-4 w-4" />
                Download {preview.name}
              </a>
            </div>
          )
        )}
      </Dialog>
    </>
  );
};
