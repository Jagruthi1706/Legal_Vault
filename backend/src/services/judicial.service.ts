import { AuditAction, AuditEntityType, IntegrityStatus, JudicialDecision, Prisma, Role } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants/app.constants';
import { prisma } from '../utils/prisma';
import { sha256 } from '../utils/hash';
import { documentService } from './document.service';
import { blockchainService } from './blockchain.service';
import { auditService } from './audit.service';

export class JudicialService {
  async assertAssignedJudge(caseId: string, judgeId: string) {
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: { assignedJudge: true },
    });
    if (!caseRecord) throw new AppError('Case not found.', HTTP_STATUS.NOT_FOUND);
    // `assignedJudgeId` is the authoritative assignment field: it is written
    // only by the ADMIN-only assignment route, which validates the target
    // role. Requiring a duplicate JUDGE CaseParticipant row here rejected
    // legitimate assignments that had been made through the admin workspace.
    if (caseRecord.assignedJudgeId !== judgeId || caseRecord.assignedJudge?.role !== Role.JUDGE) {
      throw new AppError('Only the assigned judge may perform this official judicial action.', HTTP_STATUS.FORBIDDEN);
    }
    return caseRecord;
  }

  async verify(input: { caseId: string; documentId: string; evidenceId?: string; judgeId: string; judicialDecision?: JudicialDecision; decisionReason?: string }) {
    if (input.judicialDecision === JudicialDecision.REJECTED && !input.decisionReason?.trim()) {
      throw new AppError('A rejection reason is required.', HTTP_STATUS.BAD_REQUEST);
    }
    await this.assertAssignedJudge(input.caseId, input.judgeId);
    const document = await prisma.document.findUnique({ where: { id: input.documentId } });
    if (!document || document.caseId !== input.caseId) throw new AppError('Document not found in this case.', HTTP_STATUS.NOT_FOUND);
    if (input.evidenceId) {
      const evidence = await prisma.evidence.findUnique({ where: { id: input.evidenceId } });
      if (!evidence || evidence.caseId !== input.caseId || evidence.documentId !== input.documentId) {
        throw new AppError('Evidence does not belong to this document and case.', HTTP_STATUS.BAD_REQUEST);
      }
    }

    await auditService.record({ caseId: input.caseId, actorId: input.judgeId, documentId: input.documentId, evidenceId: input.evidenceId, action: AuditAction.DOCUMENT_VERIFICATION_STARTED, entityType: AuditEntityType.DOCUMENT });
    const anchor = await prisma.blockchainTransaction.findFirst({ where: { documentId: document.id }, orderBy: { createdAt: 'desc' } });
    let integrityStatus: IntegrityStatus = IntegrityStatus.VERIFICATION_UNAVAILABLE;
    let currentHash: string | undefined;
    let blockchainAnchoredHash: string | undefined;
    let details: Prisma.InputJsonValue | undefined;
    if (!anchor) {
      integrityStatus = IntegrityStatus.NOT_ANCHORED;
      details = { reason: 'Document has no recorded blockchain anchor.' };
    } else {
      const bytes = await documentService.getDocumentContent(document.id);
      if (!bytes) {
        details = { reason: 'Document content is unavailable.' };
      } else {
        currentHash = sha256(bytes);
        try {
          const anchorEvent = await blockchainService.getAnchoredHashFromTransaction(anchor.transactionHash);
          blockchainAnchoredHash = anchorEvent.documentHash;
          const onChain = await blockchainService.verifyDocument(blockchainAnchoredHash);
          if (!onChain.exists) {
            integrityStatus = IntegrityStatus.NOT_ANCHORED;
            details = { reason: 'The recorded blockchain anchor hash is not present on-chain.' };
          } else if (currentHash !== blockchainAnchoredHash) {
            integrityStatus = IntegrityStatus.MODIFIED;
            details = { reason: 'Current document bytes differ from the blockchain-anchored SHA-256 hash.', onChainExists: true, eventType: onChain.eventType, timestamp: onChain.timestamp };
          } else {
            integrityStatus = IntegrityStatus.VERIFIED;
            details = { onChainExists: true, eventType: onChain.eventType, timestamp: onChain.timestamp };
          }
        } catch (error) {
          integrityStatus = IntegrityStatus.VERIFICATION_UNAVAILABLE;
          details = { reason: error instanceof Error ? error.message : 'Blockchain verification unavailable.' };
        }
      }
    }

    const record = await prisma.verificationRecord.create({ data: {
      caseId: input.caseId, documentId: input.documentId, evidenceId: input.evidenceId, judgeId: input.judgeId,
      integrityStatus, judicialDecision: input.judicialDecision, decisionReason: input.decisionReason?.trim() || null,
      verifiedHash: blockchainAnchoredHash ?? document.sha256Hash, currentHash, blockchainTransactionId: anchor?.id, blockchainReference: anchor?.transactionHash,
      verificationDetails: details,
    } });
    const action = input.judicialDecision === JudicialDecision.REJECTED ? AuditAction.DOCUMENT_REJECTED
      : integrityStatus === IntegrityStatus.VERIFIED ? AuditAction.DOCUMENT_VERIFIED : AuditAction.DOCUMENT_VERIFICATION_UNAVAILABLE;
    await auditService.record({ caseId: input.caseId, actorId: input.judgeId, documentId: input.documentId, evidenceId: input.evidenceId, verificationId: record.id, action, entityType: AuditEntityType.VERIFICATION_RECORD, metadata: { integrityStatus, judicialDecision: input.judicialDecision ?? null } });
    return record;
  }
}

export const judicialService = new JudicialService();
