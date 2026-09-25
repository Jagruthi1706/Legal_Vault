export const MAX_ATTACHMENT_FILES = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const validateAttachmentFiles = (incomingFiles: File[], existingFiles: File[] = []) => {
  const valid: File[] = [...existingFiles];
  const errors: string[] = [];

  for (const file of incomingFiles) {
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      errors.push(`Unsupported file type: ${file.name}`);
      continue;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      errors.push(`File too large: ${file.name} (max 25MB)`);
      continue;
    }

    valid.push(file);
  }

  if (valid.length > MAX_ATTACHMENT_FILES) {
    const trimmed = valid.slice(0, MAX_ATTACHMENT_FILES);
    errors.unshift(`Maximum ${MAX_ATTACHMENT_FILES} attachments allowed`);
    return { valid: trimmed, errors };
  }

  return { valid, errors };
};

export type AttachmentKind = 'pdf' | 'word' | 'document';

/** Attachment kind used for the type indicator and preview behavior. */
export const attachmentKind = (name: string, mimeType: string): AttachmentKind => {
  const mime = (mimeType || '').toLowerCase();
  const extension = (name.split('.').pop() || '').toLowerCase();
  if (mime === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }
  if (
    mime.includes('wordprocessingml') ||
    mime === 'application/msword' ||
    extension === 'docx' ||
    extension === 'doc'
  ) {
    return 'word';
  }
  return 'document';
};

/** Human-readable type indicator shown on the attachment card. */
export const attachmentKindLabel = (name: string, mimeType: string): string => {
  const kind = attachmentKind(name, mimeType);
  if (kind === 'pdf') return 'PDF';
  if (kind === 'word') return 'Word';
  return 'Document';
};

/** Compact file size label for attachment cards. */
export const attachmentSizeLabel = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};