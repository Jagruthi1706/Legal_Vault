import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Download, ExternalLink, FileText, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { MetaRow } from '../../components/common/MetaRow';
import { PersonLabel } from '../../components/common/PersonLabel';
import { TrustChecklist } from '../../components/common/TrustChecklist';
import { HashBlock } from '../../components/common/HashBlock';
import { Tabs } from '../../components/common/PageHeader';
import { BlockchainTab } from '../../components/workspace/BlockchainTab';
import { CaseCopilotCard } from '../../components/workspace/CaseCopilotCard';
import { LegalResearchPage } from './LegalResearchPage';
import { useAuth } from '../../contexts/AuthContext';
import { useCopilot } from '../../contexts/CopilotContext';
import { casesApi } from '../../services/casesApi';
import { documentsApi } from '../../services/documentsApi';
import type { AuditRecord, CaseMetadata, DocumentComparison, DocumentMetadata, VerificationRecord } from '../../types/api';
import type { TamperCheckResult } from '../../services/documentsApi';
import { canJudgeCompareDocument, getIntegrityDisplayState } from '../../utils/documentIntegrity';

const eventLabel = (action: string) => action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'documents', label: 'Documents' },
  { id: 'copilot', label: 'AI Copilot' },
  { id: 'research', label: 'Legal Research' },
  { id: 'custody', label: 'Custody / Audit' },
];

export const CaseWorkspacePage: React.FC = () => {
  const { caseId = '' } = useParams<{ caseId: string }>();
  const { role, user } = useAuth();
  const { setActiveCaseContext } = useCopilot();
  const [tab, setTab] = useState('overview');
  const [record, setRecord] = useState<CaseMetadata | null>(null);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [comparisons, setComparisons] = useState<DocumentComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [reason, setReason] = useState('');
  const [busyDocument, setBusyDocument] = useState<string | null>(null);
  const [judgeId, setJudgeId] = useState('');
  const [custodyDocId, setCustodyDocId] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<VerificationRecord | null>(null);

  const load = async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      setError(null);
      const [c, a, v, x] = await Promise.all([
        casesApi.getCaseById(caseId),
        casesApi.getAudit(caseId),
        casesApi.getVerifications(caseId),
        casesApi.getComparisons(caseId),
      ]);
      setRecord(c.data);
      setActiveCaseContext({ caseId: c.data.id, caseNumber: c.data.caseNumber, title: c.data.title });
      setAudit(a.data || []);
      setVerifications(v.data || []);
      setComparisons(x.data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to load this case workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveCaseContext(caseId ? { caseId } : undefined);
    void load();
  }, [caseId, setActiveCaseContext]);

  const docs = record?.documents || [];
  const evidence = record?.evidence || [];
  const isAssignedJudge = role === 'judge' && record?.assignedJudgeId === user?.id;
  const lawyerName = record?.participants?.find((p) => p.participantRole === 'LAWYER')?.user?.name || record?.createdBy?.name;

  const verify = async (documentId: string) => {
    if (decision === 'REJECTED' && !reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    try {
      setBusyDocument(documentId);
      const response = await documentsApi.createJudicialVerification(documentId, {
        judicialDecision: decision,
        decisionReason: decision === 'REJECTED' ? reason : undefined,
      });
      setVerificationNotice(response.data);
      setReason('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Official verification was not accepted.');
    } finally {
      setBusyDocument(null);
    }
  };

  const assignJudge = async () => {
    if (!judgeId.trim()) return;
    try {
      await casesApi.assignJudge(caseId, judgeId.trim());
      setJudgeId('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Judge assignment was not accepted.');
    }
  };

  const openCustody = (documentId: string) => {
    setCustodyDocId(documentId);
    setTab('custody');
  };

  if (loading) return <LoadingState label="Loading authorized case workspace…" />;
  if (error && !record) return <ErrorState message={error} />;
  if (!record) return <EmptyState title="Case unavailable" description="This case was not found or is not authorized for your account." />;

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Cases', href: '/app/cases' }, { label: record.caseNumber }]} />
      {error && <ErrorState message={error} />}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-primary">{record.caseNumber}</span>
          <StatusBadge status={record.status} />
          <span className="lv-label !mb-0">{record.caseType}</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-[22px]">{record.title}</h1>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-foreground-muted">
          <span>Creator <PersonLabel name={lawyerName} id={record.createdById} /></span>
          <span>Assigned judge <PersonLabel name={record.assignedJudge?.name} id={record.assignedJudgeId} /></span>
        </div>
      </header>

      <Tabs tabs={WORKSPACE_TABS} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {record.description && <p className="mb-4 text-sm leading-relaxed text-foreground-secondary">{record.description}</p>}
            <div className="divide-y divide-border">
              <MetaRow label="Created">{new Date(record.createdAt).toLocaleString()}</MetaRow>
              <MetaRow label="Last updated">{new Date(record.updatedAt).toLocaleString()}</MetaRow>
              <MetaRow label="Creator"><PersonLabel name={lawyerName} id={record.createdById} /></MetaRow>
              <MetaRow label="Assigned judge"><PersonLabel name={record.assignedJudge?.name} id={record.assignedJudgeId} /></MetaRow>
            </div>
            {role === 'admin' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <input className="lv-input max-w-xs" value={judgeId} onChange={(e) => setJudgeId(e.target.value)} placeholder="Judge user ID" aria-label="Judge user ID" />
                <Button size="sm" variant="outline" onClick={() => void assignJudge()}>Assign judge</Button>
              </div>
            )}
          </div>
          <div className="lg:col-span-5 space-y-4">
            <div>
              <div className="lv-label">Participants</div>
              {record.participants?.length ? record.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-border py-2 text-xs last:border-0">
                  <span className="lv-label !mb-0">{p.participantRole}</span>
                  <PersonLabel name={p.user?.name} id={p.userId} />
                </div>
              )) : <EmptyState title="No participants" description="No participant records were returned for this case." />}
            </div>
            <div>
              <div className="lv-label">Recent case activity</div>
              {audit.length ? (
                <ol className="space-y-3">
                  {audit.map((item) => (
                    <li key={item.id} className="border-l-2 border-primary pl-3 text-xs">
                      <div className="font-semibold">{eventLabel(item.action)}</div>
                      <div className="text-foreground-muted">{new Date(item.createdAt).toLocaleString()}</div>
                      <div className="text-foreground-muted"><PersonLabel name={item.actor?.name} id={item.actorId} /></div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  title="No recorded case activity"
                  description="The audit API returned no events. Uploads, evidence submissions, custody anchors, and official reviews write audit records when those actions occur. Seeded demo cases may exist without historical audit entries."
                />
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'evidence' && (
        evidence.length ? (
          <div className="lv-table-wrap">
            <table className="lv-table">
              <thead>
                <tr>
                  <th>Evidence</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Hash</th>
                  <th>Custody</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((item) => {
                  const linked = docs.find((d) => d.id === item.documentId) || null;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="font-mono text-[11px] text-primary">{item.evidenceNumber}</div>
                        <div className="font-medium">{item.title}</div>
                      </td>
                      <td className="text-foreground-muted">{item.evidenceType}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td className="max-w-[180px]"><HashBlock value={item.document?.sha256Hash || linked?.sha256Hash} /></td>
                      <td><StatusBadge status={linked?.integrityStatus || 'PENDING'} /></td>
                      <td>
                        {item.documentId ? (
                          <Link to={`/app/documents/${item.documentId}`} className="inline-flex items-center gap-1 text-xs text-primary">
                            Open <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No evidence" description="No evidence records are attached to this authorized case." />
        )
      )}

      {tab === 'documents' && (
        <>
          {verificationNotice && (
            <div className="rounded-[8px] border border-info/20 bg-info-soft p-3 text-xs text-foreground">
              <div className="font-semibold">Official review result: {verificationNotice.integrityStatus}</div>
              {verificationNotice.verifiedHash && <div className="mt-1 break-all font-mono text-[11px]">Blockchain anchor: {verificationNotice.verifiedHash}</div>}
              {verificationNotice.currentHash && <div className="break-all font-mono text-[11px]">Current document: {verificationNotice.currentHash}</div>}
            </div>
          )}
          {docs.length ? (
            <div className="space-y-3">
              {docs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  verifications={verifications}
                  showJudicial={Boolean(isAssignedJudge)}
                  showIntegrity={Boolean(isAssignedJudge)}
                  decision={decision}
                  reason={reason}
                  busy={busyDocument === doc.id}
                  onDecision={setDecision}
                  onReason={setReason}
                  onVerify={() => void verify(doc.id)}
                  onCustody={() => openCustody(doc.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No documents" description="No documents have been uploaded to this case." />
          )}
          {role === 'judge' && !isAssignedJudge && (
            <p className="mt-2 text-[11px] text-warning">Official review is available only to the assigned judge.</p>
          )}
        </>
      )}

      {tab === 'copilot' && (
        <CaseCopilotCard caseId={record.id} caseNumber={record.caseNumber} title={record.title} />
      )}

      {tab === 'research' && <LegalResearchPage embedded />}

      {tab === 'custody' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="lv-label">Blockchain custody</div>
            <BlockchainTab caseId={record.id} focusDocumentId={custodyDocId} />
          </div>
          <div className="space-y-5">
            <div>
              <div className="lv-label">Verification history</div>
              <p className="mb-2 text-[11px] text-foreground-muted">Blockchain integrity and judicial decision are separate records.</p>
              {verifications.length ? verifications.map((v) => (
                <div key={v.id} className="border-b border-border py-2 text-xs">
                  <div>Integrity: {v.integrityStatus} · Judicial decision: {v.judicialDecision || 'Not recorded'}</div>
                  <div className="text-foreground-muted">{new Date(v.verifiedAt).toLocaleString()}</div>
                </div>
              )) : <EmptyState title="No official verification" description="No judicial verification records exist for this case." />}
            </div>
            <div>
              <div className="lv-label">Tamper comparison history</div>
              {comparisons.length ? comparisons.map((x) => (
                <div key={x.id} className="space-y-2 border-b border-border py-2 text-xs">
                  <StatusBadge status={x.result} />
                  <HashBlock label="Original" value={x.originalHash} />
                  <HashBlock label="Candidate" value={x.candidateHash} />
                  <div className="text-foreground-muted">{x.candidateFileName || 'Unnamed candidate'} · {new Date(x.comparedAt).toLocaleString()}</div>
                </div>
              )) : <EmptyState title="No tamper comparisons" description="Candidate files are compared without being stored. No comparison history exists yet." />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DocumentRow: React.FC<{
  doc: DocumentMetadata;
  verifications: VerificationRecord[];
  showJudicial: boolean;
  showIntegrity: boolean;
  decision: 'ACCEPTED' | 'REJECTED';
  reason: string;
  busy: boolean;
  onDecision: (value: 'ACCEPTED' | 'REJECTED') => void;
  onReason: (value: string) => void;
  onVerify: () => void;
  onCustody: () => void;
}> = ({ doc, verifications, showJudicial, showIntegrity, decision, reason, busy, onDecision, onReason, onVerify, onCustody }) => {
  const related = verifications.filter((item) => item.documentId === doc.id);
  const judicial = related[0];
  const [candidate, setCandidate] = React.useState<File | null>(null);
  const [tamperResult, setTamperResult] = React.useState<TamperCheckResult | null>(null);
  const [tamperError, setTamperError] = React.useState<string | null>(null);
  const [tamperBusy, setTamperBusy] = React.useState(false);
  const trust = useMemo(() => ([
    { label: 'Hash generated', ok: Boolean(doc.sha256Hash) },
    { label: 'Integrity verified', ok: Boolean(judicial?.integrityStatus && judicial.integrityStatus !== 'NOT_ANCHORED' && judicial.integrityStatus !== 'VERIFICATION_UNAVAILABLE') },
    { label: 'Custody recorded', ok: doc.integrityStatus === 'ANCHORED' || Boolean(doc.lastTransactionHash) },
    { label: 'Blockchain anchored', ok: Boolean(doc.lastTransactionHash) },
    { label: 'Transaction confirmed', ok: Boolean(doc.lastTransactionHash) },
  ]), [doc, judicial]);

  const compareWithAnchor = async () => {
    if (!candidate) return;
    setTamperBusy(true);
    setTamperError(null);
    setTamperResult(null);
    try {
      const response = await documentsApi.tamperCheck(doc.id, candidate);
      setTamperResult(response.data);
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      setTamperError(statusCode === 403 ? 'AUTHORIZATION FAILED: You are not authorized to compare this document.' : error instanceof Error ? error.message : 'Integrity comparison failed.');
    } finally {
      setTamperBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-b border-border py-4 text-xs last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 text-primary" /> {doc.originalFileName}
          </div>
          <div className="mt-1 text-foreground-muted">{doc.documentType} · {doc.fileSize} bytes</div>
        </div>
        <StatusBadge status={doc.integrityStatus || 'NOT_ANCHORED'} />
      </div>
      <HashBlock value={doc.sha256Hash} />
      {doc.integrityStatus === 'ANCHORED' && (
        <div className="text-[11px] text-success">✓ Anchored on Ethereum Sepolia</div>
      )}
      <TrustChecklist title="Document trust" items={trust} />
      <div className="flex flex-wrap gap-2">
        <Link to={`/app/documents/${doc.id}`}><Button size="sm" variant="outline">Open</Button></Link>
        <Button size="sm" variant="secondary" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => void documentsApi.download(doc.id, doc.originalFileName)}>Download</Button>
        <Button size="sm" variant="ghost" leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={onCustody}>View custody</Button>
      </div>
      {showJudicial && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={decision} onChange={(e) => onDecision(e.target.value as 'ACCEPTED' | 'REJECTED')} className="lv-input max-w-[200px]" aria-label="Judicial decision">
            <option value="ACCEPTED">Accept judicially</option>
            <option value="REJECTED">Reject judicially</option>
          </select>
          {decision === 'REJECTED' && <input value={reason} onChange={(e) => onReason(e.target.value)} placeholder="Required rejection reason" className="lv-input max-w-xs" />}
          <Button size="sm" variant="primary" disabled={busy} onClick={onVerify}>{busy ? 'Reviewing…' : 'Official review'}</Button>
        </div>
      )}
      {showIntegrity && canJudgeCompareDocument('judge', showIntegrity) && (
        <div className="space-y-2 rounded-[8px] border border-border bg-surface-subtle p-3">
          <div className="font-semibold">Document integrity</div>
          <div className="text-foreground-muted">Compare a candidate copy against the authoritative blockchain anchor.</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              aria-label={`Select candidate for ${doc.originalFileName}`}
              onChange={(event) => {
                setCandidate(event.target.files?.[0] || null);
                setTamperResult(null);
                setTamperError(null);
              }}
              className="max-w-full text-xs"
            />
            <Button size="sm" variant="outline" disabled={!candidate || tamperBusy} onClick={() => void compareWithAnchor()}>
              {tamperBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Compare With Blockchain Anchor
            </Button>
          </div>
          {tamperError && <div className="text-xs text-danger">{tamperError}</div>}
          {tamperResult && (() => {
            const state = getIntegrityDisplayState(tamperResult);
            return (
              <div className={`space-y-1 rounded-[8px] border p-3 text-xs ${state === 'verified' ? 'border-success/30 bg-success-soft' : state === 'tampered' ? 'border-danger/30 bg-danger-soft' : 'border-warning/30 bg-warning-soft'}`}>
                <div className="flex items-center gap-1.5 font-semibold">
                  {state === 'verified' ? <CheckCircle2 className="h-4 w-4 text-success" /> : state === 'tampered' ? <XCircle className="h-4 w-4 text-danger" /> : null}
                  {state === 'verified' ? 'VERIFIED — FILE UNMODIFIED' : state === 'tampered' ? 'TAMPERED — FILE DOES NOT MATCH THE BLOCKCHAIN ANCHOR' : `VERIFICATION UNAVAILABLE — ${tamperResult.status || 'UNKNOWN'}`}
                </div>
                <div>{tamperResult.message}</div>
                <div className="break-all font-mono text-[11px]">Original anchor hash: {tamperResult.originalHash}</div>
                <div className="break-all font-mono text-[11px]">Candidate hash: {tamperResult.candidateHash}</div>
                <div className="break-all font-mono text-[11px]">Anchor transaction: {tamperResult.transactionHash}</div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
