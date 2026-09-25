import type { TamperCheckResult } from '../services/documentsApi';
import type { VerifyResponse } from '../services/blockchainApi';

export type IntegrityDisplayState = 'verified' | 'tampered' | 'unavailable';

export const getIntegrityDisplayState = (
  result: Pick<TamperCheckResult, 'hashMatches' | 'status'>,
): IntegrityDisplayState => {
  if (result.hashMatches || result.status === 'UNMODIFIED') return 'verified';
  if (result.status === 'TAMPERED' || result.status === 'MODIFIED') return 'tampered';
  return 'unavailable';
};

export const canJudgeCompareDocument = (role: string, isAssignedJudge: boolean): boolean =>
  role === 'judge' && isAssignedJudge;

export const canJudgeReviewDocument = (
  role: string,
  userId: string | undefined,
  assignedJudgeId: string | null | undefined,
): boolean => role === 'judge' && Boolean(userId && assignedJudgeId && userId === assignedJudgeId);

export const getBlockchainVerificationDisplayState = (
  result: Pick<VerifyResponse['data'], 'verified' | 'status'>,
): IntegrityDisplayState => {
  if (result.verified) return 'verified';
  if (result.status === 'MODIFIED' || result.status === 'HASH_MISMATCH') return 'tampered';
  return 'unavailable';
};
