import { env } from './env';

export const LEGAL_VAULT_ABI = [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'documentHash', type: 'bytes32' }],
    name: 'DocumentAlreadyAnchored',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'documentHash', type: 'bytes32' }],
    name: 'DocumentNotAnchored',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'address', name: 'anchor', type: 'address' }],
    name: 'UnauthorizedAnchor',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'documentHash', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'referenceId', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'actor', type: 'address' },
      { indexed: false, internalType: 'string', name: 'eventType', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'DocumentAnchored',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: 'address', name: 'anchor', type: 'address' }],
    name: 'AuthorizedAnchorAdded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: 'address', name: 'anchor', type: 'address' }],
    name: 'AuthorizedAnchorRemoved',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'documentHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'referenceId', type: 'bytes32' },
      { internalType: 'string', name: 'eventType', type: 'string' },
    ],
    name: 'anchorDocument',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'anchor', type: 'address' }],
    name: 'addAuthorizedAnchor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'anchor', type: 'address' }],
    name: 'removeAuthorizedAnchor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'anchor', type: 'address' }],
    name: 'isAuthorizedAnchor',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'documentHash', type: 'bytes32' }],
    name: 'verifyDocument',
    outputs: [
      { internalType: 'bool', name: 'exists', type: 'bool' },
      { internalType: 'bytes32', name: 'referenceId', type: 'bytes32' },
      { internalType: 'address', name: 'actor', type: 'address' },
      { internalType: 'string', name: 'eventType', type: 'string' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface BlockchainConfig {
  rpcUrl: string;
  privateKey?: string;
  contractAddress?: string;
  chainId?: number;
}

export function getBlockchainConfig(): BlockchainConfig {
  return {
    rpcUrl: env.BLOCKCHAIN_RPC_URL,
    privateKey: env.BLOCKCHAIN_PRIVATE_KEY,
    contractAddress: env.BLOCKCHAIN_CONTRACT_ADDRESS,
    chainId: env.BLOCKCHAIN_CHAIN_ID,
  };
}

export function getNetworkName(chainId?: number): string {
  switch (chainId) {
    case 11155111:
      return 'Ethereum Sepolia';
    case 31337:
      return 'Hardhat Local';
    case 1:
      return 'Ethereum Mainnet';
    default:
      return chainId ? `EVM Chain ${chainId}` : 'Unknown Network';
  }
}

export function getExplorerTxUrl(chainId: number, transactionHash: string): string | null {
  switch (chainId) {
    case 11155111:
      return `https://sepolia.etherscan.io/tx/${transactionHash}`;
    case 1:
      return `https://etherscan.io/tx/${transactionHash}`;
    default:
      return null;
  }
}

export function getExplorerAddressUrl(chainId: number, address: string): string | null {
  switch (chainId) {
    case 11155111:
      return `https://sepolia.etherscan.io/address/${address}`;
    case 1:
      return `https://etherscan.io/address/${address}`;
    default:
      return null;
  }
}
