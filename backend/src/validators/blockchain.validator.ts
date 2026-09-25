import { z } from 'zod';

export const anchorDocumentSchema = z.object({
  documentId: z.string().uuid({ message: 'Valid documentId UUID is required' }),
  caseId: z.string().uuid({ message: 'Valid caseId UUID is required' }),
  documentHash: z
    .string()
    .regex(/^(0x)?[0-9a-fA-F]{64}$/, {
      message: 'documentHash must be a valid 64-character hex string',
    })
    .optional(),
  eventType: z.string().min(1).default('EVIDENCE_UPLOAD'),
});

export const verifyDocumentSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    documentHash: z
      .string()
      .regex(/^(0x)?[0-9a-fA-F]{64}$/, {
        message: 'documentHash must be a valid 64-character hex string',
      })
      .optional(),
  })
  .refine((data) => Boolean(data.documentId || data.documentHash), {
    message: 'Either documentId or documentHash must be provided for verification',
  });

export const authorizedAnchorSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

export type AnchorDocumentInput = z.infer<typeof anchorDocumentSchema>;
export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;
export type AuthorizedAnchorInput = z.infer<typeof authorizedAnchorSchema>;
