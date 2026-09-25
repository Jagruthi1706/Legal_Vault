import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAttachmentFiles,
  MAX_ATTACHMENT_FILES,
  attachmentKind,
  attachmentKindLabel,
  attachmentSizeLabel,
} from '../components/copilot/copilotComposerUtils';

describe('copilot attachment validation', () => {
  it('accepts supported case files and rejects unsupported types', () => {
    const pdf = new File(['hello'], 'brief.pdf', { type: 'application/pdf' });
    const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const image = new File(['hello'], 'scan.png', { type: 'image/png' });
    const unsupported = new File(['hello'], 'archive.exe', { type: 'application/x-msdownload' });

    const result = validateAttachmentFiles([pdf, txt, image, unsupported], []);

    assert.equal(result.valid.length, 3);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Unsupported file type/i);
  });

  it('enforces the attachment cap', () => {
    const files = Array.from({ length: MAX_ATTACHMENT_FILES + 1 }, (_, index) =>
      new File(['pdf'], `brief-${index}.pdf`, { type: 'application/pdf' }),
    );

    const result = validateAttachmentFiles(files, []);

    assert.equal(result.valid.length, MAX_ATTACHMENT_FILES);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Maximum 5 attachments/i);
  });
});

describe('attachment display helpers', () => {
  it('classifies PDFs by mime type or extension', () => {
    assert.equal(attachmentKind('brief.pdf', 'application/pdf'), 'pdf');
    assert.equal(attachmentKind('brief', 'application/pdf'), 'pdf');
    assert.equal(attachmentKind('brief.PDF', ''), 'pdf');
    assert.equal(attachmentKindLabel('brief.pdf', 'application/pdf'), 'PDF');
  });

  it('classifies Word documents by mime type or extension', () => {
    assert.equal(attachmentKind('notice.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'word');
    assert.equal(attachmentKind('notice.docx', ''), 'word');
    assert.equal(attachmentKind('legacy.doc', 'application/msword'), 'word');
    assert.equal(attachmentKind('legacy.DOC', ''), 'word');
    assert.equal(attachmentKindLabel('notice.docx', ''), 'Word');
  });

  it('labels everything else as Document', () => {
    assert.equal(attachmentKind('notes.txt', 'text/plain'), 'document');
    assert.equal(attachmentKind('scan.png', 'image/png'), 'document');
    assert.equal(attachmentKindLabel('notes.txt', 'text/plain'), 'Document');
  });

  it('formats attachment sizes compactly', () => {
    assert.equal(attachmentSizeLabel(512), '1 KB');
    assert.equal(attachmentSizeLabel(2048), '2 KB');
    assert.equal(attachmentSizeLabel(2 * 1024 * 1024), '2.0 MB');
    assert.equal(attachmentSizeLabel(1536 * 1024), '1.5 MB');
  });
});
