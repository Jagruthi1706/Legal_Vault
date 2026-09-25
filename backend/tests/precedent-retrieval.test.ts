import assert from 'node:assert/strict';
import test from 'node:test';
import { VectorRecord } from '../src/services/ai/vector/types';
import { createTestSource, STATUTE_CHUNKS, PRECEDENT_CHUNKS } from './precedent-retrieval-helpers';

test('R1-R2: retrieval with and without authorityKind filter', async () => {
  const source = await createTestSource([...STATUTE_CHUNKS, ...PRECEDENT_CHUNKS]);
  const all = source.toRetrievedChunks(await source.search('Article 21'));
  assert.ok(all.length > 0 && all.every((r) => r.scope === 'LEGAL_AUTHORITY'), 'all LEGAL_AUTHORITY');
  const prec = await source.search('Article 21', { authorityKind: 'judicial_precedent' });
  assert.ok(prec.length > 0 && prec.every((r) => r.provenance.authorityKind === 'judicial_precedent'), 'all judicial_precedent');
});

test('R3-R4: relevant precedents retrieved, unrelated returns nothing', async () => {
  const source = await createTestSource([...STATUTE_CHUNKS, ...PRECEDENT_CHUNKS]);
  const names = (await source.search('Article 21', { authorityKind: 'judicial_precedent' })).map((r) => r.provenance.caseName);
  assert.ok(names.some((n) => /maneka/i.test(n)) && names.some((n) => /hussainara/i.test(n)), 'relevant precedents');
  assert.equal((await source.search('weather forecast Mumbai', { authorityKind: 'judicial_precedent' })).length, 0, 'unrelated nothing');
});

test('R5: authorityKind separates statute vs precedent', async () => {
  const source = await createTestSource([...STATUTE_CHUNKS, ...PRECEDENT_CHUNKS]);
  const prec = await source.search('Article 21', { authorityKind: 'judicial_precedent' });
  const stat = await source.search('Article 21', { authorityKind: 'statute' });
  assert.ok(prec.length > 0 && stat.length > 0, 'both non-empty');
  assert.ok(prec.every((r) => r.provenance.documentType === 'judgment') && stat.every((r) => r.provenance.documentType === 'statute'), 'separated');
});

test('R6-R7: scope LEGAL_AUTHORITY, CASE_DOCUMENT excluded', async () => {
  const cd: VectorRecord = { id: 'cd:1', text: 'Article 21 case', embedding: [], scope: 'CASE_DOCUMENT', metadata: { documentId: 'cd', title: 'CD', source: 'U', sourceUrl: '', license: '', documentType: 'other', jurisdiction: 'India', pageOrSection: 'P1' } };
  const source = await createTestSource([...STATUTE_CHUNKS, ...PRECEDENT_CHUNKS, cd]);
  const results = source.toRetrievedChunks(await source.search('Article 21'));
  assert.ok(results.every((r) => r.scope === 'LEGAL_AUTHORITY' && r.scope !== 'CASE_DOCUMENT'), 'LEGAL_AUTHORITY only');
});

test('R8-R9: provenance + development-excerpt metadata survives', async () => {
  const source = await createTestSource([...STATUTE_CHUNKS, ...PRECEDENT_CHUNKS]);
  const prec = await source.search('Article 21', { authorityKind: 'judicial_precedent' });
  assert.ok(prec.length > 0);
  for (const r of prec) {
    assert.equal(r.provenance.source, 'KanoonGPT Indian Case Laws (development subset)');
    assert.equal(r.provenance.license, 'Apache-2.0');
    assert.equal(r.provenance.court, 'Supreme Court of India');
    assert.equal(r.provenance.authorityKind, 'judicial_precedent');
    assert.equal(r.provenance.contentCompleteness, 'development-excerpt');
    assert.equal(r.provenance.reportStatus, 'not-an-official-report');
  }
});

test('R10: attachment query retrieves both statute and precedent', async () => {
  const source = await createTestSource([...STATUTE_CHUNKS, ...PRECEDENT_CHUNKS]);
  const all = await source.search('article 21');
  assert.ok(all.some((r) => r.provenance.documentType === 'statute') && all.some((r) => r.provenance.documentType === 'judgment'), 'both types');
});

test('R11-R12: documentType filter backward compatibility', async () => {
  const source = await createTestSource([...STATUTE_CHUNKS, ...PRECEDENT_CHUNKS]);
  const stat = await source.search('Article 21', { documentType: 'statute' });
  const judg = await source.search('Article 21', { documentType: 'judgment' });
  assert.ok(stat.length > 0 && stat.every((r) => r.provenance.documentType === 'statute'), 'statute filter');
  assert.ok(judg.length > 0 && judg.every((r) => r.provenance.documentType === 'judgment'), 'judgment filter');
});
