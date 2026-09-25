import { DocumentMetadata } from '../types/api';

export interface RestoredUploadedDocument {
  id: string;
  caseId: string;
  originalFileName: string;
  sha256Hash: string;
  mimeType: string;
  fileSize: number;
  persistenceStatus: 'PERSISTED';
  integrityStatus: 'ANCHORED' | 'NOT_ANCHORED' | string;
}

export interface RestoredAnchorState {
  transactionHash: string;
  blockNumber: number;
  contractAddress: string;
  chainId: number;
  networkName: string;
  status: string;
  explorerTxUrl: string | null;
  documentHash: string;
  alreadyAnchored: boolean;
}

export const explorerTxUrlFor = (
  chainId: number | null | undefined,
  txHash: string | null | undefined,
): string | null => {
  if (!txHash) return null;
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (chainId === 1) return `https://etherscan.io/tx/${txHash}`;
  return null;
};

export const networkNameFor = (chainId: number | null | undefined): string => {
  if (chainId === 11155111) return 'Ethereum Sepolia';
  if (chainId === 31337) return 'Hardhat Local';
  if (chainId === 1) return 'Ethereum Mainnet';
  return chainId != null ? `EVM Chain ${chainId}` : 'Ethereum Sepolia';
};

/** Reconstruct demo document panel state from GET /documents payload after refresh. */
export const toUploadedDoc = (doc: DocumentMetadata): RestoredUploadedDocument => ({
  id: doc.id,
  caseId: doc.caseId,
  originalFileName: doc.originalFileName,
  sha256Hash: doc.sha256Hash,
  mimeType: doc.mimeType,
  fileSize: doc.fileSize,
  persistenceStatus: 'PERSISTED',
  integrityStatus: doc.integrityStatus || (doc.lastTransactionHash ? 'ANCHORED' : 'NOT_ANCHORED'),
});

/** Reconstruct on-chain anchor panel from persisted API fields after refresh. */
export const toAnchorState = (doc: DocumentMetadata): RestoredAnchorState | null => {
  const txHash = doc.lastTransactionHash || doc.blockchainTransactions?.[0]?.transactionHash;
  if (!txHash) return null;

  const chainId = doc.lastChainId ?? doc.blockchainTransactions?.[0]?.chainId ?? 11155111;
  const blockNumber =
    doc.lastBlockNumber ?? doc.blockchainTransactions?.[0]?.blockNumber ?? 0;
  const contractAddress =
    doc.lastContractAddress || doc.blockchainTransactions?.[0]?.contractAddress || '';

  return {
    transactionHash: txHash,
    blockNumber,
    contractAddress,
    chainId,
    networkName: networkNameFor(chainId),
    status: 'ALREADY_ANCHORED',
    explorerTxUrl: explorerTxUrlFor(chainId, txHash),
    documentHash: doc.sha256Hash,
    alreadyAnchored: true,
  };
};
