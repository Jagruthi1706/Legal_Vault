import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import fs from 'node:fs';
import { AIService } from '../src/services/ai/ai.service';
import { MockAIProvider } from '../src/services/ai/mock-ai.provider';
import { CaseRetrievalService } from '../src/services/ai/retrieval.service';
import { LocalLegalKnowledgeSource } from '../src/services/ai/legal/local-knowledge.source';
import { InMemoryVectorStore } from '../src/services/ai/vector/in-memory.store';
import { LocalEmbeddingClient } from '../src/services/ai/vector/embeddings';
import {
  AIProvider,
  AIGenerateInput,
  AISummarizeInput,
} from '../src/services/ai/types';
import {
  extractContentTerms,
  termOccurs,
  RELEVANCE_RATIO,
} from '../src/services/ai/relevance';

/**
 * Focused tests for the Stage 8 attachment defect:
 *  - uploaded document text is extracted and reaches the AI context
 *  - Legal KB authority is retrieved ONLY when the question is legally relevant
 *  - the provider receives SEPARATE document (CASE_DOCUMENT) and legal
 *    (LEGAL_AUTHORITY) contexts, never merged into one unlabeled blob
 *  - answers stay grounded: no fabricated document facts, no fabricated authority
 */

const LEGAL_AUTHORITY_TEXT =
  'Section 149 of the Limitation Act, 1963 provides that an application for condonation of delay shall be made within thirty days and shall be supported by sufficient cause.';

const legalAuthority = {
  id: 'IND-PROC-LIM001-V2',
  title: 'Limitation Act, 1963, Section 149',
  text: LEGAL_AUTHORITY_TEXT,
  provenance: {
    source: 'India Code',
    sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/15272',
    license: 'Government of India public legislative text',
    documentType: 'statute' as const,
    jurisdiction: 'India',
    citation: 'Limitation Act, 1963, s. 149',
  },
  relevance: 0.9,
  chunkId: 'IND-PROC-LIM001-V2:kb:0',
  pageOrSection: 'Section 149',
};

/**
 * Deterministic, embedding-free stand-in for LocalLegalKnowledgeSource that
 * applies the SAME topical-relevance gate the real source uses
 * (extractContentTerms + RELEVANCE_RATIO). Keeps tests hermetic and proves legal
 * authority is only returned for legally-relevant questions.
 */
const buildLegalSource = (): LocalLegalKnowledgeSource => {
  const source = new LocalLegalKnowledgeSource(
    new InMemoryVectorStore(),
    new LocalEmbeddingClient(),
    [],
  );
  (
    source as unknown as {
      search: (q: string, f?: unknown) => Promise<unknown[]>;
    }
  ).search = async (query: string) => {
    const terms = extractContentTerms(query);
    const hay = LEGAL_AUTHORITY_TEXT.toLowerCase();
    if (terms.length === 0) return [legalAuthority];
    const matched = terms.filter((t) => termOccurs(t, hay)).length;
    if (matched > 0 && matched / terms.length >= RELEVANCE_RATIO)
      return [legalAuthority];
    return [];
  };
  return source;
};

type ProviderInput = AIGenerateInput | AISummarizeInput;
class RecordingProvider implements AIProvider {
  public lastInput: ProviderInput | null = null;
  public method: string | null = null;
  private readonly inner = new MockAIProvider();
  async generateAnswer(input: AIGenerateInput) {
    this.method = 'generateAnswer';
    this.lastInput = input;
    return this.inner.generateAnswer(input);
  }
  async research(input: AIGenerateInput) {
    this.method = 'research';
    this.lastInput = input;
    return this.inner.research(input);
  }
  async summarize(input: AISummarizeInput) {
    this.method = 'summarize';
    this.lastInput = input;
    return this.inner.summarize(input);
  }
  async analyzeEvidence(input: AIGenerateInput) {
    this.method = 'analyzeEvidence';
    this.lastInput = input;
    return this.inner.analyzeEvidence(input);
  }
}

const cases = {
  canAccessCase: async (_caseId: string, _userId: string, _role: string) =>
    true,
  getCaseByIdForUser: async () => ({
    id: 'case-1',
    caseNumber: 'CN-1',
    title: 'Contract dispute',
    description: '',
    evidence: [],
  }),
};

const retriever = new CaseRetrievalService(cases, {
  getDocumentsForUser: async () => [],
  getDocumentContent: async () => null,
});

const txtAttachment = {
  buffer: Buffer.from(
    'The defendant was required to provide written notice within 30 days.',
  ),
  originalName: 'notice.txt',
  mimeType: 'text/plain',
};

const PDF_BUFFER = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Contract Law Agreement) Tj ET
endstream
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
361
%%EOF`;

const pdfAttachment = {
  buffer: Buffer.from(PDF_BUFFER, 'latin1'),
  originalName: 'contract.pdf',
  mimeType: 'application/pdf',
};

const DOCX_PATH = path.join(
  __dirname,
  '..',
  'src',
  'services',
  'ai',
  'legal',
  'knowledge-base',
  'Indian_Legal_Knowledge_Base_V2.1_Final.docx',
);
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('Attachment (case-scoped): legal KB authority retrieved and kept separate from document facts', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatWithAttachments(
    'case-1',
    'u1',
    'LAWYER',
    'Limitation of delay on notice',
    [txtAttachment],
    'answer',
  );

  assert.ok(provider.lastInput, 'provider should have been invoked');
  const gen = provider.lastInput as AIGenerateInput;
  const legalCtx = gen.legalContext ?? [];
  const caseCtx = gen.caseContext ?? [];

  // Legal KB retrieval occurred and reached the provider as LEGAL_AUTHORITY.
  assert.ok(
    legalCtx.length > 0,
    'legal authority should be retrieved for an attachment legal question',
  );
  assert.ok(
    legalCtx.every(
      (c) =>
        c.scope === 'LEGAL_AUTHORITY' && c.sourceType === 'legal_authority',
    ),
    'legal context chunks must be LEGAL_AUTHORITY scope',
  );
  assert.ok(
    caseCtx.every((c) => c.scope !== 'LEGAL_AUTHORITY'),
    'case context must not contain legal authority chunks (separation)',
  );
  assert.ok(
    caseCtx.some((c) => /\bnotice\b/.test(c.text)),
    'uploaded document facts must reach the provider input',
  );

  assert.equal(result.status, 'grounded');
  assert.ok(
    result.legalSources.length > 0,
    'answer should carry legal sources',
  );
  assert.ok(
    result.caseSources.length > 0,
    'answer should carry document/case sources',
  );
  assert.ok(
    result.legalSources.every((s) => s.scope === 'LEGAL_AUTHORITY'),
    'legal sources must be LEGAL_AUTHORITY',
  );
  assert.equal(
    result.legalSources[0].documentId,
    'IND-PROC-LIM001-V2',
    'legal source id must come from the KB, not be fabricated',
  );
});

test('Attachment (no-case): legal KB authority retrieved and combined but kept separate', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase('Limitation of delay on notice', [
    txtAttachment,
  ]);

  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(
    (gen.legalContext ?? []).length > 0,
    'legal authority retrieved on no-case attachment path',
  );
  assert.ok(
    (gen.caseContext ?? []).some((c) => /\bnotice\b/.test(c.text)),
    'attachment facts reach case context',
  );
  assert.ok(
    (gen.legalContext ?? []).every((c) => c.scope === 'LEGAL_AUTHORITY'),
    'provider received legal context as LEGAL_AUTHORITY',
  );
  assert.ok(
    (gen.caseContext ?? []).every((c) => c.scope !== 'LEGAL_AUTHORITY'),
    'provider received document context as CASE_DOCUMENT, not legal authority',
  );
  assert.ok(
    result.legalSources.length > 0,
    'grounded answer carries legal sources',
  );
});

test('PDF attachment: extracted text reaches AI context together with legal authority', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase(
    'Limitation and delay for this contract agreement',
    [pdfAttachment],
  );

  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(
    (gen.caseContext ?? []).some((c) =>
      c.text.includes('Contract Law Agreement'),
    ),
    'PDF text must be extracted and reach the case context',
  );
  assert.ok(
    (gen.caseContext ?? []).every((c) => c.scope !== 'LEGAL_AUTHORITY'),
    'PDF-derived facts must be CASE_DOCUMENT, not legal authority',
  );
  assert.ok(
    (gen.legalContext ?? []).length > 0,
    'relevant legal authority retrieved alongside the PDF',
  );
  assert.equal(result.status, 'grounded');
});
test('DOCX attachment: extracted text reaches AI context together with legal authority', async () => {
  const ai = new AIService(
    retriever,
    new MockAIProvider(),
    cases,
    buildLegalSource(),
  );
  const result = await ai.chatNoCase('Limitation and delay on notice', [
    {
      buffer: fs.readFileSync(DOCX_PATH),
      originalName: 'kb.docx',
      mimeType: DOCX_MIME,
    },
  ]);

  assert.ok(
    result.caseSources.length > 0,
    'DOCX content should ground the case/document sources',
  );
  assert.ok(
    result.sources.some((c) => c.text.length > 100),
    'DOCX body text should be present in retrieved sources',
  );
  assert.ok(
    result.legalSources.length > 0,
    'legal authority retrieved alongside the DOCX',
  );
  assert.notEqual(
    result.status,
    'unavailable',
    'DOCX + legal answer should be grounded, not unavailable',
  );
});

test('Attachment with irrelevant question: no false legal grounding (no hallucination)', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase('Criminal conviction record', [
    txtAttachment,
  ]);

  assert.equal(
    (provider.lastInput as AIGenerateInput).legalContext?.length,
    0,
    'no legal authority should be retrieved for an irrelevant question',
  );
  assert.equal(
    result.status,
    'unavailable',
    'irrelevant question must not produce a grounded answer',
  );
  assert.equal(
    result.legalSources.length,
    0,
    'no legal authority must be fabricated',
  );
  assert.equal(
    result.caseSources.length,
    0,
    'no document facts must be fabricated',
  );
});

test('Attachment question requiring facts not in the document: facts not fabricated', async () => {
  const ai = new AIService(
    retriever,
    new MockAIProvider(),
    cases,
    buildLegalSource(),
  );
  // The attachment only mentions "notice"; it contains no contract price.
  const result = await ai.chatNoCase(
    'What is the contract price in this document?',
    [txtAttachment],
  );
  assert.equal(
    result.status,
    'unavailable',
    'unsupported facts must yield unavailable, not invention',
  );
  assert.equal(
    result.caseSources.length,
    0,
    'no document facts should be fabricated',
  );
  assert.equal(
    result.legalSources.length,
    0,
    'no legal authority should be fabricated',
  );
});

test('Attachment question requiring legal authority absent from the KB: authority not fabricated', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  // The document supports the notice fact, but no matching legal authority exists in
  // the KB — the answer must be grounded on the document only and must NOT invent law.
  const result = await ai.chatNoCase('Notice deadline in the document', [
    txtAttachment,
  ]);
  assert.equal(
    result.legalSources.length,
    0,
    'legal authority must not be fabricated when absent from the KB',
  );
  assert.ok(
    result.caseSources.length > 0,
    'the answer may be grounded on the attachment fact',
  );
});

test('Standalone legal KB question (no attachments) still grounded from legal authority', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatNoCase('Limitation and delay', []);

  assert.ok(
    (provider.lastInput as AIGenerateInput).legalContext?.length > 0,
    'standalone legal question still retrieves legal authority',
  );
  assert.ok(
    result.legalSources.length > 0,
    'standalone legal answer still carries legal sources',
  );
  assert.notEqual(
    result.status,
    'unavailable',
    'standalone legal question must not regress',
  );
});

test('CASE_DOCUMENT vs LEGAL_AUTHORITY separation is preserved end-to-end', async () => {
  const provider = new RecordingProvider();
  const ai = new AIService(retriever, provider, cases, buildLegalSource());
  const result = await ai.chatWithAttachments(
    'case-1',
    'u1',
    'LAWYER',
    'Limitation and delay on notice',
    [txtAttachment],
    'answer',
  );

  const gen = provider.lastInput as AIGenerateInput;
  assert.ok(
    (gen.legalContext ?? []).every((c) => c.scope === 'LEGAL_AUTHORITY'),
    'legal context is LEGAL_AUTHORITY',
  );
  assert.ok(
    (gen.caseContext ?? []).every((c) => c.scope === 'CASE_DOCUMENT'),
    'case context is CASE_DOCUMENT',
  );
  assert.ok(
    result.legalSources.every(
      (s) =>
        s.scope === 'LEGAL_AUTHORITY' && s.sourceType === 'legal_authority',
    ),
    'legal sources stay LEGAL_AUTHORITY',
  );
  assert.ok(
    result.sources.every((c) => c.scope !== 'LEGAL_AUTHORITY'),
    'case sources never contain legal authority',
  );
});
