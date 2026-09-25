import { ethers } from 'ethers';
import { getBlockchainConfig, LEGAL_VAULT_ABI, BlockchainConfig } from '../config';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants/app.constants';

export interface AnchorResult {
  transactionHash: string;
  blockNumber: number;
  contractAddress: string;
  chainId: number;
  confirmationStatus: 'confirmed' | 'failed';
  gasUsed?: string;
  effectiveGasPrice?: string;
}

export interface VerificationResult {
  exists: boolean;
  referenceId: string;
  actor: string;
  eventType: string;
  timestamp: number;
}

export interface AnchoredDocumentResult {
  documentHash: string;
  referenceId: string;
  actor: string;
  eventType: string;
  timestamp: number;
}

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private contract?: ethers.Contract;
  private config: BlockchainConfig;

  constructor(customConfig?: Partial<BlockchainConfig>) {
    const defaultConfig = getBlockchainConfig();
    this.config = {
      ...defaultConfig,
      ...customConfig,
    };

    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);

    if (this.config.privateKey) {
      this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
    }

    if (this.config.contractAddress) {
      const signerOrProvider = this.wallet ?? this.provider;
      this.contract = new ethers.Contract(
        this.config.contractAddress,
        LEGAL_VAULT_ABI,
        signerOrProvider,
      );
    }
  }

  /**
   * Helper to format a 64-char SHA-256 hash or hex string into a valid bytes32 hex string (0x...).
   */
  public toBytes32Hash(hash: string): string {
    const cleaned = hash.replace(/^0x/i, '').trim();
    if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
      throw new AppError(
        'Invalid SHA-256 hash format. Expected 64 hexadecimal characters.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    return `0x${cleaned.toLowerCase()}`;
  }

  /**
   * Helper to format a reference ID (e.g. case ID) into a bytes32 hex string.
   */
  public toBytes32Reference(refId: string): string {
    const cleaned = refId.replace(/^0x/i, '').trim();
    if (/^[0-9a-fA-F]{64}$/.test(cleaned)) {
      return `0x${cleaned.toLowerCase()}`;
    }

    const utf8Bytes = ethers.toUtf8Bytes(refId);
    if (utf8Bytes.length <= 32) {
      return ethers.zeroPadValue(utf8Bytes, 32);
    }

    return ethers.keccak256(utf8Bytes);
  }

  async getNetwork() {
    return this.provider.getNetwork();
  }

  getConfig(): BlockchainConfig {
    return this.config;
  }

  /**
   * Anchors a document's SHA-256 hash onto the LegalVault smart contract.
   */
  async anchorDocument(
    documentHash: string,
    caseId: string,
    eventType: string = 'EVIDENCE_UPLOAD',
  ): Promise<AnchorResult> {
    if (!this.wallet) {
      throw new AppError(
        'Blockchain wallet private key is not configured.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (!this.contract || !this.config.contractAddress) {
      throw new AppError(
        'Blockchain contract address is not configured.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    const formattedHash = this.toBytes32Hash(documentHash);
    const formattedRefId = this.toBytes32Reference(caseId);

    try {
      const network = await this.provider.getNetwork();
      const chainId = Number(network.chainId);

      const contractWithSigner = this.contract.connect(this.wallet) as ethers.Contract;
      const tx = await contractWithSigner.getFunction('anchorDocument')(
        formattedHash,
        formattedRefId,
        eventType,
      );

      const receipt = await tx.wait();

      if (!receipt) {
        throw new AppError(
          'Transaction submitted but no receipt was received.',
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        contractAddress: this.config.contractAddress,
        chainId,
        confirmationStatus: receipt.status === 1 ? 'confirmed' : 'failed',
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.gasPrice?.toString(),
      };
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Blockchain anchoring failed: ${error?.reason || error?.message || 'Unknown error'}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verifies an anchored document hash on the LegalVault contract.
   */
  async verifyDocument(documentHash: string): Promise<VerificationResult> {
    if (!this.contract || !this.config.contractAddress) {
      throw new AppError(
        'Blockchain contract address is not configured.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    const formattedHash = this.toBytes32Hash(documentHash);

    try {
      const result = await this.contract.getFunction('verifyDocument')(formattedHash);
      return {
        exists: Boolean(result.exists),
        referenceId: String(result.referenceId),
        actor: String(result.actor),
        eventType: String(result.eventType),
        timestamp: Number(result.timestamp),
      };
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Blockchain verification failed: ${error?.reason || error?.message || 'Unknown error'}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAnchoredHashFromTransaction(transactionHash: string): Promise<AnchoredDocumentResult> {
    if (!this.contract || !this.config.contractAddress) {
      throw new AppError(
        'Blockchain contract address is not configured.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    const receipt = await this.provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new AppError('Blockchain anchor transaction receipt was not found.', HTTP_STATUS.NOT_FOUND);
    }

    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log);
        if (!parsed || parsed.name !== 'DocumentAnchored') continue;

        const documentHash = String(parsed.args.documentHash).replace(/^0x/i, '').toLowerCase();
        const referenceId = String(parsed.args.referenceId);
        const actor = String(parsed.args.actor);
        const eventType = String(parsed.args.eventType);
        const timestamp = Number(parsed.args.timestamp);

        if (!/^[0-9a-f]{64}$/.test(documentHash) || !referenceId || !actor || !eventType || !Number.isFinite(timestamp)) {
          throw new AppError('Blockchain anchor event data is invalid.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }

        return { documentHash, referenceId, actor, eventType, timestamp };
      } catch (error) {
        if (error instanceof AppError) throw error;
      }
    }

    throw new AppError('DocumentAnchored event was not found in the transaction receipt.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  /**
   * Add an authorized anchor address (owner only)
   */
  async addAuthorizedAnchor(address: string): Promise<{ txHash: string; blockNumber: number }> {
    if (!this.wallet) {
      throw new AppError(
        'Blockchain wallet private key is not configured.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (!this.contract || !this.config.contractAddress) {
      throw new AppError(
        'Blockchain contract address is not configured.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const contractWithSigner = this.contract.connect(this.wallet) as ethers.Contract;
      const tx = await contractWithSigner.getFunction('addAuthorizedAnchor')(address);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new AppError(
          'Transaction submitted but no receipt was received.',
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Failed to add authorized anchor: ${error?.reason || error?.message || 'Unknown error'}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Remove an authorized anchor address (owner only)
   */
  async removeAuthorizedAnchor(address: string): Promise<{ txHash: string; blockNumber: number }> {
    if (!this.wallet) {
      throw new AppError(
        'Blockchain wallet private key is not configured.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (!this.contract || !this.config.contractAddress) {
      throw new AppError(
        'Blockchain contract address is not configured.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const contractWithSigner = this.contract.connect(this.wallet) as ethers.Contract;
      const tx = await contractWithSigner.getFunction('removeAuthorizedAnchor')(address);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new AppError(
          'Transaction submitted but no receipt was received.',
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Failed to remove authorized anchor: ${error?.reason || error?.message || 'Unknown error'}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if an address is authorized to anchor documents
   */
  async isAuthorizedAnchor(address: string): Promise<boolean> {
    if (!this.contract || !this.config.contractAddress) {
      throw new AppError(
        'Blockchain contract address is not configured.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const result = await this.contract.getFunction('isAuthorizedAnchor')(address);
      return Boolean(result);
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Failed to check authorized anchor status: ${error?.reason || error?.message || 'Unknown error'}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

export const blockchainService = new BlockchainService();
