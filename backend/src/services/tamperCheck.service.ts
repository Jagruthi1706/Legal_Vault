import { sha256 } from '../utils/hash';

export type TamperStatus = 'UNMODIFIED' | 'TAMPERED';

export interface TamperComparisonResult {
  status: TamperStatus;
  hashMatches: boolean;
  originalHash: string;
  candidateHash: string;
  message: string;
}

export interface TamperCheckSideEffectFlags {
  candidatePersisted: false;
  blockchainTransactionCreated: false;
}

/**
 * Pure SHA-256 comparison against an authoritative original anchored hash.
 * Filename/metadata are intentionally unused.
 */
export function compareCandidateToOriginalHash(
  originalAnchoredHash: string,
  candidateBytes: Buffer | Uint8Array | string,
): TamperComparisonResult {
  const originalHash = originalAnchoredHash.replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(originalHash)) {
    throw new Error('Original anchored hash must be a 64-character hex SHA-256 digest.');
  }

  const candidateHash = sha256(candidateBytes);
  const hashMatches = candidateHash === originalHash;

  return {
    status: hashMatches ? 'UNMODIFIED' : 'TAMPERED',
    hashMatches,
    originalHash,
    candidateHash,
    message: hashMatches
      ? 'Candidate SHA-256 matches the original blockchain-anchored SHA-256.'
      : 'Candidate SHA-256 does not match the original blockchain-anchored fingerprint.',
  };
}

export const TAMPER_CHECK_SIDE_EFFECTS: TamperCheckSideEffectFlags = {
  candidatePersisted: false,
  blockchainTransactionCreated: false,
};

export interface TamperCheckDeps {
  getOriginalDocument: (documentId: string, userId: string) => Promise<{
    id: string;
    originalFileName: string;
    sha256Hash: string | null;
  } | null>;
  getAnchorTransaction: (documentId: string) => Promise<{
    documentHash: string;
    transactionHash: string;
    blockNumber: number;
    chainId: number;
    contractAddress: string;
  } | null>;
  getAnchoredHashFromTransaction: (transactionHash: string) => Promise<{
    documentHash: string;
    referenceId: string;
    actor: string;
    eventType: string;
    timestamp: number;
  }>;
  verifyOriginalHashOnChain: (originalHash: string) => Promise<{
    exists: boolean;
    referenceId: string;
    actor: string;
    eventType: string;
    timestamp: number;
  }>;
  /** Must never be invoked by tamper check */
  anchorDocument?: (...args: unknown[]) => Promise<unknown>;
  /** Must never be invoked by tamper check */
  createBlockchainTransaction?: (...args: unknown[]) => Promise<unknown>;
  /** Must never be invoked by tamper check */
  createDocument?: (...args: unknown[]) => Promise<unknown>;
}

export async function performTamperCheck(
  input: {
    userId: string;
    originalDocumentId: string;
    candidateBytes: Buffer;
    candidateFileName: string;
    candidateMimeType: string;
    candidateFileSize: number;
  },
  deps: TamperCheckDeps,
) {
  const original = await deps.getOriginalDocument(input.originalDocumentId, input.userId);
  if (!original) {
    throw Object.assign(new Error('Original document not found or not authorized.'), {
      statusCode: 404,
    });
  }

  const anchorTx = await deps.getAnchorTransaction(original.id);
  if (!anchorTx) {
    throw Object.assign(
      new Error(
        'Original document has not been anchored on-chain. Anchor it before running tamper detection.',
      ),
      { statusCode: 400 },
    );
  }

  let blockchainAnchor;
  try {
    blockchainAnchor = await deps.getAnchoredHashFromTransaction(anchorTx.transactionHash);
    const onChainAnchor = await deps.verifyOriginalHashOnChain(blockchainAnchor.documentHash);
    if (!onChainAnchor.exists) {
      throw Object.assign(new Error('Original document anchor was not found on-chain.'), { statusCode: 400 });
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw Object.assign(new Error('Original document blockchain anchor could not be verified.'), { statusCode: 503 });
  }

  const comparison = compareCandidateToOriginalHash(
    blockchainAnchor.documentHash,
    input.candidateBytes,
  );

  let originalAnchored = false;
  let onChain: Awaited<ReturnType<TamperCheckDeps['verifyOriginalHashOnChain']>> | null = null;
  try {
    onChain = await deps.verifyOriginalHashOnChain(blockchainAnchor.documentHash);
    originalAnchored = Boolean(onChain.exists);
  } catch {
    originalAnchored = false;
    onChain = null;
  }

  // Explicitly do not call write-side dependencies.
  // Tests assert these remain unused.
  void deps.anchorDocument;
  void deps.createBlockchainTransaction;
  void deps.createDocument;

  return {
    ...comparison,
    ...TAMPER_CHECK_SIDE_EFFECTS,
    candidateFileName: input.candidateFileName,
    candidateMimeType: input.candidateMimeType,
    candidateFileSize: input.candidateFileSize,
    originalDocumentId: original.id,
    originalFileName: original.originalFileName,
    originalAnchored,
    chainId: anchorTx.chainId,
    contractAddress: anchorTx.contractAddress,
    transactionHash: anchorTx.transactionHash,
    blockNumber: anchorTx.blockNumber,
    onChain,
  };
}
