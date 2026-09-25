import { JudicialDecision } from '@prisma/client';
import { z } from 'zod';

export const createVerificationSchema = z.object({
  evidenceId: z.string().uuid().optional(),
  judicialDecision: z.nativeEnum(JudicialDecision).optional(),
  decisionReason: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (value.judicialDecision === JudicialDecision.REJECTED && !value.decisionReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['decisionReason'], message: 'A rejection reason is required.' });
  }
});

export const assignJudgeSchema = z.object({ judgeId: z.string().uuid() });
