import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PrecedentImportService,
  PrecedentPersistenceVerification,
} from '../src/services/ai/legal/knowledge-base/precedent-import.service';
import { LocalEmbeddingClient } from '../src/services/ai/vector/embeddings';
import { VectorRecord, VectorStore } from '../src/services/ai/vector/types';
import authorities from '../src/services/ai/legal/corpus/authorities.json';

const KANOON_DATASET_NAME = 'KanoonGPT Indian Case Laws (development subset)';
/**
 * Verbatim member URL derived from the REGISTERED development subset — the only
 * currently verifiable provenance basis for precedent records (Stage 12B).
 */
const verifiedMemberUrl = (() => {
  const member = authorities.find(
    (item) =>
      item.documentType === 'judgment' && item.source === KANOON_DATASET_NAME,
  );
  if (!member) {
    throw new Error('registered kanoongpt-dev-subset corpus has no judgment members');
  }
  return member.sourceUrl;
})();

const DELIM = '='.repeat(80);

const precedentBlocks = (
  id: string,
  officialSourceName: string,
  officialSourceUrl: string,
  overrides: Record<string, string | null> = {},
): string[] => {
  const base: Record<string, string> = {
    CASE_ID: id,
    CASE_NAME: 'Test v. Example',
    COURT: 'Supreme Court of India',
    BENCH: 'N/A',
    JUDGES: 'N/A',
    DATE: '2024-08-01',
    CASE_NUMBER: 'W.P. (C) 123/2024',
    CITATION: 'AIR 2024 SC 999',
    LEGAL_AREA: 'Civil Law',
    SUB_AREA: 'Testing',
    FACTS: 'The test petitioner filed a structured test petition.',
    ISSUES: 'Whether the structured test record is importable.',
    ARGUMENTS: 'N/A',
    APPLICABLE_ARTICLES: 'Article 14',
    APPLICABLE_STATUTES: 'Test Act, 1900',
    APPLICABLE_SECTIONS: 'Section 1',
    APPLICABLE_RULES: 'N/A',
    LEGAL_PRINCIPLE: 'Equality before the law.',
    RATIO: 'The test proportionality rule.',
    HOLDING: 'The impugned test act is valid.',
    FINAL_OUTCOME: 'Petition allowed.',
    REMEDY: 'N/A',
    RELIEF: 'N/A',
    RELATED_CASES: 'N/A',
    FOLLOWED_CASES: 'N/A',
    DISTINGUISHED_CASES: 'N/A',
    OVERRULED_STATUS: 'Good law',
    CURRENT_STATUS: 'Good law',
    TEMPORAL_METADATA: 'Judgment effective 2024-08-01',
    VERSION: '1.0',
    OFFICIAL_SOURCE_NAME: officialSourceName,
    OFFICIAL_SOURCE_URL: officialSourceUrl,
    OFFICIAL_IDENTIFIER: 'AIR 2024 SC 999',
    VERIFICATION_STATUS: 'Verified against Primary Source',
    LAST_VERIFIED_AT: '2026-09-05',
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete base[key];
    } else {
      base[key] = value;
    }
  }
  return [`Record: ${id}`, ...Object.entries(base).map(([k, v]) => `${k}: ${v}`)];
};

const KANOON_SOURCE: [string, string] = [KANOON_DATASET_NAME, verifiedMemberUrl];

const corpusText = (): string =>
  [
    'Intro section with no records.',
    DELIM,
    ...precedentBlocks('PREC-TEST-OK01', ...KANOON_SOURCE),
    DELIM,
    ...precedentBlocks(
      'PREC-TEST-BLOCKED',
      'Supreme Court of India (official judgments portal)',
      'https://main.sci.gov.in/judgments',
    ),
    DELIM,
    ...precedentBlocks('PREC-TEST-INVALID', ...KANOON_SOURCE, { CITATION: null }),
    DELIM,
  ].join('\n');

const readyOnlyCorpus = (): string =>
  [DELIM, ...precedentBlocks('PREC-TEST-OK01', ...KANOON_SOURCE), DELIM].join('\n');

const duplicateCorpus = (): string =>
  [
    DELIM,
    ...precedentBlocks('PREC-TEST-DUP01', ...KANOON_SOURCE),
    DELIM,
    ...precedentBlocks('PREC-TEST-DUP01', ...KANOON_SOURCE),
    DELIM,
  ].join('\n');

const mixedCorpus = (): string =>
  [
    DELIM,
    'Record: IND-TEST-OK01-V2',
    'DOCUMENT_ID: IND-TEST-OK01-V2',
    'TITLE: Test statute record',
    'LEGAL_AREA: Civil Law',
    'SOURCE_TYPE: Central Statute',
    'AUTHORITY_LEVEL: Level 1 - Primary Statutory',
    'JURISDICTION: Union of India',
    'LEGAL_PROPOSITION: A statutory proposition.',
    'CURRENT_STATUS: CURRENT LAW',
    'EFFECTIVE_FROM: 1900-01-01',
    'EFFECTIVE_TO: Open',
    `OFFICIAL_SOURCE_NAME: ${KANOON_SOURCE[0]}`,
    `OFFICIAL_SOURCE_URL: ${KANOON_SOURCE[1]}`,
    'VERIFICATION_STATUS: Verified against Primary Source',
    'LAST_VERIFIED_AT: 2026-09-05',
    'VERSION: 2.1',
    DELIM,
    ...precedentBlocks('PREC-TEST-OK01', ...KANOON_SOURCE),
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
    throw new Error('search not expected in precedent importer tests');
  },
  async delete(): Promise<void> {
    throw new Error('delete not expected in precedent importer tests');
  },
});

const okVerification = (
  chunkIds: string[],
  documentIds: string[],
): PrecedentPersistenceVerification => ({
  ok: true,
  chunkIdsChecked: chunkIds.length,
  chunksFound: chunkIds.length,
  missingChunkIds: [],
  totalLegalAuthorityChunks: chunkIds.length,
  precedentAuthorityKindRows: chunkIds.length,
  chunksPerDocument: Object.fromEntries(documentIds.map((id) => [id, 5])),
  expectedDocumentIdsMissing: [],
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
  ) => Promise<PrecedentPersistenceVerification>;
  targetVectorStore?: string;
  loadCorpusText?: () => Promise<string>;
}

const service = (
  state: FakeStoreState,
  overrides: ServiceOverrides = {},
): PrecedentImportService =>
  new PrecedentImportService({
    store: fakeStore(state),
    embeddings: new LocalEmbeddingClient(),
    loadCorpusText: overrides.loadCorpusText ?? (async () => corpusText()),
    preflight: overrides.preflight ?? (async () => undefined),
    targetVectorStore: overrides.targetVectorStore ?? 'postgres',
    verifyPersistence:
      overrides.verifyPersistence ??
      (async (chunkIds, documentIds) => okVerification(chunkIds, documentIds)),
  });

test('PI1: valid precedent import planning — dry run reports the full plan with ZERO writes', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  let preflightCalls = 0;
  const svc = service(state, {
    preflight: async () => {
      preflightCalls += 1;
    },
  });

  const plan = await svc.dryRun({ expectedRecordCount: 3 });

  assert.equal(plan.precedentRecordsFound, 3);
  assert.equal(plan.readyRecords.length, 1);
  assert.equal(plan.blockedRecords.length, 1);
  assert.equal(plan.invalidRecords.length, 1);
  assert.deepEqual(plan.duplicateRecordIds, []);
  assert.deepEqual(plan.duplicateChunkIds, []);

  const ready = plan.readyRecords[0];
  assert.equal(ready.recordId, 'PREC-TEST-OK01');
  assert.equal(ready.registryId, 'kanoongpt-dev-subset');
  assert.equal(ready.license, 'Apache-2.0');
  assert.equal(ready.chunkCount, 5, 'a complete record yields the five semantic chunks');
  assert.equal(ready.chunkIds[0], 'PREC-TEST-OK01:prec:1');
  assert.ok(plan.chunkIds.every((id) => /:prec:\d+$/.test(id)));

  const blocked = plan.blockedRecords[0];
  assert.equal(blocked.recordId, 'PREC-TEST-BLOCKED');
  assert.equal(blocked.officialSourceUrl, 'https://main.sci.gov.in/judgments');
  assert.equal(blocked.verificationStatus, 'Verified against Primary Source');
  assert.match(blocked.reason, /fail-closed/);

  assert.equal(plan.invalidRecords[0].recordId, 'PREC-TEST-INVALID');
  assert.match(plan.invalidRecords[0].reason, /missing required field CITATION/);

  assert.equal(plan.embeddingDimension, 256, 'local deterministic embedding dimension');
  assert.equal(plan.targetVectorStore, 'postgres');
  assert.ok(plan.usingPostgresStore);
  assert.ok(plan.recordCountMatchesExpectation);
  assert.equal(plan.chunksToWrite, plan.chunkIds.length);

  assert.equal(state.upsertCalls, 0, 'dry run must not write');
  assert.equal(state.stored.size, 0, 'dry run must not write');
  assert.equal(preflightCalls, 0, 'dry run must not even preflight the database');
});

test('PI2: invalid precedent rejection — a real import refuses while any record is invalid', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state);
  await assert.rejects(
    () => svc.import({ expectedRecordCount: 3 }),
    /1 invalid precedent record\(s\)[\s\S]*missing required field CITATION/,
  );
  assert.equal(state.upsertCalls, 0, 'aborted import must not write');
  assert.equal(state.stored.size, 0);
});

test('PI3: blocked provenance rejection — blocked records are never written', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  // Ready + blocked corpus (no invalid records): the import proceeds for the
  // provenance-verified record only.
  const readyAndBlockedCorpus = (): string =>
    [
      DELIM,
      ...precedentBlocks('PREC-TEST-OK01', ...KANOON_SOURCE),
      DELIM,
      ...precedentBlocks(
        'PREC-TEST-BLOCKED',
        'Supreme Court of India (official judgments portal)',
        'https://main.sci.gov.in/judgments',
      ),
      DELIM,
    ].join('\n');
  const svc = service(state, { loadCorpusText: async () => readyAndBlockedCorpus() });
  const result = await svc.import({ expectedRecordCount: 2 });

  assert.equal(result.blockedRecords.length, 1);
  assert.equal(result.blockedRecords[0].recordId, 'PREC-TEST-BLOCKED');
  assert.ok(
    ![...state.stored.keys()].some((id) => id.startsWith('PREC-TEST-BLOCKED')),
    'blocked record chunks must never reach the store',
  );
  assert.ok(
    [...state.stored.keys()].every((id) => id.startsWith('PREC-TEST-OK01:')),
    'only provenance-verified precedent chunks may be written',
  );
});

test('PI4: deterministic precedent chunk ids — re-import upserts identical ids without duplicates', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state, { loadCorpusText: async () => readyOnlyCorpus() });

  const plan1 = await svc.dryRun();
  const run1 = await svc.import({ expectedRecordCount: 1 });
  const ids1 = [...run1.writtenChunkIds].sort();
  const storedAfterRun1 = new Map(state.stored);

  const plan2 = await svc.dryRun();
  const run2 = await svc.import({ expectedRecordCount: 1 });
  const ids2 = [...run2.writtenChunkIds].sort();

  assert.deepEqual(plan2.chunkIds, plan1.chunkIds, 'plans are deterministic');
  assert.deepEqual(ids2, ids1, 're-running must produce identical chunk ids');
  assert.equal(
    run1.writtenChunkIds.length,
    new Set(run1.writtenChunkIds).size,
    'no duplicate ids within a run',
  );
  assert.equal(state.stored.size, storedAfterRun1.size, 'upsert must not create new logical rows');
  assert.equal(state.upsertCalls, 2);
  assert.ok(ids1.every((id) => /^PREC-TEST-OK01:prec:\d+$/.test(id)));
  assert.ok(ids1.every((id) => !id.includes(':kb:')), 'statutory chunk ids must never be used');
  assert.ok(run1.verification.ok && run2.verification.ok);
});

test('PI5: embedding dimension validation is enforced before any write', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state, { loadCorpusText: async () => readyOnlyCorpus() });

  await assert.rejects(
    () => svc.import({ expectedRecordCount: 1, expectedEmbeddingDimension: 128 }),
    /embedding dimension 256 does not match the expected 128/,
  );
  assert.equal(state.upsertCalls, 0, 'aborted import must not write');

  const okPlan = await svc.dryRun({ expectedEmbeddingDimension: 256 });
  assert.ok(okPlan.embeddingDimensionMatchesExpectation);
  const badPlan = await svc.dryRun({ expectedEmbeddingDimension: 999 });
  assert.equal(badPlan.embeddingDimensionMatchesExpectation, false);
});

test('PI6: dry run performs zero writes even for an empty corpus folder', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state, { loadCorpusText: async () => '' });

  const plan = await svc.dryRun();
  assert.equal(plan.precedentRecordsFound, 0);
  assert.equal(plan.chunksToWrite, 0);
  assert.equal(state.upsertCalls, 0);
  assert.equal(state.stored.size, 0);
});

test('PI7: target vector store validation — real import requires postgres', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state, {
    loadCorpusText: async () => readyOnlyCorpus(),
    targetVectorStore: 'memory',
  });

  const plan = await svc.dryRun();
  assert.equal(plan.usingPostgresStore, false);

  await assert.rejects(
    () => svc.import({ expectedRecordCount: 1 }),
    /target vector store is "memory", not postgres/,
  );
  assert.equal(state.upsertCalls, 0, 'aborted import must not write');
  assert.equal(state.stored.size, 0);
});

test('PI8: duplicate prevention — duplicate record ids abort a real import before any write', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state, { loadCorpusText: async () => duplicateCorpus() });

  const plan = await svc.dryRun();
  assert.deepEqual(plan.duplicateRecordIds, ['PREC-TEST-DUP01']);
  assert.equal(plan.precedentRecordsFound, 2);

  await assert.rejects(
    () => svc.import(),
    /duplicate precedent record id\(s\): PREC-TEST-DUP01/,
  );
  assert.equal(state.upsertCalls, 0, 'aborted import must not write');
  assert.equal(state.stored.size, 0);
});

test('PI9/10/11: persisted precedent metadata carries authorityKind, scope and documentType', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state, { loadCorpusText: async () => readyOnlyCorpus() });
  const result = await svc.import({ expectedRecordCount: 1 });

  assert.ok(result.writtenChunkIds.length > 0);
  for (const id of result.writtenChunkIds) {
    const stored = state.stored.get(id);
    assert.ok(stored, `chunk ${id} must be present in the store`);
    // 9. authorityKind persistence metadata (top of metadata AND in chunk metadata)
    assert.equal(stored.metadata.authorityKind, 'judicial_precedent');
    // 10. scope = LEGAL_AUTHORITY
    assert.equal(stored.scope, 'LEGAL_AUTHORITY');
    // 11. documentType = judgment (metadata + provenance JSON shape)
    assert.equal(stored.metadata.documentType, 'judgment');
    assert.equal(stored.metadata.judgmentDate, '2024-08-01');
    assert.equal(stored.metadata.caseName, 'Test v. Example');
    assert.equal(stored.metadata.license, 'Apache-2.0');
    assert.equal(stored.metadata.verificationStatus, 'Verified against Primary Source');
  }
  // Precedent provenance payload mirrors LegalProvenance (feeds PostgresVectorStore provenance JSON).
  const first = state.stored.get(result.writtenChunkIds[0]);
  assert.equal(first?.metadata.recordId, 'PREC-TEST-OK01');
});

test('PI12: existing statutory KB remains unaffected — statutory-format records are never imported as precedents', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  const svc = service(state, { loadCorpusText: async () => mixedCorpus() });

  // The statutory-format block (DOCUMENT_ID, no CASE_ID) is structurally invalid
  // for the precedent schema: it is classified invalid and never stored.
  const plan = await svc.dryRun();
  assert.equal(plan.precedentRecordsFound, 2);
  assert.equal(plan.invalidRecords.length, 1);
  assert.match(plan.invalidRecords[0].reason, /missing CASE_ID/);
  assert.equal(plan.readyRecords.length, 1);
  assert.equal(plan.readyRecords[0].recordId, 'PREC-TEST-OK01');

  // A real import aborts (invalid record present) — nothing written, and no
  // statutory :kb: id is ever produced by the precedent importer.
  await assert.rejects(() => svc.import({ expectedRecordCount: 2 }), /invalid precedent record/);
  assert.equal(state.upsertCalls, 0);
  assert.ok(plan.chunkIds.every((id) => !id.includes(':kb:')));
});

test('PI13: Stage 12B hardening — arbitrary Hugging Face datasets stay BLOCKED', async () => {
  const state: FakeStoreState = { upsertCalls: 0, stored: new Map() };
  // Same registered dataset name, but the URL points at a DIFFERENT huggingface
  // dataset (including KanoonGPT's own statutes dataset): must stay blocked.
  const arbitraryCorpus = (): string =>
    [
      DELIM,
      ...precedentBlocks(
        'PREC-TEST-HF-ARBITRARY',
        KANOON_DATASET_NAME,
        'https://huggingface.co/datasets/some-org/some-other-dataset',
      ),
      DELIM,
      ...precedentBlocks(
        'PREC-TEST-HF-SIBLING',
        KANOON_DATASET_NAME,
        'https://huggingface.co/datasets/KanoonGPT/indian-legal-documents',
      ),
      DELIM,
    ].join('\n');
  const svc = service(state, { loadCorpusText: async () => arbitraryCorpus() });

  const plan = await svc.dryRun();
  assert.equal(plan.precedentRecordsFound, 2);
  assert.equal(plan.readyRecords.length, 0, 'no arbitrary HF dataset may resolve');
  assert.equal(plan.blockedRecords.length, 2);
  assert.deepEqual(
    plan.blockedRecords.map((b) => b.recordId).sort(),
    ['PREC-TEST-HF-ARBITRARY', 'PREC-TEST-HF-SIBLING'],
  );
  assert.equal(state.upsertCalls, 0);
});


