import { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export interface AuditRecordInput {
  caseId: string;
  actorId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  documentId?: string;
  evidenceId?: string;
  verificationId?: string;
  comparisonId?: string;
  metadata?: Prisma.InputJsonValue;
}

/** Append-only application audit writer. No update/delete operations are exposed. */
export class AuditService {
  /** The only application-level audit mutation; audit entries are append-only. */
  async record(input: AuditRecordInput) {
    const caseRecord = await prisma.case.findUnique({ where: { id: input.caseId }, select: { id: true } });
    if (!caseRecord) throw new Error('Cannot audit a non-existent case.');
    const [document, evidence, verification, comparison] = await Promise.all([
      input.documentId ? prisma.document.findUnique({ where: { id: input.documentId }, select: { caseId: true } }) : null,
      input.evidenceId ? prisma.evidence.findUnique({ where: { id: input.evidenceId }, select: { caseId: true } }) : null,
      input.verificationId ? prisma.verificationRecord.findUnique({ where: { id: input.verificationId }, select: { caseId: true } }) : null,
      input.comparisonId ? prisma.documentComparison.findUnique({ where: { id: input.comparisonId }, select: { caseId: true } }) : null,
    ]);
    for (const entity of [document, evidence, verification, comparison]) {
      if (!entity || entity.caseId !== input.caseId) throw new Error('Audit entity does not belong to the audit case.');
    }
    return prisma.auditLog.create({ data: input });
  }

  recordCaseCreated(caseId: string, actorId: string) {
    return this.record({ caseId, actorId, action: AuditAction.CASE_CREATED, entityType: AuditEntityType.CASE });
  }

  recordDocumentUploaded(caseId: string, actorId: string, documentId: string) {
    return this.record({ caseId, actorId, documentId, action: AuditAction.DOCUMENT_UPLOADED, entityType: AuditEntityType.DOCUMENT });
  }

  recordEvidenceSubmitted(caseId: string, actorId: string, evidenceId: string, documentId?: string) {
    return this.record({ caseId, actorId, evidenceId, documentId, action: AuditAction.EVIDENCE_SUBMITTED, entityType: AuditEntityType.EVIDENCE });
  }

  recordJudgeAssigned(caseId: string, actorId: string, judgeId: string) {
    return this.record({ caseId, actorId, action: AuditAction.CASE_JUDGE_ASSIGNED, entityType: AuditEntityType.CASE, metadata: { assignedJudgeId: judgeId } });
  }

  recordDocumentAnchored(caseId: string, actorId: string, documentId: string, transactionHash: string) {
    return this.record({ caseId, actorId, documentId, action: AuditAction.DOCUMENT_ANCHORED, entityType: AuditEntityType.BLOCKCHAIN_TRANSACTION, metadata: { transactionHash } });
  }
}

export const auditService = new AuditService();
