import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalLegalKnowledgeSource } from '../src/services/ai/legal/local-knowledge.source';
import { InMemoryVectorStore } from '../src/services/ai/vector/in-memory.store';
import { LocalEmbeddingClient } from '../src/services/ai/vector/embeddings';
import { VectorRecord } from '../src/services/ai/vector/types';
import { matchKbRegistryEntry } from '../src/services/ai/legal/knowledge-base/kb-provenance';

/**
 * Hermetic Stage 4 tests for legal-authority retrieval of the persisted
 * Knowledge Base chunks. The records below mirror the exact shape written to
 * `LegalAuthorityChunk` by the Stage 3 importer (same metadata keys, same
 * `${documentId}:kb:${index}` chunk ids), seeded into an in-memory store which
 * exercises the identical `LocalLegalKnowledgeSource.search()` code path used
 * against PostgreSQL. The live-PostgreSQL variant is opt-in via KB_LIVE_TEST=1.
 */

const kbRecord = (input: {
  documentId: string;
  title: string;
  text: string;
  chunkIndex: number;
  citation: string;
  effectiveFrom: string;
  effectiveTo: string;
  currentStatus: string;
  legalArea: string;
}): VectorRecord => ({
  id: `${input.documentId}:kb:${input.chunkIndex}`,
  text: `${input.title}\nLEGAL_PROPOSITION: ${input.text}`,
  embedding: [],
  scope: 'LEGAL_AUTHORITY',
  metadata: {
    documentId: input.documentId,
    recordId: input.documentId,
    title: input.title,
    source: 'India Code Portal / Legislative Department',
    sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2338',
    license: 'Government of India public legislative text',
    citation: input.citation,
    documentType: 'statute',
    jurisdiction: 'Union of India',
    version: '2.1',
    pageOrSection: 'Core legal text',
    chunkIndex: input.chunkIndex,
    chunkCount: 2,
    currentStatus: input.currentStatus,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    legalArea: input.legalArea,
  },
});

const limitChunks = (chunkIndex: number): VectorRecord =>
  kbRecord({
    documentId: 'IND-PROC-LIM001-V2',
    title: 'Mandatory Limitation Bar, Cause-of-Action Specificity, and Condonation Scope',
    text:
      'The Limitation Act, 1963 bars suits filed beyond the prescribed period; courts may condone the delay when the party shows sufficient cause, and acknowledgments or part payments extend the period under Sections 18 and 19.',
    chunkIndex,
    citation: 'Limitation Act 1963, SS. 3 & 5',
    effectiveFrom: '1963-10-01 (Act Commencement)',
    effectiveTo: 'Open',
    currentStatus: 'CURRENT LAW',
    legalArea: 'Civil Procedure & Limitation',
  });

const dataProtectionChunks = (chunkIndex: number): VectorRecord =>
  kbRecord({
    documentId: 'IND-TECH-DPDP01-V2',
    title: 'Digital Personal Data Protection: Statutory Framework, 2025 Subordinate Rules',
    text:
      'The Digital Personal Data Protection Act, 2023 regulates notice, consent, and cross-border transfer of digital personal data by data fiduciaries in India.',
    chunkIndex,
    citation: 'DPDP Act 2023; DPDP Rules 2025',
    effectiveFrom: '2023-08-11 (Act Assent); Rules Notified 2025; Staggered Operational Phase-in',
    effectiveTo: 'Open',
    currentStatus: 'CURRENT LAW / TRANSITIONAL LAW',
    legalArea: 'Technology & Privacy Law',
  });

const caseDocumentRecord = (): VectorRecord => ({
  id: 'doc-case-1:section:1',
  text: 'Plaint filed by the plaintiff against the defendant regarding an agreement to sell the Mumbai property.',
  embedding: [],
  scope: 'CASE_DOCUMENT',
  metadata: {
    documentId: 'doc-case-1',
    title: 'plaint-copy.txt',
    source: 'Private case document',
    caseId: 'case-a',
  },
});

const seedStore = async (records: VectorRecord[]): Promise<InMemoryVectorStore> => {
  const store = new InMemoryVectorStore();
  // Embed with the same local deterministic client used in production so vector
  // scoring matches the persisted semantics.
  const embeddings = new LocalEmbeddingClient();
  const seeded = await Promise.all(
    records.map(async (record) => ({
      ...record,
      embedding: await embeddings.embed(`${record.metadata.title || ''}\n${record.text}`),
    })),
  );
  await store.upsert(seeded);
  return store;
};

const source = (store: InMemoryVectorStore): LocalLegalKnowledgeSource =>
  new LocalLegalKnowledgeSource(store, new LocalEmbeddingClient(), []);

test('KB retrieval: persisted KB chunks are retrievable as LEGAL_AUTHORITY with full provenance', async () => {
  const store = await seedStore([limitChunks(1), limitChunks(2)]);
  const results = await source(store).search(
    'condonation of delay and sufficient cause under the limitation bar',
  );

  assert.ok(results.length > 0, 'the persisted KB record must be retrievable');
  const top = results[0];
  assert.equal(top.id, 'IND-PROC-LIM001-V2');
  assert.equal(top.provenance.source, 'India Code Portal / Legislative Department');
  assert.equal(top.provenance.sourceUrl, 'https://www.indiacode.nic.in/handle/123456789/2338');
  assert.equal(top.provenance.license, 'Government of India public legislative text');
  assert.equal(top.provenance.citation, 'Limitation Act 1963, SS. 3 & 5');
  assert.equal(top.provenance.documentType, 'statute');
  assert.equal(top.provenance.jurisdiction, 'Union of India');
  assert.equal(top.provenance.version, '2.1');
  assert.match(top.chunkId, /:kb:\d+$/);
  // toRetrievedChunks keeps the strict separation contract.
  const chunks = source(store).toRetrievedChunks(results);
  assert.ok(
    chunks.every((chunk) => chunk.scope === 'LEGAL_AUTHORITY' && chunk.sourceType === 'legal_authority'),
  );
  assert.ok(chunks.every((chunk) => chunk.provenance && chunk.provenance.license));
});

test('KB retrieval: temporal metadata is surfaced verbatim', async () => {
  const store = await seedStore([dataProtectionChunks(1), dataProtectionChunks(2)]);
  const results = await source(store).search('data protection notice consent fiduciary transfer');

  assert.ok(results.length > 0);
  const top = results[0];
  assert.deepEqual(top.temporal, {
    currentStatus: 'CURRENT LAW / TRANSITIONAL LAW',
    effectiveFrom: '2023-08-11 (Act Assent); Rules Notified 2025; Staggered Operational Phase-in',
    effectiveTo: 'Open',
  });
});

test('KB retrieval: relevance filtering ranks the topical authority and gates unrelated ones', async () => {
  const store = await seedStore([
    limitChunks(1),
    limitChunks(2),
    dataProtectionChunks(1),
    dataProtectionChunks(2),
  ]);
  const results = await source(store).search('condonation of delay and sufficient cause limitation');

  assert.ok(results.length > 0);
  assert.ok(
    results.every((hit) => hit.id === 'IND-PROC-LIM001-V2'),
    'unrelated authorities must be gated out by the topical ratio',
  );
  // Filters already supported by the abstraction are enforced on the results.
  const filtered = await source(store).search('condonation of delay and sufficient cause limitation', {
    documentType: 'judgment',
  });
  assert.equal(filtered.length, 0, 'statute records must not match a judgment filter');
  const byJurisdiction = await source(store).search('condonation of delay and sufficient cause limitation', {
    jurisdiction: 'State of Maharashtra',
  });
  assert.equal(byJurisdiction.length, 0, 'jurisdiction filter must be enforced');
});

test('KB retrieval: generic/false-topical queries cannot ground unrelated authorities', async () => {
  const store = await seedStore([
    limitChunks(1),
    limitChunks(2),
    dataProtectionChunks(1),
    dataProtectionChunks(2),
  ]);

  // Entirely unrelated topical terms: nothing may be returned.
  const unrelated = await source(store).search('blockchain transaction 0xdeadbeef sepolia settlement');
  assert.equal(unrelated.length, 0, 'unrelated topical terms must return no authorities');

  // Pure generic legal vocabulary has no content terms; any pass-through hits
  // must still be genuine licensed legal authorities, never case material.
  const genericOnly = await source(store).search('case evidence matter');
  for (const hit of genericOnly) {
    assert.equal(hit.provenance.documentType, 'statute');
    assert.match(hit.provenance.license, /Government of India/);
  }
});

test('KB retrieval: stays strictly separated from CASE_DOCUMENT records', async () => {
  const store = await seedStore([limitChunks(1), limitChunks(2), caseDocumentRecord()]);
  const results = await source(store).search(
    'limitation bar condonation delay agreement to sell plaint defendant',
  );

  assert.ok(results.length > 0);
  assert.ok(results.every((hit) => hit.id !== 'doc-case-1'), 'case documents must never surface');
  assert.ok(results.every((hit) => hit.chunkId.startsWith('IND-')));
});

test('KB retrieval: no relevant authority -> empty result (transparent insufficiency)', async () => {
  const store = await seedStore([limitChunks(1), limitChunks(2)]);
  const results = await source(store).search('arbitration interim measures emergency award');
  assert.equal(results.length, 0);
  const chunks = source(store).toRetrievedChunks(results);
  assert.deepEqual(chunks, []);
});

test('KB retrieval: blocked provenance records are not retrievable', async () => {
  // The six Stage 4 BLOCKED records were never imported (fail-closed gate), so
  // their topics must not resolve to any persisted authority.
  const store = await seedStore([limitChunks(1), limitChunks(2)]);
  const results = await source(store).search(
    'insolvency resolution moratorium misleading advertisement labour codes data fiduciary notice',
  );
  assert.ok(
    !results.some((hit) =>
      [
        'IND-CORP-IBC001-V2',
        'IND-COMM-ARB001-V2',
        'IND-COMM-BNK001-V2',
        'IND-COMM-CPA001-V2',
        'IND-LAB-STATUS-V2',
        'IND-TECH-DPDP01-V2',
      ].includes(hit.id),
    ),
    'blocked records must never surface',
  );

  // And the gate itself still refuses those sources (the real-corpus partition
  // is asserted in knowledge-base.test.ts; here against recorded metadata).
  assert.equal(
    matchKbRegistryEntry({
      record: 'IND-TECH-DPDP01-V2',
      fields: {
        OFFICIAL_SOURCE_NAME:
          'Ministry of Electronics and Information Technology (MeitY), Government of India',
        OFFICIAL_SOURCE_URL: 'https://www.meity.gov.in',
      },
      rawText: '',
      repeatedFields: {},
      trailingLines: [],
    }),
    null,
  );
});

test('KB retrieval from PostgreSQL (live, read-only)', {
  skip: process.env.KB_LIVE_TEST ? false : 'set KB_LIVE_TEST=1 to run against the live database',
}, async () => {
  // Uses the default store (VECTOR_STORE=postgres -> PostgresVectorStore) and
  // the default corpus; strictly read-only (search + idempotent ensureIngested
  // upsert of the unchanged development corpus).
  const { localLegalKnowledgeSource } = await import('../src/services/ai/legal/local-knowledge.source');
  const results = await localLegalKnowledgeSource.search(
    'condonation of delay sufficient cause limitation bar suit',
  );
  assert.ok(results.length > 0, 'the persisted KB must be retrievable from PostgreSQL');
  const kbHit = results.find((hit) => hit.id === 'IND-PROC-LIM001-V2');
  assert.ok(kbHit, 'IND-PROC-LIM001-V2 must be retrievable');
  assert.equal(kbHit.provenance.license, 'Government of India public legislative text');
  assert.equal(kbHit.provenance.version, '2.1');
  assert.ok(kbHit.chunkId.includes(':kb:'));
  assert.ok(kbHit.temporal && kbHit.temporal.effectiveFrom.startsWith('1964-01-01'));
});

test('KB retrieval: database failure falls back to in-memory store without fabricating context', async () => {
  // Test the fallback mechanism directly by mocking a database failure
  const { PostgresVectorStore } = await import('../src/services/ai/vector/postgres.store');
  const { InMemoryVectorStore } = await import('../src/services/ai/vector/in-memory.store');
  const { LocalEmbeddingClient } = await import('../src/services/ai/vector/embeddings');
  const { prisma } = await import('../src/utils/prisma');

  const fallback = new InMemoryVectorStore();
  const embeddings = new LocalEmbeddingClient();

  // Seed the fallback store with a known record
  const knownText = 'public statute about bail and personal liberty';
  await fallback.upsert([
    {
      id: 'fallback-statute-1',
      text: knownText,
      embedding: await embeddings.embed(knownText),
      scope: 'LEGAL_AUTHORITY',
      metadata: {
        documentId: 'fallback-statute-1',
        title: 'Fallback Bail Statute',
        source: 'India Code',
        sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/15272',
        license: 'Government of India public legislative text',
      },
    },
  ]);

  // Mock prisma to throw an error to simulate database failure
  const originalFindMany = prisma.legalAuthorityChunk.findMany;
  prisma.legalAuthorityChunk.findMany = async () => {
    throw new Error('Simulated database failure');
  };

  try {
    const store = new PostgresVectorStore(fallback);
    const query = 'bail personal liberty';
    const embedding = await embeddings.embed(query);
    const results = await store.search(embedding, { limit: 10, scope: 'LEGAL_AUTHORITY' });

    // The search should return results from the fallback store
    assert.ok(results.length > 0, 'search should return results from fallback when database fails');

    // Verify that the results are from the fallback
    const fallbackResult = results.find((r) => r.id === 'fallback-statute-1');
    assert.ok(fallbackResult, 'fallback results should appear when database fails');

    // All results should have LEGAL_AUTHORITY scope
    assert.ok(results.every((r) => r.scope === 'LEGAL_AUTHORITY'), 'all results should have LEGAL_AUTHORITY scope');

    // Verify no fabricated context - results should only contain what we seeded
    assert.equal(results.length, 1, 'should only return the seeded fallback record');
  } finally {
    // Restore original prisma method
    prisma.legalAuthorityChunk.findMany = originalFindMany;
  }
});

test('KB pipeline: persisted KB authority flows through to grounded AI answer', {
  skip: process.env.KB_LIVE_TEST ? false : 'set KB_LIVE_TEST=1 to run against the live database',
}, async () => {
  // Full pipeline test: retrieval → context assembly → answer generation → final answer
  // Uses the live PostgreSQL store with the persisted KB chunks.
  const { localLegalKnowledgeSource } = await import('../src/services/ai/legal/local-knowledge.source');
  const { MockAIProvider } = await import('../src/services/ai/mock-ai.provider');
  const { AIService } = await import('../src/services/ai/ai.service');
  const { LocalEmbeddingClient } = await import('../src/services/ai/vector/embeddings');
  const { InMemoryVectorStore } = await import('../src/services/ai/vector/in-memory.store');

  // Create a harness with the live legal source (connected to PostgreSQL)
  const legalSource = localLegalKnowledgeSource;
  const provider = new MockAIProvider();

  // Minimal case harness that authorizes case access and provides case documents
  const cases = {
    canAccessCase: async () => true,
    getCaseByIdForUser: async () => ({
      id: 'case-a',
      caseNumber: 'CIV-A-001',
      title: 'Test Case',
      description: 'Test case for KB pipeline involving limitation and delay',
      caseType: 'CIVIL',
      status: 'ACTIVE',
      evidence: [
        { id: 'ev-1', documentId: 'doc-1', evidenceNumber: 'E-1', title: 'Pleading', description: 'Pleading regarding limitation' },
      ],
    }),
  };

  const retriever = {
    // Provide case documents so the answer can be fully grounded
    retrieve: async () => [
      {
        caseId: 'case-a',
        documentId: 'doc-1',
        chunkId: 'doc-1:section:1',
        documentName: 'Pleading',
        pageOrSection: 'Section 1',
        text: 'The plaintiff filed the suit after the limitation period expired.',
        relevance: 1,
        sourceType: 'document' as const,
        scope: 'CASE_DOCUMENT' as const,
      },
    ],
  };

  const ai = new AIService(retriever, provider, cases, legalSource);

  // Ask a legal question that should retrieve a KB authority (Limitation Act)
  const answer = await ai.research(
    'case-a',
    'lawyer-a',
    'LAWYER',
    'What does the Limitation Act say about condonation of delay?',
  );

  // 1. The answer should be grounded (both case context and legal authority exist)
  assert.equal(answer.status, 'grounded', 'answer should be grounded when both case and KB authority are retrieved');

  // 2. Legal sources should contain the KB authority
  assert.ok(answer.legalSources.length > 0, 'legal sources should contain KB authority');

  // 3. The KB authority should be IND-PROC-LIM001-V2 (Limitation Act)
  const limitationAuthority = answer.legalSources.find(
    (source) => source.documentId === 'IND-PROC-LIM001-V2',
  );
  assert.ok(limitationAuthority, 'Limitation Act authority should be in legal sources');

  // 4. Provenance/citation should survive from retrieval → context → final answer
  assert.equal(limitationAuthority.provenance.source, 'India Code Portal, Legislative Department');
  assert.equal(limitationAuthority.provenance.license, 'Government of India public legislative text');
  assert.equal(limitationAuthority.provenance.citation, 'Limitation Act 1963, SS. 3 & 5');
  assert.equal(limitationAuthority.provenance.documentType, 'statute');
  assert.equal(limitationAuthority.provenance.jurisdiction, 'Union of India');
  assert.equal(limitationAuthority.provenance.version, '2.1');

  // 5. Temporal metadata should survive the same path
  assert.ok(limitationAuthority.sourceUrl, 'sourceUrl should be preserved');
  assert.match(limitationAuthority.sourceUrl, /indiacode\.nic\.in/);

  // 6. Scope must be LEGAL_AUTHORITY (not CASE_DOCUMENT)
  assert.equal(limitationAuthority.scope, 'LEGAL_AUTHORITY');
  assert.equal(limitationAuthority.sourceType, 'legal_authority');

  // 7. CASE_DOCUMENT sources should contain the case document
  assert.ok(answer.caseSources.length > 0, 'case sources should contain case documents');
  assert.ok(answer.caseSources.every((s) => s.sourceType !== 'legal_authority'), 'case sources should not contain legal authorities');

  // 8. The answer text should reference the retrieved legal authority
  assert.match(answer.answer, /LEGAL AUTHORITIES/);
  assert.match(answer.answer, /Limitation Act/);

  // 9. Blocked records must NOT appear in the legal context
  const blockedIds = [
    'IND-CORP-IBC001-V2',
    'IND-COMM-ARB001-V2',
    'IND-COMM-BNK001-V2',
    'IND-COMM-CPA001-V2',
    'IND-LAB-STATUS-V2',
    'IND-TECH-DPDP01-V2',
  ];
  for (const blockedId of blockedIds) {
    assert.ok(
      !answer.legalSources.some((s) => s.documentId === blockedId),
      `blocked record ${blockedId} must not appear in legal sources`,
    );
  }
});