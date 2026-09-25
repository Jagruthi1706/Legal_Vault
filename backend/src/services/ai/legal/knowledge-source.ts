import { LegalProvenance } from '../types';

export interface LegalKnowledgeDocument {
  id: string;
  title: string;
  text: string;
  provenance: LegalProvenance;
}

export interface LegalSearchFilters {
  court?: string;
  documentType?: 'judgment' | 'statute' | 'other';
  jurisdiction?: string;
  dateFrom?: string;
  /** Semantic authority-kind filter. When provided, only chunks matching this
   *  authorityKind are returned. Precedents use 'judicial_precedent'; statutes
   *  use 'statute'. Optional — when omitted, all LEGAL_AUTHORITY results are
   *  eligible (backward compatible). */
  authorityKind?: 'judicial_precedent' | 'statute';
}

export interface LegalKnowledgeTemporal {
  currentStatus: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface LegalKnowledgeSource {
  search(
    query: string,
    filters?: LegalSearchFilters,
  ): Promise<
    Array<
      LegalKnowledgeDocument & {
        relevance: number;
        chunkId: string;
        pageOrSection: string;
        /** Lifecycle metadata when the source carries it (verbatim, never inferred). */
        temporal?: LegalKnowledgeTemporal;
      }
    >
  >;
  getDocument(id: string): Promise<LegalKnowledgeDocument | null>;
  getMetadata(id: string): Promise<LegalProvenance | null>;
}
