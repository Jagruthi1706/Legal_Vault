export type UserRole = 'client' | 'lawyer' | 'judge' | 'admin' | 'invalid';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  designation?: string;
  courtOrBarNumber?: string;
  organization?: string;
  verified: boolean;
}

export type CaseStatus = 
  | 'Pending' 
  | 'In Progress' 
  | 'Under Review' 
  | 'Judgment Reserved' 
  | 'Disposed' 
  | 'Appealed' 
  | 'Verified on Chain';

export type CaseCategory = 
  | 'Civil' 
  | 'Criminal' 
  | 'Constitutional' 
  | 'Corporate' 
  | 'Property' 
  | 'Family' 
  | 'Taxation' 
  | 'Environmental';

export interface Party {
  id: string;
  name: string;
  role: 'Petitioner' | 'Respondent' | 'Appellant' | 'Intervenor' | 'Witness';
  counselName?: string;
  contactEmail?: string;
}

export interface ApplicableLaw {
  code: string; // e.g. "IPC Section 420", "BNS Section 318", "CPC Order 39"
  title: string;
  description: string;
  relevanceScore: number; // e.g. 0.94
  category: string;
}

export interface ReferencedJudgment {
  id: string;
  citation: string; // e.g. "2023 INSC 784"
  title: string;
  bench: string;
  ratioDecidendi: string;
  relevanceScore: number;
  court: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  stage: string;
  status: 'Completed' | 'Upcoming' | 'In Progress';
  documentsAttached?: number;
  actor: string;
}

export interface BlockchainRecord {
  txHash: string;
  blockNumber: number;
  timestamp: string;
  verifiedBy: string;
  documentHash: string;
  status: 'Verified' | 'Pending' | 'Flagged';
}

export interface LegalDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  category: string;
  caseId: string;
  caseNumber: string;
  blockchainHash: string;
  aiSummary?: string;
  pageCount: number;
  securityClassification: 'Public' | 'Restricted' | 'Confidential' | 'Judicial Seal';
}

export interface Case {
  id: string;
  caseNumber: string; // e.g., "SLP (C) No. 14209/2024"
  title: string;
  category: CaseCategory;
  court: string; // e.g., "Supreme Court of India" or "High Court of Delhi"
  bench?: string; // e.g., "Hon'ble Justice D.Y. Chandrachud, Hon'ble Justice P.S. Narasimha"
  filingDate: string;
  nextHearingDate: string;
  status: CaseStatus;
  urgency: 'Low' | 'Medium' | 'High' | 'Urgent';
  parties: Party[];
  assignedJudge?: string;
  assignedLawyer?: string;
  petitioner: string;
  respondent: string;
  summary: string;
  aiInsights: string[];
  applicableLaws: ApplicableLaw[];
  referencedJudgments: ReferencedJudgment[];
  timeline: TimelineEvent[];
  blockchainRecord: BlockchainRecord;
  documentsCount: number;
}

/**
 * Attachment metadata kept on a user chat message (in-memory only, never
 * persisted or serialized anywhere).
 */
export interface MessageAttachment {
  name: string;
  size: number;
  mimeType: string;
  /** Original selected File, used solely for local preview/download. */
  file: File;
}

export interface AIMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  /** Files the user attached to this message (rendered above the message text). */
  attachments?: MessageAttachment[];
  sources?: string[];
  applicableLaws?: string[];
  confidenceScore?: number;
  suggestedActions?: string[];
  warnings?: string[];
  status?: 'grounded' | 'partial' | 'unavailable';
  providerMode?: 'MOCK' | 'OPENAI' | 'GEMINI';
  caseSources?: string[];
  legalSources?: string[];
  /** Judicial precedent source labels (caseName — citation), separate from legalSources. */
  precedentSources?: string[];
  facts?: string[];
  explanation?: string;
  unsupported?: string[];
  /** Temporal metadata for legal authorities (effectiveFrom, effectiveTo, currentStatus). */
  temporal?: {
    currentStatus: string;
    effectiveFrom: string;
    effectiveTo: string;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'case' | 'document' | 'blockchain' | 'ai' | 'system';
  read: boolean;
  actionUrl?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: UserRole;
  action: string;
  resource: string;
  ipAddress: string;
  status: 'Success' | 'Denied' | 'Warning';
}

export interface SystemMetric {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  timeframe: string;
}
