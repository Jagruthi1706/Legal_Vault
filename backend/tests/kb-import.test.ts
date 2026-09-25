import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KBImportService,
  KBPersistenceVerification,
} from '../src/services/ai/legal/knowledge-base/kb-import.service';
import { LocalEmbeddingClient } from '../src/services/ai/vector/embeddings';
import { VectorRecord, VectorStore } from '../src/services/ai/vector/types';

const DELIM = '='.repeat(80);

const statutoryBlocks = (
  id: string,
  officialSourceName: string,
  officialSourceUrl: string,
): string[] => [
  `Record: ${id}`,
  `DOCUMENT_ID: ${id}`,
  'TITLE: Test statute record',
  'LEGAL_AREA: Civil Law',
  'SUB_AREA: Testing',
  'SOURCE_TYPE: Central Statute',
  'AUTHORITY_LEVEL: Level 1 - Primary Statutory',
  'JURISDICTION: Union of India',
  'STATE_OR_UT: All States and Union Territories',
  'COURT_OR_AUTHORITY: N/A',
  'STATUTE: Test Act, 1900',
  'ARTICLE: N/A',
  'SECTION: Section 1',
  'RULE: N/A',
  'LEGAL_PROPOSITION: A deterministic test proposition.',
  'SIMPLE_EXPLANATION: A simple explanation for tests.',
  'APPLICATION / WHEN RELEVANT: When testing the importer.',
  'EXCEPTIONS / LIMITATIONS: None recorded.',
  'IMPORTANT_QUALIFICATIONS: Test qualification.',
  'RELATED_PROVISIONS: Related Section 2.',
  'RELATED_CASE_LAW: N/A',
  'CURRENT_STATUS: CURRENT LAW',
  'EFFECTIVE_FROM: 1900-01-01 (Act Assent); Rules Notified 2025',
  'EFFECTIVE_TO: Open',
  'HISTORICAL_APPLICABILITY: Historical note for tests.',
  `OFFICIAL_SOURCE_NAME: ${officialSourceName}`,
  `OFFICIAL_SOURCE_URL: ${officialSourceUrl}`,
  'OFFICIAL_IDENTIFIER: Test Act 1900',
  'OFFICIAL_CITATION: Test Act 1900, S. 1',
  'VERIFICATION_STATUS: Verified against Primary Source',
  'LAST_VERIFIED_AT: 2026-09-03',
  'KEYWORDS: test, statute, importer',
  'VERSION: 2.1',
];

const corpusText = (): string =>
  [
    'Intro section with no records.',
    DELIM,
    ...statutoryBlocks(
      'IND-TEST-OK01-V2',
      'India Code Portal / Legislative Department',
      'https://www.indiacode.nic.in/handle/123456789/1566',
    ),
    DELIM,
    ...statutoryBlocks(
      'IND-TEST-BLOCKED-V2',
      'Ministry of Electronics and Information Technology (MeitY), Government of India',
      'https://www.meity.gov.in',
    ),
    DELIM,
    'Case: CASE-TEST-001-V2',
    'CASE_ID: CASE-TEST-001-V2',
    'CASE_NAME: Test v. Test',
    'HOLDING: A holding that must never be imported as a statutory record.',
    DELIM,
  ].join('\n');

interface FakeStoreState {
  upsertCalls: number;
  stored: Map<string, VectorRecord>;
}

const fakeStore = (state: FakeStoreState): VectorStore => ({
  async upsert(records: VectorRecord[]): Promise<void> {
    state.upsertCalls += 1;
    for (const record of records) {
      state.stored.set(record.id, record);
    }
  },
  async search(): Promise<Array<VectorRecord & { score: number }>> {
    throw new Error('search not expected in importer tests');
  },
  async delete(): Promise<void> {
    throw new Error('delete not expected in importer tests');
  },
});

const okVerification = (
  chunkIds: string[],
  documentIds: string[],
): KBPersistenceVerification => ({
  ok: true,
  chunkIdsChecked: chunkIds.length,
  chunksFound: chunkIds.length,
  missingChunkIds: [],
  totalLegalAuthorityChunks: chunkIds.length,
  distinctDocumentIds: [...documentIds].sort(),
  expectedDocumentIdsMissing: [],
  chunksPerDocument: Object.fromEntries(documentIds.map((id) => [id, 2])),
  everyDocumentHasMultipleChunks: true,
  caseRecordLeaks: 0,
  duplicateChunkIds: 0,
  provenanceVerified: true,
  referenceTableCounts: { cases: 0, documents: 0, evidence: 0, blockchainTransactions: 0 },
});

interface ServiceOverrides {
  preflight?: () => Promise<void>;
  verifyPersistence?: (
    chunkIds: string[],
    documentIds: string[],
  ) => Promise<KBPersistenceVerification>;
}

const service = (state: FakeStoreState, overrides: ServiceOverrides = {}): KBImportService =>
  new KBImportService({
    store: fakeStore(state),
    embeddings: new LocalEmbeddingClient(),
    loadCorpusText: async () => corpusText(),
    preflight: overrides.preflight ?? (async () => undefined),
    targetVectorStore: 'postgres',
    verifyPersistence:
      overrides.verifyPersistence ??
      (async (chunkIds, documentIds) => okVerification(chunkIds, documentIds)),
  });

test('KB import: dry run reports the full plan and performs ZERO writes', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  let preflightCalls = 0;
  const svc = service(state, {
    preflight: async () => {
      preflightCalls += 1;
    },
  });

  const plan = await svc.dryRun({ expectedRecordCount: 2 });

  assert.equal(plan.statutoryRecordsFound, 2);
  assert.equal(plan.excludedCaseRecords, 1, 'the Case: section must be excluded');
  assert.equal(plan.chunksToWrite, plan.chunkIds.length);
  assert.ok(plan.chunksToWrite > 0);
  assert.ok(
    plan.chunkIds.every((id) => /:kb:\d+$/.test(id)),
    'chunk ids use the Stage 2 :kb: convention',
  );
  assert.equal(plan.embeddingDimension, 256, 'local deterministic embedding dimension');
  assert.equal(plan.blockedRecords.length, 1);
  assert.equal(plan.blockedRecords[0].recordId, 'IND-TEST-BLOCKED-V2');
  assert.match(plan.blockedRecords[0].reason, /fail-closed/);
  assert.equal(plan.readyRecords.length, 1);
  assert.equal(plan.readyRecords[0].recordId, 'IND-TEST-OK01-V2');
  assert.equal(plan.readyRecords[0].license, 'Government of India public legislative text');
  assert.equal(state.upsertCalls, 0, 'dry run must not write');
  assert.equal(state.stored.size, 0, 'dry run must not write');
  assert.equal(preflightCalls, 0, 'dry run must not even preflight the database');
});

test('KB import: deterministic and idempotent — re-running upserts identical chunk ids without duplicates', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state);

  const run1 = await svc.import({ expectedRecordCount: 2 });
  const ids1 = [...run1.writtenChunkIds].sort();
  const storedAfterRun1 = new Map(state.stored);

  const run2 = await svc.import({ expectedRecordCount: 2 });
  const ids2 = [...run2.writtenChunkIds].sort();

  assert.deepEqual(ids2, ids1, 're-running must produce identical chunk ids');
  assert.equal(
    run1.writtenChunkIds.length,
    new Set(run1.writtenChunkIds).size,
    'no duplicate ids within a run',
  );
  assert.equal(state.stored.size, storedAfterRun1.size, 'upsert must not create new logical rows');
  assert.equal(state.upsertCalls, 2);
  assert.ok(run1.verification.ok && run2.verification.ok);

  const storedRecord = state.stored.get(ids1[0]);
  assert.ok(storedRecord);
  assert.equal(storedRecord.scope, 'LEGAL_AUTHORITY');
  assert.equal(storedRecord.metadata.documentId, 'IND-TEST-OK01-V2');
  assert.equal(
    storedRecord.metadata.effectiveFrom,
    '1900-01-01 (Act Assent); Rules Notified 2025',
    'complex temporal values must be preserved verbatim',
  );
  assert.equal(storedRecord.metadata.license, 'Government of India public legislative text');
});

test('KB import: provenance fail-closed — blocked records are never written', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state);
  const result = await svc.import({ expectedRecordCount: 2 });

  assert.equal(result.blockedRecords.length, 1);
  assert.ok(
    ![...state.stored.keys()].some((id) => id.startsWith('IND-TEST-BLOCKED-V2')),
    'blocked record chunks must never reach the store',
  );
  assert.ok([...state.stored.keys()].every((id) => id.startsWith('IND-TEST-OK01-V2')));
});

test('KB import: record-count expectation is enforced', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state);
  await assert.rejects(
    () => svc.import({ expectedRecordCount: 16 }),
    /does not match the expected 16/,
  );
  assert.equal(state.upsertCalls, 0, 'aborted import must not write');
});

test('KB import: preflight failure aborts BEFORE any write', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state, {
    preflight: async () => {
      throw new Error('PrismaClientKnownRequestError: Server has closed the connection');
    },
  });
  await assert.rejects(() => svc.import({ expectedRecordCount: 2 }), /Server has closed the connection/);
  assert.equal(state.upsertCalls, 0, 'nothing may be written when the preflight fails');
  assert.equal(state.stored.size, 0);
});

test('KB import: PostgreSQL persistence failure is surfaced, never reported as success', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  // Simulates the vector store silently falling back to memory: upsert "succeeds"
  // but the post-write Prisma gate finds nothing in PostgreSQL.
  const svc = service(state, {
    verifyPersistence: async (chunkIds) => ({
      ...okVerification(chunkIds, ['IND-TEST-OK01-V2']),
      ok: false,
      chunksFound: 0,
      missingChunkIds: chunkIds,
    }),
  });
  await assert.rejects(
    () => svc.import({ expectedRecordCount: 2 }),
    /FAILED persistence verification[\s\S]*in-memory fallback must never be reported as success/,
  );
  assert.ok(state.upsertCalls > 0, 'the store was written to, but the import must still fail loudly');
});