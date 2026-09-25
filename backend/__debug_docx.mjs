import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentHandler } from './src/services/ai/attachment.handler.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DOCX_PATH = path.join(
  __dirname,
  'src',
  'services',
  'ai',
  'legal',
  'knowledge-base',
  'Indian_Legal_Knowledge_Base_V2.1_Final.docx',
);

async function main() {
  const buffer = fs.readFileSync(DOCX_PATH);
  const handler = new AttachmentHandler();
  const chunks = await handler.processAttachments('case-1', [
    { buffer, originalName: 'doc.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  ]);
  console.log('Number of chunks:', chunks.length);
  if (chunks.length > 0) {
    console.log('First chunk text length:', chunks[0].text.length);
    console.log('First chunk text (first 300 chars):', chunks[0].text.slice(0, 300));
  }
}

main();


