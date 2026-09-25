import { z } from 'zod';
import { DocumentType } from '@prisma/client';

export const createDocumentSchema = z.object({
  caseId: z.string().uuid(),
  documentType: z.nativeEnum(DocumentType).optional(),
  description: z.string().max(1000).optional(),
});
