import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { auditService, caseService, judicialService } from '../services';
import { addParticipantSchema, createCaseSchema } from '../validators/case.validator';
import { HTTP_STATUS } from '../constants/app.constants';
import { requireAuth, requireRole } from '../middleware';
import { AppError } from '../utils/AppError';
import { prisma } from '../utils/prisma';
import { AuditAction, AuditEntityType, ParticipantRole, Role } from '@prisma/client';
import { assignJudgeSchema, createVerificationSchema } from '../validators/judicial.validator';

const caseRouter = Router();

caseRouter.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  const cases = await caseService.getCasesForUser(req.user.id, req.user.role);
  res.status(HTTP_STATUS.OK).json({ success: true, data: cases });
}));

/**
 * Attach an existing account to a case as a participant.
 *
 * Without this endpoint a lawyer could not bring an existing client (or a
 * co-counsel lawyer) onto a case, because case/document visibility is driven
 * entirely by the CaseParticipant relation. The requested role is taken from
 * the validated, deliberately restricted `grantableParticipantRoles` list,
 * which excludes JUDGE: judicial assignment stays an ADMIN-only action.
 */
caseRouter.post('/:id/participants', requireAuth, requireRole('LAWYER', 'ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const parsed = addParticipantSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  if (!(await caseService.canAccessCase(req.params.id, req.user!.id, req.user!.role))) {
    throw new AppError('Case not found or not authorized.', HTTP_STATUS.NOT_FOUND);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const target = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!target) {
    throw new AppError('No account exists for that email address.', HTTP_STATUS.BAD_REQUEST);
  }
  if (target.role === Role.JUDGE || target.role === Role.ADMIN) {
    throw new AppError(
      'Judicial and administrative roles cannot be granted through participant management.',
      HTTP_STATUS.FORBIDDEN,
    );
  }

  const participantRole = parsed.data.participantRole ?? ParticipantRole.PETITIONER;
  const participant = await prisma.caseParticipant.upsert({
    where: { caseId_userId: { caseId: req.params.id, userId: target.id } },
    update: { participantRole },
    create: { caseId: req.params.id, userId: target.id, participantRole },
  });

  await auditService.record({ caseId: req.params.id, actorId: req.user!.id, action: AuditAction.PARTICIPANT_ADDED, entityType: AuditEntityType.CASE_PARTICIPANT, metadata: { participantRole, participantEmail: target.email } });

  res.status(HTTP_STATUS.CREATED).json({ success: true, data: { ...participant, user: { id: target.id, email: target.email, name: target.name } } });
}));

caseRouter.get('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  const caseRecord = await caseService.getCaseByIdForUser(req.params.id, req.user.id, req.user.role);

  if (!caseRecord) {
    throw new AppError('Case not found or not authorized.', HTTP_STATUS.NOT_FOUND);
  }

  res.status(HTTP_STATUS.OK).json({ success: true, data: caseRecord });
}));

caseRouter.post('/', requireAuth, requireRole('LAWYER', 'ADMIN', 'JUDGE'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  const parseResult = createCaseSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw parseResult.error;
  }

  const roleMap: Record<string, ParticipantRole> = {
    LAWYER: ParticipantRole.LAWYER,
    JUDGE: ParticipantRole.JUDGE,
    ADMIN: ParticipantRole.OTHER,
  };

  const validated = parseResult.data;

  // Resolve the optional party (client) account *before* creating the case so a
  // bad email cannot leave a half-registered case behind. Only an existing
  // CITIZEN account may be attached, and only as a party participant role.
  let clientAccount: { id: string; email: string; name: string } | null = null;
  if (validated.clientEmail) {
    const clientEmail = validated.clientEmail.trim().toLowerCase();
    const candidate = await prisma.user.findFirst({
      where: { email: clientEmail },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!candidate) {
      throw new AppError('No account exists for that client email address.', HTTP_STATUS.BAD_REQUEST);
    }
    if (candidate.role !== Role.CITIZEN) {
      throw new AppError('Only a client account can be attached as the case party.', HTTP_STATUS.BAD_REQUEST);
    }
    clientAccount = { id: candidate.id, email: candidate.email, name: candidate.name };
  }

  const newCase = await caseService.createCase(
    {
      caseNumber: validated.caseNumber,
      title: validated.title,
      description: validated.description,
      caseType: validated.caseType,
      status: validated.status,
    },
    req.user.id,
    roleMap[req.user.role] ?? ParticipantRole.LAWYER,
  );
  await auditService.recordCaseCreated(newCase.id, req.user.id);
  const creatorParticipant = newCase.participants.find((participant) => participant.userId === req.user!.id);
  if (creatorParticipant) {
    await auditService.record({ caseId: newCase.id, actorId: req.user.id, action: AuditAction.PARTICIPANT_ADDED, entityType: AuditEntityType.CASE_PARTICIPANT, metadata: { participantRole: creatorParticipant.participantRole } });
  }

  // A case is visible to a client only through a CaseParticipant row. Without
  // this the newly registered case could never reach the client portal.
  if (clientAccount && clientAccount.id !== req.user.id) {
    const partyParticipant = await prisma.caseParticipant.upsert({
      where: { caseId_userId: { caseId: newCase.id, userId: clientAccount.id } },
      update: { participantRole: ParticipantRole.PETITIONER },
      create: { caseId: newCase.id, userId: clientAccount.id, participantRole: ParticipantRole.PETITIONER },
    });
    await auditService.record({
      caseId: newCase.id,
      actorId: req.user.id,
      action: AuditAction.PARTICIPANT_ADDED,
      entityType: AuditEntityType.CASE_PARTICIPANT,
      metadata: { participantRole: partyParticipant.participantRole, participantEmail: clientAccount.email, via: 'case-registration' },
    });
  }

  res.status(HTTP_STATUS.CREATED).json({ success: true, data: newCase });
}));

caseRouter.patch('/:id/assigned-judge', requireAuth, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const parsed = assignJudgeSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const judge = await prisma.user.findUnique({ where: { id: parsed.data.judgeId } });
  if (!judge || judge.role !== Role.JUDGE) throw new AppError('Assigned user must be a judge.', HTTP_STATUS.BAD_REQUEST);

  const caseRecord = await prisma.case.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!caseRecord) throw new AppError('Case not found.', HTTP_STATUS.NOT_FOUND);

  // The JUDGE participation record and the authoritative assignment are written
  // together. Previously this endpoint *required* a pre-existing JUDGE
  // participant row, but no endpoint could create one, so judge assignment
  // always failed with 400 and judge workflows could never be enabled for a
  // case created through the UI.
  const [participant, updated] = await prisma.$transaction([
    prisma.caseParticipant.upsert({
      where: { caseId_userId: { caseId: caseRecord.id, userId: judge.id } },
      update: { participantRole: ParticipantRole.JUDGE },
      create: { caseId: caseRecord.id, userId: judge.id, participantRole: ParticipantRole.JUDGE },
    }),
    prisma.case.update({ where: { id: caseRecord.id }, data: { assignedJudgeId: judge.id } }),
  ]);

  await auditService.recordJudgeAssigned(updated.id, req.user!.id, judge.id);
  await auditService.record({ caseId: updated.id, actorId: req.user!.id, action: AuditAction.PARTICIPANT_ADDED, entityType: AuditEntityType.CASE_PARTICIPANT, metadata: { participantRole: participant.participantRole, via: 'assigned-judge' } });
  res.status(HTTP_STATUS.OK).json({ success: true, data: updated });
}));

caseRouter.post('/:caseId/documents/:documentId/verifications', requireAuth, requireRole('JUDGE'), asyncHandler(async (req: Request, res: Response) => {
  const parsed = createVerificationSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const verification = await judicialService.verify({ caseId: req.params.caseId, documentId: req.params.documentId, judgeId: req.user!.id, ...parsed.data });
  res.status(HTTP_STATUS.CREATED).json({ success: true, data: verification });
}));

caseRouter.get('/:caseId/audit', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!(await caseService.canAccessCase(req.params.caseId, req.user!.id, req.user!.role))) throw new AppError('Case not found or not authorized.', HTTP_STATUS.NOT_FOUND);
  const data = await prisma.auditLog.findMany({
    where: { caseId: req.params.caseId },
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
  res.status(HTTP_STATUS.OK).json({ success: true, data });
}));

caseRouter.get('/:caseId/verifications', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!(await caseService.canAccessCase(req.params.caseId, req.user!.id, req.user!.role))) throw new AppError('Case not found or not authorized.', HTTP_STATUS.NOT_FOUND);
  const data = await prisma.verificationRecord.findMany({ where: { caseId: req.params.caseId }, orderBy: { verifiedAt: 'desc' } });
  res.status(HTTP_STATUS.OK).json({ success: true, data });
}));

caseRouter.get('/:caseId/comparisons', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!(await caseService.canAccessCase(req.params.caseId, req.user!.id, req.user!.role))) throw new AppError('Case not found or not authorized.', HTTP_STATUS.NOT_FOUND);
  const data = await prisma.documentComparison.findMany({ where: { caseId: req.params.caseId }, orderBy: { comparedAt: 'desc' } });
  res.status(HTTP_STATUS.OK).json({ success: true, data });
}));

export { caseRouter };
