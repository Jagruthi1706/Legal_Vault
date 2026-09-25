import { z } from 'zod';
import authorities from './corpus/authorities.json';
import { assertCompatibleLicense } from './provenance.registry';
import { chunkDocument } from '../chunking.service';
import { EmbeddingClient } from '../vector/embeddings';
import { VectorRecord, VectorStore } from '../vector/types';
import { LegalProvenance } from '../types';

const rawAuthoritySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url(),
  license: z.string().min(1),
  court: z.string().optional(),
  caseName: z.string().optional(),
  caseNumber: z.string().optional(),
  judgmentDate: z.string().optional(),
  citation: z.string().optional(),
  documentType: z.enum(['judgment', 'statute', 'other']),
  jurisdiction: z.string().min(1),
  attribution: z.string().optional(),
  ingestedAt: z.string().optional(),
  version: z.string().optional(),
});

export type RawLegalAuthority = z.infer<typeof rawAuthoritySchema>;

const toProvenance = (raw: RawLegalAuthority): LegalProvenance => ({
  source: raw.source,
  sourceUrl: raw.sourceUrl,
  license: raw.license,
  court: raw.court || undefined,
  caseName: raw.caseName || undefined,
  caseNumber: raw.caseNumber || undefined,
  judgmentDate: raw.judgmentDate || undefined,
  citation: raw.citation || undefined,
  documentType: raw.documentType,
  jurisdiction: raw.jurisdiction,
  attribution: raw.attribution,
  ingestedAt: raw.ingestedAt,
  version: raw.version,
});

export const validateLegalAuthority = (input: unknown): RawLegalAuthority => {
  const parsed = rawAuthoritySchema.parse(input);
  assertCompatibleLicense(parsed.license, parsed.id);
  return parsed;
};

export const normalizeLegalAuthority = (raw: RawLegalAuthority): RawLegalAuthority => ({
  ...raw,
  title: raw.title.trim(),
  text: raw.text.replace(/\s+\n/g, '\n').trim(),
  court: raw.court?.trim() || '',
  citation: raw.citation?.trim() || '',
});

export const ingestLegalAuthorities = async (
  store: VectorStore,
  embeddings: EmbeddingClient,
  documents: unknown[] = authorities,
): Promise<number> => {
  const records: VectorRecord[] = [];

  for (const item of documents) {
    const normalized = normalizeLegalAuthority(validateLegalAuthority(item));
    const provenance = toProvenance(normalized);
    const chunks = chunkDocument({
      caseId: 'legal-corpus',
      documentId: normalized.id,
      documentName: normalized.title,
      text: normalized.text,
      sourceType: 'legal_authority',
      scope: 'LEGAL_AUTHORITY',
      provenance,
    });

    for (const chunk of chunks) {
      records.push({
        id: chunk.chunkId,
        text: chunk.text,
        embedding: await embeddings.embed(`${normalized.title}\n${chunk.text}`),
        scope: 'LEGAL_AUTHORITY',
        metadata: {
          documentId: normalized.id,
          title: normalized.title,
          source: provenance.source,
          sourceUrl: provenance.sourceUrl,
          license: provenance.license,
          court: provenance.court || '',
          caseName: provenance.caseName || '',
          caseNumber: provenance.caseNumber || '',
          judgmentDate: provenance.judgmentDate || '',
          citation: provenance.citation || '',
          documentType: provenance.documentType,
          jurisdiction: provenance.jurisdiction,
          attribution: provenance.attribution || '',
          ingestedAt: provenance.ingestedAt || '',
          version: provenance.version || '',
          pageOrSection: chunk.pageOrSection,
        },
      });
    }
  }

  await store.upsert(records);
  return records.length;
};
