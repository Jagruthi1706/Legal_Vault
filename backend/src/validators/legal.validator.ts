import { z } from 'zod';

export const legalIngestSchema = z.object({
  title: z.string().trim().min(1).max(300),
  source: z.string().trim().min(1).max(200),
  sourceUrl: z.string().url(),
  license: z.string().trim().min(1).max(200),
  documentType: z.enum(['judgment', 'statute', 'other']),
  jurisdiction: z.string().trim().min(1).max(120),
  court: z.string().trim().max(200).optional(),
  caseName: z.string().trim().max(300).optional(),
  caseNumber: z.string().trim().max(200).optional(),
  judgmentDate: z.string().trim().max(40).optional(),
  citation: z.string().trim().max(200).optional(),
  attribution: z.string().trim().max(500).optional(),
});

export const legalSearchSchema = z.object({
  query: z.string().trim().min(1).max(4000),
  court: z.string().trim().max(200).optional(),
  documentType: z.enum(['judgment', 'statute', 'other']).optional(),
  jurisdiction: z.string().trim().max(120).optional(),
  dateFrom: z.string().trim().max(40).optional(),
  sort: z.enum(['relevance', 'date']).optional(),
});
