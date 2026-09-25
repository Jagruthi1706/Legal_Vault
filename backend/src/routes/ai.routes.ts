import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware';
import { aiRateLimiter } from '../middleware/rateLimiter.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { aiService } from '../services/ai/ai.service';
import { aiChatSchema, aiOperationSchema, aiSummarizeSchema } from '../validators/ai.validator';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants/app.constants';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

const aiRouter = Router({ mergeParams: true });
aiRouter.use(aiRateLimiter);

aiRouter.get(
  '/status',
  requireAuth,
    requireRole('CITIZEN', 'LAWYER', 'JUDGE'),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ caseId: req.params.caseId, ...aiService.describeProvider() });
  }),
);

aiRouter.post(
  '/chat',
  requireAuth,
  requireRole('CITIZEN', 'LAWYER', 'JUDGE'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = aiChatSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const data = await aiService.chat(
      req.params.caseId,
      req.user!.id,
      req.user!.role,
      parsed.data.query,
      parsed.data.operation,
    );
    res.json({ ...data, caseId: req.params.caseId });
  }),
);

/**
 * Chat with case documents, including user-provided attachments.
 * Attachments are treated as case evidence and added to the retrieval context.
 * Supports up to 5 files per request, same MIME types as regular document upload.
 */
aiRouter.post(
  '/chat-with-attachments',
  requireAuth,
  // Clients (CITIZEN) legitimately need the no-case assistant: the client
  // Copilot has no case scope by default, so restricting this endpoint to
  // LAWYER/JUDGE made every general legal question from a client account fail
  // with 403. Case-scoped retrieval is still unavailable on this path — it only
  // ever sees user-supplied attachments and the trusted legal knowledge base.
  requireRole('CITIZEN', 'LAWYER', 'JUDGE'),
  upload.array('attachments', 5),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
    }

    const query = req.body?.query?.trim();
    if (!query) {
      throw new AppError('Query is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const operation = req.body?.operation || 'answer';

    // Convert multer files to attachment format
    const attachments = (req.files as Express.Multer.File[] | undefined)?.map((file) => ({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    })) || [];

    const data = await aiService.chatWithAttachments(
      req.params.caseId,
      req.user.id,
      req.user.role,
      query,
      attachments,
      operation as any,
    );
    res.json({ ...data, caseId: req.params.caseId });
  }),
);


aiRouter.post(
  '/summarize',
  requireAuth,
  requireRole('CITIZEN', 'LAWYER', 'JUDGE'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = aiSummarizeSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw parsed.error;
    const data = await aiService.summarize(req.params.caseId, req.user!.id, req.user!.role);
    res.json({ ...data, caseId: req.params.caseId });
  }),
);

aiRouter.post(
  '/analyze-evidence',
  requireAuth,
  // CITIZEN is included because the client Copilot answers general legal
  // questions with no case selected and routes them here. `chatNoCase` never
  // retrieves case documents (no caseId is accepted), so case isolation is
  // preserved: this path uses only the caller's own attachments and the
  // trusted legal knowledge base.
  requireRole('CITIZEN', 'LAWYER', 'JUDGE'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = aiChatSchema.safeParse({
      query: req.body?.query || 'Explain the evidence in this case.',
      operation: 'analyze_evidence',
    });
    if (!parsed.success) throw parsed.error;
    const data = await aiService.analyzeEvidence(
      req.params.caseId,
      req.user!.id,
      req.user!.role,
      parsed.data.query,
    );
    res.json({ ...data, caseId: req.params.caseId });
  }),
);

aiRouter.post(
  '/research',
  requireAuth,
  requireRole('LAWYER', 'JUDGE'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = aiChatSchema.safeParse({
      query: req.body?.query || 'Find Supreme Court or High Court authorities relevant to this case.',
      operation: 'research',
    });
    if (!parsed.success) throw parsed.error;
    const data = await aiService.research(
      req.params.caseId,
      req.user!.id,
      req.user!.role,
      parsed.data.query,
    );
        res.json({ ...data, caseId: req.params.caseId });
  }),
);

/**
 *
 * CLIENT/CITIZEN is allowed here because a client's Copilot has no case
 * workspace context for general legal questions. `aiService.chatNoCase` only
 * reads the caller's own attachments plus the trusted legal knowledge base, so
 * no case document can be reached through this path (case isolation is
 * unaffected).
 * No-case AI endpoint: answers questions using only uploaded attachments
 * and optionally retrieved legal authorities. Does NOT require a case context
 * and does NOT access any case documents.
 *
 * CITIZEN is authorized here: the client Copilot page is reachable by clients
 * (see AppRoutes `copilot`), and a general legal question asked without a
 * selected case is routed to this endpoint. `aiService.chatNoCase` never
 * receives a caseId, so no case data can be retrieved on this path. Case-scoped
 * operations remain restricted to authorized case participants elsewhere, and
 * `summarize` / `analyze_evidence` are explicitly unavailable here.
 */
const aiNoCaseRouter = Router();
aiNoCaseRouter.use(aiRateLimiter);

aiNoCaseRouter.post(
  '/chat-with-attachments',
  requireAuth,
  requireRole('CITIZEN', 'LAWYER', 'JUDGE'),
  upload.array('attachments', 5),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
    }

    const query = req.body?.query?.trim();
    if (!query) {
      throw new AppError('Query is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const attachments = (req.files as Express.Multer.File[] | undefined)?.map((file) => ({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    })) || [];

    const parsedOperation = aiOperationSchema.safeParse(req.body?.operation);
    const operation = parsedOperation.success ? parsedOperation.data : 'answer';

    const data = await aiService.chatNoCase(
      query,
      attachments,
      operation,
    );
    res.json({ ...data, caseId: null });
  }),
);

export { aiRouter, aiNoCaseRouter };
