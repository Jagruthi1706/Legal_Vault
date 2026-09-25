import { HTTP_STATUS } from '../../constants/app.constants';
import { AppError } from '../../utils/AppError';
import { caseService as defaultCaseService } from '../case.service';
import { resolveAIProvider } from './provider.factory';
import { caseRetrievalService as defaultRetriever } from './retrieval.service';
import {
  localLegalKnowledgeSource,
  LocalLegalKnowledgeSource,
} from './legal/local-knowledge.source';
import { chunkDocument } from './chunking.service';
import { attachmentHandler, AttachmentFile } from './attachment.handler';
import {
  AI_APPLICATION_INSTRUCTIONS,
  AIAnswer,
  AIOperation,
  AIProvider,
  DocumentRetriever,
  RetrievedChunk,
  AIProviderMode,
} from './types';
import { unavailableAnswer } from './answer.assembler';

/**
 * Attachment-aware Legal KB retrieval query.
 *
 * Attachment questions mix document-specific entities (party names, dates,
 * incident wording) with genuinely legal terms. The Legal KB lexical gate
 * requires ~34% of distinctive query terms to appear in a retrieved authority,
 * so passing the raw user question (e.g. "Kiran Mehta ... 14 April 2026 ...")
 * drowns out otherwise relevant authorities such as "Article 21".
 *
 * This deterministic helper keeps only legal markers/concepts (article and
 * section numbers, statute names, doctrines) and the citation numbers attached
 * to them, dropping names, dates and incidental narrative terms. When no legal
 * signal is detected it returns the original question unchanged, so the
 * existing retrieval gate still decides (no weakening, no false retrieval).
 *
 * The result is used ONLY for Legal KB authority retrieval; the full user
 * question always remains the provider's query alongside CASE_DOCUMENT.
 */
const LEGAL_MARKER_TERMS = new Set<string>([
  'article', 'section', 'schedule', 'rule', 'regulation', 'provision', 'clause',
  'subclause', 'ordinance', 'code', 'constitution', 'constitutional', 'amendment',
  'statute', 'statutory', 'doctrine', 'directive', 'principle', 'penal', 'criminal',
  'civil', 'tribunal', 'jurisdiction', 'injunction', 'warrant', 'precedent',
  'judgment', 'judicial', 'ipc', 'crpc', 'habeas', 'corpus', 'chapter', 'act',
  'law', 'laws', 'subsection', 'subrule', 'byelaw', 'proviso', 'regulation', 'notification',
  'order', 'decree', 'decrees', 'appeal', 'review', 'revision', 'limitation',
]);

const LEGAL_CONCEPT_TERMS = new Set<string>([
  'right', 'life', 'liberty', 'personal', 'freedom', 'equality', 'protection',
  'procedure', 'lawful', 'legality', 'detention', 'arrest', 'bail', 'writ',
  'fundamental', 'remedy', 'relief', 'enforcement', 'violation', 'discrimination',
  'privacy', 'speech', 'property', 'contract', 'tort', 'negligence', 'limitation',
  'delay', 'compensation', 'damage', 'custody', 'sanction', 'punishment', 'theft',
  'fraud', 'ownership', 'possession', 'interim', 'liability', 'warranty',
  'employment', 'labour', 'lease', 'tenant', 'divorce', 'maintenance',
  'succession', 'inheritance', 'defamation',
]);

/**
 * Deterministic legal-focus derivation for Legal KB retrieval.
 *
 * Tokens are checked directly (not via extractContentTerms) because that
 * existing helper intentionally drops generic legal words such as "section",
 * "rule" and "act", and short citation numbers such as "21", which must be
 * preserved here. The resulting query is later passed through the unchanged
 * Legal KB topical gate, so no retrieval behavior is weakened.
 */
export const deriveLegalRetrievalQuery = (userQuery: string): string => {
  const tokens = userQuery.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const legal: string[] = [];
  const numbers: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    if (/^\d+[a-z]*$/.test(token)) {
      numbers.push(token);
      continue;
    }
    if (LEGAL_MARKER_TERMS.has(token) || LEGAL_CONCEPT_TERMS.has(token)) {
      legal.push(token);
    }
  }
  // A bare number without any legal term is noise (e.g. "2026"); only keep
  // citation numbers when a legal signal exists.
  if (legal.length === 0) return userQuery;
  return [...legal, ...numbers].join(' ');
};

type CaseLookup = {
  canAccessCase(caseId: string, userId: string, role: string): Promise<boolean>;
  getCaseByIdForUser(
    caseId: string,
    userId: string,
    role?: string,
  ): Promise<{
    id: string;
    caseNumber: string;
    title: string;
    description?: string | null;
    caseType?: string;
    status?: string;
    evidence?: Array<{
      id: string;
      documentId?: string | null;
      evidenceNumber: string;
      title: string;
      description?: string | null;
    }>;
  } | null>;
};

export class AIService {
  constructor(
    private readonly retriever: DocumentRetriever = defaultRetriever,
    private readonly provider: AIProvider = resolveAIProvider().provider,
    private readonly cases: CaseLookup = defaultCaseService,
    private readonly legalSource: LocalLegalKnowledgeSource = localLegalKnowledgeSource,
  ) {}

  describeProvider(): { mode: string; model?: string; warnings: string[] } {
    const resolved = resolveAIProvider();
    return {
      mode: resolved.mode,
      model: resolved.model,
      warnings: resolved.warnings,
    };
  }

  /**
   * Retrieval wrapper that converts infrastructure failures (e.g. a transient
   * Prisma "Server has closed the connection") into a clear temporary
   * unavailability instead of a fabricated answer or an unexplained HTTP 500.
   * Authorization/validation AppErrors still propagate untouched.
   */
  private async retrieveContext(
    caseId: string,
    userId: string,
    role: string,
    query: string,
  ): Promise<RetrievedChunk[] | null> {
    try {
      return await this.retriever.retrieve(caseId, userId, query, role);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      // Logged server-side so persistent database failures stay visible in
      // diagnostics; the user only sees the temporary-unavailability answer.
      console.error(
        '[ai.service] Case retrieval failed:',
        error instanceof Error ? `${error.name}: ${error.message}` : error,
      );
      return null;
    }
  }

  private retrievalUnavailable(operation: AIOperation): AIAnswer {
    return unavailableAnswer(
      operation,
      this.describeProvider().mode as AIProviderMode,
      [
        'Case material could not be retrieved temporarily (possible database or connection issue). Please try again shortly.',
      ],
    );
  }

  async chat(
    caseId: string,
    userId: string,
    role: string,
    query: string,
    operation: AIOperation = 'answer',
  ): Promise<AIAnswer> {
    if (operation === 'summarize') return this.summarize(caseId, userId, role);
    if (operation === 'analyze_evidence')
      return this.analyzeEvidence(caseId, userId, role, query);
    if (operation === 'research')
      return this.research(caseId, userId, role, query);
    if (operation === 'compare_authorities')
      return this.compareAuthorities(caseId, userId, role, query);

    const caseContext = await this.retrieveContext(caseId, userId, role, query);
    if (!caseContext) {
      return this.retrievalUnavailable('answer');
    }
    const answer = await this.provider.generateAnswer({
      applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
      userQuery: query,
      context: caseContext,
      caseContext,
      legalContext: [],
      operation: 'answer',
    });
    return this.scoped(caseId, answer);
  }

  async summarize(
    caseId: string,
    userId: string,
    role: string,
  ): Promise<AIAnswer> {
    const retrieved = await this.retrieveContext(caseId, userId, role, '');
    if (!retrieved) {
      return this.retrievalUnavailable('summarize');
    }
    const caseContext = await this.withCaseMetadata(
      caseId,
      userId,
      role,
      retrieved,
    );
    const answer = await this.provider.summarize({
      applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
      context: caseContext,
      caseContext,
      legalContext: [],
    });
    return this.scoped(caseId, answer);
  }

  async analyzeEvidence(
    caseId: string,
    userId: string,
    role: string,
    query: string,
  ): Promise<AIAnswer> {
    let documentContext = await this.retrieveContext(
      caseId,
      userId,
      role,
      query,
    );
    if (!documentContext) {
      return this.retrievalUnavailable('analyze_evidence');
    }
    if (documentContext.length === 0) {
      const fallback = await this.retrieveContext(caseId, userId, role, '');
      if (!fallback) {
        return this.retrievalUnavailable('analyze_evidence');
      }
      documentContext = fallback;
    }
    const caseContext = await this.withEvidenceMetadata(
      caseId,
      userId,
      role,
      documentContext,
    );
    const answer = await this.provider.analyzeEvidence({
      applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
      userQuery: query || 'Explain the evidence in this case.',
      context: caseContext,
      caseContext,
      legalContext: [],
      operation: 'analyze_evidence',
    });
    return this.scoped(caseId, answer);
  }

  async research(
    caseId: string,
    userId: string,
    role: string,
    query: string,
  ): Promise<AIAnswer> {
    return this.withTwoContexts(
      caseId,
      userId,
      role,
      query || 'Find legal authorities relevant to this case.',
      'research',
    );
  }

  async compareAuthorities(
    caseId: string,
    userId: string,
    role: string,
    query: string,
  ): Promise<AIAnswer> {
    return this.withTwoContexts(
      caseId,
      userId,
      role,
      query ||
        'Compare authorized case facts against retrieved legal authorities.',
      'compare_authorities',
    );
  }

  /**
   * Chat with case documents, including user-provided attachments.
   * Attachments are treated as case evidence and integrated with regular case retrieval.
   */
  async chatWithAttachments(
    caseId: string,
    userId: string,
    role: string,
    query: string,
    attachments: AttachmentFile[] = [],
    operation: AIOperation = 'answer',
  ): Promise<AIAnswer> {
    // Verify case access
    await this.requireCase(caseId, userId, role);

    // Retrieve regular case documents
    const retrieved = await this.retrieveContext(caseId, userId, role, query);
    if (!retrieved) {
      return this.retrievalUnavailable(operation);
    }
    let caseContext = retrieved;

    // Process and add attachments as case evidence
    const attachmentChunks = await attachmentHandler.processAttachments(
      caseId,
      attachments,
    );
    caseContext = [...attachmentChunks, ...caseContext];

    // Legal KB authority retrieval. The uploaded attachment is CASE_DOCUMENT evidence
    // and must never become legal authority. This mirrors the standalone research path so
    // attached-document questions are grounded in BOTH the document facts and retrieved
    // LEGAL_AUTHORITY, while the provider keeps the two scopes strictly separated.
    // The user question is distilled to its legal focal terms so document names, dates
    // and parties cannot suppress relevant authority retrieval.
    // Statutory authorities and judicial precedents are retrieved separately so the
    // provider can distinguish statutes from precedents in the prompt.
    const legalHits = await this.legalSource.search(deriveLegalRetrievalQuery(query), { authorityKind: 'statute' });
    const legalContext = this.legalSource.toRetrievedChunks(legalHits);
    const precedentHits = await this.legalSource.search(deriveLegalRetrievalQuery(query), { authorityKind: 'judicial_precedent' });
    const precedentContext = this.legalSource.toRetrievedChunks(precedentHits);

    // Generate answer using the combined case evidence + statutory authority + precedents.
    // The provider separates CASE_DOCUMENT (attachment/case facts), statutory LEGAL_AUTHORITY,
    // and JUDICIAL PRECEDENT contexts.
    const answer = await this.provider.generateAnswer({
      applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
      userQuery: query,
      context: caseContext,
      caseContext,
      legalContext,
      precedentContext,
      operation,
    });
    return this.scoped(caseId, answer);
  }

  /**
   * Answer questions without an authorized case context.
   * Only attachment content (and optional legal authorities) is used.
   * No case documents are retrieved and no case authorization is checked.
   */
  async chatNoCase(
    query: string,
    attachments: AttachmentFile[] = [],
    operation: AIOperation = 'answer',
  ): Promise<AIAnswer> {
    let attachmentChunks: RetrievedChunk[] = [];
    if (attachments?.length > 0) {
      attachmentChunks = await attachmentHandler.processAttachments(
        undefined,
        attachments,
      );
    }

    const hasAttachments = attachmentChunks.length > 0;

    // Operations that require case context cannot run without a case.
    if (operation === 'summarize' || operation === 'analyze_evidence') {
      return unavailableAnswer(
        operation,
        this.describeProvider().mode as AIProviderMode,
        ['This operation requires an authorized case workspace.'],
      );
    }

    // Research/compare operations: try legal authorities, fall back to attachments
    if (operation === 'research' || operation === 'compare_authorities') {
      const legalHits = await this.legalSource.search(deriveLegalRetrievalQuery(query), { authorityKind: 'statute' });
      const legalContext = this.legalSource.toRetrievedChunks(legalHits);
      const precedentHits = await this.legalSource.search(deriveLegalRetrievalQuery(query), { authorityKind: 'judicial_precedent' });
      const precedentContext = this.legalSource.toRetrievedChunks(precedentHits);

      if (attachmentChunks.length === 0 && legalContext.length === 0 && precedentContext.length === 0) {
        return unavailableAnswer(
          operation,
          this.describeProvider().mode as AIProviderMode,
          [
            'Open an authorized case workspace for case-scoped research, or attach a file with the relevant content.',
          ],
        );
      }

      const answer = await this.provider.research({
        applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
        userQuery: query,
        context: attachmentChunks,
        caseContext: attachmentChunks,
        legalContext,
        precedentContext,
        operation,
      });
      return answer;
    }

    // Default answer operation
    if (!hasAttachments) {
      // No case and no attachments: a general legal/civil-law question may still
      // be answered from the trusted local legal knowledge source. Arbitrary case
      // documents are never searched or retrieved on this path (Phase 4).
      // Statutes and judicial precedents are retrieved as separate contexts.
      // A precedent-only question remains answerable: the combined availability of
      // LEGAL AUTHORITIES and JUDICIAL PRECEDENTS is what matters, not the presence
      // of a statute alone.
      const legalHits = await this.legalSource.search(query, { authorityKind: 'statute', documentType: 'statute' });
      const legalContext = this.legalSource.toRetrievedChunks(legalHits);
      const precedentHits = await this.legalSource.search(query, { authorityKind: 'judicial_precedent', documentType: 'judgment' });
      const precedentContext = this.legalSource.toRetrievedChunks(precedentHits);
      if (legalContext.length === 0 && precedentContext.length === 0) {
        return unavailableAnswer(
          operation,
          this.describeProvider().mode as AIProviderMode,
          [
            'No case context or attachments are available. Open an authorized case workspace or attach a file to answer your question, or ask a general legal question covered by the built-in trusted knowledge base.',
          ],
        );
      }
      const answer = await this.provider.generateAnswer({
        applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
        userQuery: query,
        context: [],
        caseContext: [],
        legalContext,
        precedentContext,
        operation,
      });
      return answer;
    }

    // Legal KB authority retrieval for attached-document questions (no-case path).
    // The attachment is CASE_DOCUMENT evidence; legal authority is retrieved separately
    // and never merged into it, so document facts and law stay provenance-distinct.
    // Statutes and judicial precedents are retrieved as separate contexts so the
    // provider can distinguish them in the prompt.
    // The user question is distilled to its legal focal terms so document names, dates
    // and parties cannot suppress relevant authority retrieval.
    const legalHits = await this.legalSource.search(deriveLegalRetrievalQuery(query), { authorityKind: 'statute', documentType: 'statute' });
    const legalContext = this.legalSource.toRetrievedChunks(legalHits);
    const precedentHits = await this.legalSource.search(deriveLegalRetrievalQuery(query), { authorityKind: 'judicial_precedent', documentType: 'judgment' });
    const precedentContext = this.legalSource.toRetrievedChunks(precedentHits);

    const answer = await this.provider.generateAnswer({
      applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
      userQuery: query,
      context: attachmentChunks,
      caseContext: attachmentChunks,
      legalContext,
      precedentContext,
      operation,
    });
    return answer;
  }

  private async withTwoContexts(
    caseId: string,
    userId: string,
    role: string,
    query: string,
    operation: AIOperation,
  ): Promise<AIAnswer> {
    let caseContext = await this.retrieveContext(caseId, userId, role, query);
    if (!caseContext) {
      return this.retrievalUnavailable(operation);
    }
    if (caseContext.length === 0) {
      const fallback = await this.retrieveContext(caseId, userId, role, '');
      if (!fallback) {
        return this.retrievalUnavailable(operation);
      }
      caseContext = fallback;
    }

    // Statutory authorities and judicial precedents are retrieved separately so
    // the provider receives distinct LEGAL AUTHORITIES and JUDICIAL PRECEDENTS
    // contexts (Stage 16). The existing topical gate is unchanged.
    const legalHits = await this.legalSource.search(query, { authorityKind: 'statute', documentType: 'statute' });
    const legalContext = this.legalSource.toRetrievedChunks(legalHits);
    const precedentHits = await this.legalSource.search(query, { authorityKind: 'judicial_precedent', documentType: 'judgment' });
    const precedentContext = this.legalSource.toRetrievedChunks(precedentHits);

    const answer = await this.provider.research({
      applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
      userQuery: query,
      context: caseContext,
      caseContext,
      legalContext,
      precedentContext,
      operation,
    });
    return this.scoped(caseId, answer);
  }

  private async withCaseMetadata(
    caseId: string,
    userId: string,
    role: string,
    context: RetrievedChunk[],
  ): Promise<RetrievedChunk[]> {
    const record = await this.requireCase(caseId, userId, role);
    const text = [
      `Case number: ${record.caseNumber}`,
      `Title: ${record.title}`,
      record.description ? `Description: ${record.description}` : '',
      record.caseType ? `Type: ${record.caseType}` : '',
      record.status ? `Status: ${record.status}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return [
      ...chunkDocument({
        caseId,
        documentId: record.id,
        documentName: `${record.caseNumber} case record`,
        text,
        sourceType: 'case_record',
        scope: 'CASE_DOCUMENT',
      }),
      ...context,
    ].slice(0, 8);
  }

  private async withEvidenceMetadata(
    caseId: string,
    userId: string,
    role: string,
    context: RetrievedChunk[],
  ): Promise<RetrievedChunk[]> {
    const record = await this.requireCase(caseId, userId, role);
    const evidenceChunks = (record.evidence ?? []).flatMap((item) =>
      chunkDocument({
        caseId,
        documentId: item.documentId || item.id,
        evidenceId: item.id,
        documentName: `${item.evidenceNumber} ${item.title}`,
        text: [
          item.title,
          item.description || 'No evidence description recorded.',
        ].join('\n'),
        sourceType: 'evidence',
        scope: 'CASE_DOCUMENT',
        chunkId: `${item.id}:evidence:1`,
      }),
    );

    return [...evidenceChunks, ...context].slice(0, 8);
  }

  private async requireCase(caseId: string, userId: string, role: string) {
    if (!(await this.cases.canAccessCase(caseId, userId, role))) {
      throw new AppError(
        'Case not found or not authorized.',
        HTTP_STATUS.NOT_FOUND,
      );
    }
    const record = await this.cases.getCaseByIdForUser(caseId, userId, role);
    if (!record) {
      throw new AppError(
        'Case not found or not authorized.',
        HTTP_STATUS.NOT_FOUND,
      );
    }
    return record;
  }

  private scoped(caseId: string, answer: AIAnswer): AIAnswer {
    const sources = answer.sources
      .filter(
        (source) =>
          source.scope !== 'LEGAL_AUTHORITY' &&
          source.sourceType !== 'legal_authority' &&
          source.caseId === caseId,
      )
      .map((source) => ({ ...source, text: source.text.slice(0, 500) }));
    const allowedCaseIds = new Set(sources.map((source) => source.chunkId));
    const legalSources = (answer.legalSources ?? []).filter(
      (source) =>
        source.scope === 'LEGAL_AUTHORITY' &&
        source.provenance &&
        source.documentId !== caseId,
    );

    return {
      ...answer,
      sources,
      citations: answer.citations.filter((citation) =>
        allowedCaseIds.has(citation.chunkId),
      ),
      caseSources: (answer.caseSources ?? []).filter((citation) =>
        allowedCaseIds.has(citation.chunkId),
      ),
      legalSources,
    };
  }
}

export const aiService = new AIService();

