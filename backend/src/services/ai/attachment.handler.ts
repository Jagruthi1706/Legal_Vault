import { AppError } from '../../utils/AppError';
import {
  HTTP_STATUS,
  CASE_UPLOAD_MIME_TYPES,
} from '../../constants/app.constants';
import { chunkDocument } from './chunking.service';
import { RetrievedChunk } from './types';
import { extractLegalDocumentText } from './legal/extract-text';
import { extractDocxText } from './legal/knowledge-base/docx-parser';

export interface AttachmentFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export class AttachmentHandler {
  private readonly MAX_ATTACHMENTS = 5;
  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file, matches multer limit
  private readonly ALLOWED_MIME_TYPES = new Set(
    CASE_UPLOAD_MIME_TYPES as readonly string[],
  );

  /**
   * Validate and process attachments for AI context.
   * Attachments are treated as case evidence, not legal authorities.
   * Each attachment is chunked and returned ready for inclusion in case retrieval context.
   */
  async processAttachments(
    caseId: string | undefined,
    attachments: AttachmentFile[],
  ): Promise<RetrievedChunk[]> {
    const resolvedCaseId = caseId || 'no-case';
    if (!attachments || attachments.length === 0) {
      return [];
    }

    if (attachments.length > this.MAX_ATTACHMENTS) {
      throw new AppError(
        `Maximum ${this.MAX_ATTACHMENTS} attachments allowed per query.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const chunks: RetrievedChunk[] = [];

    for (const attachment of attachments) {
      this.validateAttachment(attachment);
      const text = await this.extractText(attachment);
      const attachmentChunks = chunkDocument({
        caseId: resolvedCaseId,
        documentId: `attachment:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        documentName: attachment.originalName,
        text,
        sourceType: 'document',
        scope: 'CASE_DOCUMENT',
        chunkId: `${resolvedCaseId}:attachment:${Date.now()}`,
      });
      chunks.push(...attachmentChunks);
    }

    return chunks;
  }

  private validateAttachment(file: AttachmentFile): void {
    if (!file.buffer || file.buffer.length === 0) {
      throw new AppError('Attachment file is empty.', HTTP_STATUS.BAD_REQUEST);
    }

    if (file.buffer.length > this.MAX_FILE_SIZE) {
      throw new AppError(
        `Attachment file exceeds maximum size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (!this.ALLOWED_MIME_TYPES.has(file.mimeType)) {
      throw new AppError(
        `Unsupported attachment file type: ${file.mimeType}. Allowed types: PDF, TXT, MD, JPEG, PNG, DOC, DOCX.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (!file.originalName || typeof file.originalName !== 'string') {
      throw new AppError(
        'Attachment filename is invalid.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }
  }

  private async extractText(file: AttachmentFile): Promise<string> {
    const name = (file.originalName || '').toLowerCase();
    const mime = file.mimeType.toLowerCase();

    // Text-based formats: extract directly
    if (
      mime.startsWith('text/') ||
      name.endsWith('.txt') ||
      name.endsWith('.md')
    ) {
      const text = file.buffer.toString('utf8').trim();
      if (!text) {
        throw new AppError(
          'Text attachment was empty.',
          HTTP_STATUS.BAD_REQUEST,
        );
      }
      return text;
    }

    // PDF: use existing PDF text extraction. If the PDF cannot be decoded
    // (compressed streams, scanned image-only, corrupt), degrade to a
    // transparent metadata-only chunk instead of crashing — the AI layer will
    // then return an unavailable answer rather than fabricating text.
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      try {
        return extractLegalDocumentText(
          file.buffer,
          file.mimeType,
          file.originalName || 'document.pdf',
        );
      } catch {
        const fileName = file.originalName || 'unknown file';
        return `[Attachment: ${fileName} (${file.mimeType}) - ${file.buffer.length} bytes. PDF text extraction was not available for this file.]`;
      }
    }

    // DOCX: use existing mammoth-based DOCX extraction. Same graceful
    // degradation for files mammoth cannot read, reusing the existing
    // metadata-only fallback pattern (no second DOCX parser).
    if (
      mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx')
    ) {
      try {
        const result = await extractDocxText(file.buffer);
        return result.text;
      } catch {
        const fileName = file.originalName || 'unknown file';
        return `[Attachment: ${fileName} (${file.mimeType}) - ${file.buffer.length} bytes. DOCX text extraction was not available for this file.]`;
      }
    }

    // DOC (older Word format): metadata-only representation (no reliable parser available)
    if (mime === 'application/msword' || name.endsWith('.doc')) {
      const fileName = file.originalName || 'unknown file';
      return `[Attachment: ${fileName} (${file.mimeType}) - ${file.buffer.length} bytes. Text extraction not available for .doc format. Please use .docx or .pdf.]`;
    }

    // Image formats: metadata-only representation (OCR not available)
    const fileName = file.originalName || 'unknown file';
    return `[Attachment: ${fileName} (${file.mimeType}) - ${file.buffer.length} bytes. Image/text extraction not available for this format.]`;
  }
}

export const attachmentHandler = new AttachmentHandler();
