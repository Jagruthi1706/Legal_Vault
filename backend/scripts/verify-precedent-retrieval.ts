import { prisma } from '../src/utils/prisma';
import { LocalLegalKnowledgeSource } from '../src/services/ai/legal/local-knowledge.source';
import { getLegalVectorStore } from '../src/services/ai/vector/store.factory';
import { LocalEmbeddingClient } from '../src/services/ai/vector/embeddings';

async function main() {
  console.log('=== Precedent Retrieval Verification (PostgreSQL) ===\n');

  const store = getLegalVectorStore();
  const embeddings = new LocalEmbeddingClient();
  const source = new LocalLegalKnowledgeSource(store, embeddings, []);

  // Test 1: Precedent retrieval
  console.log('--- Test 1: authorityKind=judicial_precedent ---');
  const precResults = await source.search('Article 21 personal liberty', { authorityKind: 'judicial_precedent' });
  console.log('Precedent results:', precResults.length);
  for (const r of precResults) {
    console.log(`  - ${r.provenance.caseName} (${r.provenance.citation}) [${r.provenance.authorityKind}]`);
  }

  // Test 2: Statute retrieval
  console.log('\n--- Test 2: authorityKind=statute ---');
  const statResults = await source.search('Article 21', { authorityKind: 'statute' });
  console.log('Statute results:', statResults.length);
  for (const r of statResults.slice(0, 3)) {
    console.log(`  - ${r.title} [${r.provenance.documentType}]`);
  }

  // Test 3: Unfiltered
  console.log('\n--- Test 3: No filter (all LEGAL_AUTHORITY) ---');
  const allResults = await source.search('Article 21');
  console.log('All results:', allResults.length);

  // Test 4: Verify metadata survival
  if (precResults.length > 0) {
    console.log('\n--- Test 4: Precedent metadata ---');
    const r = precResults[0];
    console.log('  caseName:', r.provenance.caseName);
    console.log('  court:', r.provenance.court);
    console.log('  citation:', r.provenance.citation);
    console.log('  authorityKind:', r.provenance.authorityKind);
    console.log('  contentCompleteness:', r.provenance.contentCompleteness);
    console.log('  reportStatus:', r.provenance.reportStatus);
    console.log('  source:', r.provenance.source);
    console.log('  license:', r.provenance.license);
  }

  // Test 5: DB counts
  const total = await prisma.legalAuthorityChunk.count();
  const precCount = await prisma.legalAuthorityChunk.count({
    where: { metadata: { path: ['authorityKind'], equals: 'judicial_precedent' } },
  });
  console.log('\n--- DB Counts ---');
  console.log('Total LegalAuthorityChunk rows:', total);
  console.log('Precedent rows (authorityKind=judicial_precedent):', precCount);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
