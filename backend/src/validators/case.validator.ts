import { z } from 'zod';
import { CaseType, CaseStatus } from '@prisma/client';

export const createCaseSchema = z.object({
  caseNumber: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  caseType: z.nativeEnum(CaseType).optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  /**
   * Optional party (client) to attach to the newly registered case.
   *
   * A case is only visible to a client when a CaseParticipant row links them to
   * it, so without this the case could never appear in the client portal.
   * Only an existing CITIZEN account may be attached, and it is always attached
   * with a party participant role — never a judicial or administrative one.
   */
  clientEmail: z.string().email().max(320).optional(),
});

/**
 * Participant roles that a case owner may grant through the participant
 * endpoint. JUDGE is deliberately absent: judicial assignment is an
 * ADMIN-only action (`PATCH /cases/:id/assigned-judge`) and must never be
 * self-service, so it cannot be reached through participant management.
 */
export const grantableParticipantRoles = ['PETITIONER', 'RESPONDENT', 'LAWYER', 'CLERK', 'OTHER'] as const;

export const addParticipantSchema = z.object({
  email: z.string().email().max(320),
  participantRole: z.enum(grantableParticipantRoles).optional(),
});
