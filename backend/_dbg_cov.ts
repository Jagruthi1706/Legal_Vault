import 'dotenv/config';

async function main() {
  const { LocalLegalKnowledgeSource } = await import('./src/services/ai/legal/local-knowledge.source');
  const { InMemoryVectorStore } = await import('./src/services/ai/vector/in-memory.store');
  const { LocalEmbeddingClient, embedLocal } = await import('./src/services/ai/vector/embeddings');
  const { deriveLegalRetrievalQuery } = await import('./src/services/ai/ai.service');
  const { GeminiProvider } = await import('./src/services/ai/gemini.provider');
  const { VectorRecord } = await import('./src/services/ai/vector/types');

  const store = new InMemoryVectorStore();
  const statuteRecord = (o: { documentId: string; title: string; text: string; citation: string }): VectorRecord => ({
    id: `${o.documentId}:kb:1`,
    text: o.text,
    embedding: embedLocal(`${o.title}\n${o.text}`),
    scope: 'LEGAL_AUTHORITY',
    metadata: {
      documentId: o.documentId,
      title: o.title,
      source: 'India Code (published statute text)',
      sourceUrl: 'https://www.indiacode.nic.in',
      license: 'Public domain (Government of India open data)',
      documentType: 'statute',
      jurisdiction: 'India',
      citation: o.citation,
      authorityKind: 'statute',
    },
  });
  const precedentRecord = (o: { documentId: string; title: string; text: string; citation: string }): VectorRecord => ({
    id: `${o.documentId}:kb:1`,
    text: o.text,
    embedding: embedLocal(`${o.title}\n${o.text}`),
    scope: 'LEGAL_AUTHORITY',
    metadata: {
      documentId: o.documentId,
      title: o.title,
      source: 'Indian Kanoon (public judgment mirror)',
      sourceUrl: 'https://indiankanoon.org',
      license: 'Public domain judgment text',
      documentType: 'judgment',
      jurisdiction: 'India',
      citation: o.citation,
      court: 'Supreme Court of India',
      caseName: o.title,
      judgmentDate: '2014-07-02',
      authorityKind: 'judicial_precedent',
    },
  });
  void store.upsert([
    statuteRecord({
      documentId: 'IND-CIV-CPC001-V2',
      title: 'Code of Civil Procedure, 1908 — Section 9',
      text:
        'Section 9 CPC: The courts shall have jurisdiction to try all suits of a civil nature excepting suits of which their cognizance is either expressly or implicitly barred. A civil case is a dispute between parties concerning rights and obligations of a civil nature adjudicated by a civil court.',
      citation: 'CPC 1908, Section 9',
    }),
    statuteRecord({
      documentId: 'IND-CIV-ORDER7-V2',
      title: 'Code of Civil Procedure, 1908 — Order VII Rule 1',
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
  ]);
  const source = new LocalLegalKnowledgeSource(store, new LocalEmbeddingClient(), []);
  const query = deriveLegalRetrievalQuery('What is Section 9 CPC?');
  const statuteHits = await source.search(query, { authorityKind: 'statute', documentType: 'statute' });
  const precedentHits = await source.search(query, { authorityKind: 'judicial_precedent', documentType: 'judgment' });
  console.log(`[dbg] derived="${query}" statutes=${statuteHits.length} precedents=${precedentHits.length}`);
  const legalContext = source.toRetrievedChunks(statuteHits);
  const precedentContext = source.toRetrievedChunks(precedentHits);
  console.log(`[dbg] legalContext names: ${legalContext.map((c) => c.documentName).join(' | ')}`);
  console.log(`[dbg] precedentContext names: ${precedentContext.map((c) => c.documentName).join(' | ')}`);

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
                status: 'ok',
                confidence: 0.9,
              }),
            },
          ],
        },
      },
    ],
  };
  const provider = new GeminiProvider(
    { apiKey: 'test-only-key', model: 'gemini-test-model', timeoutMs: 200, maxRetries: 0 },
    (async () => ({ ok: true, status: 200, json: async () => payload, text: async () => JSON.stringify(payload) })) as unknown as typeof fetch,
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
  console.log(`[dbg] status=${result.status} confidence=${result.confidence}`);
  console.log(`[dbg] warnings: ${JSON.stringify(result.warnings, null, 1)}`);
  process.exit(0);
}
main().catch((e) => { console.error('[dbg] fatal:', e instanceof Error ? e.message : e); process.exit(1); });
