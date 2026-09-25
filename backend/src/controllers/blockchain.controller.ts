import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../utils/prisma';
import {
  getBlockchainConfig,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  getNetworkName,
} from '../config';
import { blockchainService } from '../services/blockchain.service';
import { auditService, caseService, documentService } from '../services';
import { sha256 } from '../utils/hash';
import {
  anchorDocumentSchema,
  verifyDocumentSchema,
  authorizedAnchorSchema,
} from '../validators/blockchain.validator';

const buildNetworkPayload = (chainId: number, contractAddress?: string) => ({
  chainId,
  networkName: getNetworkName(chainId),
  contractAddress: contractAddress ?? null,
  explorerAddressUrl:
    contractAddress != null ? getExplorerAddressUrl(chainId, contractAddress) : null,
});

export const getNetworkStatus = asyncHandler(async (_req: Request, res: Response) => {
  const config = getBlockchainConfig();
  let liveChainId: number | null = null;

  try {
    const network = await blockchainService.getNetwork();
    liveChainId = Number(network.chainId);
  } catch {
    liveChainId = config.chainId ?? null;
  }

  const chainId = liveChainId ?? config.chainId ?? null;

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      configured: Boolean(config.rpcUrl && config.contractAddress && config.privateKey),
      rpcConfigured: Boolean(config.rpcUrl),
      contractConfigured: Boolean(config.contractAddress),
      walletConfigured: Boolean(config.privateKey),
      chainId,
      networkName: chainId != null ? getNetworkName(chainId) : 'Unknown Network',
      contractAddress: config.contractAddress ?? null,
      explorerAddressUrl:
        chainId != null && config.contractAddress
          ? getExplorerAddressUrl(chainId, config.contractAddress)
          : null,
      expectedChainId: config.chainId ?? null,
    },
  });
});

export const anchorDocument = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
    }

    const parseResult = anchorDocumentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const { documentId, caseId, documentHash: suppliedHash, eventType } = parseResult.data;

    const membership = await caseService.ensureUserIsParticipant(caseId, req.user.id);
    if (!membership) {
      throw new AppError(
        'Case not found or you are not a participant on this case.',
        HTTP_STATUS.FORBIDDEN,
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new AppError('Document not found.', HTTP_STATUS.NOT_FOUND);
    }

    if (document.caseId !== caseId) {
      throw new AppError(
        'Document does not belong to the specified caseId.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (!document.sha256Hash) {
      throw new AppError(
        'Document does not have a computed SHA-256 hash.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (
      suppliedHash &&
      suppliedHash.replace(/^0x/i, '').toLowerCase() !==
        document.sha256Hash.replace(/^0x/i, '').toLowerCase()
    ) {
      throw new AppError(
        'Supplied documentHash does not match the document stored SHA-256 hash.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const docHashToAnchor = document.sha256Hash;

    const existingTx = await prisma.blockchainTransaction.findFirst({
      where: { documentHash: docHashToAnchor },
    });

    if (existingTx) {
      throw new AppError(
        `Document hash is already anchored on-chain in transaction ${existingTx.transactionHash}.`,
        HTTP_STATUS.CONFLICT,
      );
    }

    const anchorResult = await blockchainService.anchorDocument(
      docHashToAnchor,
      caseId,
      eventType,
    );

    const dbTransaction = await prisma.blockchainTransaction.create({
      data: {
        transactionHash: anchorResult.transactionHash,
        blockNumber: anchorResult.blockNumber,
        contractAddress: anchorResult.contractAddress,
        chainId: anchorResult.chainId,
        documentHash: docHashToAnchor,
        eventType,
        status: anchorResult.confirmationStatus.toUpperCase(),
        documentId: document.id,
        caseId: document.caseId,
      },
      include: {
        document: true,
        case: true,
      },
    });

    const explorerTxUrl = getExplorerTxUrl(
      anchorResult.chainId,
      anchorResult.transactionHash,
    );
    await auditService.recordDocumentAnchored(
      document.caseId,
      req.user.id,
      document.id,
      dbTransaction.transactionHash,
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        documentHash: docHashToAnchor,
        transaction: dbTransaction,
        blockchain: {
          ...anchorResult,
          networkName: getNetworkName(anchorResult.chainId),
          explorerTxUrl,
          explorerAddressUrl: getExplorerAddressUrl(
            anchorResult.chainId,
            anchorResult.contractAddress,
          ),
        },
        network: buildNetworkPayload(anchorResult.chainId, anchorResult.contractAddress),
        explorerTxUrl,
      },
    });
  },
);

export const verifyDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const parseResult = verifyDocumentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const { documentId, documentHash: suppliedHash } = parseResult.data;

    let targetHash: string | undefined = suppliedHash?.replace(/^0x/i, '').toLowerCase();
    let documentRecord: Awaited<ReturnType<typeof documentService.getDocumentByIdForUser>> = null;
    let currentHash: string | null = null;
    let storedHash: string | null = null;

    if (documentId) {
      if (!req.user) {
        throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
      }

      documentRecord = await documentService.getDocumentByIdForUser(documentId, req.user.id, req.user.role);

      if (!documentRecord) {
        throw new AppError('Document not found in database.', HTTP_STATUS.NOT_FOUND);
      }

      if (!documentRecord.sha256Hash) {
        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: {
            verified: false,
            status: 'VERIFICATION_UNAVAILABLE',
            reason: 'Document has no stored SHA-256 hash for verification.',
            documentId,
          },
        });
        return;
      }

      storedHash = documentRecord.sha256Hash.replace(/^0x/i, '').toLowerCase();

      const content = await documentService.getDocumentContent(documentId);
      if (!content) {
        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: {
            verified: false,
            status: 'VERIFICATION_UNAVAILABLE',
            reason: 'Document content is unavailable for verification.',
            documentId,
          },
        });
        return;
      }

      currentHash = sha256(content);
      if (currentHash !== storedHash) {
        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: {
            verified: false,
            status: 'MODIFIED',
            reason: 'Stored document content does not match the canonical SHA-256 hash (HASH_MISMATCH).',
            documentId,
            storedHash,
            currentHash,
          },
        });
        return;
      }

      if (targetHash && targetHash !== storedHash) {
        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: {
            verified: false,
            status: 'HASH_MISMATCH',
            reason: 'Supplied hash does not match the document stored SHA-256 hash.',
            documentId,
            storedHash,
            suppliedHash: targetHash,
            currentHash,
          },
        });
        return;
      }

      targetHash = storedHash;
    } else if (targetHash && req.user) {
      // Hash-only verification is still case-scoped: a judge may only verify a
      // stored hash belonging to a document they are authorized to view.
      documentRecord = await documentService.getDocumentByHashForUser(targetHash, req.user.id, req.user.role);
      if (!documentRecord) {
        throw new AppError('Document not found in an authorized case.', HTTP_STATUS.NOT_FOUND);
      }
    }

    if (!targetHash) {
      throw new AppError('No document hash available to verify.', HTTP_STATUS.BAD_REQUEST);
    }

    const config = getBlockchainConfig();

    try {
      const onChainResult = await blockchainService.verifyDocument(targetHash);
      let liveChainId = config.chainId ?? null;
      try {
        const network = await blockchainService.getNetwork();
        liveChainId = Number(network.chainId);
      } catch {
        // keep configured chain id
      }

      if (!onChainResult.exists) {
        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: {
            verified: false,
            status: 'NOT_ANCHORED',
            reason: 'No on-chain LegalVault anchor found for this document hash.',
            documentId: documentRecord?.id,
            storedHash,
            currentHash,
            documentHash: targetHash,
            network: liveChainId != null
              ? buildNetworkPayload(liveChainId, config.contractAddress)
              : null,
          },
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          verified: true,
          status: 'VERIFIED',
          documentId: documentRecord?.id,
          documentHash: targetHash,
          storedHash,
          currentHash,
          onChain: onChainResult,
          network: liveChainId != null
            ? buildNetworkPayload(liveChainId, config.contractAddress)
            : null,
        },
      });
    } catch (err: any) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          verified: false,
          status: 'VERIFICATION_UNAVAILABLE',
          reason: `Smart contract verification failed: ${err.message}`,
          documentId: documentRecord?.id,
          storedHash,
          currentHash,
          documentHash: targetHash,
        },
      });
    }
  },
);

export const getTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
    const transactions = await prisma.blockchainTransaction.findMany({
      where: req.user.role === 'ADMIN' ? undefined : {
        case: { participants: { some: { userId: req.user.id } } },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        document: true,
        case: true,
      },
    });

    const enriched = transactions.map((tx) => ({
      ...tx,
      networkName: getNetworkName(tx.chainId),
      explorerTxUrl: getExplorerTxUrl(tx.chainId, tx.transactionHash),
      explorerAddressUrl: getExplorerAddressUrl(tx.chainId, tx.contractAddress),
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: enriched,
    });
  },
);

export const getDocumentBlockchainHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const { documentId } = req.params;

    if (!req.user) throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);

    const document = await documentService.getDocumentByIdForUser(documentId, req.user.id, req.user.role);

    if (!document) {
      throw new AppError('Document not found.', HTTP_STATUS.NOT_FOUND);
    }

    const transactions = await prisma.blockchainTransaction.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      include: {
        case: true,
      },
    });

    let onChainVerification = null;
    if (document.sha256Hash) {
      try {
        onChainVerification = await blockchainService.verifyDocument(document.sha256Hash);
      } catch {
        onChainVerification = null;
      }
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        documentId,
        sha256Hash: document.sha256Hash,
        transactions: transactions.map((tx) => ({
          ...tx,
          networkName: getNetworkName(tx.chainId),
          explorerTxUrl: getExplorerTxUrl(tx.chainId, tx.transactionHash),
          explorerAddressUrl: getExplorerAddressUrl(tx.chainId, tx.contractAddress),
        })),
        onChainVerification,
      },
    });
  },
);

export const getCaseBlockchainHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const { caseId } = req.params;

    if (!req.user) throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);

    const caseRecord = await caseService.getCaseByIdForUser(caseId, req.user.id, req.user.role);

    if (!caseRecord) {
      throw new AppError('Case not found.', HTTP_STATUS.NOT_FOUND);
    }

    const transactions = await prisma.blockchainTransaction.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      include: {
        document: true,
      },
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        caseId,
        caseNumber: caseRecord.caseNumber,
        title: caseRecord.title,
        transactions: transactions.map((tx) => ({
          ...tx,
          networkName: getNetworkName(tx.chainId),
          explorerTxUrl: getExplorerTxUrl(tx.chainId, tx.transactionHash),
          explorerAddressUrl: getExplorerAddressUrl(tx.chainId, tx.contractAddress),
        })),
      },
    });
  },
);

export const getTransactionByHash = asyncHandler(
  async (req: Request, res: Response) => {
    const { transactionHash } = req.params;

    if (!req.user) throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);

    const tx = await prisma.blockchainTransaction.findUnique({
      where: { transactionHash },
      include: {
        document: true,
        case: true,
      },
    });

    if (!tx) {
      throw new AppError('Blockchain transaction not found.', HTTP_STATUS.NOT_FOUND);
    }

    if (!(await caseService.canAccessCase(tx.caseId, req.user.id, req.user.role))) {
      throw new AppError('Blockchain transaction not found.', HTTP_STATUS.NOT_FOUND);
    }

    let onChainVerification = null;
    try {
      onChainVerification = await blockchainService.verifyDocument(tx.documentHash);
    } catch {
      onChainVerification = null;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        transaction: {
          ...tx,
          networkName: getNetworkName(tx.chainId),
          explorerTxUrl: getExplorerTxUrl(tx.chainId, tx.transactionHash),
          explorerAddressUrl: getExplorerAddressUrl(tx.chainId, tx.contractAddress),
        },
        onChainVerification,
      },
    });
  },
);

export const addAuthorizedAnchor = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
    if (req.user.role !== 'ADMIN') {
      throw new AppError('Only administrators can manage authorized anchors.', HTTP_STATUS.FORBIDDEN);
    }

    const parseResult = authorizedAnchorSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const { address } = parseResult.data;
    const result = await blockchainService.addAuthorizedAnchor(address);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        address,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        message: `Address ${address} has been added as an authorized anchor`,
      },
    });
  },
);

export const removeAuthorizedAnchor = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
    if (req.user.role !== 'ADMIN') {
      throw new AppError('Only administrators can manage authorized anchors.', HTTP_STATUS.FORBIDDEN);
    }

    const parseResult = authorizedAnchorSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const { address } = parseResult.data;
    const result = await blockchainService.removeAuthorizedAnchor(address);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        address,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        message: `Address ${address} has been removed as an authorized anchor`,
      },
    });
  },
);

export const checkAuthorizedAnchor = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);

    const { address } = req.params;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new AppError('Valid Ethereum address is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const isAuthorized = await blockchainService.isAuthorizedAnchor(address);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        address,
        isAuthorized,
      },
    });
  },
);
