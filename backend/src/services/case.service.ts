import { CaseStatus, CaseType, ParticipantRole, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { normalizeDocument } from '../utils/documentNormalize';

const userNameSelect = { select: { id: true, name: true, email: true } } as const;

/**
 * Case visibility predicate.
 *
 * A user may access a case when either:
 *  - they hold a CaseParticipant record for the case, or
 *  - the case is officially assigned to them (`Case.assignedJudgeId`).
 *
 * `assignedJudgeId` is written only by the ADMIN-only assignment route, which
 * also validates that the target user's role is JUDGE, so it is an
 * authorization-grade field and not user-controlled. Treating an assigned
 * judge as a non-participant was the root cause of assigned judges receiving
 * 404s on their own cases, case documents and blockchain verification.
 */
const visibleToUser = (userId: string) => ({
  OR: [
    { participants: { some: { userId } } },
    { assignedJudgeId: userId },
  ],
});

const caseDetailInclude = {
  createdBy: userNameSelect,
  assignedJudge: userNameSelect,
  participants: {
    include: { user: userNameSelect },
  },
  documents: {
    include: {
      uploadedBy: userNameSelect,
      blockchainTransactions: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
  },
  evidence: {
    include: {
      submittedBy: userNameSelect,
      document: {
        select: {
          id: true,
          originalFileName: true,
          sha256Hash: true,
        },
      },
    },
  },
} satisfies Prisma.CaseInclude;

const withNormalizedDocuments = <T extends { documents?: Parameters<typeof normalizeDocument>[0][] }>(record: T) => ({
  ...record,
  documents: (record.documents || []).map((document) => normalizeDocument(document)),
});

export class CaseService {
  async getCases() {
    return prisma.case.findMany({
      include: caseDetailInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCaseById(id: string) {
    return prisma.case.findUnique({
      where: { id },
      include: caseDetailInclude,
    });
  }

  async getCasesForUser(userId: string, role?: string) {
    const cases = await prisma.case.findMany({
      where: role === 'ADMIN' ? undefined : visibleToUser(userId),
      include: caseDetailInclude,
      orderBy: { createdAt: 'desc' },
    });
    return cases.map((item) => withNormalizedDocuments(item));
  }

  async getCaseByIdForUser(caseId: string, userId: string, role?: string) {
    const record = await prisma.case.findFirst({
      where: role === 'ADMIN' ? { id: caseId } : {
        id: caseId,
        ...visibleToUser(userId),
      },
      include: caseDetailInclude,
    });
    return record ? withNormalizedDocuments(record) : null;
  }

  async ensureUserIsParticipant(caseId: string, userId: string) {
    return prisma.caseParticipant.findFirst({
      where: { caseId, userId },
    });
  }

  async canAccessCase(caseId: string, userId: string, role: string) {
    if (role === 'ADMIN') {
      return Boolean(await prisma.case.findUnique({ where: { id: caseId }, select: { id: true } }));
    }
    // Judges assigned to the case are authorized readers even without a
    // duplicate CaseParticipant row.
    if (role === 'JUDGE') {
      const assigned = await prisma.case.findFirst({
        where: { id: caseId, ...visibleToUser(userId) },
        select: { id: true },
      });
      if (assigned) return true;
    }
    return Boolean(await this.ensureUserIsParticipant(caseId, userId));
  }

  async createCase(
    data: {
      caseNumber: string;
      title: string;
      description?: string;
      caseType?: CaseType;
      status?: CaseStatus;
    },
    creatorUserId: string,
    creatorParticipantRole: ParticipantRole = ParticipantRole.LAWYER,
  ) {
    return prisma.case.create({
      data: {
        caseNumber: data.caseNumber,
        title: data.title,
        description: data.description,
        caseType: data.caseType ?? CaseType.OTHER,
        status: data.status ?? CaseStatus.DRAFT,
        createdById: creatorUserId,
        participants: {
          create: {
            userId: creatorUserId,
            participantRole: creatorParticipantRole,
          },
        },
      },
      include: caseDetailInclude,
    });
  }
}

export const caseService = new CaseService();
