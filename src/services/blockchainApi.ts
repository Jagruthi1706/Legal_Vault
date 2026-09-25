import { API_BASE, authHeaders, handleResponse } from './apiClient';

export interface AnchorRequest {
  documentId: string;
  caseId: string;
  documentHash?: string;
  eventType?: string;
}

export interface AnchorResponse {
  success: boolean;
  data: {
    documentHash: string;
    transaction: {
      id: string;
      transactionHash: string;
      blockNumber: number;
      contractAddress: string;
      chainId: number;
      documentHash: string;
      eventType: string;
      status: string;
      createdAt: string;
      documentId: string;
      caseId: string;
      document?: any;
      case?: any;
    };
    blockchain: {
      transactionHash: string;
      blockNumber: number;
      contractAddress: string;
      chainId: number;
      confirmationStatus: string;
      gasUsed?: string;
      effectiveGasPrice?: string;
      networkName: string;
      explorerTxUrl: string | null;
      explorerAddressUrl: string | null;
    };
    network: {
      chainId: number;
      networkName: string;
      contractAddress: string | null;
      explorerAddressUrl: string | null;
    };
    explorerTxUrl: string | null;
  };
}

export interface VerifyRequest {
  documentId?: string;
  documentHash?: string;
}

export interface VerifyResponse {
  success: boolean;
  data: {
    verified: boolean;
    status?: string;
    reason?: string;
    documentHash?: string;
    documentId?: string;
    storedHash?: string;
    currentHash?: string;
    suppliedHash?: string;
    onChain?: {
      exists: boolean;
      referenceId: string;
      actor: string;
      eventType: string;
      timestamp: number;
    };
    network?: {
      chainId: number;
      networkName: string;
      contractAddress: string | null;
      explorerAddressUrl: string | null;
    } | null;
  };
}

export interface BlockchainTransaction {
  id: string;
  transactionHash: string;
  blockNumber: number;
  contractAddress: string;
  chainId: number;
  documentHash: string;
  eventType: string;
  status: string;
  createdAt: string;
  documentId: string;
  caseId: string;
  networkName?: string;
  explorerTxUrl?: string | null;
  explorerAddressUrl?: string | null;
  document?: {
    id: string;
    originalFileName: string;
    mimeType: string;
    sha256Hash: string;
  };
  case?: {
    id: string;
    caseNumber: string;
    title: string;
  };
}

export interface NetworkStatusResponse {
  success: boolean;
  data: {
    configured: boolean;
    rpcConfigured: boolean;
    contractConfigured: boolean;
    walletConfigured: boolean;
    chainId: number | null;
    networkName: string;
    contractAddress: string | null;
    explorerAddressUrl: string | null;
    expectedChainId: number | null;
  };
}

export const blockchainApi = {
  async getNetworkStatus(): Promise<NetworkStatusResponse> {
    const res = await fetch(`${API_BASE}/blockchain/network`, {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  async uploadDocument(
    file: File,
    caseId: string,
    documentType: string,
    description?: string,
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caseId', caseId);
    formData.append('documentType', documentType);
    if (description) formData.append('description', description);

    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return handleResponse<{
      success: boolean;
      data: {
        id: string;
        caseId: string;
        originalFileName: string;
        sha256Hash: string;
        mimeType: string;
        fileSize: number;
        documentType: string;
        createdAt: string;
      };
    }>(res);
  },

  async anchorDocument(req: AnchorRequest): Promise<AnchorResponse> {
    const res = await fetch(`${API_BASE}/blockchain/anchor`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(req),
    });
    return handleResponse<AnchorResponse>(res);
  },

  async verifyDocument(req: VerifyRequest): Promise<VerifyResponse> {
    const res = await fetch(`${API_BASE}/blockchain/verify`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(req),
    });
    return handleResponse<VerifyResponse>(res);
  },

  async getTransactions(): Promise<{ success: boolean; data: BlockchainTransaction[] }> {
    const res = await fetch(`${API_BASE}/blockchain/transactions`, {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  async getDocumentBlockchain(documentId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/blockchain`, {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  async getCaseBlockchain(caseId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/cases/${caseId}/blockchain`, {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  async getTransactionByHash(txHash: string): Promise<any> {
    const res = await fetch(`${API_BASE}/blockchain/tx/${txHash}`, {
      headers: authHeaders(),
    });
    return handleResponse(res);
  },
};
