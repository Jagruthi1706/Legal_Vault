import { AppError } from '../../utils/AppError';
import { HTTP_STATUS } from '../../constants/app.constants';
import { caseService as defaultCaseService } from '../case.service';
import { documentService as defaultDocumentService } from '../document.service';
import { chunkDocument } from './chunking.service';
import { DocumentRetriever, RetrievedChunk } from './types';
import { escapeRegExp, extractContentTerms } from './relevance';

type CaseDocument = { id: string; caseId: string; originalFileName: string };

type CaseParty = {
  role?: string;
  user?: { name?: string | null; email?: string | null } | null;
};

type CaseDetail = {
  caseNumber: string;
  title: string;
  description?: string | null;
  caseType?: string;
  status?: string;
  createdBy?: { name?: string | null; email?: string | null } | null;
  assignedJudge?: { name?: string | null; email?: string | null } | null;
  participants?: CaseParty[];
  evidence?: Array<{
    evidenceNumber?: string;
    title?: string;
    description?: string | null;
    document?: { originalFileName?: string | null } | null;
  }>;
};

type CaseAccess = {
  canAccessCase(caseId: string, userId: string, role: string): Promise<boolean>;
  getCaseByIdForUser?(
    caseId: string,
    userId: string,
    role?: string,
  ): Promise<(CaseDetail & { id: string }) | null>;
};

type DocumentAccess = {
  getDocumentsForUser(caseId: string | undefined, userId: string, role?: string): Promise<CaseDocument[]>;
  getDocumentContent(documentId: string): Promise<Buffer | null>;
};

const MAX_CHUNKS = 6;
// A chunk may only support an answer when a meaningful share of the question's
// topical (non-generic) terms actually occur in it. 2/6 topical matches must NOT
// ground an unrelated case record, while 1/1 ("obligations") or 2/3 must.
const RELEVANCE_RATIO = 0.34;

/** Thrown when case/document retrieval fails for infrastructure reasons (e.g. a
 * transient Prisma connection loss). The AI layer converts this into a clear
 * "temporarily unavailable" answer instead of a fabricated reply or HTTP 500. */
export class RetrievalUnavailableError extends Error {
  constructor(message = 'Case retrieval is temporarily unavailable.', readonly cause?: unknown) {
    super(message);
    this.name = 'RetrievalUnavailableError';
  }
}

const scoreChunk = (chunk: RetrievedChunk, terms: string[]): number => {
  if (terms.length === 0) {
    return chunk.relevance;
  }
  const haystack = `${chunk.documentName} ${chunk.text}`.toLowerCase();
  return terms.reduce((score, term) => {
    const matches = haystack.match(new RegExp(`\\b${escapeRegExp(term)}(?:s|es)?\\b`, 'g'));
    return score + (matches ? matches.length : 0);
  }, 0);
};

/** Number of the query's topical terms that genuinely occur in the chunk. */
const matchedContentTerms = (chunk: RetrievedChunk, terms: string[]): number => {
  if (terms.length === 0) {
    return 0;
  }
  const haystack = `${chunk.documentName} ${chunk.text}`.toLowerCase();
  return terms.filter((term) => new RegExp(`\\b${escapeRegExp(term)}(?:s|es)?\\b`).test(haystack)).length;
};

export class CaseRetrievalService implements DocumentRetriever {
  constructor(
    private readonly cases: CaseAccess = defaultCaseService,
    private readonly documents: DocumentAccess = defaultDocumentService,
  ) {}

  async retrieve(caseId: string, userId: string, query: string, role: string): Promise<RetrievedChunk[]> {
    if (!caseId?.trim() || !userId?.trim()) {
      throw new AppError('Case not found or not authorized.', HTTP_STATUS.NOT_FOUND);
    }

    if (!(await this.cases.canAccessCase(caseId, userId, role))) {
      throw new AppError('Case not found or not authorized.', HTTP_STATUS.NOT_FOUND);
    }

    const chunks: RetrievedChunk[] = [];

    // Grounded case profile (metadata, parties, evidence register) fetched through the
    // same participant-scoped accessor used everywhere else, so authorization is
    // re-verified and no data outside this case can enter the context.
    let caseDetail: (CaseDetail & { id: string }) | null = null;
    try {
      caseDetail = (await this.cases.getCaseByIdForUser?.(caseId, userId, role)) ?? null;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      // Transient infrastructure failure (e.g. Prisma "Server has closed the
      // connection"). Never fabricate case facts on top of a broken retrieval.
      throw new RetrievalUnavailableError('Case profile retrieval is temporarily unavailable.', error);
    }
    if (caseDetail) {
      const parties = (caseDetail.participants ?? [])
        .map((participant) =>
          [participant.user?.name ?? participant.user?.email, participant.role]
            .filter(Boolean)
            .join(' — '),
        )
        .filter(Boolean);
      const evidenceRegister = (caseDetail.evidence ?? [])
        .map(
          (item) =>
            [item.evidenceNumber, item.title, item.document?.originalFileName]
              .filter(Boolean)
              .join(': ') + (item.description ? ` — ${item.description}` : ''),
        )
        .filter(Boolean);

      const profileLines = [
        `Case number: ${caseDetail.caseNumber}`,
        `Title: ${caseDetail.title}`,
        `Case type: ${caseDetail.caseType ?? 'Unknown'}`,
        `Status: ${caseDetail.status ?? 'Unknown'}`,
        caseDetail.description ? `Description: ${caseDetail.description}` : '',
        parties.length > 0 ? `Parties: ${parties.join('; ')}` : '',
        caseDetail.createdBy?.name ? `Case created by: ${caseDetail.createdBy.name}` : '',
        caseDetail.assignedJudge?.name ? `Assigned judge: ${caseDetail.assignedJudge.name}` : '',
        evidenceRegister.length > 0 ? `Evidence on record: ${evidenceRegister.join(' | ')}` : '',
      ].filter(Boolean);

      chunks.push({
        caseId,
        documentId: `case-record:${caseId}`,
        chunkId: `case-record:${caseId}:profile`,
        documentName: `${caseDetail.caseNumber} case record`,
        pageOrSection: 'Case profile',
        text: profileLines.join('\n'),
        relevance: 1,
        sourceType: 'case_record',
        scope: 'CASE_DOCUMENT',
      });
    }

    // Always scoped to the authorized case. Never search the full document table.
    let documents: CaseDocument[];
    try {
      documents = await this.documents.getDocumentsForUser(caseId, userId, role);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new RetrievalUnavailableError('Case document retrieval is temporarily unavailable.', error);
    }

    for (const document of documents) {
      if (document.caseId !== caseId) {
        continue;
      }
      try {
        const bytes = await this.documents.getDocumentContent(document.id);
        const text = bytes ? bytes.toString('utf8') : `[Metadata only: ${document.originalFileName}]`;
        chunks.push(
          ...chunkDocument({
            caseId,
            documentId: document.id,
            documentName: document.originalFileName,
            text,
            sourceType: 'document',
          }),
        );
      } catch {
        // Skip unreadable or missing stored files so retrieval remains grounded and does not crash the AI flow.
      }
    }

    // Ranking and gating both use the same topical terms so ordering reflects
    // genuine overlap rather than generic-word frequency.
    const contentTerms = extractContentTerms(query);
    const ranked = chunks
      .map((chunk) => ({ ...chunk, relevance: scoreChunk(chunk, contentTerms) }))
      .sort((a, b) => b.relevance - a.relevance);

    const bestByDocument = new Map<string, (typeof ranked)[number]>();
    for (const chunk of ranked) {
      const existing = bestByDocument.get(chunk.documentId);
      if (!existing || chunk.relevance > existing.relevance) {
        bestByDocument.set(chunk.documentId, chunk);
      }
    }
    const deduped = [...bestByDocument.values()].sort((a, b) => b.relevance - a.relevance);

    if (contentTerms.length === 0) {
      // Structural/broad question about the authorized case (e.g. "Summarize this
      // case.", "What are the key issues in this case?"). Every topical word is
      // generic, so the always-authorized case material is the correct context.
      const rankedBroad = [...deduped]
        .sort((a, b) => (b.sourceType === 'case_record' ? 1 : 0) - (a.sourceType === 'case_record' ? 1 : 0))
        .slice(0, MAX_CHUNKS);
      return rankedBroad;
    }

    // Topical question: a chunk may only support the answer when a meaningful
    // share of the question's topical terms genuinely occur in it. Generic words
    // ("case", "court", "evidence", "judge", ...) can never establish relevance,
    // so an unrelated case record cannot ground an unrelated query.
    const gated = deduped.filter((chunk) => {
      const matches = matchedContentTerms(chunk, contentTerms);
      return matches > 0 && matches / contentTerms.length >= RELEVANCE_RATIO;
    });

    return gated.slice(0, MAX_CHUNKS);
  }
}

export const caseRetrievalService = new CaseRetrievalService();
