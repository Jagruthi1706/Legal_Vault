import assert from 'node:assert/strict';
import test from 'node:test';
import { canJudgeCompareDocument, canJudgeReviewDocument, getBlockchainVerificationDisplayState, getIntegrityDisplayState } from './documentIntegrity';

test('only the assigned judge receives the document integrity action', () => {
  assert.equal(canJudgeCompareDocument('judge', true), true);
  assert.equal(canJudgeCompareDocument('judge', false), false);
  assert.equal(canJudgeCompareDocument('client', true), false);
  assert.equal(canJudgeCompareDocument('lawyer', true), false);
  assert.equal(canJudgeCompareDocument('admin', true), false);
});

test('tamper results distinguish verified, tampered, and unavailable states', () => {
  assert.equal(getIntegrityDisplayState({ hashMatches: true, status: 'UNMODIFIED' }), 'verified');
  assert.equal(getIntegrityDisplayState({ hashMatches: false, status: 'TAMPERED' }), 'tampered');
  assert.equal(getIntegrityDisplayState({ hashMatches: false, status: 'VERIFICATION_UNAVAILABLE' }), 'unavailable');
  assert.equal(getIntegrityDisplayState({ hashMatches: false, status: 'NOT_ANCHORED' }), 'unavailable');
});

test('stored blockchain verification distinguishes verified, mismatch, and unavailable states', () => {
  assert.equal(getBlockchainVerificationDisplayState({ verified: true, status: 'VERIFIED' }), 'verified');
  assert.equal(getBlockchainVerificationDisplayState({ verified: false, status: 'MODIFIED' }), 'tampered');
  assert.equal(getBlockchainVerificationDisplayState({ verified: false, status: 'NOT_ANCHORED' }), 'unavailable');
});

test('Document Review keeps only cases assigned to the authenticated judge', () => {
  assert.equal(canJudgeReviewDocument('judge', 'judge-1', 'judge-1'), true);
  assert.equal(canJudgeReviewDocument('judge', 'judge-1', 'judge-2'), false);
  assert.equal(canJudgeReviewDocument('judge', 'judge-1', null), false);
  assert.equal(canJudgeReviewDocument('client', 'judge-1', 'judge-1'), false);
  assert.equal(canJudgeReviewDocument('lawyer', 'lawyer-1', 'lawyer-1'), false);
  assert.equal(canJudgeReviewDocument('admin', 'admin-1', 'admin-1'), false);
});

test('authorization failures are distinct from tampering', () => {
  assert.equal(getIntegrityDisplayState({ hashMatches: false, status: 'FORBIDDEN' }), 'unavailable');
});