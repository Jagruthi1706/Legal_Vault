import { DocumentType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { sha256 } from '../utils/hash';
import { storageService } from './storage.service';

/**
 * Document visibility predicate.
 *
 * Mirrors `case.service.ts` case visibility: a user may read a document when
 * they are a CaseParticipant of its case, or when its case is officially
 * assigned to them as judge (`Case.assignedJudgeId`).
 *
 * Without the assignment clause, POST /blockchain/verify failed with
 * "Document not found in an authorized case." for every assigned judge whose
 * assignment did not also have a CaseParticipant row.
 */
const documentVisibleToUser = (userId: string) => ({
  case: {
    OR: [
      { participants: { some: { userId } } },
      { assignedJudgeId: userId },
    ],
  },
});

export class DocumentService {
  async getDocumentById(id: string) {
    return prisma.document.findUnique({
      where: { id },
      include: {
        case: true,
        uploadedBy: true,
        evidence: true,
        blockchainTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getDocuments(caseId?: string) {
    return prisma.document.findMany({
      where: caseId ? { caseId } : undefined,
      include: {
        case: true,
        uploadedBy: true,
        blockchainTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentsForUser(caseId: string | undefined, userId: string, role?: string) {
    return prisma.document.findMany({
      where: {
        ...(caseId ? { caseId } : {}),
        ...(role === 'ADMIN' ? {} : documentVisibleToUser(userId)),
      },
      include: {
        case: true,
        uploadedBy: true,
        blockchainTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentByIdForUser(documentId: string, userId: string, role?: string) {
    return prisma.document.findFirst({
      where: {
        id: documentId,
        ...(role === 'ADMIN' ? {} : documentVisibleToUser(userId)),
      },
      include: {
        case: true,
        uploadedBy: true,
        blockchainTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getDocumentByHashForUser(documentHash: string, userId: string, role?: string) {
    return prisma.document.findFirst({
      where: {
        sha256Hash: documentHash.replace(/^0x/i, '').toLowerCase(),
        ...(role === 'ADMIN' ? {} : documentVisibleToUser(userId)),
      },
      include: { case: true, uploadedBy: true, evidence: true, blockchainTransactions: true },
    });
  }

  async createDocument(data: {
    caseId: string;
    uploadedById: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    documentType?: DocumentType;
    description?: string;
    version?: number;
    fileContents: Buffer;
  }) {
    const sha256Hash = sha256(data.fileContents);
    const storageKey = await storageService.save(data.fileContents, {
      originalFileName: data.originalFileName,
      contentType: data.mimeType,
    });

    try {
      return await prisma.document.create({
        data: {
          caseId: data.caseId,
          uploadedById: data.uploadedById,
          originalFileName: data.originalFileName,
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          storageKey,
          documentType: data.documentType,
          description: data.description,
          version: data.version ?? 1,
          sha256Hash,
        },
      });
    } catch (error) {
      await storageService.delete(storageKey);
      throw error;
    }
  }

  async getDocumentContent(documentId: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { storageKey: true },
    });

    if (!document) {
      return null;
    }

    try {
      return await storageService.read(document.storageKey);
    } catch {
      return null;
    }
  }
}

export const documentService = new DocumentService();
