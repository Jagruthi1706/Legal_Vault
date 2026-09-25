import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { extractLegalDocumentText } from '../src/services/ai/legal/extract-text';
import { AttachmentHandler } from '../src/services/ai/attachment.handler';

const REAL_PDF_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  'Downloads',
  'Legal_Vault_Attachment_Test_Delay.pdf',
);

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

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Small uncompressed PDF with a plain-text literal (existing extractor input). */
const simplePdf = (): Buffer =>
  Buffer.from(
    `%PDF-1.4
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
%%EOF`,
    'latin1',
  );

/** PDF whose text content stream is FlateDecode-compressed (like Word/Acrobat). */
const compressedPdf = (): Buffer => {
  const contentOps =
    'BT /F1 12 Tf 72 720 Td (Compressed PDF law article 21) Tj ' +
    '0 -14 Td (Personal liberty protected) Tj ET';
  const stored = deflateSync(Buffer.from(contentOps, 'latin1'));
  return Buffer.from(
    `%PDF-1.4
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
<< /Length ${stored.length} /Filter /FlateDecode >>
stream
${stored.toString('latin1')}
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
%%EOF`,
    'latin1',
  );
};

test('PDF extraction: simple uncompressed PDF still extracts text', () => {
  const text = extractLegalDocumentText(simplePdf(), 'application/pdf', 'contract.pdf');
  assert.ok(text.includes('Contract Law Agreement'), 'uncompressed literal text should be extracted');
});

test('PDF extraction: FlateDecode-compressed text PDF extracts real text', () => {
  const text = extractLegalDocumentText(compressedPdf(), 'application/pdf', 'compressed.pdf');
  assert.ok(
    text.includes('Compressed PDF law article 21'),
    'compressed stream text should be decoded into real content',
  );
  assert.ok(
    text.includes('Personal liberty protected'),
    'multi-line compressed content should be decoded',
  );
});

test('PDF extraction: empty file fails safely', () => {
  assert.throws(
    () => extractLegalDocumentText(Buffer.from(''), 'application/pdf', 'empty.pdf'),
    /not a PDF/i,
  );
});

test('PDF extraction: scanned/image-only PDF fails safely (no invented text)', () => {
  // Representative scanned page: the content stream only invokes the image
  // XObject (no text operators, no parenthesized literals, no /FlateDecode).
  const scan = Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 40 >>
stream
q
100 0 0 100 0 0 cm
/Im1 Do
Q
endstream
endobj
5 0 obj
<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 8 >>
stream
ff00ff00ff00ff00
endstream
endobj
xref
0 6
0000000000 65535 f
trailer
<< /Size 6 /Root 1 0 R >>
startxref
600
%%EOF`,
    'latin1',
  );
  assert.throws(
    () => extractLegalDocumentText(scan, 'application/pdf', 'scan.pdf'),
    /did not contain extractable text/i,
  );
});

test('PDF extraction: unreadable PDF degrades through attachment handler, no crash', async () => {
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments(undefined, [
    {
      buffer: Buffer.from('%PDF-1.4\nthis is not real pdf text\n%%EOF'),
      originalName: 'scan.pdf',
      mimeType: 'application/pdf',
    },
  ]);
  assert.ok(chunks.length > 0, 'metadata-only chunk should be produced');
  assert.ok(chunks[0].text.includes('not available'), 'failure should be reported transparently');
  assert.equal(chunks[0].scope, 'CASE_DOCUMENT', 'metadata chunk must stay CASE_DOCUMENT');
});

test('DOCX extraction: mammoth path still works through attachment handler', async () => {
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments(undefined, [
    {
      buffer: fs.readFileSync(DOCX_PATH),
      originalName: 'kb.docx',
      mimeType: DOCX_MIME,
    },
  ]);
  assert.ok(chunks.length > 0, 'DOCX should produce chunks');
  const totalText = chunks.reduce((sum, c) => sum + c.text.length, 0);
  assert.ok(totalText > 200, 'DOCX should extract substantial text');
});

/**
 * Encode bytes to PDF ASCII85 (Ascii85Decode). Used to build test PDFs whose
 * content stream is [ /ASCII85Decode /FlateDecode ] — exactly the filter chain
 * used by the real failing PDF (ReportLab output).
 */
const toAscii85 = (data: Buffer): string => {
  let out = '';
  let i = 0;
  while (i < data.length) {
    const originalLen = Math.min(4, data.length - i);
    const padded = Buffer.alloc(4, 0);
    data.subarray(i, i + originalLen).copy(padded);
    // Use multiplication to avoid signed 32-bit overflow from bitwise ops
    const value = padded[0]! * 16777216 + padded[1]! * 65536 + padded[2]! * 256 + padded[3]!;

    if (value === 0 && originalLen === 4) {
      out += 'z';
    } else {
      let remaining = value;
      let chars = '';
      for (let k = 0; k < 5; k++) {
        chars = String.fromCharCode((remaining % 85) + 33) + chars;
        remaining = Math.floor(remaining / 85);
      }
      out += chars.slice(0, originalLen + 1);
    }
    i += originalLen;
  }
  return out + '~>';
};

test('PDF extraction: ASCII85 + FlateDecode filter chain decodes real text', () => {
  const contentOps =
    'BT /F1 12 Tf 72 720 Td (Article 21 fundamental rights) Tj ' +
    '0 -14 Td (Personal liberty protected under constitution) Tj ET';
  const deflated = deflateSync(Buffer.from(contentOps, 'latin1'));
  const ascii85Encoded = toAscii85(deflated);

  const header = Buffer.from(
    `%PDF-1.4
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
<< /Filter [ /ASCII85Decode /FlateDecode ] /Length ${ascii85Encoded.length} >>
stream
`,
    'latin1',
  );
  const footer = Buffer.from(
    `
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
%%EOF`,
    'latin1',
  );
  const pdf = Buffer.concat([
    header,
    Buffer.from(ascii85Encoded, 'latin1'),
    footer,
  ]);

  const text = extractLegalDocumentText(pdf, 'application/pdf', 'ascii85-flate.pdf');
  assert.ok(
    text.includes('Article 21 fundamental rights'),
    'ASCII85+Flate stream text should be decoded into real content',
  );
  assert.ok(
    text.includes('Personal liberty protected under constitution'),
    'multi-line ASCII85+Flate content should be decoded',
  );
});

test('PDF extraction: ASCII85 + FlateDecode does NOT return metadata garbage', () => {
  // Verify the safety fix: when an encoded content stream is present, the
  // extractor must NOT fall back to raw parenthesized metadata strings.
  const contentOps =
    'BT /F1 12 Tf 72 720 Td (Delay Condonation Filing Rights) Tj ET';
  const deflated = deflateSync(Buffer.from(contentOps, 'latin1'));
  const ascii85Encoded = toAscii85(deflated);

  const header = Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Filter [ /ASCII85Decode /FlateDecode ] /Length ${ascii85Encoded.length} >>
stream
`,
    'latin1',
  );
  const footer = Buffer.from(
    `
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
trailer
<< /Size 6 /Root 1 0 R >>
startxref
600
%%EOF`,
    'latin1',
  );
  const pdf = Buffer.concat([
    header,
    Buffer.from(ascii85Encoded, 'latin1'),
    footer,
  ]);

  const text = extractLegalDocumentText(pdf, 'application/pdf', 'safety.pdf');
  assert.ok(
    text.includes('Delay Condonation Filing Rights'),
    'real content stream text must be extracted',
  );
  assert.ok(
    !text.includes('Helvetica'),
    'font metadata must not be returned as extracted text',
  );
});

test('PDF extraction: real failing PDF (Legal_Vault_Attachment_Test_Delay.pdf) extracts case text', () => {
  if (!fs.existsSync(REAL_PDF_PATH)) {
    console.log(`  [skipped] test PDF not found at ${REAL_PDF_PATH}`);
    return;
  }
  const buffer = fs.readFileSync(REAL_PDF_PATH);
  const text = extractLegalDocumentText(buffer, 'application/pdf', 'Legal_Vault_Attachment_Test_Delay.pdf');

  assert.ok(text.length >= 20, 'extracted text should be non-trivial');
  assert.ok(
    text.includes('SAMPLE ATTACHMENT') || text.includes('FICTIONAL CASE NOTE') || text.includes('LV-TEST-042'),
    'extracted text should contain real document content, not metadata garbage',
  );
  assert.ok(
    !text.includes('ReportLab PDF Library'),
    'producer metadata must not appear as extracted text',
  );
  assert.ok(
    !text.includes('anonymous'),
    'author metadata must not appear as extracted text',
  );
});

test('PDF extraction: real failing PDF produces meaningful CASE_DOCUMENT chunks', async () => {
  if (!fs.existsSync(REAL_PDF_PATH)) {
    console.log(`  [skipped] test PDF not found at ${REAL_PDF_PATH}`);
    return;
  }
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments(undefined, [
    {
      buffer: fs.readFileSync(REAL_PDF_PATH),
      originalName: 'Legal_Vault_Attachment_Test_Delay.pdf',
      mimeType: 'application/pdf',
    },
  ]);

  assert.ok(chunks.length > 0, 'should produce at least one chunk');
  assert.equal(chunks[0]!.scope, 'CASE_DOCUMENT', 'chunk scope must be CASE_DOCUMENT');
  const totalText = chunks.reduce((sum, c) => sum + c.text.length, 0);
  assert.ok(totalText >= 20, 'chunks should contain meaningful text');
  assert.ok(
    !chunks[0]!.text.includes('not available'),
    'extraction should succeed, not degrade to metadata-only fallback',
  );
});