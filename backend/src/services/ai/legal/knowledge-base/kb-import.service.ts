import fs from 'node:fs';
import path from 'node:path';
import { getAIConfig } from '../../../../config/ai.config';
import { prisma } from '../../../../utils/prisma';
import { EmbeddingClient, LocalEmbeddingClient } from '../../vector/embeddings';
import { getLegalVectorStore } from '../../vector/store.factory';
import { VectorRecord, VectorStore } from '../../vector/types';
import { getProvenanceRegistry } from '../provenance.registry';
import { extractDocxText } from './docx-parser';
import {
  KBRecordProvenance,
  kbRecordProvenance,
  matchKbRegistryEntry,
} from './kb-provenance';
import { chunkLegalRecord, LegalRecordChunk } from './legal-record-chunker';
import {
  parseKnowledgeBaseCorpus,
  validateKnowledgeBaseRecords,
  ParsedKnowledgeBaseRecord,
} from './record-parser';

export const KB_DOCX_FILENAME = 'Indian_Legal_Knowledge_Base_V2.1_Final.docx';
/** Deterministic expectation for the verified V2.1 statutory corpus. */
export const KB_EXPECTED_STATUTORY_RECORDS = 16;

export const resolveKbDocxPath = (): string => {
  const candidates = [
    path.join(process.cwd(), 'src', 'services', 'ai', 'legal', 'knowledge-base', KB_DOCX_FILENAME),
    path.join(__dirname, KB_DOCX_FILENAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Knowledge Base DOCX not found. Tried: ${candidates.join(' | ')}`);
};

const loadCorpusTextFromDocx = async (): Promise<string> => {
  const { text } = await extractDocxText(fs.readFileSync(resolveKbDocxPath()));
  return text;
};

export interface KBBlockedRecord {
  recordId: string;
  officialSourceName: string;
  officialSourceUrl: string;
  reason: string;
}

export interface KBReadyRecord {
  recordId: string;
  title: string;
  chunkCount: number;
  chunkIds: string[];
  registryId: string;
  license: string;
}

export interface KBDryRunResult {
  targetVectorStore: string;
  usingPostgresStore: boolean;
  statutoryRecordsFound: number;
  excludedCaseRecords: number;
  expectedRecordCount?: number;
  recordCountMatchesExpectation: boolean;
  blockedRecords: KBBlockedRecord[];
  readyRecords: KBReadyRecord[];
  chunksToWrite: number;
  chunkIds: string[];
  embeddingDimension: number;
  corpusVersion: string;
}

export interface KBPersistenceVerification {
  ok: boolean;
  chunkIdsChecked: number;
  chunksFound: number;
  missingChunkIds: string[];
  totalLegalAuthorityChunks: number;
  distinctDocumentIds: string[];
  expectedDocumentIdsMissing: string[];
  chunksPerDocument: Record<string, number>;
  everyDocumentHasMultipleChunks: boolean;
  caseRecordLeaks: number;
  duplicateChunkIds: number;
  provenanceVerified: boolean;
  referenceTableCounts: {
    cases: number;
    documents: number;
    evidence: number;
    blockchainTransactions: number;
  };
}

export interface KBImportResult extends KBDryRunResult {
  writtenChunkIds: string[];
  verification: KBPersistenceVerification;
}

export interface KBImportDeps {
  store?: VectorStore;
  embeddings?: EmbeddingClient;
  loadCorpusText?: () => Promise<string>;
  preflight?: () => Promise<void>;
  /** Overrides the configured target (tests); defaults to getAIConfig().vectorStore. */
  targetVectorStore?: string;
  verifyPersistence?: (
    chunkIds: string[],
    documentIds: string[],
  ) => Promise<KBPersistenceVerification>;
}

interface PreparedRecord {
  record: ParsedKnowledgeBaseRecord;
  provenance: KBRecordProvenance;
  license: string;
  registryId: string;
  chunks: LegalRecordChunk[];
}

/**
 * Stage 3 importer: persists the verified statutory Knowledge Base records into
 * the EXISTING PostgresVectorStore / LegalAuthorityChunk table.
 *
 * Safety properties:
 * - Dry run performs zero database writes.
 * - Provenance is fail-closed: only records whose official source matches an
 *   already-registered provenance entry are imported; blocked records are
 *   reported and never stored with invented licenses.
 * - A read-only preflight aborts before any write if the store is unreachable.
 * - A post-write persistence gate verifies via Prisma that every chunk really
 *   reached PostgreSQL, so an in-memory fallback can never be reported as
 *   success.
 * - Chunk ids are the Stage 2 convention `${documentId}:kb:${index}`, so
 *   re-running upserts identical rows (idempotent, no duplicates).
 * - Embeddings use the existing local deterministic client (never Gemini).
 */
export class KBImportService {
  constructor(private readonly deps: KBImportDeps = {}) {}

  private embeddings(): EmbeddingClient {
    return this.deps.embeddings ?? new LocalEmbeddingClient();
  }

  private store(): VectorStore {
    return this.deps.store ?? getLegalVectorStore();
  }

  private async prepare(): Promise<{
    plan: KBDryRunResult;
    prepared: PreparedRecord[];
  }> {
    const loadCorpusText = this.deps.loadCorpusText ?? loadCorpusTextFromDocx;
    const text = await loadCorpusText();
    const { records, stats } = parseKnowledgeBaseCorpus(text);
    validateKnowledgeBaseRecords(records);

    const registered = getProvenanceRegistry('india-code');
    const prepared: PreparedRecord[] = [];
    const blockedRecords: KBBlockedRecord[] = [];

    for (const record of records) {
      const match = matchKbRegistryEntry(record);
      if (!match || !registered) {
        blockedRecords.push({
          recordId: record.record,
          officialSourceName: record.fields.OFFICIAL_SOURCE_NAME || '',
          officialSourceUrl: record.fields.OFFICIAL_SOURCE_URL || '',
          reason: !registered
            ? 'Registered provenance entry "india-code" is unavailable.'
            : 'Official source is not covered by a registered provenance/license entry (fail-closed; no license invented).',
        });
        continue;
      }
      prepared.push({
        record,
        provenance: kbRecordProvenance(record),
        license: registered.license,
        registryId: match.registryId,
        chunks: chunkLegalRecord({
          record,
          provenance: { source: registered.datasetName },
        }),
      });
    }

    const embeddingDimension = (
      await this.embeddings().embed('embedding dimension probe')
    ).length;
    const chunkIds = prepared.flatMap((item) => item.chunks.map((chunk) => chunk.chunkId));
    const targetVectorStore = this.deps.targetVectorStore ?? getAIConfig().vectorStore;

    const plan: KBDryRunResult = {
      targetVectorStore,
      usingPostgresStore: targetVectorStore === 'postgres',
      statutoryRecordsFound: records.length,
      excludedCaseRecords: stats.excludedCaseRecords,
      recordCountMatchesExpectation: true, // neutral default; withExpectation() evaluates it
      blockedRecords,
      readyRecords: prepared.map((item) => ({
        recordId: item.record.record,
        title: item.record.fields.TITLE || item.record.record,
        chunkCount: item.chunks.length,
        chunkIds: item.chunks.map((chunk) => chunk.chunkId),
        registryId: item.registryId,
        license: item.license,
      })),
      chunksToWrite: chunkIds.length,
      chunkIds,
      embeddingDimension,
      corpusVersion: records[0]?.fields.VERSION || '',
    };
    return { plan, prepared };
  }

  /** Read-only plan. Performs NO database writes and NO preflight. */
  async dryRun(options: { expectedRecordCount?: number } = {}): Promise<KBDryRunResult> {
    const { plan } = await this.prepare();
    return withExpectation(plan, options.expectedRecordCount);
  }

  async import(options: { expectedRecordCount?: number } = {}): Promise<KBImportResult> {
    const { plan, prepared } = await this.prepare();
    const expected = withExpectation(plan, options.expectedRecordCount);

    if (!expected.recordCountMatchesExpectation) {
      throw new Error(
        `Knowledge Base import aborted: statutory record count ${expected.statutoryRecordsFound} does not match the expected ${options.expectedRecordCount}.`,
      );
    }
    if (!expected.usingPostgresStore) {
      throw new Error(
        `Knowledge Base import aborted: target vector store is "${expected.targetVectorStore}", not postgres.`,
      );
    }
    if (prepared.length === 0) {
      throw new Error(
        'Knowledge Base import aborted: every record is blocked by provenance/license validation; nothing may be stored.',
      );
    }

    // Read-only preflight: abort before ANY write if the store is unreachable.
    await (this.deps.preflight ?? defaultPreflight)();

    const vectorRecords: VectorRecord[] = [];
    for (const item of prepared) {
      for (const chunk of item.chunks) {
        vectorRecords.push(await this.toVectorRecord(item, chunk));
      }
    }

    await this.store().upsert(vectorRecords);

    const writtenChunkIds = vectorRecords.map((record) => record.id);
    const writtenDocumentIds = prepared.map((item) => item.record.record);
    const verification = await (this.deps.verifyPersistence ?? verifyKbPersistence)(
      writtenChunkIds,
      writtenDocumentIds,
    );

    if (!verification.ok) {
      throw new Error(
        `Knowledge Base import FAILED persistence verification: ${verification.missingChunkIds.length} chunk(s) missing from PostgreSQL ` +
          `(in-memory fallback must never be reported as success). Missing: ${verification.missingChunkIds.slice(0, 5).join(', ')}…`,
      );
    }

    return { ...expected, writtenChunkIds, verification };
  }

  private async toVectorRecord(
    item: PreparedRecord,
    chunk: LegalRecordChunk,
  ): Promise<VectorRecord> {
    const record = item.record;
    const metadata: VectorRecord['metadata'] = {
      documentId: record.record,
      title: record.fields.TITLE || record.record,
      source: item.provenance.source,
      sourceUrl: item.provenance.sourceUrl,
      license: item.license,
      court: record.fields.COURT_OR_AUTHORITY,
      citation: record.fields.OFFICIAL_CITATION,
      documentType: item.provenance.documentType,
      jurisdiction: item.provenance.jurisdiction,
      version: item.provenance.version,
      recordId: record.record,
      pageOrSection: chunk.pageOrSection,
      chunkIndex: chunk.chunkIndex,
      chunkCount: chunk.chunkCount,
      corpusFile: KB_DOCX_FILENAME,
      corpusVersion: item.provenance.version,
      verificationStatus: item.provenance.verificationStatus,
      lastVerifiedAt: item.provenance.lastVerifiedAt,
      officialIdentifier: item.provenance.officialIdentifier,
      currentStatus: record.fields.CURRENT_STATUS,
      effectiveFrom: record.fields.EFFECTIVE_FROM,
      effectiveTo: record.fields.EFFECTIVE_TO,
      authorityLevel: record.fields.AUTHORITY_LEVEL,
      legalArea: record.fields.LEGAL_AREA,
      subArea: record.fields.SUB_AREA,
      sourceTypeLabel: record.fields.SOURCE_TYPE,
      stateOrUt: record.fields.STATE_OR_UT,
      keywords: record.fields.KEYWORDS,
      // Verbatim per-chunk losslessness: every source label not rendered into
      // this chunk's text travels in the row metadata.
      ...chunk.metadata,
    };
    return {
      id: chunk.chunkId,
      text: chunk.text,
      embedding: await this.embeddings().embed(`${record.fields.TITLE}\n${chunk.text}`),
      scope: 'LEGAL_AUTHORITY',
      metadata,
    };
  }
}

const withExpectation = (
  plan: KBDryRunResult,
  expectedRecordCount?: number,
): KBDryRunResult => ({
  ...plan,
  expectedRecordCount,
  recordCountMatchesExpectation:
    expectedRecordCount === undefined ||
    plan.statutoryRecordsFound === expectedRecordCount,
});

const defaultPreflight = async (): Promise<void> => {
  await prisma.legalAuthorityChunk.count();
};

/**
 * Post-write persistence gate. Reads through the existing Prisma/Supabase path
 * and fails unless every expected chunk physically exists in PostgreSQL with
 * the right scope and provenance. This is what prevents the vector store's
 * in-memory fallback from ever being mistaken for a successful import.
 */
export const verifyKbPersistence = async (
  chunkIds: string[],
  documentIds: string[],
): Promise<KBPersistenceVerification> => {
  const rows = await prisma.legalAuthorityChunk.findMany({
    where: { id: { in: chunkIds } },
  });
  const missingChunkIds = chunkIds.filter((id) => !rows.some((row) => row.id === id));

  const allLegalRows = await prisma.legalAuthorityChunk.findMany({
    where: { scope: 'LEGAL_AUTHORITY' },
    select: { id: true, documentId: true, scope: true, provenance: true, metadata: true },
  });

  const chunksPerDocument: Record<string, number> = {};
  for (const row of allLegalRows) {
    chunksPerDocument[row.documentId] = (chunksPerDocument[row.documentId] || 0) + 1;
  }

  const caseRecordLeaks = await prisma.legalAuthorityChunk.count({
    where: {
      OR: [{ scope: { not: 'LEGAL_AUTHORITY' } }, { documentId: { startsWith: 'CASE-' } }],
    },
  });

  const provenanceVerified = rows.every(
    (row) =>
      Boolean(row.provenance) &&
      typeof row.provenance === 'object' &&
      Boolean((row.provenance as { source?: unknown }).source) &&
      Boolean((row.metadata as { source?: unknown })?.source) &&
      Boolean((row.metadata as { documentId?: unknown })?.documentId) &&
      Boolean((row.metadata as { license?: unknown })?.license) &&
      Boolean((row.metadata as { version?: unknown })?.version),
  );

  const expectedDocumentIdsMissing = documentIds.filter(
    (documentId) => !allLegalRows.some((row) => row.documentId === documentId),
  );
  const everyDocumentHasMultipleChunks = documentIds.every(
    (documentId) => (chunksPerDocument[documentId] || 0) >= 2,
  );

  const [cases, documents, evidence, blockchainTransactions] = await Promise.all([
    prisma.case.count(),
    prisma.document.count(),
    prisma.evidence.count(),
    prisma.blockchainTransaction.count(),
  ]);

  const uniqueIds = new Set(allLegalRows.map((row) => row.id));

  return {
    ok:
      missingChunkIds.length === 0 &&
      expectedDocumentIdsMissing.length === 0 &&
      everyDocumentHasMultipleChunks &&
      caseRecordLeaks === 0 &&
      uniqueIds.size === allLegalRows.length &&
      provenanceVerified,
    chunkIdsChecked: chunkIds.length,
    chunksFound: rows.length,
    missingChunkIds,
    totalLegalAuthorityChunks: allLegalRows.length,
    distinctDocumentIds: Object.keys(chunksPerDocument).sort(),
    expectedDocumentIdsMissing,
    chunksPerDocument,
    everyDocumentHasMultipleChunks,
    caseRecordLeaks,
    duplicateChunkIds: allLegalRows.length - uniqueIds.size,
    provenanceVerified,
    referenceTableCounts: { cases, documents, evidence, blockchainTransactions },
  };
};

export const kbImportService = new KBImportService();