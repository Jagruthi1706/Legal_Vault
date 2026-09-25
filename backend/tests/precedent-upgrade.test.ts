import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseCorpus,
  computeAdditiveMetadata,
  isPlaceholder,
} from '../scripts/upgrade-precedents';
import { SAMPLE_CORPUS } from './precedent-upgrade-fixtures';

test('U1: isPlaceholder + parseCorpus basics', () => {
  assert.equal(isPlaceholder('N/A'), true);
  assert.equal(isPlaceholder('None'), true);
  assert.equal(isPlaceholder(''), true);
  assert.equal(isPlaceholder('Constitution of India'), false);
  const records = parseCorpus(SAMPLE_CORPUS);
  assert.equal(records.length, 2);
  assert.equal(records[0].officialIdentifier, 'auth-kesavananda-1973');
  assert.equal(records[0].APPLICABLE_STATUTES, 'Constitution of India');
  assert.equal(records[1].APPLICABLE_ARTICLES, 'Articles 14, 19 and 21');
  assert.equal(parseCorpus(SAMPLE_CORPUS.replace(/\n/g, '\r\n')).length, 2);
});

test('U2: computeAdditiveMetadata adds required markers', () => {
  const additions = computeAdditiveMetadata(
    { documentType: 'judgment' },
    { recordId: 'P', officialIdentifier: 'x', subArea: 'S', APPLICABLE_ARTICLES: 'N/A', APPLICABLE_STATUTES: 'N/A', APPLICABLE_SECTIONS: 'N/A' },
  );
  assert.equal(additions.authorityKind, 'judicial_precedent');
  assert.equal(additions.sourceType, 'legal_authority');
  assert.equal(additions.contentCompleteness, 'development-excerpt');
  assert.equal(additions.reportStatus, 'not-an-official-report');
  assert.equal(additions.LEGAL_AREA, 'Constitutional Law');
  assert.equal(additions.SUB_AREA, 'S');
});

test('U3: skips N/A fields, adds supported ones, idempotent', () => {
  const empty = { recordId: 'P', officialIdentifier: 'x', subArea: 'S', APPLICABLE_ARTICLES: 'N/A', APPLICABLE_STATUTES: 'None', APPLICABLE_SECTIONS: '' };
  const a1 = computeAdditiveMetadata({ documentType: 'judgment' }, empty);
  assert.equal(a1.APPLICABLE_ARTICLES, undefined);
  assert.equal(a1.APPLICABLE_STATUTES, undefined);
  const full = { recordId: 'P', officialIdentifier: 'x', subArea: 'S', APPLICABLE_ARTICLES: 'Article 21', APPLICABLE_STATUTES: 'Constitution of India', APPLICABLE_SECTIONS: 'Section 377' };
  const a2 = computeAdditiveMetadata({ documentType: 'judgment' }, full);
  assert.equal(a2.APPLICABLE_ARTICLES, 'Article 21');
  assert.equal(a2.APPLICABLE_STATUTES, 'Constitution of India');
  assert.equal(a2.APPLICABLE_SECTIONS, 'Section 377');
  const a3 = computeAdditiveMetadata({ documentType: 'judgment', authorityKind: 'judicial_precedent', sourceType: 'legal_authority', contentCompleteness: 'development-excerpt', reportStatus: 'not-an-official-report', LEGAL_AREA: 'Constitutional Law', SUB_AREA: 'Existing' }, { ...full, subArea: 'New' });
  assert.equal(a3.authorityKind, undefined);
  assert.equal(a3.SUB_AREA, 'New');
});
