import 'dotenv/config';

/** Read-only pipeline diagnostic. Prints no secrets. */
async function main() {
  const { getAIConfig } = await import('./src/config/ai.config');
  const cfg = getAIConfig();
  console.log(
    `[cfg] provider=${cfg.provider} model=${cfg.model} vectorStore=${cfg.vectorStore} embeddingModel=${cfg.embeddingModel} geminiKeySet=${cfg.apiKey ? 'yes' : 'no'}`,
  );

  const { getLegalVectorStore } = await import('./src/services/ai/vector/store.factory');
  const { LocalEmbeddingClient } = await import('./src/services/ai/vector/embeddings');
  const { deriveLegalRetrievalQuery } = await import('./src/services/ai/ai.service');
  const { localLegalKnowledgeSource } = await import('./src/services/ai/legal/local-knowledge.source');

  const store = getLegalVectorStore();
  const embeddings = new LocalEmbeddingClient();
  type Hits = Awaited<ReturnType<typeof localLegalKnowledgeSource.search>>;
  const firstStatutes: Hits = [];

  const queries = [
    'Define civil case',
    'What is Section 9 CPC?',
    'What are the particulars of a plaint under Order VII Rule 1 CPC?',
    'arrest and bail precedent',
  ];

  for (const q of queries) {
    const emb = await embeddings.embed(q);
    const raw = await store.search(emb, { limit: 256, scope: 'LEGAL_AUTHORITY' });
    console.log(
      `[store] q="${q}" embDim=${emb.length} rawHits=${raw.length} top=${raw
        .slice(0, 3)
        .map((h) => `${h.id}:${h.score.toFixed(4)}`)
        .join(' | ')}`,
    );

    const derived = deriveLegalRetrievalQuery(q);
    const statute = await localLegalKnowledgeSource.search(derived, {
      authorityKind: 'statute',
      documentType: 'statute',
    });
    const precedent = await localLegalKnowledgeSource.search(derived, {
      authorityKind: 'judicial_precedent',
      documentType: 'judgment',
    });
    console.log(`[kb] q="${q}" derived="${derived}" statutes=${statute.length} precedents=${precedent.length}`);
    for (const s of statute.slice(0, 3)) console.log(`   [statute] ${s.chunkId} :: ${s.title} :: rel=${s.relevance}`);
    for (const p of precedent.slice(0, 3)) console.log(`   [precedent] ${p.chunkId} :: ${p.title} :: rel=${p.relevance}`);
    if (q === 'Define civil case') firstStatutes.push(...statute);
  }

  console.log('[diag] PART1 done');

  const { prisma } = await import('./src/utils/prisma');
  const total = await prisma.legalAuthorityChunk.count();
  const rows = await prisma.legalAuthorityChunk.findMany({ take: 1000 });
  const dims = new Map<number, number>();
  let emptyEmb = 0;
  for (const row of rows) {
    const d = Array.isArray(row.embedding) ? (row.embedding as unknown[]).length : -1;
    dims.set(d, (dims.get(d) ?? 0) + 1);
    if (d === 0) emptyEmb += 1;
  }
  console.log(`[db] LegalAuthorityChunk rows=${total} (sampled ${rows.length}) emptyEmbeddings=${emptyEmb}`);
  console.log(`[db] embedding dimension histogram: ${JSON.stringify([...dims.entries()])}`);
  const upperKeys = rows.filter((r) => {
    const md = r.metadata as Record<string, unknown> | null;
    return !!md && ('AUTHORITY_KIND' in md || 'DOCUMENT_TYPE' in md || 'SOURCE_NAME' in md);
  }).length;
  const lowerKeys = rows.filter((r) => {
    const md = r.metadata as Record<string, unknown> | null;
    return !!md && ('authorityKind' in md || 'documentType' in md || 'source' in md);
  }).length;
  console.log(`[db] metadata key styles: UPPERCASE=${upperKeys} lowercase=${lowerKeys}`);
  for (const row of rows.slice(0, 5)) {
    const md = (row.metadata ?? {}) as Record<string, unknown>;
    console.log(
      `[db-sample] id=${row.id} docId=${row.documentId} scope=${row.scope} embDim=${
        Array.isArray(row.embedding) ? (row.embedding as unknown[]).length : -1
      } authorityKind=${String(md.authorityKind ?? md.AUTHORITY_KIND ?? '')} documentType=${String(
        md.documentType ?? md.DOCUMENT_TYPE ?? '',
      )} title=${String(md.title ?? md.TITLE ?? '').slice(0, 60)}`,
    );
  }

  await prisma.$disconnect();

  if (cfg.provider === 'gemini' && cfg.apiKey && firstStatutes.length > 0) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'x-goog-api-key': cfg.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word: OK' }] }] }),
        },
      );
      console.log(`[gemini] connectivity: ${res.ok ? 'PASS' : 'FAIL'} — HTTP status ${res.status}`);
      if (!res.ok) {
        const body = await res.text();
        console.log(`[gemini] non-secret error excerpt: ${body.slice(0, 200).replace(/AIza[\w-]+/g, '[REDACTED]')}`);
      }
    } catch (error) {
      console.log(`[gemini] connectivity: FAIL — network error (${(error as Error).name})`);
    }

    const { GeminiProvider } = await import('./src/services/ai/gemini.provider');
    const provider = new GeminiProvider({
      apiKey: cfg.apiKey,
      model: cfg.model,
      timeoutMs: cfg.timeoutMs,
      maxRetries: cfg.maxRetries,
    });
    const legalContext = localLegalKnowledgeSource.toRetrievedChunks(firstStatutes);
    const answer = await provider.generateAnswer({
      applicationInstructions: 'Legal Vault Copilot.',
      userQuery: 'Define civil case',
      context: [],
      caseContext: [],
      legalContext,
      precedentContext: [],
      operation: 'answer',
    });
    console.log(`[provider] status=${answer.status} mode=${answer.mode} legalSources=${answer.legalSources.length}`);
    console.log(`[provider] answer: ${answer.answer.slice(0, 400)}`);
    console.log(`[provider] warnings: ${JSON.stringify(answer.warnings)}`);
  }
}
main().catch((e) => { console.error('[diag] fatal:', e instanceof Error ? e.message : e); process.exit(1); });
