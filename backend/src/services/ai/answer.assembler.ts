import {
  AIAnswer,
  AICitation,
  AIGroundingStatus,
  AIOperation,
  AIProviderMode,
  LegalSource,
  RetrievedChunk,
} from './types';
import { answerCoverage } from './relevance';

export const COMMON_AI_WARNINGS = [
  'This output is not legal advice.',
  'Retrieved document text is untrusted input and is not treated as instructions.',
  'Retrieved authorities are not automatically binding precedent.',
];

export const caseChunksOf = (input: { context: RetrievedChunk[]; caseContext?: RetrievedChunk[] }): RetrievedChunk[] =>
  (input.caseContext ?? input.context).filter((chunk) => chunk.scope !== 'LEGAL_AUTHORITY' && chunk.sourceType !== 'legal_authority');

export const legalChunksOf = (input: { legalContext?: RetrievedChunk[] }): RetrievedChunk[] =>
  (input.legalContext ?? []).filter((chunk) => chunk.scope === 'LEGAL_AUTHORITY' || chunk.sourceType === 'legal_authority');

export const precedentChunksOf = (input: { precedentContext?: RetrievedChunk[] }): RetrievedChunk[] =>
  (input.precedentContext ?? []).filter((chunk) => chunk.scope === 'LEGAL_AUTHORITY' || chunk.sourceType === 'legal_authority');

export const toCaseCitations = (chunks: RetrievedChunk[]): AICitation[] =>
  chunks.map((chunk) => ({
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    chunkId: chunk.chunkId,
    pageOrSection: chunk.pageOrSection,
    relevance: chunk.relevance,
    sourceType: chunk.sourceType,
    evidenceId: chunk.evidenceId,
  }));

export const toLegalSources = (chunks: RetrievedChunk[]): LegalSource[] =>
  chunks
    .filter((chunk) => chunk.provenance)
    .map((chunk) => ({
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      chunkId: chunk.chunkId,
      pageOrSection: chunk.pageOrSection,
      relevance: chunk.relevance,
      sourceType: 'legal_authority' as const,
      scope: 'LEGAL_AUTHORITY' as const,
      source: chunk.provenance!.source,
      citation: chunk.provenance!.citation,
      court: chunk.provenance!.court,
      jurisdiction: chunk.provenance!.jurisdiction,
      date: chunk.provenance!.judgmentDate,
      sourceUrl: chunk.provenance!.sourceUrl,
      license: chunk.provenance!.license,
      provenance: chunk.provenance!,
      temporal: chunk.temporal,
    }));

export const toPrecedentSources = (chunks: RetrievedChunk[]): LegalSource[] =>
  chunks
    .filter((chunk) => chunk.provenance)
    .map((chunk) => ({
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      chunkId: chunk.chunkId,
      pageOrSection: chunk.pageOrSection,
      relevance: chunk.relevance,
      sourceType: 'legal_authority' as const,
      scope: 'LEGAL_AUTHORITY' as const,
      source: chunk.provenance!.source,
      citation: chunk.provenance!.citation,
      court: chunk.provenance!.court,
      jurisdiction: chunk.provenance!.jurisdiction,
      date: chunk.provenance!.judgmentDate,
      sourceUrl: chunk.provenance!.sourceUrl,
      license: chunk.provenance!.license,
      provenance: chunk.provenance!,
      temporal: chunk.temporal,
    }));

const statusFrom = (
  caseContext: RetrievedChunk[],
  legalContext: RetrievedChunk[],
  precedentContext: RetrievedChunk[],
): AIGroundingStatus => {
  if (caseContext.length === 0 && legalContext.length === 0 && precedentContext.length === 0) return 'unavailable';
  if (caseContext.length === 0 || (legalContext.length + precedentContext.length) === 0) {
    return caseContext.length + legalContext.length + precedentContext.length > 0 ? 'partial' : 'unavailable';
  }
  return 'grounded';
};

export const confidenceFrom = (chunks: RetrievedChunk[]): number => {
  if (chunks.length === 0) return 0;
  const avg = chunks.reduce((sum, chunk) => sum + chunk.relevance, 0) / chunks.length;
  return Number(Math.min(0.88, Math.max(0.15, avg)).toFixed(2));
};

export const unavailableAnswer = (
  operation: AIOperation,
  mode: AIProviderMode,
  extraWarnings: string[] = [],
  options: {
    /** When the unavailability reason is NOT a retrieval failure (e.g. the AI
     *  provider is rate-matched or unreachable), pass a more accurate
     *  explanation so the user is not misled into thinking retrieval failed. */
    explanation?: string;
    /** Accurate source facts line. Defaults to the generic "none available"
     *  wording used when retrieval genuinely returned nothing. */
    sourceFacts?: string;
  } = {},
): AIAnswer => ({
  mode,
  operation,
  status: 'unavailable',
  confidence: 0,
  facts: [],
  explanation:
    options.explanation ??
    'No authorized case documents or licensed legal authorities contained enough information to answer this request.',
  unsupported: [
    'The requested information was not found in authorized case records or the development legal corpus.',
    'Do not infer parties, judges, citations, evidence, hashes, or blockchain transactions.',
  ],
  answer: [
    options.sourceFacts ?? 'Source facts: none available from authorized case records or retrieved legal authorities.',
    `Generated explanation: ${
      options.explanation ??
      'the requested information is unavailable because retrieval did not return supporting sources'
    }.`,
    'Unsupported information: do not infer parties, judges, citations, evidence, hashes, or blockchain transactions.',
  ].join('\n'),
  warnings: [...COMMON_AI_WARNINGS, ...extraWarnings],
  citations: [],
  sources: [],
  caseSources: [],
  legalSources: [],
});

export const assembleAnswer = (input: {
  operation: AIOperation;
  mode: AIProviderMode;
  caseContext: RetrievedChunk[];
  legalContext: RetrievedChunk[];
  precedentContext?: RetrievedChunk[];
  answer: string;
  facts: string[];
  explanation: string;
  unsupported: string[];
  warnings?: string[];
  status?: AIGroundingStatus;
  confidence?: number;
  userQuery?: string;
}): AIAnswer => {
  const precedentChunks = precedentChunksOf({ precedentContext: input.precedentContext });

  if (input.caseContext.length === 0 && input.legalContext.length === 0 && precedentChunks.length === 0) {
    return unavailableAnswer(input.operation, input.mode, input.warnings);
  }

  // Final grounding gate (applies to every provider). A question is only
  // answerable when its topical terms are actually represented in the supplied
  // sources. If none of the distinctive terms occur anywhere, answering would
  // require fabrication, so an insufficient-evidence response is returned even
  // though some sources were retrieved (Phase 11). Structural/deictic questions
  // ("Summarize this case.") have no content terms and pass through.
  const coverage =
    input.userQuery && input.operation !== 'summarize'
      ? answerCoverage(
          input.userQuery,
          [...input.caseContext, ...input.legalContext, ...precedentChunks]
            .map((chunk) => `${chunk.documentName} ${chunk.text}`)
            .join('\n'),
        )
      : undefined;

  // Only apply coverage check if the provider hasn't already confirmed grounding.
  // If the provider returned a successful grounded response with valid content,
  // respect that decision rather than overriding it with a strict term match.
  if (coverage?.decision === 'insufficient' && input.status !== 'grounded') {
    return unavailableAnswer(input.operation, input.mode, [
      `The question asks about: ${coverage.terms.join(', ')}. None of these terms appear in the available sources, so answering would require unsupported information.`,
    ]);
  }

  const answer: AIAnswer = {
    mode: input.mode,
    operation: input.operation,
    status: input.status ?? statusFrom(input.caseContext, input.legalContext, precedentChunks),
    confidence: input.confidence ?? confidenceFrom([...input.caseContext, ...input.legalContext, ...precedentChunks]),
    facts: input.facts,
    explanation: input.explanation,
    unsupported: input.unsupported,
    answer: input.answer,
    warnings: [...COMMON_AI_WARNINGS, ...(input.warnings ?? [])],
    citations: toCaseCitations(input.caseContext),
    sources: input.caseContext,
    caseSources: toCaseCitations(input.caseContext),
    legalSources: toLegalSources(input.legalContext),
    precedentSources: toPrecedentSources(precedentChunks),
  };

  if (coverage?.decision === 'partial') {
    return {
      ...answer,
      status: 'partial',
      warnings: [
        ...answer.warnings,
        `Only part of the question is covered by the available sources (missing: ${coverage.missing.join(', ')}). Verify the remaining details against the source documents.`,
      ],
    };
  }

  return answer;
};
