import assert from 'node:assert/strict';
import test from 'node:test';
import { JudicialService } from '../src/services/judicial.service';
import { blockchainService } from '../src/services/blockchain.service';
import { documentService } from '../src/services/document.service';
import { auditService } from '../src/services/audit.service';
import { prisma } from '../src/utils/prisma';
import { sha256 } from '../src/utils/hash';

const ORIGINAL = Buffer.from('original document bytes');
const MODIFIED = Buffer.from('modified document bytes');
const BLOCKCHAIN_HASH = sha256(ORIGINAL);
const DATABASE_HASH = sha256('database metadata hash');

const installStubs = (currentBytes: Buffer) => {
  const prismaAny = prisma as any;
  const blockchainAny = blockchainService as any;
  const documentAny = documentService as any;
  const auditAny = auditService as any;
  const originals = {
    caseFindUnique: prismaAny.case.findUnique,
    documentFindUnique: prismaAny.document.findUnique,
    transactionFindFirst: prismaAny.blockchainTransaction.findFirst,
    verificationCreate: prismaAny.verificationRecord.create,
    documentContent: documentAny.getDocumentContent,
    anchorLookup: blockchainAny.getAnchoredHashFromTransaction,
    verifyDocument: blockchainAny.verifyDocument,
    auditRecord: auditAny.record,
  };

  prismaAny.case.findUnique = async () => ({
    assignedJudgeId: 'judge-1',
    assignedJudge: { role: 'JUDGE' },
    participants: [{ userId: 'judge-1', participantRole: 'JUDGE' }],
  });
  prismaAny.document.findUnique = async () => ({
    id: 'document-1',
    caseId: 'case-1',
    sha256Hash: DATABASE_HASH,
  });
  prismaAny.blockchainTransaction.findFirst = async () => ({
    id: 'transaction-1',
    transactionHash: '0xanchor',
  });
  prismaAny.verificationRecord.create = async ({ data }: any) => ({ id: 'verification-1', ...data });
  documentAny.getDocumentContent = async () => currentBytes;
  blockchainAny.getAnchoredHashFromTransaction = async () => ({
    documentHash: BLOCKCHAIN_HASH,
    referenceId: '0xreference',
    actor: '0xactor',
    eventType: 'EVIDENCE_UPLOAD',
    timestamp: 1,
  });
  blockchainAny.verifyDocument = async (hash: string) => ({
    exists: hash === BLOCKCHAIN_HASH,
    referenceId: '0xreference',
    actor: '0xactor',
    eventType: 'EVIDENCE_UPLOAD',
    timestamp: 1,
  });
  auditAny.record = async () => undefined;

  return () => {
    prismaAny.case.findUnique = originals.caseFindUnique;
    prismaAny.document.findUnique = originals.documentFindUnique;
    prismaAny.blockchainTransaction.findFirst = originals.transactionFindFirst;
    prismaAny.verificationRecord.create = originals.verificationCreate;
    documentAny.getDocumentContent = originals.documentContent;
    blockchainAny.getAnchoredHashFromTransaction = originals.anchorLookup;
    blockchainAny.verifyDocument = originals.verifyDocument;
    auditAny.record = originals.auditRecord;
  };
};

test('judicial verification uses the blockchain event hash over both local hash fields', async () => {
  const restore = installStubs(ORIGINAL);
  try {
    const result = await new JudicialService().verify({
      caseId: 'case-1',
      documentId: 'document-1',
      judgeId: 'judge-1',
    });

    assert.equal(result.integrityStatus, 'VERIFIED');
    assert.equal(result.verifiedHash, BLOCKCHAIN_HASH);
    assert.equal(result.currentHash, BLOCKCHAIN_HASH);
  } finally {
    restore();
  }
});

test('judicial verification marks current bytes modified against the blockchain event hash', async () => {
  const restore = installStubs(MODIFIED);
  try {
    const result = await new JudicialService().verify({
      caseId: 'case-1',
      documentId: 'document-1',
      judgeId: 'judge-1',
    });

    assert.equal(result.integrityStatus, 'MODIFIED');
    assert.equal(result.verifiedHash, BLOCKCHAIN_HASH);
    assert.equal(result.currentHash, sha256(MODIFIED));
  } finally {
    restore();
  }
});