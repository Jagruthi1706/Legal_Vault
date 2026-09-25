import { z } from 'zod';

export const aiOperationSchema = z.enum([
  'answer',
  'summarize',
  'analyze_evidence',
  'research',
  'compare_authorities',
]);

export const aiChatSchema = z.object({
  query: z.string().trim().min(1).max(4000),
  operation: aiOperationSchema.optional(),
});

export const aiSummarizeSchema = z.object({});
