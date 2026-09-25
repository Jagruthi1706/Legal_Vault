import { Case, User, LegalDocument, NotificationItem, AuditLog, SystemMetric } from '../types';

export const MOCK_USERS: User[] = [
  {
    id: 'usr-1',
    name: 'Rajesh Kumar Sharma',
    email: 'rajesh.sharma@citizen.in',
    role: 'client',
    verified: true,
    designation: 'Individual Litigant',
    organization: 'Self-Represented Citizen'
  },
  {
    id: 'usr-2',
    name: 'Adv. Ananya Subramanian',
    email: 'ananya@subramanianchambers.in',
    role: 'lawyer',
    verified: true,
    courtOrBarNumber: 'D/1842/2012',
    designation: 'Senior Advocate',
    organization: 'Subramanian & Partners Chambers'
  },
  {
    id: 'usr-3',
    name: 'Hon’ble Justice Vikramaditya Sen',
    email: 'justice.vsen@sci.gov.in',
    role: 'judge',
    verified: true,
    courtOrBarNumber: 'SCI-J-042',
    designation: 'Presiding Judge, Bench III',
    organization: 'Supreme Court of India'
  },
  {
    id: 'usr-4',
    name: 'Dr. Rameshwar Nath Varma',
    email: 'admin.varma@legalvault.gov.in',
    role: 'admin',
    verified: true,
    designation: 'Chief Registrar & Systems Administrator',
    organization: 'Ministry of Law & Justice / e-Courts Project'
  }
];

export const MOCK_CASES: Case[] = [
  {
    id: 'case-101',
    caseNumber: 'SLP (C) No. 18492/2024',
    title: 'Mehta Property Developers Ltd. v. Delhi Development Authority & Ors.',
    category: 'Property',
    court: 'Supreme Court of India',
    bench: 'Hon’ble Justice Vikramaditya Sen, Hon’ble Justice R. Banumathi',
    filingDate: '12 Jan 2024',
    nextHearingDate: '14 Aug 2026',
    status: 'In Progress',
    urgency: 'High',
    petitioner: 'Mehta Property Developers Ltd.',
    respondent: 'Delhi Development Authority & Ors.',
    summary: 'Special Leave Petition challenging the Delhi High Court judgment regarding compulsory land acquisition compensation, statutory interest rates under the Right to Fair Compensation and Transparency in Land Acquisition Act, 2013.',
    assignedJudge: 'Hon’ble Justice Vikramaditya Sen',
    assignedLawyer: 'Adv. Ananya Subramanian',
    documentsCount: 14,
    parties: [
      { id: 'p1', name: 'Mehta Property Developers Ltd.', role: 'Petitioner', counselName: 'Adv. Ananya Subramanian' },
      { id: 'p2', name: 'Delhi Development Authority', role: 'Respondent', counselName: 'Adv. Harish Salve (Sr.)' },
      { id: 'p3', name: 'Land Acquisition Collector, New Delhi', role: 'Respondent', counselName: 'Adv. Tushar Mehta (SG)' }
    ],
    aiInsights: [
      'Strong probability of compensation enhanced by 18.5% based on landmark precedent in *State of Haryana v. Gurcharan Singh (2022)*.',
      'Document tamper-check: 100% hash integrity match on Ethereum ledger for Title Deed #DL-2018-994.',
      'Delay analysis: Case has been pending for 186 days; 3 adjournments were requested by Respondent Counsel.'
    ],
    applicableLaws: [
      { code: 'RFCTLARR Act, 2013 - Section 26', title: 'Determination of Market Value of Land', description: 'Criteria for calculating market value based on minimum land value or recent sale transactions.', relevanceScore: 0.98, category: 'Land Law' },
      { code: 'RFCTLARR Act, 2013 - Section 30', title: 'Award of Solatium', description: 'Mandatory 100% solatium payment on final market value award.', relevanceScore: 0.92, category: 'Land Law' },
      { code: 'CPC, 1908 - Order 39 Rules 1 & 2', title: 'Temporary Injunctions', description: 'Granting of stay order restraining development work pending final disposal.', relevanceScore: 0.85, category: 'Procedural Law' },
      { code: 'Transfer of Property Act, 1882 - Section 54', title: 'Sale Defined', description: 'Requirements of valid conveyance and registered sale deed execution.', relevanceScore: 0.78, category: 'Property Law' }
    ],
    referencedJudgments: [
      { id: 'rj-1', citation: '2022 INSC 412', title: 'State of Haryana v. Gurcharan Singh', bench: '3-Judge Bench', court: 'Supreme Court of India', ratioDecidendi: ' Solatium and statutory interest under the 2013 Land Act apply retrospectively to pending awards where physical possession was not taken prior to Jan 1, 2014.', relevanceScore: 0.96 },
      { id: 'rj-2', citation: '2019 SCC OnLine SC 1102', title: 'Indore Development Authority v. Manoharlal', bench: '5-Judge Constitution Bench', court: 'Supreme Court of India', ratioDecidendi: 'Lapse of acquisition proceedings under Section 24(2) requires non-payment of compensation AND non-taking of possession.', relevanceScore: 0.91 },
      { id: 'rj-3', citation: '2021 AIR SC 3302', title: 'K.T. Plantation Pvt. Ltd. v. State of Karnataka', bench: '2-Judge Bench', court: 'Supreme Court of India', ratioDecidendi: 'Right to property under Article 300A is a constitutional human right requiring just compensation.', relevanceScore: 0.84 }
    ],
    timeline: [
      { id: 'tl-1', date: '12 Jan 2024', title: 'SLP Filed', description: 'E-filing submitted with 324 pages of trial court records.', stage: 'Filing', status: 'Completed', actor: 'Adv. Ananya Subramanian', documentsAttached: 4 },
      { id: 'tl-2', date: '28 Feb 2024', title: 'Notice Issued', description: 'Bench issued notice to DDA returnable in 4 weeks. Stay granted on demolition.', stage: 'Admission', status: 'Completed', actor: 'Registry, Supreme Court', documentsAttached: 2 },
      { id: 'tl-3', date: '15 May 2024', title: 'Counter Affidavit Submitted', description: 'DDA filed counter affidavit raising objections on limitation period.', stage: 'Pleadings', status: 'Completed', actor: 'Delhi Development Authority', documentsAttached: 5 },
      { id: 'tl-4', date: '10 Oct 2024', title: 'Rejoinder Filed', description: 'Petitioner submitted reply refuting DDA contention with satellite land mapping.', stage: 'Pleadings', status: 'Completed', actor: 'Adv. Ananya Subramanian', documentsAttached: 3 },
      { id: 'tl-5', date: '14 Aug 2026', title: 'Final Arguments Scheduled', description: 'Listed before Constitution Bench III for final disposal.', stage: 'Hearing', status: 'Upcoming', actor: 'Courtroom 3' }
    ],
    blockchainRecord: {
      txHash: '0x8f2a93c14d9e02318b7623a9d8011c210ab43912e73491f0923e110c921782e1',
      blockNumber: 19842103,
      timestamp: '2024-01-12T10:42:18Z',
      verifiedBy: 'National Judicial Data Grid Node #04 (Hyperledger Fabric)',
      documentHash: 'sha256:d41d8cd98f00b204e9800998ecf8427e004b2b1e',
      status: 'Verified'
    }
  },
  {
    id: 'case-102',
    caseNumber: 'CRL.A. No. 492/2023',
    title: 'State (NCT of Delhi) v. Vikramjeet Singh & Anr.',
    category: 'Criminal',
    court: 'High Court of Delhi',
    bench: 'Hon’ble Justice Siddharth Mridul, Hon’ble Justice Rajnish Bhatnagar',
    filingDate: '08 Mar 2023',
    nextHearingDate: '28 Jul 2026',
    status: 'Under Review',
    urgency: 'Urgent',
    petitioner: 'State (NCT of Delhi)',
    respondent: 'Vikramjeet Singh & Anr.',
    summary: 'Criminal appeal against acquittal order under BNS Sections 318 (Cheating) and 61 (Criminal Conspiracy) involving financial fraud of ₹42 Crores via digital banking channels.',
    assignedJudge: 'Hon’ble Justice Siddharth Mridul',
    assignedLawyer: 'Adv. Ananya Subramanian',
    documentsCount: 22,
    parties: [
      { id: 'p4', name: 'State (NCT of Delhi)', role: 'Petitioner', counselName: 'Standing Counsel for State' },
      { id: 'p5', name: 'Vikramjeet Singh', role: 'Respondent', counselName: 'Adv. Kapil Sibal (Sr.)' }
    ],
    aiInsights: [
      'Digital evidence audit confirms valid Section 65B Information Technology Act certificate attached.',
      'Pattern recognition flagged 4 identical fraudulent transactions across HDFC Bank branches in NCR.'
    ],
    applicableLaws: [
      { code: 'BNS, 2023 - Section 318', title: 'Cheating and Dishonestly Inducing Delivery of Property', description: 'Punishment for financial deception.', relevanceScore: 0.99, category: 'Criminal Law' },
      { code: 'IT Act, 2000 - Section 66D', title: 'Cheating by Personation using Computer Resource', description: 'Impersonation through digital communications.', relevanceScore: 0.91, category: 'Cyber Law' },
      { code: 'BSA, 2023 - Section 63', title: 'Admissibility of Electronic Records (formerly Sec 65B)', description: 'Mandatory certificate for electronic evidence.', relevanceScore: 0.95, category: 'Evidence Law' }
    ],
    referencedJudgments: [
      { id: 'rj-4', citation: '2020 INSC 531', title: 'Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal', bench: '3-Judge Bench', court: 'Supreme Court of India', ratioDecidendi: 'Section 65B(4) certificate is mandatory precondition to admissibility of electronic evidence.', relevanceScore: 0.97 }
    ],
    timeline: [
      { id: 'tl-6', date: '08 Mar 2023', title: 'Criminal Appeal Filed', description: 'State filed appeal challenging session trial judgment.', stage: 'Filing', status: 'Completed', actor: 'Public Prosecutor', documentsAttached: 8 }
    ],
    blockchainRecord: {
      txHash: '0x3c1109a27e4110f22c10928b9a1029c384a1e90218b32111f93010c2291039e2',
      blockNumber: 19521100,
      timestamp: '2023-03-08T14:20:00Z',
      verifiedBy: 'Delhi High Court Blockchain Vault',
      documentHash: 'sha256:7e004b2b1ed41d8cd98f00b204e9800998ecf842',
      status: 'Verified'
    }
  },
  {
    id: 'case-103',
    caseNumber: 'W.P. (C) No. 3310/2024',
    title: 'Dr. Sunita Rao & Ors. v. Union of India & Central Vigilance Commission',
    category: 'Constitutional',
    court: 'Supreme Court of India',
    bench: 'Hon’ble Chief Justice D.Y. Chandrachud, Hon’ble Justice J.B. Pardiwala',
    filingDate: '19 Feb 2024',
    nextHearingDate: '02 Sep 2026',
    status: 'Judgment Reserved',
    urgency: 'High',
    petitioner: 'Dr. Sunita Rao & Ors.',
    respondent: 'Union of India & CVC',
    summary: 'Public Interest Litigation seeking constitutional review of data privacy frameworks and algorithmic transparency in automated citizen welfare distribution algorithms.',
    assignedJudge: 'Hon’ble Chief Justice D.Y. Chandrachud',
    assignedLawyer: 'Adv. Ananya Subramanian',
    documentsCount: 19,
    parties: [
      { id: 'p6', name: 'Dr. Sunita Rao', role: 'Petitioner', counselName: 'Adv. Prashant Bhushan' },
      { id: 'p7', name: 'Union of India', role: 'Respondent', counselName: 'Attorney General for India' }
    ],
    aiInsights: [
      'Focus area: Article 21 Privacy Doctrine laid down in *K.S. Puttaswamy (2017)*.',
      'AI Analysis: Algorithmic bias audit submitted by Petitioner highlights 4.2% error rate in rural distribution nodes.'
    ],
    applicableLaws: [
      { code: 'Constitution of India - Article 14', title: 'Equality Before Law', description: 'Protection against arbitrary state action in algorithmic selection.', relevanceScore: 0.95, category: 'Constitutional Law' },
      { code: 'Constitution of India - Article 21', title: 'Protection of Life and Personal Liberty', description: 'Right to privacy and informational autonomy.', relevanceScore: 0.99, category: 'Constitutional Law' },
      { code: 'DPDP Act, 2023 - Section 6', title: 'Consent and Data Principal Rights', description: 'Lawful processing standards for government databases.', relevanceScore: 0.93, category: 'Data Protection' }
    ],
    referencedJudgments: [
      { id: 'rj-5', citation: '(2017) 10 SCC 1', title: 'Justice K.S. Puttaswamy (Retd.) v. Union of India', bench: '9-Judge Constitution Bench', court: 'Supreme Court of India', ratioDecidendi: 'Right to privacy is an intrinsic part of the right to life and personal liberty under Article 21.', relevanceScore: 0.99 }
    ],
    timeline: [
      { id: 'tl-7', date: '19 Feb 2024', title: 'PIL E-Filed', description: 'Petition admitted by Constitutional Bench.', stage: 'Admission', status: 'Completed', actor: 'Registry', documentsAttached: 6 }
    ],
    blockchainRecord: {
      txHash: '0x902e817f22310b9123c881023910c22901c28b12e30192801923c810293120ee',
      blockNumber: 19902111,
      timestamp: '2024-02-19T11:15:22Z',
      verifiedBy: 'Supreme Court Immutable Chain Node #01',
      documentHash: 'sha256:a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      status: 'Verified'
    }
  },
  {
    id: 'case-104',
    caseNumber: 'CP (IB) No. 812/MB/2024',
    title: 'State Bank of India v. Apex Logistics Infrastructure Pvt. Ltd.',
    category: 'Corporate',
    court: 'NCLT Mumbai Bench',
    bench: 'Hon’ble Member (Judicial) K.R. Saji Kumar',
    filingDate: '05 May 2024',
    nextHearingDate: '19 Aug 2026',
    status: 'Pending',
    urgency: 'Medium',
    petitioner: 'State Bank of India',
    respondent: 'Apex Logistics Infrastructure Pvt. Ltd.',
    summary: 'Section 7 Insolvency application under Insolvency and Bankruptcy Code (IBC) 2016 for recovery of defaulted debt amounting to ₹184 Crores.',
    assignedJudge: 'Hon’ble Member K.R. Saji Kumar',
    assignedLawyer: 'Adv. Ananya Subramanian',
    documentsCount: 31,
    parties: [
      { id: 'p8', name: 'State Bank of India', role: 'Petitioner', counselName: 'Adv. Cyril Shroff' },
      { id: 'p9', name: 'Apex Logistics Infrastructure Pvt. Ltd.', role: 'Respondent', counselName: 'Adv. Abhishek Manu Singhvi' }
    ],
    aiInsights: [
      'Debt default verified across NeSL Information Utility record dated 14 April 2024.',
      'Moratorium under Section 14 recommended upon admission.'
    ],
    applicableLaws: [
      { code: 'IBC, 2016 - Section 7', title: 'Initiation of CIRP by Financial Creditor', description: 'Application for corporate insolvency resolution process upon default.', relevanceScore: 0.99, category: 'Insolvency Law' },
      { code: 'IBC, 2016 - Section 14', title: 'Moratorium', description: 'Prohibition of suits and transfer of corporate debtor assets.', relevanceScore: 0.94, category: 'Insolvency Law' }
    ],
    referencedJudgments: [
      { id: 'rj-6', citation: '2019 INSC 124', title: 'Swiss Ribbons Pvt. Ltd. v. Union of India', bench: '2-Judge Bench', court: 'Supreme Court of India', ratioDecidendi: 'Constitutional validity of IBC 2016 upheld in entirety.', relevanceScore: 0.95 }
    ],
    timeline: [
      { id: 'tl-8', date: '05 May 2024', title: 'Section 7 Filed', description: 'Submitted along with NeSL record of default.', stage: 'Filing', status: 'Completed', actor: 'SBI Financial Creditor', documentsAttached: 12 }
    ],
    blockchainRecord: {
      txHash: '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      blockNumber: 19988100,
      timestamp: '2024-05-05T09:30:00Z',
      verifiedBy: 'NCLT Smart Contract Audit System',
      documentHash: 'sha256:ef9012345678a1b2c3d4e5f60718293a4b5c6d7e',
      status: 'Verified'
    }
  }
];

export const MOCK_DOCUMENTS: LegalDocument[] = [
  {
    id: 'doc-1',
    title: 'Certified Copy of Title Deed #DL-2018-994',
    fileName: 'Title_Deed_DL_2018_994_Certified.pdf',
    fileSize: '4.8 MB',
    fileType: 'PDF',
    uploadedAt: '12 Jan 2024 10:45 AM',
    uploadedBy: 'Adv. Ananya Subramanian',
    category: 'Property Records',
    caseId: 'case-101',
    caseNumber: 'SLP (C) No. 18492/2024',
    blockchainHash: '0x8f2a93c14d9e02318b7623a9d8011c210ab43912e73491f0923e110c921782e1',
    pageCount: 18,
    securityClassification: 'Restricted',
    aiSummary: 'Registered land conveyance deed executed in Sub-Registrar Office IX, South Delhi. Confirms ownership of 14.2 acres in Mehrauli sector valued at ₹32.4 Crores.'
  },
  {
    id: 'doc-2',
    title: 'Delhi Development Authority Compensation Award Notice',
    fileName: 'DDA_Compensation_Award_2023.pdf',
    fileSize: '2.1 MB',
    fileType: 'PDF',
    uploadedAt: '14 Jan 2024 02:15 PM',
    uploadedBy: 'Delhi Development Authority',
    category: 'Gazette Orders',
    caseId: 'case-101',
    caseNumber: 'SLP (C) No. 18492/2024',
    blockchainHash: '0x7a81092812039812903810293810293810293810293810293810293810293810',
    pageCount: 8,
    securityClassification: 'Public',
    aiSummary: 'Compulsory land acquisition award notice granting ₹1.2 Cr per acre under Section 23. Contested as significantly below prevailing circle rate of ₹3.8 Cr.'
  },
  {
    id: 'doc-3',
    title: 'Section 65B Electronic Evidence Certificate (BSA Sec 63)',
    fileName: 'Sec65B_Certificate_Digital_Audit.pdf',
    fileSize: '1.4 MB',
    fileType: 'PDF',
    uploadedAt: '10 Mar 2023 11:30 AM',
    uploadedBy: 'Inspector R.S. Hooda (Cyber Cell)',
    category: 'Evidence Certificate',
    caseId: 'case-102',
    caseNumber: 'CRL.A. No. 492/2023',
    blockchainHash: '0x3c1109a27e4110f22c10928b9a1029c384a1e90218b32111f93010c2291039e2',
    pageCount: 4,
    securityClassification: 'Confidential',
    aiSummary: 'Mandatory statutory certificate authenticating server logs and IP tracing data collected from HDFC Bank transaction gateway.'
  },
  {
    id: 'doc-4',
    title: 'Written Submission & Constitutional Precedent Digest',
    fileName: 'Petitioner_Written_Submissions_Constitutional.pdf',
    fileSize: '6.2 MB',
    fileType: 'PDF',
    uploadedAt: '22 Feb 2024 04:00 PM',
    uploadedBy: 'Adv. Prashant Bhushan',
    category: 'Legal Submissions',
    caseId: 'case-103',
    caseNumber: 'W.P. (C) No. 3310/2024',
    blockchainHash: '0x902e817f22310b9123c881023910c22901c28b12e30192801923c810293120ee',
    pageCount: 42,
    securityClassification: 'Public',
    aiSummary: 'Detailed jurisprudence digest analyzing comparative privacy benchmarks from the EU GDPR, US Fourth Amendment, and Indian Supreme Court constitutional precedents.'
  }
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Hearing Reminder: SLP (C) No. 18492/2024',
    description: 'Final arguments listed in Courtroom 3 before Bench III tomorrow at 10:30 AM.',
    timestamp: '10 mins ago',
    type: 'case',
    read: false,
    actionUrl: '/app/cases/case-101'
  },
  {
    id: 'notif-2',
    title: 'Blockchain Verification Confirmed',
    description: 'Title Deed #DL-2018-994 has been immutably anchored on Hyperledger Block #19842103.',
    timestamp: '1 hour ago',
    type: 'blockchain',
    read: false,
    actionUrl: '/app/blockchain'
  },
  {
    id: 'notif-3',
    title: 'AI Draft Judgment Ready for Review',
    description: 'Legal Vault AI generated a preliminary judgment summary for CRL.A. No. 492/2023.',
    timestamp: '3 hours ago',
    type: 'ai',
    read: true,
    actionUrl: '/app/cases/case-102'
  },
  {
    id: 'notif-4',
    title: 'New Counter Affidavit Uploaded',
    description: 'Delhi Development Authority uploaded 5 annexures to case workspace.',
    timestamp: 'Yesterday',
    type: 'document',
    read: true,
    actionUrl: '/app/documents'
  },
  {
    id: 'notif-5',
    title: 'Security System Audit Passed',
    description: 'Zero unauthorized access attempts reported in the last 24 hours. SSL/TLS 1.3 Active.',
    timestamp: '2 days ago',
    type: 'system',
    read: true
  }
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-101',
    timestamp: '2026-07-22 07:15:22',
    user: 'Hon’ble Justice Vikramaditya Sen',
    role: 'judge',
    action: 'Digital Signature Applied',
    resource: 'Order_Interim_Stay_SLP_18492.pdf',
    ipAddress: '10.204.12.89 (Supreme Court Intranet)',
    status: 'Success'
  },
  {
    id: 'log-102',
    timestamp: '2026-07-22 06:40:11',
    user: 'Adv. Ananya Subramanian',
    role: 'lawyer',
    action: 'Document Cryptographic Verification',
    resource: 'Title_Deed_DL_2018_994_Certified.pdf',
    ipAddress: '115.242.10.4 (Subramanian Chambers)',
    status: 'Success'
  },
  {
    id: 'log-103',
    timestamp: '2026-07-22 05:12:00',
    user: 'Rajesh Kumar Sharma',
    role: 'client',
    action: 'Case Status Search',
    resource: 'SLP (C) No. 18492/2024',
    ipAddress: '49.207.210.18',
    status: 'Success'
  },
  {
    id: 'log-104',
    timestamp: '2026-07-21 23:19:44',
    user: 'Unknown Actor',
    role: 'client',
    action: 'Restricted Document Download Attempt',
    resource: 'Sec65B_Certificate_Digital_Audit.pdf',
    ipAddress: '185.220.101.4',
    status: 'Denied'
  }
];

export const MOCK_SYSTEM_METRICS: SystemMetric[] = [
  { title: 'Total Active Cases', value: '14,289', change: '+3.4%', isPositive: true, timeframe: 'vs last month' },
  { title: 'AI Research Query Accuracy', value: '98.7%', change: '+0.8%', isPositive: true, timeframe: 'benchmark benchmark' },
  { title: 'Blockchain Anchored Records', value: '1,420,890', change: '+12.1%', isPositive: true, timeframe: 'immutable ledger' },
  { title: 'Average Pendency Reduction', value: '34 Days', change: '-18.2%', isPositive: true, timeframe: 'faster disposal rate' }
];

export const MOCK_REPORTS_CHART_DATA = [
  { month: 'Jan', filed: 1200, disposed: 1150, pending: 8500 },
  { month: 'Feb', filed: 1350, disposed: 1280, pending: 8570 },
  { month: 'Mar', filed: 1400, disposed: 1420, pending: 8550 },
  { month: 'Apr', filed: 1100, disposed: 1300, pending: 8350 },
  { month: 'May', filed: 1550, disposed: 1600, pending: 8300 },
  { month: 'Jun', filed: 1600, disposed: 1750, pending: 8150 },
  { month: 'Jul', filed: 1450, disposed: 1680, pending: 7920 }
];

export const MOCK_CASE_CATEGORY_DISTRIBUTION = [
  { name: 'Property & Land', value: 38, color: '#3B82F6' },
  { name: 'Criminal Law', value: 24, color: '#F43F5E' },
  { name: 'Constitutional', value: 16, color: '#8B5CF6' },
  { name: 'Corporate & IBC', value: 12, color: '#10B981' },
  { name: 'Civil & Tax', value: 10, color: '#F59E0B' }
];
