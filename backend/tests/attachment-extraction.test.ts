import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { AttachmentHandler } from '../src/services/ai/attachment.handler';

const DOCX_PATH = path.join(
  __dirname,
  '..',
  'src',
  'services',
  'ai',
  'legal',
  'knowledge-base',
  'Indian_Legal_Knowledge_Base_V2.1_Final.docx',
);

test('Attachment extraction: TXT file extracts full text', async () => {
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments('case-1', [
    {
      buffer: Buffer.from('This is a test document about contract law.'),
      originalName: 'notes.txt',
      mimeType: 'text/plain',
    },
  ]);
  assert.ok(chunks.length > 0, 'Should produce chunks');
  assert.ok(
    chunks[0].text.includes('contract law'),
    'Text content should be extracted',
  );
  assert.equal(chunks[0].scope, 'CASE_DOCUMENT');
});

test('Attachment extraction: PDF file extracts text using existing PDF extractor', async () => {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Contract Law Agreement) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
361
%%EOF`;

  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments('case-1', [
    {
      buffer: Buffer.from(pdfContent, 'latin1'),
      originalName: 'contract.pdf',
      mimeType: 'application/pdf',
    },
  ]);
  assert.ok(chunks.length > 0, 'Should produce chunks from PDF');
  assert.ok(
    chunks[0].text.includes('Contract Law Agreement'),
    'PDF text should be extracted',
  );
});

test('Attachment extraction: DOCX file extracts text using mammoth', async () => {
  const buffer = fs.readFileSync(DOCX_PATH);
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments('case-1', [
    {
      buffer,
      originalName: 'doc.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  ]);
  assert.ok(chunks.length > 0, 'Should produce chunks from DOCX');
  // chunkDocument splits on blank lines; the KB docx legitimately begins with a
  // short title header, so the *first* chunk may be small. Validate the real
  // intent: substantial body text was actually extracted via mammoth.
  const totalText = chunks.reduce((sum, c) => sum + c.text.length, 0);
  assert.ok(totalText > 200, 'DOCX should extract substantial text');
  assert.ok(
    chunks.some((c) => c.text.length > 100),
    'DOCX body should contain substantial chunks',
  );
});

test('Attachment extraction: Empty text file fails safely', async () => {
  const handler = new AttachmentHandler();
  await assert.rejects(
    () =>
      handler.processAttachments('case-1', [
        {
          buffer: Buffer.from(''),
          originalName: 'empty.txt',
          mimeType: 'text/plain',
        },
      ]),
    /empty/i,
  );
});

test('Attachment extraction: Empty PDF fails safely', async () => {
  const handler = new AttachmentHandler();
  await assert.rejects(
    () =>
      handler.processAttachments('case-1', [
        {
          buffer: Buffer.from(''),
          originalName: 'empty.pdf',
          mimeType: 'application/pdf',
        },
      ]),
    /empty|PDF/i,
  );
});

test('Attachment extraction: Image file returns metadata-only (no OCR)', async () => {
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments('case-1', [
    {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      originalName: 'scan.png',
      mimeType: 'image/png',
    },
  ]);
  assert.ok(chunks.length > 0, 'Should produce chunks');
  assert.ok(chunks[0].text.includes('scan.png'), 'Should include filename');
});

test('Attachment extraction: Unsupported file type rejected', async () => {
  const handler = new AttachmentHandler();
  await assert.rejects(
    () =>
      handler.processAttachments('case-1', [
        {
          buffer: Buffer.from('malicious'),
          originalName: 'virus.exe',
          mimeType: 'application/x-msdownload',
        },
      ]),
    /unsupported/i,
  );
});

test('Attachment extraction: Context separation preserved', async () => {
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments('case-1', [
    {
      buffer: Buffer.from('Contract dispute document.'),
      originalName: 'contract.txt',
      mimeType: 'text/plain',
    },
  ]);
  assert.ok(
    chunks.every((c) => c.scope === 'CASE_DOCUMENT'),
    'All chunks should be CASE_DOCUMENT',
  );
  assert.ok(
    chunks.every((c) => c.sourceType === 'document'),
    'All chunks should be document type',
  );
});

test('Attachment extraction: Multiple attachments processed', async () => {
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments('case-1', [
    {
      buffer: Buffer.from('First document about limitation.'),
      originalName: 'doc1.txt',
      mimeType: 'text/plain',
    },
    {
      buffer: Buffer.from('Second document about contracts.'),
      originalName: 'doc2.txt',
      mimeType: 'text/plain',
    },
  ]);
  assert.ok(chunks.length >= 2, 'Should produce chunks from both attachments');
  const allText = chunks.map((c) => c.text).join(' ');
  assert.ok(
    allText.includes('limitation'),
    'First document text should be present',
  );
  assert.ok(
    allText.includes('contracts'),
    'Second document text should be present',
  );
});

test('Attachment extraction: Empty DOCX fails safely', async () => {
  const handler = new AttachmentHandler();
  await assert.rejects(
    () =>
      handler.processAttachments('case-1', [
        {
          buffer: Buffer.from(''),
          originalName: 'empty.docx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ]),
    /empty/i,
  );
});

test('Attachment extraction: unreadable (non-text) PDF degrades to transparent metadata, no crash', async () => {
  // Starts with %PDF so the extractor accepts the format, but contains no
  // extractable text literals. Extraction failure must degrade gracefully to a
  // metadata-only chunk instead of throwing/crashing the pipeline.
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments('case-1', [
    {
      buffer: Buffer.from('%PDF-1.4\nthis is not real pdf text\n%%EOF'),
      originalName: 'scan.pdf',
      mimeType: 'application/pdf',
    },
  ]);
  assert.ok(
    chunks.length > 0,
    'Should still produce a metadata-only chunk for an unreadable PDF',
  );
  assert.ok(
    chunks[0].text.includes('not available'),
    'Unreadable PDF should be reported transparently',
  );
  assert.ok(
    chunks[0].scope === 'CASE_DOCUMENT',
    'Metadata-only chunk must remain CASE_DOCUMENT (not authority)',
  );
});

test('Attachment extraction: unreadable (corrupt) DOCX degrades to transparent metadata, no crash', async () => {
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments('case-1', [
    {
      buffer: Buffer.from('not a real docx file'),
      originalName: 'corrupt.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  ]);
  assert.ok(
    chunks.length > 0,
    'Should still produce a metadata-only chunk for a corrupt DOCX',
  );
  assert.ok(
    chunks[0].text.includes('not available'),
    'Unreadable DOCX should be reported transparently',
  );
  assert.ok(
    chunks[0].scope === 'CASE_DOCUMENT',
    'Metadata-only chunk must remain CASE_DOCUMENT (not authority)',
  );
});
