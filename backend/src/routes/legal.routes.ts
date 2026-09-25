import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS, LEGAL_INGEST_MIME_TYPES } from '../constants/app.constants';
import { legalIngestSchema, legalSearchSchema } from '../validators/legal.validator';
import { legalIngestService } from '../services/ai/legal/legal-ingest.service';
import { localLegalKnowledgeSource } from '../services/ai/legal/local-knowledge.source';
import { listProvenanceRegistries } from '../services/ai/legal/provenance.registry';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const legalRouter = Router();

legalRouter.get(
  '/provenance',
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: listProvenanceRegistries() });
  }),
);

legalRouter.post(
  '/search',
  requireAuth,
  // Judges perform legal research as part of judicial work; the search path is
  // read-only over the shared legal knowledge base and returns no case data.
  requireRole('LAWYER', 'JUDGE'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = legalSearchSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const hits = await localLegalKnowledgeSource.search(parsed.data.query, {
      court: parsed.data.court,
      documentType: parsed.data.documentType,
      jurisdiction: parsed.data.jurisdiction,
      dateFrom: parsed.data.dateFrom,
    });
    const mapped = hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      excerpt: hit.text.slice(0, 360),
      relevance: hit.relevance,
      provenance: hit.provenance,
      pageOrSection: hit.pageOrSection,
    }));
    if (parsed.data.sort === 'date') {
      mapped.sort((a, b) => String(b.provenance.judgmentDate || '').localeCompare(String(a.provenance.judgmentDate || '')));
    }
    res.json({ success: true, data: mapped });
  }),
);

legalRouter.post(
  '/ingest',
  requireAuth,
  requireRole('ADMIN'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('A PDF or text file is required.', HTTP_STATUS.BAD_REQUEST);
    if (!(LEGAL_INGEST_MIME_TYPES as readonly string[]).includes(req.file.mimetype) &&
      !req.file.originalname.toLowerCase().match(/\.(txt|md|pdf)$/)) {
      throw new AppError('Unsupported legal ingest type.', HTTP_STATUS.BAD_REQUEST);
    }
    const parsed = legalIngestSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const result = await legalIngestService.ingestFile({
      ...parsed.data,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      bytes: req.file.buffer,
    });
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: result });
  }),
);

legalRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const document = await localLegalKnowledgeSource.getDocument(req.params.id);
    if (!document) throw new AppError('Legal authority not found.', HTTP_STATUS.NOT_FOUND);
    res.json({ success: true, data: document });
  }),
);

export { legalRouter };
