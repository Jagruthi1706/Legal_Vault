import { Router, Request, Response } from 'express';
import multer from 'multer';
import { CASE_UPLOAD_MIME_TYPES, HTTP_STATUS, sanitizeDownloadFilename } from '../constants/app.constants';
import { AppError } from '../utils';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../utils/prisma';
import { normalizeDocument } from '../utils/documentNormalize';
import {
  getExplorerTxUrl,
  getNetworkName,
} from '../config';
import {
  auditService,
  blockchainService,
  caseService,
  comparisonService,
  documentService,
  judicialService,
  performTamperCheck,
} from '../services';
import { createDocumentSchema } from '../validators/document.validator';
import { createVerificationSchema } from '../validators/judicial.validator';
import { requireAuth, requireRole } from '../middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

const documentRouter = Router();

const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  const caseId = req.query.caseId as string | undefined;
  const documents = await documentService.getDocumentsForUser(caseId, req.user.id, req.user.role);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: documents.map(normalizeDocument),
  });
});

const getDocumentById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  const { id } = req.params;
  const document = await documentService.getDocumentByIdForUser(id, req.user.id, req.user.role);

  if (!document) {
    throw new AppError('Document not found.', HTTP_STATUS.NOT_FOUND);
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: normalizeDocument(document),
  });
});

const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  const { id } = req.params;
  const document = await documentService.getDocumentByIdForUser(id, req.user.id, req.user.role);

  if (!document) {
    throw new AppError('Document not found.', HTTP_STATUS.NOT_FOUND);
  }

  const content = await documentService.getDocumentContent(id);
  if (!content) {
    throw new AppError('Stored file could not be retrieved.', HTTP_STATUS.NOT_FOUND);
  }

  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeDownloadFilename(document.originalFileName)}"`);
  res.send(content);
});

const createDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!req.file) {
    throw new AppError('No file uploaded.', HTTP_STATUS.BAD_REQUEST);
  }

  if (!['CITIZEN', 'LAWYER'].includes(req.user.role)) {
    throw new AppError('Your role cannot upload case documents.', HTTP_STATUS.FORBIDDEN);
  }

  if (!(CASE_UPLOAD_MIME_TYPES as readonly string[]).includes(req.file.mimetype)) {
    throw new AppError('Unsupported file type for case evidence upload.', HTTP_STATUS.BAD_REQUEST);
  }

  const result = createDocumentSchema.safeParse(req.body);
  if (!result.success) {
    throw result.error;
  }

  const { caseId, documentType, description } = result.data;

  const membership = await caseService.ensureUserIsParticipant(caseId, req.user.id);
  if (!membership) {
    throw new AppError(
      'Case not found or you are not a participant on this case.',
      HTTP_STATUS.FORBIDDEN,
    );
  }

  const document = await documentService.createDocument({
    caseId,
    uploadedById: req.user.id,
    originalFileName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    documentType,
    description,
    fileContents: req.file.buffer,
  });
  await auditService.recordDocumentUploaded(document.caseId, req.user.id, document.id);

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    data: normalizeDocument(document),
  });
});

/**
 * Read-only tamper comparison.
 * Does NOT persist candidate, create BlockchainTransaction, or send ETH txs.
 */
const tamperCheck = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!req.file) {
    throw new AppError('Candidate file is required.', HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const originalDocument = await documentService.getDocumentByIdForUser(
      req.params.id,
      req.user.id,
      req.user.role,
    );
    if (!originalDocument) {
      throw new AppError('Document not found.', HTTP_STATUS.NOT_FOUND);
    }
    await judicialService.assertAssignedJudge(originalDocument.caseId, req.user.id);

    const result = await performTamperCheck(
      {
        userId: req.user.id,
        originalDocumentId: req.params.id,
        candidateBytes: req.file.buffer,
        candidateFileName: req.file.originalname,
        candidateMimeType: req.file.mimetype,
        candidateFileSize: req.file.size,
      },
      {
        getOriginalDocument: async (documentId, userId) =>
          documentService.getDocumentByIdForUser(documentId, userId, req.user!.role),
        getAnchorTransaction: async (documentId) =>
          prisma.blockchainTransaction.findFirst({
            where: { documentId },
            orderBy: { createdAt: 'desc' },
          }),
        getAnchoredHashFromTransaction: (transactionHash) =>
          blockchainService.getAnchoredHashFromTransaction(transactionHash),
        verifyOriginalHashOnChain: (originalHash) =>
          blockchainService.verifyDocument(originalHash),
        // Intentionally unused write-side hooks — kept for explicit non-invocation.
        anchorDocument: async () => {
          throw new Error('Tamper check must not anchor documents.');
        },
        createBlockchainTransaction: async () => {
          throw new Error('Tamper check must not create blockchain transactions.');
        },
        createDocument: async () => {
          throw new Error('Tamper check must not persist candidate documents.');
        },
      },
    );

    // Persist only facts after the existing read-only comparison has succeeded.
    // The candidate buffer is still never sent to storage or a document model.
    const { comparison } = await comparisonService.compare({
      actorId: req.user.id,
      originalDocumentId: req.params.id,
      candidateBytes: req.file.buffer,
      candidateFileName: req.file.originalname,
      candidateMimeType: req.file.mimetype,
      candidateFileSize: req.file.size,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...result,
        comparisonId: comparison.id,
        network: getNetworkName(result.chainId),
        explorerTxUrl: getExplorerTxUrl(result.chainId, result.transactionHash),
      },
    });
  } catch (error: any) {
    if (error?.statusCode) {
      throw new AppError(error.message, error.statusCode);
    }
    throw error;
  }
});

documentRouter.get('/', requireAuth, listDocuments);
documentRouter.post('/:id/tamper-check', requireAuth, requireRole('JUDGE'), upload.single('file'), tamperCheck);
documentRouter.post('/:documentId/judicial-verifications', requireAuth, requireRole('JUDGE'), asyncHandler(async (req: Request, res: Response) => {
  const parsed = createVerificationSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const document = await documentService.getDocumentByIdForUser(req.params.documentId, req.user!.id, req.user!.role);
  if (!document) throw new AppError('Document not found.', HTTP_STATUS.NOT_FOUND);
  const record = await judicialService.verify({ caseId: document.caseId, documentId: document.id, judgeId: req.user!.id, ...parsed.data });
  res.status(HTTP_STATUS.CREATED).json({ success: true, data: record });
}));
documentRouter.get('/:documentId/comparisons', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const document = await documentService.getDocumentByIdForUser(req.params.documentId, req.user!.id, req.user!.role);
  if (!document) throw new AppError('Document not found.', HTTP_STATUS.NOT_FOUND);
  const data = await prisma.documentComparison.findMany({ where: { originalDocumentId: document.id }, orderBy: { comparedAt: 'desc' } });
  res.status(HTTP_STATUS.OK).json({ success: true, data });
}));
documentRouter.get('/:id', requireAuth, getDocumentById);
documentRouter.get('/:id/download', requireAuth, downloadDocument);
documentRouter.post('/', requireAuth, upload.single('file'), createDocument);

export { documentRouter };
