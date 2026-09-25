import { EvidenceStatus, EvidenceType } from '@prisma/client';
import { prisma } from '../utils/prisma';

export class EvidenceService {
  async getEvidenceById(id: string) {
    return prisma.evidence.findUnique({
      where: { id },
      include: {
        case: true,
        document: true,
        submittedBy: true,
      },
    });
  }

  async getEvidenceForUser(caseId: string | undefined, userId: string, role?: string) {
    return prisma.evidence.findMany({
      where: {
        ...(caseId ? { caseId } : {}),
        ...(role === 'ADMIN' ? {} : { case: {
          participants: {
            some: { userId },
          },
        } }),
      },
      include: {
        case: true,
        document: true,
        submittedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEvidenceByIdForUser(evidenceId: string, userId: string, role?: string) {
    return prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        ...(role === 'ADMIN' ? {} : { case: {
          participants: {
            some: { userId },
          },
        } }),
      },
      include: {
        case: true,
        document: true,
        submittedBy: true,
      },
    });
  }

  async createEvidence(data: {
    caseId: string;
    submittedById: string;
    evidenceNumber: string;
    title: string;
    description?: string;
    evidenceType?: EvidenceType;
    documentId?: string;
    status?: EvidenceStatus;
  }) {
    return prisma.evidence.create({
      data: {
        caseId: data.caseId,
        submittedById: data.submittedById,
        evidenceNumber: data.evidenceNumber,
        title: data.title,
        description: data.description,
        evidenceType: data.evidenceType ?? EvidenceType.OTHER,
        documentId: data.documentId,
        status: data.status ?? EvidenceStatus.SUBMITTED,
      },
    });
  }
}

export const evidenceService = new EvidenceService();
