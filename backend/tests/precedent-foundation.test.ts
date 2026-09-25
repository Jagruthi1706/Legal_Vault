import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parsePrecedentCorpus,
  parsePrecedentRecords,
  validatePrecedentRecords,
  ParsedPrecedentRecord,
} from '../src/services/ai/legal/knowledge-base/precedent-record';
import {
  chunkPrecedentRecord,
  PrecedentChunk,
  PRECEDENT_MAX_CHUNK_LENGTH,
} from '../src/services/ai/legal/knowledge-base/precedent-chunker';
import {
  deterministicPrecedentId,
  precedentChunkId,
} from '../src/services/ai/legal/knowledge-base/precedent-id';
import {
  resolvePrecedentRegistryEntry,
  toPrecedentProvenance,
} from '../src/services/ai/legal/knowledge-base/precedent-provenance';
import {
  parseKnowledgeBaseRecords,
  validateKnowledgeBaseRecords,
} from '../src/services/ai/legal/knowledge-base/record-parser';
import { chunkLegalRecord } from '../src/services/ai/legal/knowledge-base/legal-record-chunker';
import authorities from '../src/services/ai/legal/corpus/authorities.json';

/**
 * Verified dataset identity + a verbatim member URL, derived from the REGISTERED
 * development subset itself (authorities.json) — the actual licensed ingestion
 * basis of kanoongpt-dev-subset ("Full remote dataset is not ingested").
 */
const KANOON_DATASET_NAME = 'KanoonGPT Indian Case Laws (development subset)';
const verifiedMemberUrl = (() => {
  const member = authorities.find(
    (item) =>
      item.documentType === 'judgment' && item.source === KANOON_DATASET_NAME,
  );
  if (!member) {
    throw new Error('registered kanoongpt-dev-subset corpus has no judgment members');
  }
  return member.sourceUrl;
})();

const synthText = (blocks: string[]): string =>
  ['='.repeat(80), ...blocks, '='.repeat(80)].join('\n');

const BASE_FIELDS: Record<string, string> = {
  CASE_ID: 'PREC-TEST-0001',
  CASE_NAME: 'Test v. Example',
  COURT: 'Supreme Court of India',
  BENCH: 'N/A',
  JUDGES: 'N/A',
  DATE: '2024-08-01',
  CASE_NUMBER: 'W.P. (C) 123/2024',
  CITATION: 'AIR 2024 SC 999',
  LEGAL_AREA: 'Constitutional Law',
  SUB_AREA: 'Testing',
  FACTS: 'The petitioner filed a test petition.',
  ISSUES: 'Whether the test construction is valid.',
  ARGUMENTS: 'N/A',
  APPLICABLE_ARTICLES: 'Article 14',
  APPLICABLE_STATUTES: 'Test Act, 1900',
  APPLICABLE_SECTIONS: 'Section 1',
  APPLICABLE_RULES: 'N/A',
  LEGAL_PRINCIPLE: 'Equality before the law.',
  RATIO: 'The ratio is the test proportionality rule.',
  HOLDING: 'The holding is that the impugned act is valid.',
  FINAL_OUTCOME: 'Petition allowed.',
  REMEDY: 'N/A',
  RELIEF: 'N/A',
  RELATED_CASES: 'N/A',
  FOLLOWED_CASES: 'N/A',
  DISTINGUISHED_CASES: 'N/A',
  OVERRULED_STATUS: 'Good law',
  CURRENT_STATUS: 'Good law',
  TEMPORAL_METADATA: 'Judgment effective 2024-08-01',
  VERSION: '1.0',
  OFFICIAL_SOURCE_NAME: 'KanoonGPT Indian Case Laws (development subset)',
  OFFICIAL_SOURCE_URL: 'https://huggingface.co/datasets/kanoongpt/indian-case-laws',
  OFFICIAL_IDENTIFIER: 'AIR 2024 SC 999',
  VERIFICATION_STATUS: 'Verified against Primary Source',
  LAST_VERIFIED_AT: '2026-09-05',
};

/** `null` override removes the field entirely (to simulate a missing field). */
const synthRecord = (
  overrides: Record<string, string | null> = {},
): ParsedPrecedentRecord => {
  const base: Record<string, string> = { ...BASE_FIELDS };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete base[key];
    } else {
      base[key] = value;
    }
  }
  const lines = [
    `Record: ${base.CASE_ID}`,
    ...Object.entries(base).map(([k, v]) => `${k}: ${v}`),
  ];
  const [parsed] = parsePrecedentRecords(synthText(lines));
  return parsed;
};

const chunkRecord = (record: ParsedPrecedentRecord): PrecedentChunk[] =>
  chunkPrecedentRecord({
    record,
    provenance: { source: 'KanoonGPT Indian Case Laws (development subset)' },
  });

const chunksIn = (chunks: PrecedentChunk[], sectionPrefix: string): PrecedentChunk[] =>
  chunks.filter((c) => c.pageOrSection.startsWith(sectionPrefix));

test('P1: valid precedent parsing is lossless, deterministic and boundary-safe', () => {
  const DELIM = '='.repeat(80);
  const corpus = [
    DELIM,
    [
      'Record: PREC-TEST-0001',
      'CASE_ID: PREC-TEST-0001',
      'CASE_NAME: Test v. Example',
      'FACTS: first fact line',
      'second fact line continues',
      'DATE:   2024-08-01  ',
    ].join('\n'),
    DELIM,
    [
      'Case: Unstructured narrative section without a Record header',
      'This narrative must never be parsed as a precedent record.',
    ].join('\n'),
    DELIM,
  ].join('\n');

  const { records, stats } = parsePrecedentCorpus(corpus);
  assert.equal(stats.precedentRecords, 1);
  assert.equal(stats.excludedNonPrecedentSections, 1);
  assert.equal(records.length, 1);

  const [record] = records;
  assert.equal(record.record, 'PREC-TEST-0001');
  assert.equal(record.fields.CASE_ID, 'PREC-TEST-0001');
  assert.equal(record.fields.CASE_NAME, 'Test v. Example');
  // Multiline continuation is preserved (joined), never truncated.
  assert.equal(record.fields.FACTS, 'first fact line second fact line continues');
  // Whitespace is normalized deterministically.
  assert.equal(record.fields.DATE, '2024-08-01');
  assert.deepEqual(Object.keys(record.repeatedFields), []);
  assert.deepEqual(record.trailingLines, []);

  // Re-parsing the same input yields the identical record identity and fields.
  const reparsed = parsePrecedentRecords(corpus);
  assert.deepEqual(
    reparsed.map((r) => [r.record, r.fields]),
    records.map((r) => [r.record, r.fields]),
  );

  // Ambiguous boundaries: a heading inside a record terminates the field block;
  // trailing lines are preserved verbatim and never parsed as fields.
  const boundaryCorpus = synthText([
    [
      `Record: ${BASE_FIELDS.CASE_ID}`,
      ...Object.entries(BASE_FIELDS).map(([k, v]) => `${k}: ${v}`),
      'Case: Narratively continued corpus unit',
      'FACTS: this line belongs to the next unit, not the record',
    ].join('\n'),
  ]);
  const [boundaryRecord] = parsePrecedentRecords(boundaryCorpus);
  assert.deepEqual(boundaryRecord.trailingLines, [
    'Case: Narratively continued corpus unit',
    'FACTS: this line belongs to the next unit, not the record',
  ]);
  assert.equal(boundaryRecord.fields.FACTS, BASE_FIELDS.FACTS);
});

test('P2: invalid precedents are rejected (fail-closed validation)', () => {
  assert.throws(
    () => validatePrecedentRecords([]),
    /No precedent records were parsed/,
  );

  const missingCases: Array<[Record<string, string | null>, string]> = [
    [{ CITATION: null }, 'CITATION'],
    [{ COURT: null }, 'COURT'],
    [{ CASE_NAME: null }, 'CASE_NAME'],
    [{ DATE: null }, 'DATE'],
    [{ OFFICIAL_SOURCE_URL: null }, 'OFFICIAL_SOURCE_URL'],
    [{ VERIFICATION_STATUS: null }, 'VERIFICATION_STATUS'],
  ];
  for (const [overrides, label] of missingCases) {
    assert.throws(
      () => validatePrecedentRecords([synthRecord(overrides)]),
      new RegExp(`missing required field ${label}`),
      `omitting ${label} must fail validation`,
    );
  }

  assert.throws(
    () => validatePrecedentRecords([synthRecord({ OFFICIAL_SOURCE_URL: 'not-a-url' })]),
    /invalid OFFICIAL_SOURCE_URL/,
  );

  // Malformed identity metadata: Record header and CASE_ID disagree.
  const mismatchLines = [
    'Record: PREC-TEST-0001',
    ...Object.entries({ ...BASE_FIELDS, CASE_ID: 'PREC-TEST-9999' }).map(
      ([k, v]) => `${k}: ${v}`,
    ),
  ];
  const [mismatched] = parsePrecedentRecords(synthText(mismatchLines));
  assert.throws(() => validatePrecedentRecords([mismatched]), /mismatched CASE_ID/);

  const noLegalText = synthRecord({
    FACTS: 'N/A',
    ISSUES: 'N/A',
    ARGUMENTS: 'N/A',
    LEGAL_PRINCIPLE: 'N/A',
    RATIO: 'N/A',
    HOLDING: 'none',
    FINAL_OUTCOME: 'N/A',
    REMEDY: 'N/A',
  });
  assert.throws(
    () => validatePrecedentRecords([noLegalText]),
    /contains no legal text/,
  );

  // A fully valid synthetic record validates cleanly.
  validatePrecedentRecords([synthRecord()]);
});

test('P3: precedent record IDs are deterministic and formatting-independent', () => {
  const id = deterministicPrecedentId(
    'Supreme Court of India',
    '2024-08-01',
    'AIR 2024 SC 999',
  );
  assert.equal(id, 'PREC-SUPREMECOURT-2024-AIR-2024-SC-999');
  assert.equal(
    id,
    deterministicPrecedentId(
      ' supreme court of india ',
      '2024-08-01',
      ' air 2024 sc 999 ',
    ),
  );
  assert.notEqual(
    id,
    deterministicPrecedentId('Supreme Court of India', '2024-08-01', 'AIR 2025 SC 1'),
  );
  assert.equal(deterministicPrecedentId('', '', ''), 'PREC-COURT-UNKNOWN');

  // Repeated parsing of the same input produces the same record identity.
  assert.equal(synthRecord().record, synthRecord().record);
});

test('P4: chunk IDs are deterministic and follow ${recordId}:prec:${index}', () => {
  const record = synthRecord();
  const first = chunkRecord(record);
  const second = chunkRecord(record);
  assert.deepEqual(
    first.map((c) => c.chunkId),
    second.map((c) => c.chunkId),
  );
  assert.ok(first.length >= 5, 'a complete record yields the five semantic chunks');
  first.forEach((c, i) => {
    assert.equal(c.chunkId, `PREC-TEST-0001:prec:${i + 1}`);
    assert.equal(c.chunkIndex, i + 1);
    assert.equal(c.chunkCount, first.length);
  });
  assert.equal(precedentChunkId('PREC-X', 7), 'PREC-X:prec:7');
});

test('P5: semantic chunk structure (five source-ordered sections)', () => {
  const chunks = chunkRecord(synthRecord());
  assert.deepEqual(
    chunks.map((c) => c.pageOrSection),
    [
      'Identity & citation',
      'Facts & issues',
      'Ratio & holding',
      'Statutory linkage',
      'Outcome & remedy',
    ],
  );
  chunks.forEach((c) => {
    assert.ok(c.text.length <= PRECEDENT_MAX_CHUNK_LENGTH);
    assert.equal(c.documentId, 'PREC-TEST-0001');
    assert.equal(c.recordId, 'PREC-TEST-0001');
    assert.equal(c.title, 'Test v. Example');
    assert.ok(c.text.length > 0);
  });
  // Identity chunk text carries the identity/citation fields.
  const identity = chunks[0];
  assert.ok(identity.text.includes('CASE_NAME: Test v. Example'));
  assert.ok(identity.text.includes('COURT: Supreme Court of India'));
  assert.ok(identity.text.includes('CITATION: AIR 2024 SC 999'));
  assert.ok(identity.text.includes('LEGAL_AREA: Constitutional Law'));
  // Lifecycle/temporal/provenance labels are metadata-only (never rendered).
  for (const label of [
    'CURRENT_STATUS:',
    'TEMPORAL_METADATA:',
    'OFFICIAL_SOURCE_URL:',
  ]) {
    assert.ok(
      !chunks.some((c) => c.text.includes(label)),
      `${label} must travel in metadata, not chunk text`,
    );
  }
  assert.equal(chunks[0].metadata.OFFICIAL_SOURCE_URL, BASE_FIELDS.OFFICIAL_SOURCE_URL);
  assert.equal(chunks[0].metadata.CURRENT_STATUS, BASE_FIELDS.CURRENT_STATUS);
  assert.equal(chunks[0].metadata.TEMPORAL_METADATA, BASE_FIELDS.TEMPORAL_METADATA);
});

test('P6: facts/issues are preserved verbatim and never truncated', () => {
  const chunks = chunkRecord(synthRecord());
  const facts = chunksIn(chunks, 'Facts & issues');
  assert.equal(facts.length, 1);
  assert.ok(facts[0].text.includes(`FACTS: ${BASE_FIELDS.FACTS}`));
  assert.ok(facts[0].text.includes(`ISSUES: ${BASE_FIELDS.ISSUES}`));
  // Placeholders are never rendered, but travel losslessly in metadata.
  assert.ok(!facts[0].text.includes('ARGUMENTS:'));
  assert.equal(facts[0].metadata.ARGUMENTS, 'N/A');
  // Losslessness: other chunks carry the facts/issues in metadata.
  assert.equal(chunks[0].metadata.FACTS, BASE_FIELDS.FACTS);
  assert.equal(chunks[0].metadata.ISSUES, BASE_FIELDS.ISSUES);

  // An oversized field is split on word boundaries — never shortened.
  const longFacts = 'The petitioner filed a lengthy factual narrative. '.repeat(40).trim();
  const longChunks = chunkRecord(synthRecord({ FACTS: longFacts }));
  const longFactsChunks = chunksIn(longChunks, 'Facts & issues');
  // The facts field is split into parts; ISSUES remains its own chunk.
  const issuesChunk = longFactsChunks.find((c) => c.text.startsWith('ISSUES: '));
  assert.ok(
    issuesChunk,
    'ISSUES stays a separate chunk after the oversized facts split',
  );
  const factParts = longFactsChunks.filter((c) => c !== issuesChunk);
  assert.ok(factParts.length > 1, 'oversized facts are split into parts');
  factParts.forEach((c) => {
    assert.ok(c.text.length <= PRECEDENT_MAX_CHUNK_LENGTH);
  });
  const rejoined = factParts.map((c) => c.text).join(' ');
  assert.ok(rejoined.startsWith('FACTS: '));
  assert.equal(rejoined.slice('FACTS: '.length), longFacts);
  // Losslessness still holds for every non-split chunk (split facts parts
  // carry the FACTS label in their text instead of metadata).
  longChunks
    .filter((c) => !c.pageOrSection.includes('(part'))
    .forEach((c) => assert.equal(c.metadata.FACTS, longFacts));
});

test('P7: ratio/holding are preserved verbatim in their semantic chunk', () => {
  const chunks = chunkRecord(synthRecord());
  const ratio = chunksIn(chunks, 'Ratio & holding');
  assert.equal(ratio.length, 1);
  assert.ok(ratio[0].text.includes(`LEGAL_PRINCIPLE: ${BASE_FIELDS.LEGAL_PRINCIPLE}`));
  assert.ok(ratio[0].text.includes(`RATIO: ${BASE_FIELDS.RATIO}`));
  assert.ok(ratio[0].text.includes(`HOLDING: ${BASE_FIELDS.HOLDING}`));
  // Losslessness for the other chunks.
  assert.equal(chunks[1].metadata.RATIO, BASE_FIELDS.RATIO);
  assert.equal(chunks[1].metadata.HOLDING, BASE_FIELDS.HOLDING);
  assert.equal(chunks[4].metadata.LEGAL_PRINCIPLE, BASE_FIELDS.LEGAL_PRINCIPLE);
});

test('P8: statutory linkage is preserved verbatim in its semantic chunk', () => {
  const chunks = chunkRecord(synthRecord());
  const linkage = chunksIn(chunks, 'Statutory linkage');
  assert.equal(linkage.length, 1);
  assert.ok(linkage[0].text.includes('APPLICABLE_ARTICLES: Article 14'));
  assert.ok(linkage[0].text.includes('APPLICABLE_STATUTES: Test Act, 1900'));
  assert.ok(linkage[0].text.includes('APPLICABLE_SECTIONS: Section 1'));
  // Placeholder linkage is metadata-only, never rendered.
  assert.ok(!linkage[0].text.includes('APPLICABLE_RULES:'));
  assert.equal(linkage[0].metadata.APPLICABLE_RULES, 'N/A');
  // Non-placeholder rules are rendered; losslessness holds elsewhere.
  const withRules = chunkRecord(synthRecord({ APPLICABLE_RULES: 'Rule 3 of Test Rules' }));
  const rulesLinkage = chunksIn(withRules, 'Statutory linkage');
  assert.ok(rulesLinkage[0].text.includes('APPLICABLE_RULES: Rule 3 of Test Rules'));
  assert.equal(withRules[0].metadata.APPLICABLE_ARTICLES, 'Article 14');
});

test('P9: final outcome/remedy and case relationships are preserved', () => {
  const chunks = chunkRecord(synthRecord());
  const outcome = chunksIn(chunks, 'Outcome & remedy');
  assert.equal(outcome.length, 1);
  assert.ok(outcome[0].text.includes(`FINAL_OUTCOME: ${BASE_FIELDS.FINAL_OUTCOME}`));
  // Placeholder remedy/relief/relationships stay metadata-only.
  for (const label of ['REMEDY:', 'RELIEF:', 'RELATED_CASES:', 'FOLLOWED_CASES:']) {
    assert.ok(!outcome[0].text.includes(label), `${label} must not render when N/A`);
  }
  assert.equal(outcome[0].metadata.REMEDY, 'N/A');
  assert.equal(outcome[0].metadata.RELIEF, 'N/A');

  // Non-placeholder relationships render inside the outcome chunk.
  const withRelations = chunkRecord(
    synthRecord({
      RELATED_CASES: 'State v. Other, AIR 2020 SC 1',
      FOLLOWED_CASES: 'Followed v. Precedent, AIR 2019 SC 2',
    }),
  );
  const relations = chunksIn(withRelations, 'Outcome & remedy');
  assert.ok(relations[0].text.includes('RELATED_CASES: State v. Other, AIR 2020 SC 1'));
  assert.ok(relations[0].text.includes('FOLLOWED_CASES: Followed v. Precedent, AIR 2019 SC 2'));
  // Final outcome is descriptive fact metadata on every other chunk too.
  assert.equal(withRelations[0].metadata.FINAL_OUTCOME, BASE_FIELDS.FINAL_OUTCOME);
  assert.equal(withRelations[0].metadata.OVERRULED_STATUS, BASE_FIELDS.OVERRULED_STATUS);
});

test('P10: authorityKind is judicial_precedent on every chunk (field + metadata)', () => {
  const chunks = chunkRecord(synthRecord({ FACTS: 'x '.repeat(900).trim() }));
  assert.ok(chunks.length > 1);
  chunks.forEach((c) => {
    assert.equal(c.authorityKind, 'judicial_precedent');
    assert.equal(c.metadata.authorityKind, 'judicial_precedent');
  });
});

test('P11: every chunk is scoped LEGAL_AUTHORITY (CASE_DOCUMENT untouched)', () => {
  chunkRecord(synthRecord()).forEach((c) => {
    assert.equal(c.scope, 'LEGAL_AUTHORITY');
  });
});

test('P12: every chunk is sourceType legal_authority', () => {
  chunkRecord(synthRecord()).forEach((c) => {
    assert.equal(c.sourceType, 'legal_authority');
  });
});

test('P13: provenance is fail-closed — exact dataset identity only, no hostname matching', () => {
  // Court/ministry/statute portals have NO precedent-compatible registry entry.
  for (const url of [
    'https://main.sci.gov.in/judgments',
    'https://api.sci.gov.in/judgment',
    'https://www.indiacode.nic.in/handle/123456789/1362',
    'https://lddashboard.nic.in',
    'https://www.meity.gov.in',
  ]) {
    assert.equal(
      resolvePrecedentRegistryEntry(synthRecord({ OFFICIAL_SOURCE_URL: url })),
      null,
      `${url} must stay BLOCKED for precedents`,
    );
  }

  // An ARBITRARY Hugging Face URL must stay blocked even with the registered
  // dataset name (hostname matching was deliberately removed in Stage 12B).
  assert.equal(
    resolvePrecedentRegistryEntry(synthRecord()),
    null,
    'arbitrary huggingface.co URLs must not resolve to kanoongpt-dev-subset',
  );
  // The sibling KanoonGPT statutes dataset is NOT the case-law dataset.
  assert.equal(
    resolvePrecedentRegistryEntry(
      synthRecord({
        OFFICIAL_SOURCE_URL:
          'https://huggingface.co/datasets/KanoonGPT/indian-legal-documents',
      }),
    ),
    null,
  );

  // A claimed dataset NAME must never license a contradictory official URL.
  assert.equal(
    resolvePrecedentRegistryEntry(
      synthRecord({
        OFFICIAL_SOURCE_NAME: 'KanoonGPT Indian Case Laws (development subset)',
        OFFICIAL_SOURCE_URL: 'https://main.sci.gov.in/judgments',
      }),
    ),
    null,
    'name-only matching must stay fail-closed',
  );

  // A member URL with a MISMATCHED source name stays blocked (Gate 1).
  assert.equal(
    resolvePrecedentRegistryEntry(
      synthRecord({
        OFFICIAL_SOURCE_NAME: 'KanoonGPT',
        OFFICIAL_SOURCE_URL: verifiedMemberUrl,
      }),
    ),
    null,
    'dataset name must match the registry verbatim',
  );

  // The EXACT approved upstream dataset URL resolves (Gate 2b).
  assert.deepEqual(
    resolvePrecedentRegistryEntry(
      synthRecord({
        OFFICIAL_SOURCE_URL:
          'https://huggingface.co/datasets/KanoonGPT/indian-case-laws',
      }),
    ),
    { registryId: 'kanoongpt-dev-subset', membership: 'dataset_url' },
  );

  // A verbatim member URL of the registered development subset resolves (Gate 2a).
  const memberRecord = synthRecord({
    OFFICIAL_SOURCE_NAME: KANOON_DATASET_NAME,
    OFFICIAL_SOURCE_URL: verifiedMemberUrl,
  });
  assert.deepEqual(resolvePrecedentRegistryEntry(memberRecord), {
    registryId: 'kanoongpt-dev-subset',
    membership: 'registered_member',
  });

  // toPrecedentProvenance refuses to fabricate provenance for blocked records.
  assert.throws(
    () => toPrecedentProvenance(synthRecord()),
    /no registered provenance source/,
  );

  // Resolved provenance carries verbatim verification metadata + judgment type.
  const prov = toPrecedentProvenance(memberRecord);
  assert.equal(prov.registryId, 'kanoongpt-dev-subset');
  assert.equal(prov.membership, 'registered_member');
  assert.equal(prov.legal.documentType, 'judgment');
  assert.equal(prov.legal.license, 'Apache-2.0');
  assert.equal(prov.legal.source, memberRecord.fields.OFFICIAL_SOURCE_NAME);
  assert.equal(prov.legal.sourceUrl, verifiedMemberUrl);
  assert.equal(prov.legal.court, memberRecord.fields.COURT);
  assert.equal(prov.legal.caseName, memberRecord.fields.CASE_NAME);
  assert.equal(prov.legal.caseNumber, memberRecord.fields.CASE_NUMBER);
  assert.equal(prov.legal.judgmentDate, memberRecord.fields.DATE);
  assert.equal(prov.legal.citation, memberRecord.fields.CITATION);
  assert.equal(prov.legal.version, memberRecord.fields.VERSION);
  assert.equal(prov.verification.officialIdentifier, memberRecord.fields.OFFICIAL_IDENTIFIER);
  assert.equal(prov.verification.verificationStatus, memberRecord.fields.VERIFICATION_STATUS);
  assert.equal(prov.verification.lastVerifiedAt, memberRecord.fields.LAST_VERIFIED_AT);
});

test('P14: duplicate fields and duplicate record ids are rejected, never overwritten', () => {
  const lines = [
    `Record: ${BASE_FIELDS.CASE_ID}`,
    ...Object.entries(BASE_FIELDS).map(([k, v]) => `${k}: ${v}`),
    'CITATION: AIR 2024 SC 111',
  ];
  const [duplicated] = parsePrecedentRecords(synthText(lines));
  assert.deepEqual(duplicated.repeatedFields.CITATION, [
    'AIR 2024 SC 999',
    'AIR 2024 SC 111',
  ]);
  assert.throws(
    () => validatePrecedentRecords([duplicated]),
    /duplicate field labels/,
  );

  const block = [
    `Record: ${BASE_FIELDS.CASE_ID}`,
    ...Object.entries(BASE_FIELDS).map(([k, v]) => `${k}: ${v}`),
  ].join('\n');
  // Explicit delimiters separate the two identical corpus units.
  const duplicateCorpus = ['='.repeat(80), block, '='.repeat(80), block, '='.repeat(80)].join('\n');
  const corpus = parsePrecedentCorpus(duplicateCorpus);
  assert.equal(corpus.stats.precedentRecords, 2);
  assert.throws(
    () => validatePrecedentRecords(corpus.records),
    /Duplicate precedent record/,
  );
});

test('P15: existing statutory KB pipeline is unaffected (regression guard)', () => {
  const statutoryLines = [
    'Record: IND-TEST-0001-V2',
    'DOCUMENT_ID: IND-TEST-0001-V2',
    'TITLE: Test statute record',
    'LEGAL_AREA: Civil Law',
    'SOURCE_TYPE: Central Statute',
    'AUTHORITY_LEVEL: Level 1 - Primary Statutory',
    'JURISDICTION: Union of India',
    'LEGAL_PROPOSITION: A test proposition.',
    'CURRENT_STATUS: CURRENT LAW',
    'EFFECTIVE_FROM: 1900-01-01',
    'EFFECTIVE_TO: Open',
    'OFFICIAL_SOURCE_NAME: India Code Portal',
    'OFFICIAL_SOURCE_URL: https://www.indiacode.nic.in/handle/123456789/1566',
    'VERIFICATION_STATUS: Verified against Primary Source',
    'VERSION: 2.1',
  ].join('\n');
  const [statutory] = parseKnowledgeBaseRecords(synthText([statutoryLines]));
  validateKnowledgeBaseRecords([statutory]);
  const kbChunks = chunkLegalRecord({
    record: statutory,
    provenance: { source: 'India Code' },
  });
  assert.ok(kbChunks.length > 0);
  assert.equal(kbChunks[0].chunkId, 'IND-TEST-0001-V2:kb:1');
  assert.equal(kbChunks[0].scope, 'LEGAL_AUTHORITY');
  assert.equal(kbChunks[0].sourceType, 'legal_authority');
  // Statutory chunk ids keep the :kb: convention; precedent ids never leak in.
  kbChunks.forEach((c) => assert.ok(!c.chunkId.includes(':prec:')));
});

