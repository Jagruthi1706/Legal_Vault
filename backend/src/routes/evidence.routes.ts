import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { auditService, caseService, documentService, evidenceService } from '../services';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants/app.constants';
import { requireAuth } from '../middleware';
import { createEvidenceSchema } from '../validators/evidence.validator';

const evidenceRouter = Router();

evidenceRouter.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  const caseId = req.query.caseId as string | undefined;
  const evidence = await evidenceService.getEvidenceForUser(caseId, req.user.id, req.user.role);
  res.status(HTTP_STATUS.OK).json({ success: true, data: evidence });
}));

evidenceRouter.get('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  const evidence = await evidenceService.getEvidenceByIdForUser(req.params.id, req.user.id, req.user.role);
  if (!evidence) {
    throw new AppError('Evidence not found or not authorized.', HTTP_STATUS.NOT_FOUND);
  }

  res.status(HTTP_STATUS.OK).json({ success: true, data: evidence });
}));

evidenceRouter.post('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  const parseResult = createEvidenceSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw parseResult.error;
  }

  if (!['CITIZEN', 'LAWYER'].includes(req.user.role)) {
    throw new AppError('Your role cannot submit evidence.', HTTP_STATUS.FORBIDDEN);
  }

  const { caseId, documentId } = parseResult.data;
  if (!(await caseService.ensureUserIsParticipant(caseId, req.user.id))) {
    throw new AppError('Case not found or you are not a participant on this case.', HTTP_STATUS.FORBIDDEN);
  }
  if (documentId) {
    const document = await documentService.getDocumentByIdForUser(documentId, req.user.id, req.user.role);
    if (!document || document.caseId !== caseId) {
      throw new AppError('Document not found in this case.', HTTP_STATUS.FORBIDDEN);
    }
  }

  const evidence = await evidenceService.createEvidence({
    caseId: parseResult.data.caseId,
    evidenceNumber: parseResult.data.evidenceNumber,
    title: parseResult.data.title,
    description: parseResult.data.description,
    evidenceType: parseResult.data.evidenceType,
    documentId: parseResult.data.documentId,
    status: parseResult.data.status,
    submittedById: req.user.id,
  });
  await auditService.recordEvidenceSubmitted(evidence.caseId, req.user.id, evidence.id, evidence.documentId ?? undefined);

  res.status(HTTP_STATUS.CREATED).json({ success: true, data: evidence });
}));

export { evidenceRouter };
