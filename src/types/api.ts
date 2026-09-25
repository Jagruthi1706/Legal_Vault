export interface DocumentMetadata {
  id: string;
  caseId: string;
  uploadedById: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  storageKey?: string;
  documentType: string;
  description: string | null;
  version: number;
  sha256Hash: string;
  createdAt: string;
  updatedAt: string;
  integrityStatus?: 'ANCHORED' | 'NOT_ANCHORED' | string;
  lastAnchoredAt?: string | null;
  lastTransactionHash?: string | null;
  lastChainId?: number | null;
  lastContractAddress?: string | null;
  lastBlockNumber?: number | null;
  case?: {
    id: string;
    caseNumber: string;
    title: string;
    assignedJudgeId?: string | null;
  };
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
  };
  blockchainTransactions?: Array<{
    id: string;
    transactionHash: string;
    blockNumber: number;
    status: string;
    createdAt: string;
    chainId?: number;
    contractAddress?: string;
  }>;
}

export interface CaseMetadata {
  id: string;
  caseNumber: string;
  title: string;
  description?: string;
  caseType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  documents?: DocumentMetadata[];
  evidence?: EvidenceMetadata[];
  participants?: CaseParticipant[];
  createdById?: string | null;
  assignedJudgeId?: string | null;
  createdBy?: { id: string; name: string; email: string } | null;
  assignedJudge?: { id: string; name: string; email: string } | null;
}

export interface CaseParticipant {
  id: string;
  userId: string;
  participantRole: string;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}
export interface EvidenceMetadata {
  id: string;
  caseId: string;
  documentId?: string | null;
  evidenceNumber: string;
  title: string;
  description?: string | null;
  evidenceType: string;
  status: string;
  submittedById: string;
  createdAt: string;
  submittedBy?: { id: string; name: string; email: string } | null;
  document?: { id: string; originalFileName: string; sha256Hash: string | null } | null;
}
export interface AuditRecord {
  id: string;
  caseId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  documentId?: string | null;
  evidenceId?: string | null;
  verificationId?: string | null;
  comparisonId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
}
export interface VerificationRecord { id: string; caseId: string; documentId: string; evidenceId?: string | null; judgeId: string; integrityStatus: string; judicialDecision?: 'ACCEPTED' | 'REJECTED' | null; decisionReason?: string | null; verifiedHash?: string | null; currentHash?: string | null; blockchainReference?: string | null; verifiedAt: string; }
export interface DocumentComparison { id: string; caseId: string; originalDocumentId: string; actorId: string; originalHash: string; candidateHash: string; result: string; candidateFileName?: string | null; candidateMimeType?: string | null; candidateFileSize?: number | null; comparedAt: string; }

export interface DocumentListResponse {
  success: boolean;
  data: DocumentMetadata[];
}

export interface CaseListResponse {
  success: boolean;
  data: CaseMetadata[];
}
