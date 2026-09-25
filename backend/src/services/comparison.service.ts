import { AuditAction, AuditEntityType, ComparisonResult, Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants/app.constants';
import { prisma } from '../utils/prisma';
import { blockchainService } from './blockchain.service';
import { documentService } from './document.service';
import { performTamperCheck } from './tamperCheck.service';
import { judicialService } from './judicial.service';
import { auditService } from './audit.service';

export class ComparisonService {
  async compare(input: { originalDocumentId: string; actorId: string; candidateBytes: Buffer; candidateFileName: string; candidateMimeType: string; candidateFileSize: number }) {
    const original = await prisma.document.findUnique({ where: { id: input.originalDocumentId } });
    if (!original) throw new AppError('Original document not found.', HTTP_STATUS.NOT_FOUND);
    await judicialService.assertAssignedJudge(original.caseId, input.actorId);
    const result = await performTamperCheck({
      userId: input.actorId, originalDocumentId: original.id, candidateBytes: input.candidateBytes,
      candidateFileName: input.candidateFileName, candidateMimeType: input.candidateMimeType, candidateFileSize: input.candidateFileSize,
    }, {
      getOriginalDocument: (documentId, userId) => documentService.getDocumentByIdForUser(documentId, userId, 'JUDGE'),
      getAnchorTransaction: (documentId) => prisma.blockchainTransaction.findFirst({ where: { documentId }, orderBy: { createdAt: 'desc' } }),
      getAnchoredHashFromTransaction: (transactionHash) => blockchainService.getAnchoredHashFromTransaction(transactionHash),
      verifyOriginalHashOnChain: (hash) => blockchainService.verifyDocument(hash),
    });
    const transaction = await prisma.blockchainTransaction.findFirst({ where: { documentId: original.id }, orderBy: { createdAt: 'desc' } });
    const comparison = await prisma.documentComparison.create({ data: {
      caseId: original.caseId, originalDocumentId: original.id, actorId: input.actorId, blockchainTransactionId: transaction?.id,
      originalHash: result.originalHash, candidateHash: result.candidateHash,
      result: result.status === 'UNMODIFIED' ? ComparisonResult.UNMODIFIED : ComparisonResult.TAMPERED,
      candidateFileName: result.candidateFileName, candidateMimeType: result.candidateMimeType, candidateFileSize: result.candidateFileSize,
      details: { originalAnchored: result.originalAnchored, transactionHash: result.transactionHash } as Prisma.InputJsonValue,
    } });
    await auditService.record({ caseId: original.caseId, actorId: input.actorId, documentId: original.id, comparisonId: comparison.id, action: AuditAction.TAMPER_CHECK_PERFORMED, entityType: AuditEntityType.DOCUMENT_COMPARISON, metadata: { result: comparison.result, candidateHash: comparison.candidateHash } });
    return { result, comparison };
  }
}

export const comparisonService = new ComparisonService();
