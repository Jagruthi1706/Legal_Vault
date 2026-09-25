import 'dotenv/config';
import { LocalLegalKnowledgeSource } from './src/services/ai/legal/local-knowledge.source.ts';

let pass = 0;
let fail = 0;
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function asyncTest(name, fn) {
  try {
    await fn();
    pass++;
    results.push(`✅ PASS: ${name}`);
  } catch (e) {
    fail++;
    results.push(`❌ FAIL: ${name} - ${e.message}`);
  }
}

console.log('STAGE 7: SEARCH & RETRIEVAL TESTS');
const source = new LocalLegalKnowledgeSource();

console.log('\n--- PART 1-2: Real KB Questions ---');

await asyncTest('Q1: Limitation Act - condonation of delay', async () => {
  const hits = await source.search('condonation of delay sufficient cause limitation');
  assert(hits.length > 0, 'No results returned');
  const lim = hits.find(h => h.id === 'IND-PROC-LIM001-V2');
  assert(lim, 'IND-PROC-LIM001-V2 should be retrieved');
  assert(lim.provenance.source.includes('India Code') || lim.provenance.source.includes('Legislative Department'), 'Source should be India Code or Legislative Department');
  assert(lim.provenance.citation.includes('Limitation Act'), 'Citation should mention Limitation Act');
  assert(lim.temporal?.effectiveFrom === '1964-01-01', `effectiveFrom should be 1964-01-01, got ${lim.temporal?.effectiveFrom}`);
  assert(lim.temporal?.currentStatus === 'CURRENT LAW', `currentStatus should be CURRENT LAW, got ${lim.temporal?.currentStatus}`);
});

await asyncTest('Q2: Constitution Article 21 - right to life', async () => {
  const hits = await source.search('right to life personal liberty Article 21');
  assert(hits.length > 0, 'No results returned');
  const art21 = hits.find(h => h.id === 'IND-CONST-ART021-V2');
  assert(art21, 'IND-CONST-ART021-V2 should be retrieved');
  assert(art21.provenance.source.includes('Legislative Department') || art21.provenance.source.includes('India Code'), 'Source should be Legislative Department or India Code');
});

await asyncTest('Q3: Transfer of Property Act', async () => {
  const hits = await source.search('transfer of property sale mortgage');
  assert(hits.length > 0, 'No results returned');
  const tpa = hits.find(h => h.id === 'IND-PROP-TPA001-V2');
  assert(tpa, 'IND-PROP-TPA001-V2 should be retrieved');
  assert(tpa.provenance.documentType === 'statute', 'Document type should be statute');
});

await asyncTest('Q4: Indian Contract Act', async () => {
  const hits = await source.search('Indian Contract Act 1872 damages breach');
  assert(hits.length > 0, 'No results returned');
  const ica = hits.find(h => h.id === 'IND-CONT-ICA001-V2');
  assert(ica, 'IND-CONT-ICA001-V2 should be retrieved');
});

await asyncTest('Q5: Code of Civil Procedure', async () => {
  const hits = await source.search('civil procedure suit jurisdiction decree');
  assert(hits.length > 0, 'No results returned');
  const cpc = hits.find(h => h.id.startsWith('IND-CIV-CPC'));
  assert(cpc, 'A CPC record should be retrieved');
});

await asyncTest('Q6: Specific Relief Act', async () => {
  const hits = await source.search('specific relief injunction mandatory');
  assert(hits.length > 0, 'No results returned');
  const sra = hits.find(h => h.id === 'IND-PROP-SRA001-V2');
  assert(sra, 'IND-PROP-SRA001-V2 should be retrieved');
});

await asyncTest('Q7: Writ jurisdiction Constitution', async () => {
  const hits = await source.search('writ jurisdiction habeas corpus mandamus');
  assert(hits.length > 0, 'No results returned');
  const writ = hits.find(h => h.id === 'IND-CONST-WRIT01-V2');
  assert(writ, 'IND-CONST-WRIT01-V2 should be retrieved');
});

// ============================================================
// PART 3: NEGATIVE / SAFETY QUESTIONS
// ============================================================
console.log('\n--- PART 3: Negative / Safety Questions ---');

await asyncTest('N1: Blocked record (IBC) NOT retrievable', async () => {
  const hits = await source.search('insolvency bankruptcy resolution moratorium');
  const ibc = hits.find(h => h.id === 'IND-CORP-IBC001-V2');
  assert(!ibc, 'IND-CORP-IBC001-V2 should NOT be retrieved (blocked)');
});

await asyncTest('N2: Blocked record (Arbitration) NOT retrievable', async () => {
  const hits = await source.search('arbitration interim measures emergency award');
  const arb = hits.find(h => h.id === 'IND-COMM-ARB001-V2');
  assert(!arb, 'IND-COMM-ARB001-V2 should NOT be retrieved (blocked)');
});

await asyncTest('N3: Blocked record (DPDP) NOT retrievable', async () => {
  const hits = await source.search('data protection privacy fiduciary consent');
  const dpdp = hits.find(h => h.id === 'IND-TECH-DPDP01-V2');
  assert(!dpdp, 'IND-TECH-DPDP01-V2 should NOT be retrieved (blocked)');
});

await asyncTest('N4: Nonexistent authority returns empty', async () => {
  const hits = await source.search('Martian colonial tax code section 999');
  assert(hits.length === 0, 'Should return empty for nonexistent authority');
});

await asyncTest('N5: Generic terms do not falsely ground', async () => {
  const hits = await source.search('blockchain transaction judge citation statute case');
  for (const hit of hits) {
    const haystack = `${hit.title} ${hit.text}`.toLowerCase();
    const hasSubstantiveMatch = ['limitation', 'contract', 'property', 'civil', 'specific', 'relief', 'constitution'].some(
      term => haystack.includes(term)
    );
    assert(hasSubstantiveMatch, `Generic query should not return unrelated record: ${hit.id}`);
  }
});

// ============================================================
// RESULTS
// ============================================================
console.log('\n--- RESULTS ---');
for (const r of results) {
  console.log(r);
}
console.log(`TOTAL: ${pass + fail} | PASS: ${pass} | FAIL: ${fail}`);

if (fail > 0) {
  process.exit(1);
}

