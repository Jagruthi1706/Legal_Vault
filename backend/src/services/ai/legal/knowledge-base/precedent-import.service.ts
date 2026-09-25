/**
 * Judicial Precedent import service (Stage 12) — DRY-RUN FIRST.
 *
 * Mirrors the proven statutory `kb-import.service.ts` architecture (same safety
 * properties, same dep-injection seams, same PostgresVectorStore target) while
 * consuming the Stage 11 precedent foundation:
 *
 *   precedents/ corpus (.txt, delimiter-framed `Record: CASE_ID` blocks)
 *     → parsePrecedentCorpus
 *     → per-record structural validation (invalid records are CLASSIFIED and
 *       reported with their reason; a real import refuses to proceed while any
 *       record is invalid)
 *     → fail-closed provenance gate (resolvePrecedentRegistryEntry; no license
 *       is ever invented; unresolvable sources are BLOCKED and never stored)
 *     → chunkPrecedentRecord (deterministic `${recordId}:prec:${index}` ids)
 *     → existing embedding abstraction (local deterministic client; no Gemini)
 *     → existing PostgresVectorStore / LegalAuthorityChunk (upsert = idempotent;
 *       no new table, no new Prisma model, no schema change)
 *
 * Safety properties (identical to the statutory importer):
 * - Dry run performs ZERO database writes (it does not even preflight).
 * - Blocked/invalid records are reported and never stored.
 * - A real import is explicit and guarded (expected record count, embedding
 *   dimension, postgres target, no invalid/duplicate ids), gated by a read-only
 *   preflight plus a post-write persistence verification, so an in-memory
 *   fallback can never be reported as success.
 * - Chunk ids follow the Stage 11 precedent convention, so re-running upserts
 *   identical rows (idempotent, no duplicates). Existing statutory `:kb:` rows
 *   are never touched.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getAIConfig } from '../../../../config/ai.config';
import { prisma } from '../../../../utils/prisma';
import { EmbeddingClient, LocalEmbeddingClient } from '../../vector/embeddings';
import { getLegalVectorStore } from '../../vector/store.factory';
import { VectorRecord, VectorStore } from '../../vector/types';
import { chunkPrecedentRecord, PrecedentChunk } from './precedent-chunker';
import {
  getPrecedentValidationError,
  parsePrecedentCorpus,
  ParsedPrecedentRecord,
} from './precedent-record';
import {
  PrecedentProvenance,
  resolvePrecedentRegistryEntry,
  toPrecedentProvenance,
} from './precedent-provenance';

/** Corpus folder for structured precedent records (see ./precedents/README.md). */
export const PRECEDENT_CORPUS_DIRNAME = 'precedents';

export const resolvePrecedentCorpusDir = (): string => {
  const candidates = [
    path.join(process.cwd(), 'src', 'services', 'ai', 'legal', 'knowledge-base', PRECEDENT_CORPUS_DIRNAME),
    path.join(__dirname, PRECEDENT_CORPUS_DIRNAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Precedent corpus directory not found. Tried: ${candidates.join(' | ')}`);
};

/**
 * Loads every `*.txt` corpus file in the precedents folder, in deterministic
 * sorted filename order. An empty folder yields an empty corpus — the importer
 * never invents content, and no approved precedent corpus exists yet.
 */
const loadCorpusFromFiles = async (): Promise<string> => {
  const dir = resolvePrecedentCorpusDir();
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith('.txt'))
    .sort();
  return files.map((file) => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n');
};

export interface PrecedentInvalidRecord {
  recordId: string;
  reason: string;
}

export interface PrecedentBlockedRecord {
  recordId: string;
  officialSourceName: string;
  officialSourceUrl: string;
  verificationStatus: string;
  reason: string;
}

export interface PrecedentReadyRecord {
  recordId: string;
  caseName: string;
  court: string;
  citation: string;
  officialSourceName: string;
  officialSourceUrl: string;
  verificationStatus: string;
  registryId: string;
  /** Provenance evidence basis for this record (auditable). */
  membership: 'registered_member' | 'dataset_url';
  license: string;
  chunkCount: number;
  chunkIds: string[];
}

export interface PrecedentDryRunResult {
  targetVectorStore: string;
  usingPostgresStore: boolean;
  precedentRecordsFound: number;
  invalidRecords: PrecedentInvalidRecord[];
  blockedRecords: PrecedentBlockedRecord[];
  readyRecords: PrecedentReadyRecord[];
  duplicateRecordIds: string[];
  duplicateChunkIds: string[];
  chunksToWrite: number;
  chunkIds: string[];
  embeddingDimension: number;
  expectedRecordCount?: number;
  recordCountMatchesExpectation: boolean;
  expectedEmbeddingDimension?: number;
  embeddingDimensionMatchesExpectation: boolean;
}

export interface PrecedentPersistenceVerification {
  ok: boolean;
  chunkIdsChecked: number;
  chunksFound: number;
  missingChunkIds: string[];
  totalLegalAuthorityChunks: number;
  precedentAuthorityKindRows: number;
  chunksPerDocument: Record<string, number>;
  expectedDocumentIdsMissing: string[];
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

export interface PrecedentImportResult extends PrecedentDryRunResult {
  writtenChunkIds: string[];
  verification: PrecedentPersistenceVerification;
}

export interface PrecedentImportDeps {
  store?: VectorStore;
  embeddings?: EmbeddingClient;
  loadCorpusText?: () => Promise<string>;
  preflight?: () => Promise<void>;
  /** Overrides the configured target (tests); defaults to getAIConfig().vectorStore. */
  targetVectorStore?: string;
  verifyPersistence?: (
    chunkIds: string[],
    documentIds: string[],
  ) => Promise<PrecedentPersistenceVerification>;
}

interface PreparedPrecedent {
  record: ParsedPrecedentRecord;
  provenance: PrecedentProvenance;
  registryId: string;
  membership: 'registered_member' | 'dataset_url';
  chunks: PrecedentChunk[];
}

/**
 * Classify ONE parsed record into its import outcome. Pure and deterministic:
 * - structurally invalid → `{ kind: 'invalid' }` with the validation reason
 * - provenance cannot be resolved → `{ kind: 'blocked' }` (fail-closed)
 * - otherwise → `{ kind: 'ready' }` with provenance + deterministic chunks
 */
const classifyRecord = (
  record: ParsedPrecedentRecord,
):
  | { kind: 'invalid'; reason: string }
  | { kind: 'blocked'; reason: string }
  | {
      kind: 'ready';
      provenance: PrecedentProvenance;
      registryId: string;
      membership: 'registered_member' | 'dataset_url';
      chunks: PrecedentChunk[];
    } => {
  const validationError = getPrecedentValidationError(record);
  if (validationError) {
    return { kind: 'invalid', reason: validationError };
  }

  const registry = resolvePrecedentRegistryEntry(record);
  if (!registry) {
    return {
      kind: 'blocked',
      reason:
        'Official source is not covered by a precedent-compatible registered provenance/license entry (fail-closed; no license invented).',
    };
  }

  const provenance = toPrecedentProvenance(record, registry);
  const chunks = chunkPrecedentRecord({
    record,
    provenance: {
      source: provenance.legal.source,
      license: provenance.legal.license,
      documentType: 'judgment',
    },
  });
  return {
    kind: 'ready',
    provenance,
    registryId: registry.registryId,
    membership: registry.membership,
    chunks,
  };
};

const withExpectation = (
  plan: PrecedentDryRunResult,
  options: { expectedRecordCount?: number; expectedEmbeddingDimension?: number },
): PrecedentDryRunResult => ({
  ...plan,
  expectedRecordCount: options.expectedRecordCount,
  recordCountMatchesExpectation:
    options.expectedRecordCount === undefined ||
    plan.precedentRecordsFound === options.expectedRecordCount,
  expectedEmbeddingDimension: options.expectedEmbeddingDimension,
  embeddingDimensionMatchesExpectation:
    options.expectedEmbeddingDimension === undefined ||
    plan.embeddingDimension === options.expectedEmbeddingDimension,
});

const defaultPreflight = async (): Promise<void> => {
  await prisma.legalAuthorityChunk.count();
};

/**
 * Stage 12 importer for judicial precedents into the EXISTING
 * PostgresVectorStore / LegalAuthorityChunk table. DRY-RUN FIRST.
 */
export class PrecedentImportService {
  constructor(private readonly deps: PrecedentImportDeps = {}) {}

  private embeddings(): EmbeddingClient {
    return this.deps.embeddings ?? new LocalEmbeddingClient();
  }

  private store(): VectorStore {
    return this.deps.store ?? getLegalVectorStore();
  }

  private async prepare(): Promise<{
    plan: PrecedentDryRunResult;
    prepared: PreparedPrecedent[];
  }> {
    const loadCorpusText = this.deps.loadCorpusText ?? loadCorpusFromFiles;
    const text = await loadCorpusText();
    const { records } = parsePrecedentCorpus(text);

    // Dry-run must never abort on individual bad records: classify every record
    // and report the reason. A real import refuses to proceed on any invalid
    // or duplicated record (see `import`).
    const invalidRecords: PrecedentInvalidRecord[] = [];
    const blockedRecords: PrecedentBlockedRecord[] = [];
    const prepared: PreparedPrecedent[] = [];

    const recordIdCounts = new Map<string, number>();
    for (const record of records) {
      recordIdCounts.set(record.record, (recordIdCounts.get(record.record) || 0) + 1);

      const outcome = classifyRecord(record);
      if (outcome.kind === 'invalid') {
        invalidRecords.push({
          recordId: record.record || '(unnamed record)',
          reason: outcome.reason,
        });
        continue;
      }
      if (outcome.kind === 'blocked') {
        blockedRecords.push({
          recordId: record.record,
          officialSourceName: record.fields.OFFICIAL_SOURCE_NAME || '',
          officialSourceUrl: record.fields.OFFICIAL_SOURCE_URL || '',
          verificationStatus: record.fields.VERIFICATION_STATUS || '',
          reason: outcome.reason,
        });
        continue;
      }
      prepared.push({
        record,
        provenance: outcome.provenance,
        registryId: outcome.registryId,
        membership: outcome.membership,
        chunks: outcome.chunks,
      });
    }

    const duplicateRecordIds = [...recordIdCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id)
      .sort();

    const chunkIds = prepared.flatMap((item) => item.chunks.map((chunk) => chunk.chunkId));
    const chunkIdCounts = new Map<string, number>();
    for (const id of chunkIds) {
      chunkIdCounts.set(id, (chunkIdCounts.get(id) || 0) + 1);
    }
    const duplicateChunkIds = [...chunkIdCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id)
      .sort();

    const embeddingDimension = (
      await this.embeddings().embed('embedding dimension probe')
    ).length;
    const targetVectorStore = this.deps.targetVectorStore ?? getAIConfig().vectorStore;

    const plan: PrecedentDryRunResult = {
      targetVectorStore,
      usingPostgresStore: targetVectorStore === 'postgres',
      precedentRecordsFound: records.length,
      invalidRecords,
      blockedRecords,
      readyRecords: prepared.map((item) => ({
        recordId: item.record.record,
        caseName: item.record.fields.CASE_NAME || item.record.record,
        court: item.record.fields.COURT || '',
        citation: item.record.fields.CITATION || '',
        officialSourceName: item.provenance.verification.officialSourceName,
        officialSourceUrl: item.provenance.verification.officialSourceUrl,
        verificationStatus: item.provenance.verification.verificationStatus,
        registryId: item.registryId,
        membership: item.membership,
        license: item.provenance.legal.license,
        chunkCount: item.chunks.length,
        chunkIds: item.chunks.map((chunk) => chunk.chunkId),
      })),
      duplicateRecordIds,
      duplicateChunkIds,
      chunksToWrite: chunkIds.length,
      chunkIds,
      embeddingDimension,
      expectedRecordCount: undefined,
      recordCountMatchesExpectation: true,
      expectedEmbeddingDimension: undefined,
      embeddingDimensionMatchesExpectation: true,
    };
    return { plan, prepared };
  }

  /** Read-only plan. Performs NO database writes and NO preflight. */
  async dryRun(
    options: { expectedRecordCount?: number; expectedEmbeddingDimension?: number } = {},
  ): Promise<PrecedentDryRunResult> {
    const { plan } = await this.prepare();
    return withExpectation(plan, options);
  }

  /**
   * Explicit real import. Guards (all abort BEFORE any write): expected record
   * count, expected embedding dimension, postgres target, zero invalid records,
   * zero duplicate record/chunk ids, non-empty prepared set, and a read-only
   * preflight. Post-write, a Prisma persistence gate verifies every chunk
   * physically reached PostgreSQL with precedent metadata.
   */
  async import(
    options: { expectedRecordCount?: number; expectedEmbeddingDimension?: number } = {},
  ): Promise<PrecedentImportResult> {
    const { plan, prepared } = await this.prepare();
    const expected = withExpectation(plan, options);

    if (!expected.recordCountMatchesExpectation) {
      throw new Error(
        `Precedent import aborted: precedent record count ${expected.precedentRecordsFound} does not match the expected ${options.expectedRecordCount}.`,
      );
    }
    if (!expected.embeddingDimensionMatchesExpectation) {
      throw new Error(
        `Precedent import aborted: embedding dimension ${expected.embeddingDimension} does not match the expected ${options.expectedEmbeddingDimension}.`,
      );
    }
    if (!expected.usingPostgresStore) {
      throw new Error(
        `Precedent import aborted: target vector store is "${expected.targetVectorStore}", not postgres.`,
      );
    }
    if (expected.invalidRecords.length > 0) {
      throw new Error(
        `Precedent import aborted: ${expected.invalidRecords.length} invalid precedent record(s). First: ${expected.invalidRecords[0].recordId} — ${expected.invalidRecords[0].reason}`,
      );
    }
    if (expected.duplicateRecordIds.length > 0) {
      throw new Error(
        `Precedent import aborted: duplicate precedent record id(s): ${expected.duplicateRecordIds.join(', ')}.`,
      );
    }
    if (expected.duplicateChunkIds.length > 0) {
      throw new Error(
        `Precedent import aborted: duplicate precedent chunk id(s): ${expected.duplicateChunkIds.join(', ')}.`,
      );
    }
    if (prepared.length === 0) {
      throw new Error(
        'Precedent import aborted: every record is blocked or invalid; nothing may be stored.',
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
    const verification = await (
      this.deps.verifyPersistence ?? verifyPrecedentPersistence
    )(writtenChunkIds, writtenDocumentIds);

    if (!verification.ok) {
      throw new Error(
        `Precedent import FAILED persistence verification: ${verification.missingChunkIds.length} chunk(s) missing from PostgreSQL ` +
          `(in-memory fallback must never be reported as success). Missing: ${verification.missingChunkIds.slice(0, 5).join(', ')}…`,
      );
    }

    return { ...expected, writtenChunkIds, verification };
  }

  private async toVectorRecord(
    item: PreparedPrecedent,
    chunk: PrecedentChunk,
  ): Promise<VectorRecord> {
    const record = item.record;
    const metadata: VectorRecord['metadata'] = {
      documentId: record.record,
      title: record.fields.CASE_NAME || record.record,
      source: item.provenance.legal.source,
      sourceUrl: item.provenance.legal.sourceUrl,
      license: item.provenance.legal.license,
      court: record.fields.COURT || '',
      caseName: record.fields.CASE_NAME || '',
      caseNumber: record.fields.CASE_NUMBER || '',
      judgmentDate: record.fields.DATE || '',
      citation: record.fields.CITATION || '',
      documentType: 'judgment',
      jurisdiction: item.provenance.legal.jurisdiction,
      attribution: item.provenance.legal.attribution || '',
      version: record.fields.VERSION || '',
      recordId: record.record,
      authorityKind: 'judicial_precedent',
      provenanceMembership: item.membership,
      pageOrSection: chunk.pageOrSection,
      chunkIndex: chunk.chunkIndex,
      chunkCount: chunk.chunkCount,
      corpusDir: PRECEDENT_CORPUS_DIRNAME,
      verificationStatus: item.provenance.verification.verificationStatus,
      lastVerifiedAt: item.provenance.verification.lastVerifiedAt,
      officialIdentifier: item.provenance.verification.officialIdentifier,
      currentStatus: record.fields.CURRENT_STATUS || '',
      legalArea: record.fields.LEGAL_AREA || '',
      subArea: record.fields.SUB_AREA || '',
      overruledStatus: record.fields.OVERRULED_STATUS || '',
      // Verbatim per-chunk losslessness: every source label not rendered into
      // this chunk's text travels in the row metadata (incl. authorityKind).
      ...chunk.metadata,
    };
    return {
      id: chunk.chunkId,
      text: chunk.text,
      embedding: await this.embeddings().embed(
        `${record.fields.CASE_NAME || record.record}\n${chunk.text}`,
      ),
      scope: 'LEGAL_AUTHORITY',
      metadata,
    };
  }
}

/**
 * Post-write persistence gate (read-only) for precedent imports, mirroring
 * `verifyKbPersistence`. Fails unless every expected chunk physically exists in
 * PostgreSQL with the right scope, judgment provenance and precedent metadata —
 * preventing the vector store's in-memory fallback from ever being reported as
 * a successful import. Verifies the existing statutory `:kb:` rows are intact by
 * only reporting counts (it never modifies anything).
 */
export const verifyPrecedentPersistence = async (
  chunkIds: string[],
  documentIds: string[],
): Promise<PrecedentPersistenceVerification> => {
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

  const jsonObject = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const precedentRows = allLegalRows.filter(
    (row) => jsonObject(row.metadata).authorityKind === 'judicial_precedent',
  );

  const caseRecordLeaks = await prisma.legalAuthorityChunk.count({
    where: {
      OR: [{ scope: { not: 'LEGAL_AUTHORITY' } }, { documentId: { startsWith: 'CASE-' } }],
    },
  });

  const provenanceVerified = rows.every((row) => {
    const metadata = jsonObject(row.metadata);
    const provenance = jsonObject(row.provenance);
    return (
      Boolean(provenance.source) &&
      Boolean(provenance.sourceUrl) &&
      Boolean(provenance.license) &&
      provenance.documentType === 'judgment' &&
      metadata.documentId !== undefined &&
      metadata.license !== undefined &&
      metadata.authorityKind === 'judicial_precedent' &&
      metadata.verificationStatus !== undefined
    );
  });

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
    precedentAuthorityKindRows: precedentRows.length,
    chunksPerDocument,
    expectedDocumentIdsMissing,
    everyDocumentHasMultipleChunks,
    caseRecordLeaks,
    duplicateChunkIds: allLegalRows.length - uniqueIds.size,
    provenanceVerified,
    referenceTableCounts: { cases, documents, evidence, blockchainTransactions },
  };
};

export const precedentImportService = new PrecedentImportService();

