import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { AIService } from '../src/services/ai/ai.service';
import { MockAIProvider } from '../src/services/ai/mock-ai.provider';
import { CaseRetrievalService } from '../src/services/ai/retrieval.service';
import { LocalLegalKnowledgeSource } from '../src/services/ai/legal/local-knowledge.source';
import { InMemoryVectorStore } from '../src/services/ai/vector/in-memory.store';
import { LocalEmbeddingClient } from '../src/services/ai/vector/embeddings';
import { LegalSearchFilters } from '../src/services/ai/legal/knowledge-source';
import { VectorRecord } from '../src/services/ai/vector/types';
import { AIProvider, AIGenerateInput, AISummarizeInput, RetrievedChunk } from '../src/services/ai/types';
import { extractContentTerms, termOccurs, RELEVANCE_RATIO } from '../src/services/ai/relevance';
import { makeStatuteChunk, makePrecedentChunk } from './precedent-retrieval-helpers';

/**
 * Stage 16 focused tests: connect statutes + judicial precedents to the AI answer.
 *
 * The intended architecture is:
 *   CASE_DOCUMENT facts          -> caseContext
 *   STATUTORY LEGAL_AUTHORITY    -> legalContext
 *   JUDICIAL_PRECEDENT           -> precedentContext
 *
 * These tests verify the ACTUAL context propagation (provider input), provenance /
 * development-excerpt survival, anti-fabrication, non-guaranteed remedy framing,
 * and that the six verified development-excerpt precedents are never presented as
 * complete official judgments. They are hermetic: an in-memory store seeded with
 * the real retrieve-filter semantics is used, and the provider is a recording
 * wrapper around the deterministic mock. No database is touched.
 */

/* -------------------------------------------------------------------------- */
/* Hermetic legal source with the real relevance/search machinery              */
/* -------------------------------------------------------------------------- */

const ARTICLE_21_STATUTE_TEXT =
  'Article 21 of the Constitution of India: No person shall be deprived of his life or personal liberty except according to procedure established by law.';

type SearchFilters = LegalSearchFilters | undefined;

const applyTopicalGate = (query: string, text: string): boolean => {
  const terms = extractContentTerms(query);
  if (terms.length === 0) return true;
  const hay = text.toLowerCase();
  const matched = terms.filter((t) => termOccurs(t, hay)).length;
  return matched > 0 && matched / terms.length >= RELEVANCE_RATIO;
};

const filterMatch = (hit: VectorRecord & { score: number }, filters: SearchFilters): boolean => {
  if (!filters) return true;
  if (filters.documentType && String(hit.metadata.documentType || '') !== filters.documentType) return false;
  if (filters.authorityKind) {
    const kind = String(hit.metadata.authorityKind || '');
    if (filters.authorityKind === 'judicial_precedent' && kind !== 'judicial_precedent') return false;
    if (filters.authorityKind === 'statute') {
      const isStatute = kind === 'statute' || String(hit.metadata.documentType || '') === 'statute';
      if (!isStatute) return false;
    }
  }
  return true;
};

const seeds = (): VectorRecord[] => [
  makeStatuteChunk('statute-art21:kb:1', 'statute-art21', 'Constitution of India — Article 21', ARTICLE_21_STATUTE_TEXT),
  makePrecedentChunk('prec-maneka:section:1', 'prec-maneka', 'Maneka Gandhi v. Union of India', 'The procedure under Article 21 must be fair just and reasonable.'),
  makePrecedentChunk('prec-hussainara:section:1', 'prec-hussainara', 'Hussainara Khatoon v. State of Bihar', 'Speedy trial is part of personal liberty under Article 21.'),
];

const buildLegalSource = (): LocalLegalKnowledgeSource => {
  const source = new LocalLegalKnowledgeSource(new InMemoryVectorStore(), new LocalEmbeddingClient(), []);
  (
    source as unknown as {
      search: (q: string, f?: unknown) => Promise<unknown[]>;
    }
  ).search = async (query: string, passedFilters?: unknown) => {
    const filters = passedFilters as SearchFilters;
    const matches = seeds()
      .filter((hit) => filterMatch(hit, filters))
      .filter((hit) => applyTopicalGate(query, `${String(hit.metadata.title || '')} ${hit.text}`))
      .slice(0, 8);
    return matches.map((hit) => ({
      id: String(hit.metadata.documentId),
      title: String(hit.metadata.title),
      text: hit.text,
      provenance: {
        source: String(hit.metadata.source || ''),
        sourceUrl: String(hit.metadata.sourceUrl || ''),
        license: String(hit.metadata.license || ''),
        court: String(hit.metadata.court || ''),
        caseName: String(hit.metadata.caseName || ''),
        caseNumber: String(hit.metadata.caseNumber || ''),
        judgmentDate: String(hit.metadata.judgmentDate || ''),
        citation: String(hit.metadata.citation || ''),
        documentType: (hit.metadata.documentType as 'judgment' | 'statute' | 'other') || 'other',
        jurisdiction: 'India',
        authorityKind: (hit.metadata.authorityKind || undefined) as 'judicial_precedent' | 'statute' | undefined,
        contentCompleteness: (hit.metadata.contentCompleteness || undefined) as string | undefined,
        reportStatus: (hit.metadata.reportStatus || undefined) as string | undefined,
      },
      relevance: 0.9,
      chunkId: String(hit.id),
      pageOrSection: 'Section 1',
    }));
  };
  return source;
};
/* -------------------------------------------------------------------------- */
/* Recording provider + minimal case harness                                  */
/* -------------------------------------------------------------------------- */

type ProviderInput = AIGenerateInput | AISummarizeInput;

class RecordingProvider implements AIProvider {
  public lastInput: ProviderInput | null = null;
  public method: string | null = null;
  private readonly inner = new MockAIProvider();

  async generateAnswer(input: AIGenerateInput): Promise<Awaited<ReturnType<MockAIProvider['generateAnswer']>>> {
    this.method = 'generateAnswer';
    this.lastInput = input;
    return this.inner.generateAnswer(input);
  }

  async research(input: AIGenerateInput): Promise<Awaited<ReturnType<MockAIProvider['research']>>> {
    this.method = 'research';
    this.lastInput = input;
    return this.inner.research(input);
  }

  async summarize(input: AISummarizeInput): Promise<Awaited<ReturnType<MockAIProvider['summarize']>>> {
    this.method = 'summarize';
    this.lastInput = input;
    return this.inner.summarize(input);
  }

  async analyzeEvidence(input: AIGenerateInput): Promise<Awaited<ReturnType<MockAIProvider['analyzeEvidence']>>> {
    this.method = 'analyzeEvidence';
    this.lastInput = input;
    return this.inner.analyzeEvidence(input);
  }
}

const cases = {
  canAccessCase: async (_caseId: string, _userId: string, _role: string) => true,
  getCaseByIdForUser: async () => ({
    id: 'case-1',
    caseNumber: 'CN-1',
    title: 'Detention matter',
    description: '',
    evidence: [],
  }),
};

const retriever = new CaseRetrievalService(cases, {
  getDocumentsForUser: async () => [],
  getDocumentContent: async () => null,
});

const mehtaAttachment = {
  buffer: Buffer.from(
    'On 14 April 2026 Kiran Mehta was detained at the municipal building and a temporary restriction on movement was imposed.',
  ),
  originalName: 'incident.txt',
  mimeType: 'text/plain',
};

const allKindsAre = (chunks: RetrievedChunk[], kind: string): boolean =>
  chunks.length > 0 && chunks.every((c) => (c.provenance?.authorityKind ?? '') === kind || (c.provenance?.documentType ?? '') === kind);
/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

test('Stage 16: statutes and precedents are retrieved into separate contexts (statute query)', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase('What does Article 21 of the Constitution protect?', []);
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen);
  assert.ok(result);
  assert.ok(gen.legalContext?.length > 0, 'statutory query must populate legalContext');
  assert.ok(
    gen.legalContext?.every((c) => (c.provenance?.documentType ?? '') === 'statute'),
    'legalContext must contain statutes only',
  );
  assert.ok(
    gen.precedentContext?.length === 0,
    'statute filter must keep precedents out of the precedent context for a statutory-only query',
  );
});

test('Stage 16: legal question retrieves precedents separately', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'Maneka Gandhi: does Article 21 require a fair just and reasonable procedure?',
    [],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen);
  assert.ok(gen.precedentContext?.length > 0, 'precedent query must retrieve precedents');
  assert.ok(
    gen.precedentContext?.every((c) => (c.provenance?.authorityKind ?? '') === 'judicial_precedent'),
    'precedent context must contain only judicial precedents',
  );
  assert.ok(gen.legalContext?.length === 0, 'no statute should be pulled for a pure precedent query');
  assert.ok(result.precedentSources !== undefined, 'assembled answer must carry precedentSources');
  assert.ok(result.precedentSources!.length > 0, 'precedentSources must contain the retrieved precedent');
});

test('Stage 16: attachment question retrieves statutes and precedents into separate contexts', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'According to the attached document, what happened to Kiran Mehta and what Article 21 rights and fair-procedure precedents are relevant?',
    [mehtaAttachment],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen);
  assert.ok(gen.caseContext?.some((c) => /kiran/i.test(c.text)), 'attachment facts must reach caseContext');
  assert.ok((gen.legalContext ?? []).length > 0, 'attachment legal question must retrieve statutes');
  assert.ok((gen.precedentContext ?? []).length > 0, 'attachment legal question must retrieve precedents');
  assert.ok(allKindsAre(gen.legalContext!, 'statute'), 'legalContext is statutory');
  assert.ok(
    gen.precedentContext!.every((c) => (c.provenance?.authorityKind ?? '') === 'judicial_precedent'),
    'precedentContext is judicial precedent',
  );
  assert.ok(gen.caseContext?.every((c) => c.scope !== 'LEGAL_AUTHORITY'), 'case context is not legal authority');
  assert.ok(result.precedentSources!.length > 0, 'answer carries precedentSources');
});

test('Stage 16: case-scoped research receives separate precedent context', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.research(
    'case-1',
    'u1',
    'LAWYER',
    'Article 21 fair procedure and personal liberty precedents',
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen);
  assert.equal(provider.method, 'research');
  assert.ok(gen.precedentContext?.length > 0, 'case-scoped research must retrieve precedents');
  assert.ok(gen.legalContext?.length > 0, 'case-scoped research must retrieve statutes');
  assert.ok(
    gen.precedentContext!.every((c) => (c.provenance?.authorityKind ?? '') === 'judicial_precedent'),
    'precedents are not merged into legalContext',
  );
  assert.ok(result.precedentSources!.length > 0);
});

test('Stage 16: provider receives three distinct contexts for attachment questions', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  await ai.chatNoCase(
    'According to the attached document, what happened to Kiran Mehta and what Article 21 rights and fair-procedure precedents are relevant?',
    [mehtaAttachment],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen);
  assert.ok(gen.caseContext && gen.caseContext.length > 0, 'CASE EVIDENCE present');
  assert.ok(gen.legalContext && gen.legalContext.length > 0, 'LEGAL AUTHORITIES present');
  assert.ok(gen.precedentContext && gen.precedentContext.length > 0, 'JUDICIAL PRECEDENTS present');
  assert.equal(
    gen.userQuery,
    'According to the attached document, what happened to Kiran Mehta and what Article 21 rights and fair-procedure precedents are relevant?',
    'USER QUESTION unchanged',
  );
});
test('Stage 16: precedent provenance survives', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'Maneka Gandhi: does Article 21 require a fair just and reasonable procedure?',
    [],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen);
  const prec = gen.precedentContext![0];
  assert.ok(prec.provenance?.caseName, 'caseName provenance survives');
  assert.equal(prec.provenance?.court, 'Supreme Court of India', 'court provenance survives');
  assert.equal(prec.provenance?.citation, '(1978) 1 SCC 248', 'citation provenance survives');
  assert.ok(prec.provenance?.sourceUrl, 'sourceUrl provenance survives');
  assert.equal(prec.provenance?.authorityKind, 'judicial_precedent', 'authorityKind provenance survives');
  const src = result.precedentSources![0];
  assert.ok(src.provenance?.caseName, 'precedentSources carry provenanced caseName');
  assert.ok(src.provenance?.citation, 'precedentSources carry citation');
});

test('Stage 16: development-excerpt and not-an-official-report survive', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'Maneka Gandhi: does Article 21 require a fair just and reasonable procedure?',
    [],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen);
  assert.equal(gen.precedentContext![0].provenance?.contentCompleteness, 'development-excerpt');
  assert.equal(gen.precedentContext![0].provenance?.reportStatus, 'not-an-official-report');
  assert.equal(result.precedentSources![0].provenance?.contentCompleteness, 'development-excerpt');
  assert.equal(result.precedentSources![0].provenance?.reportStatus, 'not-an-official-report');
});

test('Stage 16: precedent-only answer is not presented as a full official judgment', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'Maneka Gandhi: does Article 21 require a fair just and reasonable procedure?',
    [],
  );
  assert.ok(result.precedentSources!.length > 0, 'precedent was retrieved');
  const surfaced = [...result.warnings, ...(result.unsupported ?? [])].join('\n');
  assert.ok(
    /development excerpt/i.test(surfaced) || /not an official report/i.test(surfaced),
    'answer must qualify the development-excerpt status',
  );
});

test('Stage 16: no precedent -> no fabricated precedent', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'weather forecast in Mumbai on Tuesday',
    [mehtaAttachment],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen);
  assert.equal(gen.precedentContext?.length, 0, 'no precedent retrieved for irrelevant question');
  assert.equal(gen.legalContext?.length, 0, 'no statute retrieved for irrelevant question');
  assert.equal(result.precedentSources?.length ?? 0, 0, 'no precedent source may be fabricated');
  assert.equal(result.legalSources.length, 0, 'no legal source may be fabricated');
});

test('Stage 16: no statute -> no fabricated statute', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'not covered by the knowledge base',
    [],
  );
  // The standalone path returns unavailable WITHOUT invoking the provider when
  // nothing is retrieved, so the anti-fabrication guarantee is observable on the
  // assembled answer rather than on an (absent) provider input.
  assert.equal(result.status, 'unavailable', 'nothing retrieved -> unavailable');
  assert.equal(result.legalSources.length, 0, 'no legal source may be fabricated');
  assert.equal(result.precedentSources?.length ?? 0, 0, 'no precedent source may be fabricated');
});

test('Stage 16: missing document fact -> no fabrication', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'What is the contract price in this document?',
    [mehtaAttachment],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen);
  assert.ok(gen.caseContext?.some((c) => /kiran/i.test(c.text)), 'attachment reaches context');
  assert.ok(
    !gen.caseContext!.some((c) => /contract price/i.test(c.text)),
    'document text is the ONLY fact source',
  );
  assert.equal(result.status, 'unavailable', 'missing fact must yield unavailable, not invention');
  assert.equal(result.caseSources.length, 0, 'no fabricated case source');
});

test('Stage 16: possible remedy is not stated as guaranteed', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase('Article 21 and personal liberty', [], 'compare_authorities');
  assert.ok(result.precedentSources!.length > 0, 'precedent retrieved for remedy analysis');
  const answer = result.answer.toLowerCase();
  assert.ok(answer, 'answer text present');
  assert.ok(
    !/\byou will win\b/.test(answer) &&
      !/\bthe solution is\b/.test(answer) &&
      !/\bwill definitely\b/.test(answer) &&
      !/\bguaranteed\b/.test(result.explanation.toLowerCase()),
    'remedy must not be framed as guaranteed',
  );
});
/* -------------------------------------------------------------------------- */
/* Regression guards: existing standalone + attachment legal behavior          */
/* -------------------------------------------------------------------------- */

test('Stage 16 regression: standalone legal question remains grounded', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'What does Article 21 of the Constitution of India protect?',
    [],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen.legalContext && gen.legalContext.length > 0, 'statute still retrieved on standalone path');
  assert.ok(result.legalSources.length > 0, 'legal sources still surfaced');
  assert.notEqual(result.status, 'unavailable');
});

test('Stage 16 regression: attachment legal retrieval still works', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'Article 21 and personal liberty of Kiran Mehta',
    [mehtaAttachment],
  );
  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(gen.legalContext && gen.legalContext.length > 0, 'statutes still retrieved on attachment path');
  assert.ok(gen.caseContext?.some((c) => /kiran/i.test(c.text)), 'attachment facts still reach case context');
  assert.notEqual(result.status, 'unavailable');
});