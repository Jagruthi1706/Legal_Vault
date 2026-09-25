import { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma';
import { cosineSimilarity, VectorRecord, VectorSearchOptions, VectorStore } from './types';
import { dedupeByDocumentId, rejectCaseDocuments } from './ranking';
import { InMemoryVectorStore } from './in-memory.store';

type StoredRow = {
  id: string;
  documentId: string;
  scope: string;
  text: string;
  embedding: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  provenance: Prisma.JsonValue;
};

const toRecord = (row: StoredRow): VectorRecord => {
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, string | number | boolean | undefined>) }
      : {};
  // MERGE: the database may store provenance fields in a separate JSON column
  // (e.g. CPC import records). Merge those lowercase keys into metadata so the
  // downstream toProvenance() / normalizeMetadata() helpers see them. This is
  // additive and idempotent — existing records that already carry these keys
  // in metadata are unchanged (metadata takes precedence over provenance).
  if (row.provenance && typeof row.provenance === 'object' && !Array.isArray(row.provenance)) {
    const prov = row.provenance as Record<string, string | number | boolean | undefined>;
    for (const [key, value] of Object.entries(prov)) {
      if (!(key in metadata)) {
        metadata[key] = value;
      }
    }
  }
  return {
    id: row.id,
    text: row.text,
    embedding: Array.isArray(row.embedding) ? (row.embedding as number[]) : [],
    scope: row.scope === 'LEGAL_AUTHORITY' ? 'LEGAL_AUTHORITY' : 'CASE_DOCUMENT',
    metadata,
  };
};

/**
 * Optional PostgreSQL-backed legal-authority store.
 * Requires the unapplied additive LegalAuthorityChunk migration.
 * Falls back to in-memory when the table is not present.
 * Never upserts CASE_DOCUMENT records.
 */
export class PostgresVectorStore implements VectorStore {
  constructor(private readonly fallback: VectorStore = new InMemoryVectorStore()) {}

  async upsert(records: VectorRecord[]): Promise<void> {
    const legalOnly = rejectCaseDocuments(records);
    try {
      for (const record of legalOnly) {
        await prisma.legalAuthorityChunk.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            documentId: String(record.metadata.documentId || record.id),
            scope: 'LEGAL_AUTHORITY',
            text: record.text,
            embedding: record.embedding,
            provenance: {
              source: record.metadata.source,
              sourceUrl: record.metadata.sourceUrl,
              license: record.metadata.license,
              court: record.metadata.court,
              caseName: record.metadata.caseName,
              caseNumber: record.metadata.caseNumber,
              judgmentDate: record.metadata.judgmentDate,
              citation: record.metadata.citation,
              documentType: record.metadata.documentType,
              jurisdiction: record.metadata.jurisdiction,
            },
            metadata: record.metadata as Prisma.InputJsonValue,
          },
          update: {
            text: record.text,
            embedding: record.embedding,
            metadata: record.metadata as Prisma.InputJsonValue,
          },
        });
      }
    } catch {
      await this.fallback.upsert(legalOnly);
    }
  }

  async search(embedding: number[], options: VectorSearchOptions = {}): Promise<Array<VectorRecord & { score: number }>> {
    const limit = options.limit ?? 6;
    try {
      const rows = await prisma.legalAuthorityChunk.findMany({
        where: { scope: 'LEGAL_AUTHORITY' },
      });
      return dedupeByDocumentId(
        rows
          .map((row) => {
            const record = toRecord(row);
            return { ...record, score: cosineSimilarity(embedding, record.embedding) };
          })
          .filter((row) => row.scope === 'LEGAL_AUTHORITY')
          .sort((a, b) => b.score - a.score),
      ).slice(0, limit);
    } catch {
      return this.fallback.search(embedding, { ...options, scope: 'LEGAL_AUTHORITY' });
    }
  }

  async delete(ids: string[]): Promise<void> {
    try {
      await prisma.legalAuthorityChunk.deleteMany({ where: { id: { in: ids } } });
    } catch {
      await this.fallback.delete(ids);
    }
  }
}
