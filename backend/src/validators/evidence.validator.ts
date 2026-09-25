import { z } from 'zod';
import { EvidenceType, EvidenceStatus } from '@prisma/client';

export const createEvidenceSchema = z.object({
  caseId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  evidenceNumber: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  evidenceType: z.nativeEnum(EvidenceType).optional(),
  status: z.nativeEnum(EvidenceStatus).optional(),
});
