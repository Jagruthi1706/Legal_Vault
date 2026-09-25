/**
 * Regression tests for the Legal Vault Copilot retrieval/grounding pipeline.
 *
 * Cover the user-visible regression reported after Stage 7: the Copilot answering
 * every question with "retrieval did not return supporting sources". These tests
 * pin the actual failure point (a Gemini HTTP 429 wrapped in the DEFAULT
 * unavailable wording that blames retrieval) and keep the healthy retrieval
 * pipeline locked in place:
 *   1. "Define civil case" returns usable statutory sources.
 *   2. "What is Section 9 CPC?" returns the CPC Section 9 authority.
 *   3. Order/Rule queries return the appropriate CPC provision.
 *   4. Statutes and precedents stay provenance-separated end-to-end.
 *   5. Case-document retrieval keeps document facts distinct from legal law.
 *   6. The Gemini provider forwards retrieved context verbatim (grounding intact).
 *   7. A provider 429 is reported accurately and never blamed on retrieval.
 *
 * Hermetic: no network, no database. Uses a seeded in-memory vector store.
 * Retrieval tests use deriveLegalRetrievalQuery() exactly as the production
 * Copilot path does (see ai.service.chatNoCase/withTwoContexts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { LocalLegalKnowledgeSource } from '../src/services/ai/legal/local-knowledge.source';
import { InMemoryVectorStore } from '../src/services/ai/vector/in-memory.store';
import { LocalEmbeddingClient, embedLocal } from '../src/services/ai/vector/embeddings';
import { VectorRecord } from '../src/services/ai/vector/types';
import { deriveLegalRetrievalQuery } from '../src/services/ai/ai.service';
import { GeminiProvider } from '../src/services/ai/gemini.provider';
import { RetrievedChunk } from '../src/services/ai/types';

const seedCorpus = (): InMemoryVectorStore => {
  const store = new InMemoryVectorStore();
  const chunk = (documentId: string, chunkIndex: number): string => `${documentId}:kb:${chunkIndex}`;

  const statuteRecord = (opts: {
    documentId: string;
    title: string;
    text: string;
    citation: string;
  }): VectorRecord => ({
    id: chunk(opts.documentId, 1),
    text: opts.text,
    embedding: embedLocal(`${opts.title}\n${opts.text}`),
    scope: 'LEGAL_AUTHORITY',
    metadata: {
      documentId: opts.documentId,
      title: opts.title,
      source: 'India Code (published statute text)',
      sourceUrl: 'https://www.indiacode.nic.in',
      license: 'Public domain (Government of India open data)',
      documentType: 'statute',
      jurisdiction: 'India',
      citation: opts.citation,
      authorityKind: 'statute',
    },
  });

  const precedentRecord = (opts: {
    documentId: string;
    title: string;
    text: string;
    citation: string;
  }): VectorRecord => ({
    id: chunk(opts.documentId, 1),
    text: opts.text,
    embedding: embedLocal(`${opts.title}\n${opts.text}`),
    scope: 'LEGAL_AUTHORITY',
    metadata: {
      documentId: opts.documentId,
      title: opts.title,
      source: 'Indian Kanoon (public judgment mirror)',
      sourceUrl: 'https://indiankanoon.org',
      license: 'Public domain judgment text',
      documentType: 'judgment',
      jurisdiction: 'India',
      citation: opts.citation,
      court: 'Supreme Court of India',
      caseName: opts.title,
      judgmentDate: '2014-07-02',
      authorityKind: 'judicial_precedent',
    },
  });

  const records: VectorRecord[] = [
    statuteRecord({
      documentId: 'IND-CIV-CPC001-V2',
      title: 'Code of Civil Procedure, 1908 â€” Section 9',
      text:
        'Section 9 CPC: The courts shall have jurisdiction to try all suits of a civil nature excepting suits of which their cognizance is either expressly or implicitly barred. A civil case is a dispute between parties concerning rights and obligations of a civil nature adjudicated by a civil court.',
      citation: 'CPC 1908, Section 9',
    }),
    statuteRecord({
      documentId: 'IND-CIV-ORDER7-V2',
      title: 'Code of Civil Procedure, 1908 â€” Order VII Rule 1',
      text:
        'Order VII Rule 1 CPC prescribes the particulars of a plaint: the name of the court, the parties, the cause of action, the material facts, the relief claimed and the valuation of the suit.',
      citation: 'CPC 1908, Order VII Rule 1',
    }),
    precedentRecord({
      documentId: 'IND-PREC-ARNESH-V2',
      title: 'Arnesh Kumar v. State of Bihar',
      text:
        'The Supreme Court held that arrest in offences punishable with imprisonment up to seven years must not be routine. Police must record reasons and satisfy the checklist under Section 41 CrPC.',
      citation: '(2014) 8 SCC 273',
    }),
  ];
  void store.upsert(records);
  return store;
};

const buildKnowledgeSource = (): LocalLegalKnowledgeSource =>
  new LocalLegalKnowledgeSource(seedCorpus(), new LocalEmbeddingClient(), []);

describe('Copilot retrieval pipeline regression (post-Stage 7)', () => {
  test('retrieval: "Define civil case" returns usable statutory sources', async () => {
    const source = buildKnowledgeSource();
    const query = deriveLegalRetrievalQuery('Define civil case');
    const hits = await source.search(query, { authorityKind: 'statute', documentType: 'statute' });
    assert.ok(hits.length > 0, 'expected at least one statute hit for "Define civil case"');
    const top = hits[0];
    assert.equal(top.provenance.documentType, 'statute', 'top hit must be statutory authority');
    assert.equal(top.provenance.authorityKind, 'statute', 'top hit must carry statute authorityKind');
    assert.ok(top.text.length > 0, 'retrieved statute text must be usable');
  });

  test('retrieval: "What is Section 9 CPC?" returns the CPC Section 9 authority', async () => {
    const source = buildKnowledgeSource();
    const query = deriveLegalRetrievalQuery('What is Section 9 CPC?');
    const hits = await source.search(query, { authorityKind: 'statute', documentType: 'statute' });
    assert.ok(hits.length > 0, 'expected at least one statute hit for Section 9 CPC');
    const section9 = hits.find((hit) => hit.chunkId === 'IND-CIV-CPC001-V2:kb:1');
    assert.ok(section9, 'Section 9 CPC authority must be retrieved');
    assert.match(section9.text, /Section 9/, 'retrieved text must be the Section 9 provision');
    assert.equal(section9.id, 'IND-CIV-CPC001-V2', 'document id must identify the CPC authority');
  });

  test('retrieval: Order/Rule query returns the appropriate CPC provision', async () => {
    const source = buildKnowledgeSource();
    const query = deriveLegalRetrievalQuery('What are the particulars of a plaint under Order VII Rule 1 CPC?');
    const hits = await source.search(query, { authorityKind: 'statute', documentType: 'statute' });
    assert.ok(hits.length > 0, 'expected at least one statute hit for Order VII Rule 1');
    const order7 = hits.find((hit) => hit.chunkId === 'IND-CIV-ORDER7-V2:kb:1');
    assert.ok(order7, 'Order VII Rule 1 provision must be retrieved');
  });
});

describe('Authority separation, provenance and generic-question robustness', () => {
  test('retrieval: statutory retrieval remains separate from precedents', async () => {
    const source = buildKnowledgeSource();
    const query = deriveLegalRetrievalQuery('What is Section 9 CPC?');
    const statutes = await source.search(query, { authorityKind: 'statute', documentType: 'statute' });
    const precedents = await source.search(query, { authorityKind: 'judicial_precedent', documentType: 'judgment' });
    assert.ok(statutes.length > 0, 'statutory retrieval must return records');
    for (const hit of statutes) {
      assert.notEqual(hit.provenance.authorityKind, 'judicial_precedent', 'statute context must not contain precedents');
      assert.equal(hit.provenance.documentType, 'statute');
    }
    for (const hit of precedents) {
      assert.equal(hit.provenance.documentType, 'judgment', 'precedent context must only contain judgments');
    }
  });

  test('retrieval: precedent retrieval still works', async () => {
    const source = buildKnowledgeSource();
    const query = deriveLegalRetrievalQuery('arrest guidelines Arnesh Kumar Supreme Court');
    const precedents = await source.search(query, { authorityKind: 'judicial_precedent', documentType: 'judgment' });
    assert.ok(precedents.length > 0, 'precedent retrieval must return the seeded judgment');
    assert.ok(
      precedents.some((hit) => hit.id === 'IND-PREC-ARNESH-V2'),
      'Arnesh Kumar precedent must be retrievable',
    );
  });

  test('retrieval: provenance remains intact through retrieval', async () => {
    const source = buildKnowledgeSource();
    const query = deriveLegalRetrievalQuery('What is Section 9 CPC?');
    const hits = await source.search(query, { authorityKind: 'statute', documentType: 'statute' });
    assert.ok(hits.length > 0);
    for (const hit of hits) {
      assert.ok(hit.provenance.source, 'provenance source required');
      assert.ok(hit.provenance.sourceUrl, 'provenance sourceUrl required');
      assert.ok(hit.provenance.license, 'provenance license required');
      assert.ok(hit.provenance.citation, 'provenance citation required');
      assert.equal(hit.provenance.jurisdiction, 'India');
    }
  });

  test('retrieval: generic legal questions do not incorrectly return zero sources', async () => {
    const source = buildKnowledgeSource();
    const queries = ['Define civil case', 'What is Section 9 CPC?', 'civil jurisdiction', 'plaint particulars'];
    for (const raw of queries) {
      const query = deriveLegalRetrievalQuery(raw);
      const hits = await source.search(query, { authorityKind: 'statute', documentType: 'statute' });
      assert.ok(hits.length > 0, `expected statute sources for "${raw}" (derived query: "${query}")`);
    }
  });
});

describe('Case-document separation', () => {
  test('retrieval: case-document retrieval keeps document facts distinct from legal law', async () => {
    const source = buildKnowledgeSource();
    const question =
      'Our suit was filed with the plaint particulars listed in Order VII Rule 1 CPC. Were they complete?';
    const attachmentChunks: RetrievedChunk[] = [
      {
        caseId: 'case-1',
        documentId: 'doc-1',
        chunkId: 'doc-1:upload:1',
        documentName: 'plaint-copy.txt',
        pageOrSection: 'Page 1',
        text: 'Plaint filed before the civil court reciting the cause of action and the relief claimed.',
        relevance: 1,
        sourceType: 'case_document',
        scope: 'CASE_DOCUMENT',
      },
    ];

    const legalHits = await source.search(deriveLegalRetrievalQuery(question), {
      authorityKind: 'statute',
      documentType: 'statute',
    });
    const legalContext = source.toRetrievedChunks(legalHits);

    assert.ok(legalContext.length > 0, 'legal authorities must be retrieved for the attached-document question');
    for (const authority of legalContext) {
      assert.equal(authority.scope, 'LEGAL_AUTHORITY', 'legal context must stay scope LEGAL_AUTHORITY');
      assert.ok(authority.provenance, 'legal context chunks must carry provenance');
    }
    for (const attachment of attachmentChunks) {
      assert.equal(attachment.scope, 'CASE_DOCUMENT', 'attachment context must stay scope CASE_DOCUMENT');
    }
    assert.ok(
      legalContext.every((authority) => attachmentChunks.every((chunk) => chunk.chunkId !== authority.chunkId)),
      'case-document chunks must never be merged into the legal authority context',
    );
  });
});

describe('Gemini grounding forwarding', () => {
  test('provider: retrieved grounded context is forwarded verbatim to Gemini', async () => {
    const source = buildKnowledgeSource();
    const statuteQuery = deriveLegalRetrievalQuery('What is Section 9 CPC?');
    const precedentQuery = deriveLegalRetrievalQuery('arrest guidelines Arnesh Kumar Supreme Court');
    const statuteHits = await source.search(statuteQuery, { authorityKind: 'statute', documentType: 'statute' });
    const precedentHits = await source.search(precedentQuery, {
      authorityKind: 'judicial_precedent',
      documentType: 'judgment',
    });
    const legalContext = source.toRetrievedChunks(statuteHits);
    const precedentContext = source.toRetrievedChunks(precedentHits);
    assert.ok(legalContext.length > 0 && precedentContext.length > 0, 'both authority contexts must be non-empty');

    let capturedBody: unknown;
    const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
      capturedBody = init?.body;
      const payload = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    answer: 'Section 9 CPC confers civil jurisdiction on the courts.',
                    facts: ['Section 9 CPC: courts shall try all suits of a civil nature not expressly barred.'],
                    explanation: 'Derived from the retrieved CPC authority.',
                    unsupported: 'None.',
                    status: 'grounded',
                    confidence: 0.9,
                  }),
                },
              ],
            },
          },
        ],
      };
      return {
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const provider = new GeminiProvider(
      { apiKey: 'test-only-key', model: 'gemini-test-model', timeoutMs: 200, maxRetries: 0 },
      fetchImpl,
    );
    const result = await provider.generateAnswer({
      applicationInstructions: 'Legal Vault Copilot.',
      userQuery: 'What is Section 9 CPC?',
      context: [],
      caseContext: [],
      legalContext,
      precedentContext,
      operation: 'answer',
    });

    assert.equal(result.status, 'grounded');
    assert.ok(result.legalSources.length > 0, 'grounded answer must echo the retrieved legal sources');
    assert.ok(
      result.legalSources.some((s) => s.documentName.includes('Section 9')),
      'legal sources must identify the retrieved CPC authority',
    );

    const raw = JSON.stringify(capturedBody);
    assert.ok(raw.includes('LEGAL AUTHORITIES:'), 'prompt must carry the legal authorities block');
    assert.ok(raw.includes('JUDICIAL PRECEDENTS:'), 'prompt must carry the precedents block');
    assert.ok(raw.includes('Section 9'), 'prompt must contain the retrieved statute text verbatim');
    assert.ok(raw.includes('Arnesh Kumar'), 'prompt must contain the retrieved precedent text');
  });
});

describe('Provider failure messaging (regression)', () => {
  test('provider: Gemini rate-limit (429) is reported accurately, never blamed on retrieval', async () => {
    const source = buildKnowledgeSource();
    const legalContext = source.toRetrievedChunks(
      await source.search(deriveLegalRetrievalQuery('What is Section 9 CPC?'), {
        authorityKind: 'statute',
        documentType: 'statute',
      }),
    );
    assert.ok(legalContext.length > 0, 'retrieval must supply supporting sources for the question');

    const provider = new GeminiProvider(
      { apiKey: 'test-only-key', model: 'gemini-test-model', timeoutMs: 200, maxRetries: 0 },
      (async () =>
        ({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: async () => 'rate limited',
        })) as unknown as typeof fetch,
    );
    const result = await provider.generateAnswer({
      applicationInstructions: 'Legal Vault Copilot.',
      userQuery: 'What is Section 9 CPC?',
      context: [],
      caseContext: [],
      legalContext,
      precedentContext: [],
      operation: 'answer',
    });

    assert.equal(result.status, 'unavailable');
    assert.equal(result.mode, 'GEMINI');
    const narrative = `${result.answer} ${result.explanation}`.toLowerCase();
    assert.ok(
      !/retrieval did not return supporting sources/.test(narrative),
      'must NOT blame retrieval when supporting sources were retrieved',
    );
    assert.match(narrative, /rate|quota|limit/, 'must report the provider rate-limit cause');
  });
});
