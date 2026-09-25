import authorities from './corpus/authorities.json';
import { ingestLegalAuthorities } from './ingestion.pipeline';
import {
  LegalKnowledgeDocument,
  LegalKnowledgeSource,
  LegalSearchFilters,
  LegalKnowledgeTemporal,
} from './knowledge-source';
import { LegalProvenance, RetrievedChunk } from '../types';
import { EmbeddingClient, LocalEmbeddingClient } from '../vector/embeddings';
import { getLegalVectorStore } from '../vector/store.factory';
import { VectorRecord, VectorStore } from '../vector/types';
import { combinedAuthorityScore, dedupeByDocumentId, lexicalAuthorityScore } from '../vector/ranking';
import { extractContentTerms, RELEVANCE_RATIO, termOccurs } from '../relevance';

/**
 * Normalises metadata from either the standard KB schema (lowercase keys) or the
 * CPC import schema (UPPERCASE keys: SOURCE_NAME, SOURCE_URL, AUTHORITY_KIND, etc.)
 * so downstream code (toProvenance, matchesFilters, result mapping) works uniformly.
 */
const normalizeMetadata = (
  metadata: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean | undefined> => ({
  ...metadata,
  source: metadata.source || metadata.SOURCE_NAME,
  sourceUrl: metadata.sourceUrl || metadata.SOURCE_URL,
  license: metadata.license || metadata.LICENSE,
  authorityKind: metadata.authorityKind || metadata.AUTHORITY_KIND,
  title: metadata.title || metadata.TITLE,
  jurisdiction: metadata.jurisdiction || metadata.JURISDICTION || 'India',
  attribution: metadata.attribution || metadata.ATTRIBUTION,
  version: metadata.version || metadata.SOURCE_VERSION,
  citation: metadata.citation || metadata.OFFICIAL_CITATION,
  court: metadata.court || metadata.COURT,
  caseName: metadata.caseName || metadata.CASE_NAME,
  caseNumber: metadata.caseNumber || metadata.CASE_NUMBER,
  judgmentDate: metadata.judgmentDate || metadata.JUDGMENT_DATE,
  contentCompleteness: metadata.contentCompleteness,
  reportStatus: metadata.reportStatus || metadata.VERIFICATION_STATUS,
});

/** Derives a human-readable title for CPC records that lack a `title` metadata field. */
const deriveTitle = (metadata: Record<string, string | number | boolean | undefined>): string => {
  if (metadata.title || metadata.TITLE) return String(metadata.title || metadata.TITLE);
  const act = String(metadata.ACT || '');
  const provType = String(metadata.PROVISION_TYPE || metadata.pageOrSection || '');
  const provNum = String(metadata.PROVISION_NUMBER || '');
  if (act && provType && provNum) return `${act} — ${provType} ${provNum}`;
  if (act && provType) return `${act} — ${provType}`;
  if (act) return act;
  return '';
};

/** Gets the base document ID from a chunk ID, stripping chunk suffixes. */
const getBaseDocumentId = (chunkId: string): string => {
  const colonIdx = chunkId.indexOf(':');
  return colonIdx > 0 ? chunkId.substring(0, colonIdx) : chunkId;
};

const toProvenance = (metadata: Record<string, string | number | boolean | undefined>): LegalProvenance => ({
  source: String(metadata.source || metadata.SOURCE_NAME || ''),
  sourceUrl: String(metadata.sourceUrl || metadata.SOURCE_URL || ''),
  license: String(metadata.license || metadata.LICENSE || ''),
  court: metadata.court || metadata.COURT ? String(metadata.court || metadata.COURT) : undefined,
  caseName: metadata.caseName || metadata.CASE_NAME ? String(metadata.caseName || metadata.CASE_NAME) : undefined,
  caseNumber: metadata.caseNumber || metadata.CASE_NUMBER ? String(metadata.caseNumber || metadata.CASE_NUMBER) : undefined,
  judgmentDate: metadata.judgmentDate || metadata.JUDGMENT_DATE ? String(metadata.judgmentDate || metadata.JUDGMENT_DATE) : undefined,
  citation: metadata.citation || metadata.OFFICIAL_CITATION ? String(metadata.citation || metadata.OFFICIAL_CITATION) : undefined,
  documentType: (metadata.documentType || metadata.DOCUMENT_TYPE || 'other') as LegalProvenance['documentType'],
  jurisdiction: String(metadata.jurisdiction || metadata.JURISDICTION || 'India'),
  attribution: metadata.attribution || metadata.ATTRIBUTION ? String(metadata.attribution || metadata.ATTRIBUTION) : undefined,
  ingestedAt: metadata.ingestedAt ? String(metadata.ingestedAt) : undefined,
  version: metadata.version || metadata.SOURCE_VERSION ? String(metadata.version || metadata.SOURCE_VERSION) : undefined,
  authorityKind: (metadata.authorityKind || metadata.AUTHORITY_KIND) as LegalProvenance['authorityKind'],
  contentCompleteness: metadata.contentCompleteness ? String(metadata.contentCompleteness) : undefined,
  reportStatus: metadata.reportStatus || metadata.VERIFICATION_STATUS ? String(metadata.reportStatus || metadata.VERIFICATION_STATUS) : undefined,
});

const toTemporal = (metadata: Record<string, string | number | boolean | undefined>): LegalKnowledgeTemporal | undefined => {
  const currentStatus = String(metadata.currentStatus || '');
  const effectiveFrom = String(metadata.effectiveFrom || '');
  const effectiveTo = String(metadata.effectiveTo || '');
  if (!currentStatus && !effectiveFrom && !effectiveTo) {
    return undefined;
  }
  // Verbatim lifecycle metadata from the source record — never inferred.
  return { currentStatus, effectiveFrom, effectiveTo };
};

/**
 * Filter enforcement on the search results. The in-memory store applies filters
 * itself; the PostgreSQL store currently does not, so the same predicates are
 * enforced here uniformly (idempotent for stores that already filtered).
 */
const matchesFilters = (
  hit: VectorRecord & { score: number },
  filters: LegalSearchFilters,
): boolean => {
    if (filters.court && String(hit.metadata.court || '') !== filters.court) {
    return false;
  }
  // Normalise both lowercase (KB) and UPPERCASE (CPC import) metadata keys so
  // that documentType / authorityKind filtering works for either schema.
  const md = hit.metadata && typeof hit.metadata === 'object' ? normalizeMetadata(hit.metadata) : hit.metadata;

  if (filters.documentType && String(md.documentType || '') !== filters.documentType) {
    return false;
  }
  if (filters.jurisdiction && String(md.jurisdiction || 'India') !== filters.jurisdiction) {
    return false;
  }
  if (filters.authorityKind) {
    const recordAuthorityKind = String(md.authorityKind || '');
    if (filters.authorityKind === 'judicial_precedent') {
      // Precedents carry authorityKind='judicial_precedent' in metadata.
      // Some precedent records may only carry documentType='judgment' instead;
      // accept either marker so the judgment fallback works for both schemas.
      const isPrecedent =
        recordAuthorityKind === 'judicial_precedent' ||
        String(md.documentType || '') === 'judgment';
      if (!isPrecedent) {
        return false;
      }
    } else if (filters.authorityKind === 'statute') {
      // Statutes are identified by documentType='statute'. They may not carry
      // authorityKind metadata, so we accept either the metadata marker or the
      // documentType as the statute signal.
      const isStatute =
        recordAuthorityKind === 'statute' || String(md.documentType || '') === 'statute';
      if (!isStatute) {
        return false;
      }
    }
  }
  return true;
};

export class LocalLegalKnowledgeSource implements LegalKnowledgeSource {
  private ready: Promise<void> | null = null;

  constructor(
    private readonly store: VectorStore = getLegalVectorStore(),
    private readonly embeddings: EmbeddingClient = new LocalEmbeddingClient(),
    private readonly corpus: unknown[] = authorities,
  ) {}

  async search(query: string, filters: LegalSearchFilters = {}) {
    await this.ensureIngested();
    const embedding = await this.embeddings.embed(query);
    const hits = await this.store.search(embedding, {
      limit: 256,
      scope: 'LEGAL_AUTHORITY',
      filter: {
        court: filters.court,
        documentType: filters.documentType,
        jurisdiction: filters.jurisdiction,
        // authorityKind is NOT passed to the store's native filter because
        // statutes may not carry authorityKind metadata. The uniform
        // matchesFilters() below applies the correct fallback logic.
      },
    });

    // Topical relevance gate — the same definition of "topical" used by the
    // case-document retrieval gate and the answer coverage check. Generic legal
    // words (case, court, evidence, act, section, …) can never establish
    // relevance on their own, so neither an unrelated statute nor an unrelated
    // KB record can be surfaced as "relevant" by generic-term overlap alone.
        // Structural/broad queries have no content terms and pass through.
    const contentTerms = extractContentTerms(query);

    const reranked = dedupeByDocumentId(
      hits
        .filter((hit) => {
          if (!matchesFilters(hit, filters)) {
            return false;
          }
          if (!filters.dateFrom) return true;
          const md = normalizeMetadata(hit.metadata);
          return String(md.judgmentDate || '') >= filters.dateFrom;
        })
        .map((hit) => {
          const md = normalizeMetadata(hit.metadata);
          const lexical = lexicalAuthorityScore(query, {
            title: deriveTitle(md),
            citation: String(md.citation || ''),
            text: hit.text,
            caseName: String(md.caseName || ''),
          });
          return { ...hit, metadata: md, score: combinedAuthorityScore(hit.score, lexical) };
        })
        .sort((a, b) => b.score - a.score),
    )
      .filter((hit) => {
        if (contentTerms.length === 0) {
          return true;
        }
        const md = normalizeMetadata(hit.metadata);
        const haystack = `${deriveTitle(md)} ${hit.text}`.toLowerCase();
        const matched = contentTerms.filter((term) => termOccurs(term, haystack)).length;
        return matched > 0 && matched / contentTerms.length >= RELEVANCE_RATIO;
      })
      .slice(0, 8);

    return reranked
      .filter((hit) => hit.scope === 'LEGAL_AUTHORITY')
      .map((hit) => {
        const md = hit.metadata;
        const baseId = String(md.documentId || md.DOCUMENT_ID || getBaseDocumentId(hit.id));
        return {
          id: baseId,
          title: deriveTitle(md),
          text: hit.text,
          provenance: toProvenance(md),
          relevance: Number(hit.score.toFixed(4)),
          chunkId: hit.id,
          pageOrSection:
            String(md.pageOrSection || '') ||
            `${String(md.PROVISION_TYPE || '')} ${String(md.PROVISION_NUMBER || '')}`.trim() ||
            'Section',
          temporal: toTemporal(md),
        };
      });
  }

  async getDocument(id: string): Promise<LegalKnowledgeDocument | null> {
    // Normalize the input ID to handle both exact IDs and chunk-derived IDs
    const normalizedId = getBaseDocumentId(id);
    
    // Try exact match first, then try matching as a base ID (for chunk-derived IDs)
    const match = (this.corpus as Array<{ id: string; title: string; text: string }>).find((item) => 
      item.id === id || item.id === normalizedId || getBaseDocumentId(item.id) === id || getBaseDocumentId(item.id) === normalizedId
    );
    if (!match) return null;
    const metadata = await this.getMetadata(match.id);
    if (!metadata) return null;
    return { id: match.id, title: match.title, text: match.text, provenance: metadata };
  }

  async getMetadata(id: string): Promise<LegalProvenance | null> {
    // Normalize the input ID to handle both exact IDs and chunk-derived IDs
    const normalizedId = getBaseDocumentId(id);
    
    const match = (this.corpus as Array<{
      id: string;
      source: string;
      sourceUrl: string;
      license: string;
      court?: string;
      caseName?: string;
      caseNumber?: string;
      judgmentDate?: string;
      citation?: string;
      documentType: LegalProvenance['documentType'];
      jurisdiction: string;
      attribution?: string;
      ingestedAt?: string;
      version?: string;
    }>).find((item) => item.id === id || item.id === normalizedId || getBaseDocumentId(item.id) === id || getBaseDocumentId(item.id) === normalizedId);
    if (!match) return null;
    return {
      source: match.source,
      sourceUrl: match.sourceUrl,
      license: match.license,
      court: match.court || undefined,
      caseName: match.caseName || undefined,
      caseNumber: match.caseNumber || undefined,
      judgmentDate: match.judgmentDate || undefined,
      citation: match.citation || undefined,
      documentType: match.documentType,
      jurisdiction: match.jurisdiction,
      attribution: match.attribution,
      ingestedAt: match.ingestedAt,
      version: match.version,
    };
  }

  toRetrievedChunks(results: Awaited<ReturnType<LegalKnowledgeSource['search']>>): RetrievedChunk[] {
    return results.map((item) => ({
      caseId: 'legal-corpus',
      documentId: item.id,
      chunkId: item.chunkId,
      documentName: item.title,
      pageOrSection: item.pageOrSection,
      text: item.text,
      relevance: item.relevance,
      sourceType: 'legal_authority',
      scope: 'LEGAL_AUTHORITY',
      provenance: item.provenance,
      temporal: item.temporal,
    }));
  }

  private async ensureIngested(): Promise<void> {
    if (!this.ready) {
      this.ready = ingestLegalAuthorities(this.store, this.embeddings, this.corpus).then(() => undefined);
    }
    await this.ready;
  }
}

export const localLegalKnowledgeSource = new LocalLegalKnowledgeSource();
