/**
 * Maps a Prisma document (with optional blockchainTransactions) to the API shape
 * used by the frontend to restore persisted/anchored state after refresh.
 */
export function normalizeDocument(document: {
  id: string;
  caseId: string;
  uploadedById: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  description: string | null;
  version: number;
  sha256Hash: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  case?: unknown;
  uploadedBy?: unknown;
  blockchainTransactions?: Array<{
    createdAt: Date | string;
    transactionHash: string;
    chainId: number;
    contractAddress: string;
    blockNumber: number;
    documentHash?: string;
  }>;
}) {
  const txs = document.blockchainTransactions ?? [];
  const latest = txs[0];

  return {
    id: document.id,
    caseId: document.caseId,
    uploadedById: document.uploadedById,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    documentType: document.documentType,
    description: document.description,
    version: document.version,
    sha256Hash: document.sha256Hash,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    case: document.case,
    uploadedBy: document.uploadedBy,
    integrityStatus: txs.length > 0 ? 'ANCHORED' : 'NOT_ANCHORED',
    lastAnchoredAt: latest?.createdAt ?? null,
    lastTransactionHash: latest?.transactionHash ?? null,
    lastChainId: latest?.chainId ?? null,
    lastContractAddress: latest?.contractAddress ?? null,
    lastBlockNumber: latest?.blockNumber ?? null,
  };
}
