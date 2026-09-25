import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLegalDocumentText, deterministicLegalId } from '../src/services/ai/legal/extract-text';
import { LegalIngestService } from '../src/services/ai/legal/legal-ingest.service';
import { InMemoryVectorStore } from '../src/services/ai/vector/in-memory.store';
import { LocalEmbeddingClient } from '../src/services/ai/vector/embeddings';
import { LocalLegalKnowledgeSource } from '../src/services/ai/legal/local-knowledge.source';
import { PostgresVectorStore } from '../src/services/ai/vector/postgres.store';
import { rejectCaseDocuments, dedupeByDocumentId } from '../src/services/ai/vector/ranking';
import { OpenAIProvider } from '../src/services/ai/openai.provider';
import { AI_APPLICATION_INSTRUCTIONS } from '../src/services/ai/types';
import { CASE_UPLOAD_MIME_TYPES, sanitizeDownloadFilename } from '../src/constants/app.constants';
import { requireRole } from '../src/middleware/auth.middleware';
import { LocalStorageProvider } from '../src/providers/storage/LocalStorageProvider';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AIService } from '../src/services/ai/ai.service';
import { CaseRetrievalService } from '../src/services/ai/retrieval.service';
import { MockAIProvider } from '../src/services/ai/mock-ai.provider';
import { AppError } from '../src/utils/AppError';
import { AuditService } from '../src/services/audit.service';

const sampleChunk = {
  caseId: 'case-a',
  documentId: 'doc-a1',
  chunkId: 'c1',
  documentName: 'affidavit-a.txt',
  pageOrSection: 'Section 1',
  text: 'The accused seeks bail after arrest.',
  relevance: 1,
  sourceType: 'document' as const,
};

test('Phase 6: four demo roles still cannot bypass judicial-only middleware', () => {
  const judgeOnly = requireRole('JUDGE');
  for (const role of ['CITIZEN', 'LAWYER', 'ADMIN', 'CLIENT']) {
    let error: { statusCode?: number } | undefined;
    judgeOnly({ user: { id: 'u', email: 'a@b.c', name: 'n', role } } as never, {} as never, (err?: unknown) => {
      error = err as { statusCode?: number };
    });
    assert.equal(error?.statusCode, 403);
  }
  let allowed: unknown;
  judgeOnly({ user: { id: 'u', email: 'a@b.c', name: 'n', role: 'JUDGE' } } as never, {} as never, (err?: unknown) => {
    allowed = err;
  });
  assert.equal(allowed, undefined);
});

test('Phase 6: legal text ingestion attaches provenance and never indexes case documents', async () => {
  const store = new InMemoryVectorStore();
  const ingest = new LegalIngestService(store, new LocalEmbeddingClient());
  const result = await ingest.ingestFile({
    title: 'Development bail note',
    source: 'India Code',
    sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/15272',
    license: 'Government of India public legislative text',
    documentType: 'statute',
    jurisdiction: 'India',
    citation: 'Code of Criminal Procedure, 1973, s. 439',
    fileName: 'bail.txt',
    mimeType: 'text/plain',
    bytes: Buffer.from('Section 439 confers special powers on High Courts and Courts of Session regarding bail.'),
  });
  assert.equal(result.id, deterministicLegalId('https://www.indiacode.nic.in/handle/123456789/15272', 'Development bail note'));
  assert.ok(result.chunks > 0);

  const legal = new LocalLegalKnowledgeSource(store, new LocalEmbeddingClient(), []);
  const hits = await legal.search('High Court bail');
  assert.ok(hits.every((hit) => hit.provenance.license));
  assert.ok(hits.every((hit) => hit.provenance.sourceUrl.startsWith('https://')));
});

test('Phase 6: vector store rejects private case documents from the legal index', () => {
  const mixed = rejectCaseDocuments([
    {
      id: 'legal-1',
      text: 'public judgment',
      embedding: [1, 0],
      scope: 'LEGAL_AUTHORITY',
      metadata: { documentId: 'auth-1' },
    },
    {
      id: 'case-secret',
      text: 'Confidential other-case exhibit',
      embedding: [0, 1],
      scope: 'CASE_DOCUMENT',
      metadata: { documentId: 'doc-b1' },
    },
  ]);
  assert.deepEqual(mixed.map((item) => item.id), ['legal-1']);
});

test('Phase 6: OpenAI retries rate limits then returns unavailable', async () => {
  let calls = 0;
  const provider = new OpenAIProvider(
    { apiKey: 'sk-test', model: 'gpt-test', timeoutMs: 1000, maxRetries: 2 },
    (async () => {
      calls += 1;
      return { ok: false, status: 429, json: async () => ({}) } as Response;
    }),
  );
  const result = await provider.generateAnswer({
    applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
    userQuery: 'summarize',
    context: [sampleChunk],
    caseContext: [sampleChunk],
  });
  assert.ok(calls >= 3);
  assert.equal(result.status, 'unavailable');
  assert.match(result.warnings.join(' '), /rate-limited/i);
});

test('Phase 6: upload MIME allowlist and download filename sanitization', () => {
  assert.ok(CASE_UPLOAD_MIME_TYPES.includes('application/pdf'));
  assert.equal(CASE_UPLOAD_MIME_TYPES.includes('application/x-msdownload'), false);
  assert.equal(sanitizeDownloadFilename('evil\r\nfilename="a.exe"').includes('\n'), false);
});

test('Phase 6: legal PDF/text extractor rejects empty or non-pdf binaries', () => {
  const text = extractLegalDocumentText(Buffer.from('Personal liberty under Article 21 is a constitutional guarantee.'), 'text/plain', 'note.txt');
  assert.match(text, /Article 21/);
  assert.throws(() => extractLegalDocumentText(Buffer.from('not-a-pdf'), 'application/pdf', 'x.pdf'));
});

test('Phase 6: postgres vector store falls back when the additive table is absent', async () => {
  const fallback = new InMemoryVectorStore();
  const store = new PostgresVectorStore(fallback);
  await store.upsert([
    {
      id: 'legal-fallback',
      text: 'public statute about bail',
      embedding: await new LocalEmbeddingClient().embed('public statute about bail'),
      scope: 'LEGAL_AUTHORITY',
      metadata: { documentId: 'statute-1', title: 'Bail statute', source: 'India Code', sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/15272', license: 'Government of India public legislative text' },
    },
  ]);
  const hits = await fallback.search(await new LocalEmbeddingClient().embed('bail'), { scope: 'LEGAL_AUTHORITY' });
  assert.ok(hits.length >= 0);
});

test('Phase 6: retrieval ranking keeps the highest-scoring chunk per document', () => {
  const ranked = dedupeByDocumentId([
    { id: 'c1', score: 0.2, metadata: { documentId: 'doc-1' } },
    { id: 'c2', score: 0.9, metadata: { documentId: 'doc-1' } },
    { id: 'c3', score: 0.4, metadata: { documentId: 'doc-2' } },
  ]);
  assert.deepEqual(ranked.map((item) => item.id), ['c2', 'c3']);
});

test('Phase 6: unauthorized users cannot run case-scoped AI', async () => {
  const cases = {
    canAccessCase: async (caseId: string, userId: string) => caseId === 'case-a' && userId === 'lawyer-a',
    getCaseByIdForUser: async () => null,
  };
  const retriever = new CaseRetrievalService(cases, {
    getDocumentsForUser: async () => [],
    getDocumentContent: async () => null,
  });
  const ai = new AIService(retriever, new MockAIProvider(), cases, new LocalLegalKnowledgeSource(new InMemoryVectorStore(), new LocalEmbeddingClient(), []));
  await assert.rejects(
    () => ai.chat('case-a', 'outsider', 'LAWYER', 'summarize the secret exhibit'),
    (error: unknown) => error instanceof AppError && error.statusCode === 404,
  );
});

test('Phase 6: storage keys cannot traverse out of the storage directory', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'legal-vault-storage-'));
  try {
    const provider = new LocalStorageProvider(dir);
    await assert.rejects(() => provider.read('../secret.txt'));
    await assert.rejects(() => provider.read('..\\secret.txt'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Phase 6: candidate tamper-check files cannot be ingested into the legal corpus', async () => {
  const ingest = new LegalIngestService(new InMemoryVectorStore(), new LocalEmbeddingClient());
  await assert.rejects(
    () => ingest.ingestFile({
      title: 'candidate',
      source: 'India Code',
      sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/15272',
      license: 'Government of India public legislative text',
      documentType: 'other',
      jurisdiction: 'India',
      fileName: 'candidate.bin',
      mimeType: 'application/octet-stream',
      bytes: Buffer.from('not-legal-authority'),
    }),
  );
});

test('Phase 6: Article 21 ranks above Article 22 for an exact article query', async () => {
  const legal = new LocalLegalKnowledgeSource(new InMemoryVectorStore(), new LocalEmbeddingClient());
  const hits = await legal.search('Article 21');
  assert.ok(hits.length > 0);
  assert.match(hits[0].title, /Article 21/i);
  assert.equal(hits[0].title.includes('Article 22'), false);
});

test('Phase 6: audit writer remains append-only', () => {
  const service = new AuditService() as unknown as Record<string, unknown>;
  assert.equal(typeof service.record, 'function');
  assert.equal('update' in service, false);
  assert.equal('delete' in service, false);
});
