import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { extractDocxText } from '../src/services/ai/legal/knowledge-base/docx-parser';
import {
  parseKnowledgeBaseCorpus,
  parseKnowledgeBaseRecords,
  validateKnowledgeBaseRecords,
  ParsedKnowledgeBaseRecord,
} from '../src/services/ai/legal/knowledge-base/record-parser';
import {
  chunkLegalRecord,
  KB_MAX_CHUNK_LENGTH,
} from '../src/services/ai/legal/knowledge-base/legal-record-chunker';
import {
  derivePrimaryIsoDate,
  mapKnowledgeBaseRecord,
} from '../src/services/ai/legal/knowledge-base/record-mapping';
import {
  kbRecordProvenance,
  matchKbRegistryEntry,
} from '../src/services/ai/legal/knowledge-base/kb-provenance';
import { chunkDocument } from '../src/services/ai/chunking.service';

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

const CHUNKER_PATH = path.join(
  __dirname,
  '..',
  'src',
  'services',
  'ai',
  'legal',
  'knowledge-base',
  'legal-record-chunker.ts',
);

const EXPECTED_RECORD_IDS = [
  'IND-CONST-ART014-V2',
  'IND-CONST-ART021-V2',
  'IND-CONST-WRIT01-V2',
  'IND-CIV-CPC001-V2',
  'IND-CIV-CPC002-V2',
  'IND-CIV-CPC003-V2',
  'IND-PROC-LIM001-V2',
  'IND-CONT-ICA001-V2',
  'IND-PROP-TPA001-V2',
  'IND-PROP-SRA001-V2',
  'IND-CORP-IBC001-V2',
  'IND-COMM-ARB001-V2',
  'IND-COMM-BNK001-V2',
  'IND-COMM-CPA001-V2',
  'IND-LAB-STATUS-V2',
  'IND-TECH-DPDP01-V2',
];

const synthText = (blocks: string[]): string =>
  ['='.repeat(80), ...blocks, '='.repeat(80)].join('\n');

const synthRecord = (overrides: Record<string, string> = {}): ParsedKnowledgeBaseRecord => {
  const base: Record<string, string> = {
    DOCUMENT_ID: 'IND-TEST-0001-V2',
    TITLE: 'Test statute record',
    LEGAL_AREA: 'Civil Law',
    SUB_AREA: 'Testing',
    SOURCE_TYPE: 'Central Statute',
    AUTHORITY_LEVEL: 'Level 1 - Primary Statutory',
    JURISDICTION: 'Union of India',
    STATE_OR_UT: 'All States and Union Territories',
    COURT_OR_AUTHORITY: 'N/A',
    STATUTE: 'Test Act, 1900',
    ARTICLE: 'N/A',
    SECTION: 'Section 1',
    RULE: 'N/A',
    LEGAL_PROPOSITION: 'A test proposition.',
    SIMPLE_EXPLANATION: 'A simple explanation.',
    'APPLICATION / WHEN RELEVANT': 'When testing.',
    'EXCEPTIONS / LIMITATIONS': 'None recorded.',
    IMPORTANT_QUALIFICATIONS: 'Test qualification.',
    RELATED_PROVISIONS: 'Related Section 2.',
    RELATED_CASE_LAW: 'N/A',
    CURRENT_STATUS: 'CURRENT LAW',
    EFFECTIVE_FROM: '1900-01-01',
    EFFECTIVE_TO: 'Open',
    HISTORICAL_APPLICABILITY: 'Historical note.',
    OFFICIAL_SOURCE_NAME: 'India Code Portal / Legislative Department',
    OFFICIAL_SOURCE_URL: 'https://www.indiacode.nic.in/handle/123456789/1566',
    OFFICIAL_IDENTIFIER: 'Test Act 1900',
    OFFICIAL_CITATION: 'Test Act 1900, S. 1',
    VERIFICATION_STATUS: 'Verified against Primary Source',
    LAST_VERIFIED_AT: '2026-09-03',
    KEYWORDS: 'test, statute',
    VERSION: '2.1',
    ...overrides,
  };
  const lines = [
    'Record: IND-TEST-0001-V2',
    ...Object.entries(base).map(([k, v]) => `${k}: ${v}`),
  ];
  const [parsed] = parseKnowledgeBaseRecords(synthText(lines));
  return parsed;
};

const minimalBlocks = (id: string, extra: string[] = []): string[] => [
  `Record: ${id}`,
  `DOCUMENT_ID: ${id}`,
  'TITLE: T',
  'LEGAL_AREA: L',
  'SOURCE_TYPE: Central Statute',
  'AUTHORITY_LEVEL: Level 1',
  'JURISDICTION: Union of India',
  'LEGAL_PROPOSITION: P',
  ...extra,
  'CURRENT_STATUS: CURRENT LAW',
  'EFFECTIVE_FROM: 1900-01-01',
  'EFFECTIVE_TO: Open',
  'OFFICIAL_SOURCE_NAME: India Code Portal',
  'OFFICIAL_SOURCE_URL: https://www.indiacode.nic.in',
  'VERIFICATION_STATUS: Verified against Primary Source',
  'VERSION: 2.1',
];

test('KB 4: duplicate Record identifiers fail strict validation', () => {
  const text = synthText(minimalBlocks('IND-DUP-0001-V2')).concat(
    '\n',
    synthText(minimalBlocks('IND-DUP-0001-V2')),
  );
  const records = parseKnowledgeBaseRecords(text);
  assert.equal(records.length, 2);
  assert.throws(() => validateKnowledgeBaseRecords(records), /Duplicate Knowledge Base record/);
});

test('KB 5: DOCUMENT_ID mismatch fails strict validation', () => {
  const record = synthRecord({ DOCUMENT_ID: 'IND-OTHER-9999-V2' });
  assert.throws(() => validateKnowledgeBaseRecords([record]), /mismatched DOCUMENT_ID/);
});

test('KB 6: missing required field fails strict validation', () => {
  const record = synthRecord();
  delete record.fields.TITLE;
  assert.throws(() => validateKnowledgeBaseRecords([record]), /missing required field TITLE/);
});

test('KB 7: multiline field values are fully preserved', () => {
  const text = synthText([
    'Record: IND-TEST-0002-V2',
    'DOCUMENT_ID: IND-TEST-0002-V2',
    'TITLE: T',
    'LEGAL_AREA: L',
    'SOURCE_TYPE: Central Statute',
    'AUTHORITY_LEVEL: Level 1',
    'JURISDICTION: Union of India',
    'LEGAL_PROPOSITION: First part of the proposition',
    'continued on the next source line with more detail',
    'CURRENT_STATUS: CURRENT LAW',
    'EFFECTIVE_FROM: 1900-01-01',
    'EFFECTIVE_TO: Open',
    'OFFICIAL_SOURCE_NAME: India Code Portal',
    'OFFICIAL_SOURCE_URL: https://www.indiacode.nic.in',
    'VERIFICATION_STATUS: Verified against Primary Source',
    'VERSION: 2.1',
  ]);
  const [record] = parseKnowledgeBaseRecords(text);
  assert.equal(
    record.fields.LEGAL_PROPOSITION,
    'First part of the proposition continued on the next source line with more detail',
  );
});

test('KB 8: duplicate field labels are detected and never silently overwritten', () => {
  const text = synthText([
    'Record: IND-TEST-0003-V2',
    'DOCUMENT_ID: IND-TEST-0003-V2',
    'TITLE: T',
    'LEGAL_AREA: L',
    'SOURCE_TYPE: Central Statute',
    'AUTHORITY_LEVEL: Level 1',
    'JURISDICTION: Union of India',
    'CURRENT_STATUS: FIRST STATUS VALUE',
    'LEGAL_PROPOSITION: P',
    'CURRENT_STATUS: SECOND STATUS VALUE',
    'EFFECTIVE_FROM: 1900-01-01',
    'EFFECTIVE_TO: Open',
    'OFFICIAL_SOURCE_NAME: India Code Portal',
    'OFFICIAL_SOURCE_URL: https://www.indiacode.nic.in',
    'VERIFICATION_STATUS: Verified against Primary Source',
    'VERSION: 2.1',
  ]);
  const [record] = parseKnowledgeBaseRecords(text);
  assert.deepEqual(record.repeatedFields.CURRENT_STATUS, [
    'FIRST STATUS VALUE',
    'SECOND STATUS VALUE',
  ]);
  assert.equal(
    record.fields.CURRENT_STATUS,
    'FIRST STATUS VALUE',
    'first occurrence kept verbatim, never overwritten',
  );
  assert.throws(
    () => validateKnowledgeBaseRecords([record]),
    /duplicate field labels[\s\S]*CURRENT_STATUS/,
  );
});

test('KB 9-11 + temporal helper: N/A, Open and complex EFFECTIVE_FROM are preserved verbatim', async () => {
  const { text } = await extractDocxText(fs.readFileSync(DOCX_PATH));
  const { records } = parseKnowledgeBaseCorpus(text);
  validateKnowledgeBaseRecords(records);

  const dpdp = records.find((r) => r.record === 'IND-TECH-DPDP01-V2');
  assert.ok(dpdp);
  assert.equal(dpdp.fields.ARTICLE, 'N/A');
  assert.equal(dpdp.fields.EFFECTIVE_TO, 'Open');
  assert.equal(
    dpdp.fields.EFFECTIVE_FROM,
    '2023-08-11 (Act Assent); Rules Notified 2025; Staggered Operational Phase-in',
  );

  // Trailing "Section 5: Master Landmark Judicial Precedents" heading must not leak into VERSION.
  assert.equal(dpdp.fields.VERSION, '2.1');
  assert.ok(dpdp.trailingLines.some((line) => line.startsWith('Section 5:')));

  // Optional primary-date derivation is unambiguous-only and never discards the source string.
  assert.equal(derivePrimaryIsoDate(dpdp.fields.EFFECTIVE_FROM), '2023-08-11');
  assert.equal(derivePrimaryIsoDate('Open'), null);
  assert.equal(derivePrimaryIsoDate('N/A'), null);
  assert.equal(derivePrimaryIsoDate('2026-09-03'), '2026-09-03');
});

test('KB 12: shared case-document chunker is untouched and independent from KB chunking', () => {
  // Static isolation check: the KB chunker must not import the shared chunker.
  const chunkerSource = fs.readFileSync(CHUNKER_PATH, 'utf8');
  assert.ok(
    !/from\s+['"].*chunking\.service['"]/.test(chunkerSource),
    'KB chunker must not import the shared chunker',
  );

  // Behavioural check: the shared chunker keeps its original case-document behaviour.
  const chunks = chunkDocument({
    caseId: 'case-1',
    documentId: 'doc-1',
    documentName: 'doc-1.txt',
    text: 'paragraph one\n\nparagraph two',
    sourceType: 'document',
    scope: 'CASE_DOCUMENT',
  });
  assert.equal(chunks.length, 2);
  assert.deepEqual(
    chunks.map((c) => c.chunkId),
    ['doc-1:section:1', 'doc-1:section:2'],
  );
  assert.equal(chunks[0].scope, 'CASE_DOCUMENT');

  // KB chunk ids use a distinct, documented scheme.
  const kbChunks = chunkLegalRecord({ record: synthRecord(), provenance: {} });
  assert.ok(kbChunks[0].chunkId.endsWith(':kb:1'));
  assert.equal(kbChunks[0].scope, 'LEGAL_AUTHORITY');
  assert.equal(KB_MAX_CHUNK_LENGTH, 1200);
});

test('KB 13 + 15: parser and chunker are deterministic across repeated runs', async () => {
  const { text } = await extractDocxText(fs.readFileSync(DOCX_PATH));
  const run1 = parseKnowledgeBaseCorpus(text);
  const run2 = parseKnowledgeBaseCorpus(text);
  assert.equal(
    JSON.stringify(run1),
    JSON.stringify(run2),
    're-running the parser must produce identical structured records',
  );

  const record = run1.records.find((r) => r.record === 'IND-CIV-CPC001-V2');
  assert.ok(record);
  const provenance = { source: record.fields.OFFICIAL_SOURCE_NAME };
  const c1 = chunkLegalRecord({ record, provenance });
  const c2 = chunkLegalRecord({ record, provenance });
  assert.equal(
    JSON.stringify(c1),
    JSON.stringify(c2),
    're-running chunking must produce identical chunk ids and texts',
  );
  assert.deepEqual(
    c1.map((c) => c.chunkId),
    c2.map((c) => c.chunkId),
  );
});

test('KB 14 + 16: full corpus parses, validates and chunks without data loss', async () => {
  const { text } = await extractDocxText(fs.readFileSync(DOCX_PATH));
  const { records, stats } = parseKnowledgeBaseCorpus(text);

  validateKnowledgeBaseRecords(records);

  const uniqueDocumentIds = new Set(records.map((r) => r.fields.DOCUMENT_ID));
  assert.equal(uniqueDocumentIds.size, 16);
  for (const record of records) {
    assert.equal(record.fields.DOCUMENT_ID, record.record);
    assert.equal(record.fields.VERSION, '2.1');
  }

  const allChunks = records.flatMap((record) =>
    chunkLegalRecord({
      record,
      provenance: { source: record.fields.OFFICIAL_SOURCE_NAME },
    }),
  );

  for (const chunk of allChunks) {
    assert.equal(chunk.scope, 'LEGAL_AUTHORITY');
    assert.equal(chunk.sourceType, 'legal_authority');
    assert.equal(chunk.chunkId, `${chunk.documentId}:kb:${chunk.chunkIndex}`);
    assert.ok(
      chunk.text.length <= KB_MAX_CHUNK_LENGTH,
      'chunk text must respect the maximum length',
    );
    assert.ok(chunk.title.length > 0);
  }

  // Losslessness: every source label/value of every record must appear in the
  // chunk text or the chunk metadata; and the grouped mapping must be total.
  for (const record of records) {
    const chunks = allChunks.filter((c) => c.recordId === record.record);
    assert.ok(chunks.length > 0);
    const combinedText = chunks.map((c) => c.text).join('\n');
    for (const [label, value] of Object.entries(record.fields)) {
      const rendered = combinedText.includes(`${label}: ${value}`);
      const inMetadata = chunks.some((c) => c.metadata[label] === value);
      assert.ok(
        rendered || inMetadata,
        `${record.record} field ${label} must survive parsing+chunking without loss`,
      );
    }

    const mapped = mapKnowledgeBaseRecord(record);
    const mappedEntries: Array<[string, string]> = [
      ...Object.entries(mapped.identity),
      ...Object.entries(mapped.classification),
      ...Object.entries(mapped.legalReference),
      ...Object.entries(mapped.coreLegalText),
      ...Object.entries(mapped.lifecycle),
      ...Object.entries(mapped.officialProvenance),
      ...Object.entries(mapped.discovery),
    ];
    for (const [label, value] of Object.entries(record.fields)) {
      assert.ok(
        mappedEntries.some(([l, v]) => l === label && v === value),
        `${record.record} field ${label} must appear in the grouped mapping`,
      );
    }
  }

  const lengths = allChunks.map((c) => c.text.length);
  const multiChunkRecords = records
    .map((r) => ({
      recordId: r.record,
      chunks: allChunks.filter((c) => c.recordId === r.record).length,
    }))
    .filter((r) => r.chunks > 1);

  const summary = {
    recordCount: records.length,
    uniqueDocumentIds: uniqueDocumentIds.size,
    chunkCount: allChunks.length,
    minChunkLength: Math.min(...lengths),
    maxChunkLength: Math.max(...lengths),
    multiChunkRecords,
    stats,
    validationStatus: 'PASS',
  };
  console.log('[KB Stage 2 deterministic validation result]', JSON.stringify(summary, null, 2));

  assert.equal(summary.recordCount, 16);
  assert.equal(summary.uniqueDocumentIds, 16);
});

test('KB provenance: record-sourced provenance is verbatim; registry match is fail-closed', () => {
  const indiaCodeRecord = synthRecord();
  const provenance = kbRecordProvenance(indiaCodeRecord);
  assert.equal(provenance.source, 'India Code Portal / Legislative Department');
  assert.equal(provenance.sourceUrl, 'https://www.indiacode.nic.in/handle/123456789/1566');
  assert.equal(provenance.version, '2.1');
  assert.equal(provenance.verificationStatus, 'Verified against Primary Source');
  assert.equal(provenance.documentType, 'statute');
  assert.equal(matchKbRegistryEntry(indiaCodeRecord)?.registryId, 'india-code');

  const otherSourceRecord = synthRecord({
    OFFICIAL_SOURCE_URL: 'https://www.meity.gov.in',
    OFFICIAL_SOURCE_NAME:
      'Ministry of Electronics and Information Technology (MeitY), Government of India',
  });
  assert.equal(
    matchKbRegistryEntry(otherSourceRecord),
    null,
    'unregistered sources stay unregistered; no invented license',
  );
  assert.ok(
    !('license' in kbRecordProvenance(otherSourceRecord)),
    'no license may be fabricated at this stage',
  );
});

test('Stage 4 provenance audit: exact approved/blocked partition of the 16 records', async () => {
  const { text } = await extractDocxText(fs.readFileSync(DOCX_PATH));
  const { records } = parseKnowledgeBaseCorpus(text);
  assert.equal(records.length, 16);

  const approved = records.filter((r) => matchKbRegistryEntry(r) !== null).map((r) => r.record);
  const blocked = records.filter((r) => matchKbRegistryEntry(r) === null).map((r) => r.record);

  // Approved: only sources factually equivalent to the registered "india-code"
  // dataset (indiacode.nic.in, and the India Code operator Legislative
  // Department's own legislative dashboard lddashboard.nic.in).
  assert.deepEqual(
    [...approved].sort(),
    [
      'IND-CONST-ART014-V2',
      'IND-CONST-ART021-V2',
      'IND-CONST-WRIT01-V2',
      'IND-CIV-CPC001-V2',
      'IND-CIV-CPC002-V2',
      'IND-CIV-CPC003-V2',
      'IND-PROC-LIM001-V2',
      'IND-CONT-ICA001-V2',
      'IND-PROP-TPA001-V2',
      'IND-PROP-SRA001-V2',
    ].sort(),
  );

  // Blocked (fail-closed): regulator/ministry portals and the Supreme Court
  // judgment portal have no registered license; KanoonGPT/Apache-2.0 must never
  // be treated as a license for them, and none of their URLs is factually
  // equivalent to the approved India Code source.
  assert.deepEqual(
    [...blocked].sort(),
    [
      'IND-CORP-IBC001-V2',
      'IND-COMM-ARB001-V2',
      'IND-COMM-BNK001-V2',
      'IND-COMM-CPA001-V2',
      'IND-LAB-STATUS-V2',
      'IND-TECH-DPDP01-V2',
    ].sort(),
  );

  // Guard against accidental over-broad matching: ministry/regulator/judiciary
  // portals must never map to the india-code entry.
  for (const url of [
    'https://www.ibbi.gov.in',
    'https://main.sci.gov.in/judgments',
    'https://consumeraffairs.nic.in',
    'https://labour.gov.in',
    'https://www.meity.gov.in',
  ]) {
    assert.equal(
      matchKbRegistryEntry(synthRecord({ OFFICIAL_SOURCE_URL: url, OFFICIAL_SOURCE_NAME: 'Any Ministry' })),
      null,
      `${url} must stay fail-closed`,
    );
  }
});

test('KB 1: DOCX extraction succeeds', async () => {
  const result = await extractDocxText(fs.readFileSync(DOCX_PATH));
  assert.ok(result.text.length > 1000);
  assert.ok(Array.isArray(result.messages));
  assert.ok(result.text.includes('Record: IND-CONST-ART014-V2'));
});

test('KB 2 + 3: exactly 16 records parsed, in deterministic source order', async () => {
  const { text } = await extractDocxText(fs.readFileSync(DOCX_PATH));
  const { records, stats } = parseKnowledgeBaseCorpus(text);
  assert.equal(records.length, 16);
  assert.equal(stats.statutoryRecords, 16);
  assert.equal(stats.excludedCaseRecords, 8, 'the 8 Case: precedent sections must be excluded');
  assert.deepEqual(
    records.map((r) => r.record),
    EXPECTED_RECORD_IDS,
    'record order and identifiers must match the source corpus',
  );
  for (const record of records) {
    assert.equal(Object.keys(record.repeatedFields).length, 0, `${record.record} has no duplicate labels`);
  }
});