import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Search, ShieldCheck, XCircle } from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { HashBlock } from '../../components/common/HashBlock';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { Button } from '../../components/common/Button';
import { documentsApi } from '../../services/documentsApi';
import type { TamperCheckResult } from '../../services/documentsApi';
import { blockchainApi, type VerifyResponse } from '../../services/blockchainApi';
import { useAuth } from '../../contexts/AuthContext';
import { getBlockchainVerificationDisplayState, getIntegrityDisplayState } from '../../utils/documentIntegrity';
import type { DocumentMetadata } from '../../types/api';

export const DocumentsPage: React.FC = () => {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [docs, setDocs] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentMetadata | null>(null);
  const [candidate, setCandidate] = useState<File | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse['data'] | null>(null);
  const [tamperResult, setTamperResult] = useState<TamperCheckResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'stored' | 'candidate' | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setDocs((await documentsApi.getDocuments()).data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load authorized documents.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredDocs = useMemo(
    () =>
      docs.filter((doc) =>
        `${doc.originalFileName} ${doc.case?.caseNumber || ''} ${doc.sha256Hash}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [docs, search],
  );

  // The documents list is already returned by the backend's authorized-case query.
  // Backend assigned-judge authorization remains the final enforcement boundary.
  const canReviewDocument = role === 'judge';
  // Clients are presented with a plain document list plus an upload entry point.
  // Technical custody detail (SHA-256, anchoring, transaction hashes) stays a
  // lawyer/judge concern even though the backend keeps hashing and anchoring.
  const isClient = role === 'client';
  const canUpload = role === 'client' || role === 'lawyer';

  const selectDocument = (doc: DocumentMetadata) => {
    setSelectedDocument(doc);
    setCandidate(null);
    setVerifyResult(null);
    setTamperResult(null);
    setActionError(null);
  };

  const verifyStoredDocument = async () => {
    if (!selectedDocument) return;
    setBusyAction('stored');
    setActionError(null);
    setVerifyResult(null);
    try {
      setVerifyResult((await blockchainApi.verifyDocument({ documentId: selectedDocument.id })).data);
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      setActionError(statusCode === 403 ? 'AUTHORIZATION FAILED: You are not authorized to verify this document.' : err instanceof Error ? err.message : 'Verification unavailable.');
    } finally {
      setBusyAction(null);
    }
  };

  const compareCandidate = async () => {
    if (!selectedDocument || !candidate) return;
    setBusyAction('candidate');
    setActionError(null);
    setTamperResult(null);
    try {
      setTamperResult((await documentsApi.tamperCheck(selectedDocument.id, candidate)).data);
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      setActionError(statusCode === 403 ? 'AUTHORIZATION FAILED: You are not authorized to compare this document.' : err instanceof Error ? err.message : 'Verification unavailable.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Documents' }]} />
      <PageHeader
        title={isClient ? 'My documents' : 'Authorized documents'}
        description={
          isClient
            ? 'Documents you have filed on your authorized cases. Upload new documents to a case you are a party to.'
            : 'Live documents for cases you can access. Upload remains case-scoped from a case workspace.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canUpload && (
              <Link to="/app/evidence">
                <Button variant="primary" size="sm">Upload Document</Button>
              </Link>
            )}
            <Link to="/app/cases">
              <Button variant="outline" size="sm">Open a case</Button>
            </Link>
          </div>
        }
      />
      <div className="relative max-w-md">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-foreground-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isClient ? 'Search filename or case' : 'Search filename, case, or hash'}
          className="lv-input pl-9"
        />
      </div>
      {selectedDocument && canReviewDocument && (
        <div className="space-y-4 rounded-[10px] border border-border bg-surface-subtle p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="lv-label">Document integrity</div>
              <h2 className="text-sm font-semibold text-foreground">{selectedDocument.originalFileName}</h2>
              <p className="text-xs text-foreground-muted">Case: {selectedDocument.case?.caseNumber || selectedDocument.caseId}</p>
            </div>
            <StatusBadge status={selectedDocument.integrityStatus || 'NOT_ANCHORED'} />
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div><span className="text-foreground-muted">Blockchain status:</span> {selectedDocument.integrityStatus === 'ANCHORED' ? 'Anchored' : 'Not anchored'}</div>
            <div className="break-all"><span className="text-foreground-muted">Anchor transaction:</span> {selectedDocument.lastTransactionHash || 'Unavailable'}</div>
          </div>
          {selectedDocument.integrityStatus === 'ANCHORED' ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" disabled={busyAction !== null} onClick={() => void verifyStoredDocument()}>
                  {busyAction === 'stored' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Verify Stored Document
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-[7px] border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface">
                  Choose Candidate File
                  <input type="file" className="sr-only" onChange={(event) => { setCandidate(event.target.files?.[0] || null); setTamperResult(null); setActionError(null); }} />
                </label>
                <Button size="sm" variant="outline" disabled={!candidate || busyAction !== null} onClick={() => void compareCandidate()}>
                  {busyAction === 'candidate' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Compare With Blockchain Anchor
                </Button>
              </div>
              {candidate && <div className="text-[11px] text-foreground-muted">Candidate: {candidate.name} · {candidate.size} bytes</div>}
            </>
          ) : (
            <div className="text-xs text-warning">Not available — document has no blockchain anchor.</div>
          )}
          {actionError && <div className={`rounded-[8px] border p-3 text-xs ${actionError.startsWith('AUTHORIZATION FAILED') ? 'border-danger/30 bg-danger-soft text-danger' : 'border-warning/30 bg-warning-soft text-warning'}`}>{actionError.startsWith('AUTHORIZATION FAILED') ? actionError : `VERIFICATION UNAVAILABLE: ${actionError}`}</div>}
          {verifyResult && (() => {
            const state = getBlockchainVerificationDisplayState(verifyResult);
            return <IntegrityResult state={state} title={state === 'verified' ? 'VERIFIED — DOCUMENT MATCHES BLOCKCHAIN ANCHOR' : state === 'tampered' ? 'TAMPERED — DOCUMENT DOES NOT MATCH BLOCKCHAIN ANCHOR' : 'VERIFICATION UNAVAILABLE'} details={[verifyResult.reason, verifyResult.documentHash && `Blockchain anchor hash: ${verifyResult.documentHash}`, verifyResult.currentHash && `Current document hash: ${verifyResult.currentHash}`, verifyResult.onChain && `On-chain event: ${verifyResult.onChain.eventType}`].filter(Boolean) as string[]} />;
          })()}
          {tamperResult && (() => {
            const state = getIntegrityDisplayState(tamperResult);
            return <IntegrityResult state={state} title={state === 'verified' ? 'VERIFIED — FILE UNMODIFIED' : state === 'tampered' ? 'TAMPERED — FILE DOES NOT MATCH BLOCKCHAIN ANCHOR' : 'VERIFICATION UNAVAILABLE'} details={[tamperResult.message, `Blockchain anchor hash: ${tamperResult.originalHash}`, `Candidate hash: ${tamperResult.candidateHash}`, `Anchor transaction: ${tamperResult.transactionHash}`]} />;
          })()}
        </div>
      )}
      {loading && <LoadingState label="Loading documents…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && filteredDocs.length === 0 && (
        <EmptyState title="No authorized documents" description="No documents were returned for this account." />
      )}
      {filteredDocs.length > 0 && (
        <div className="lv-table-wrap">
          <table className="lv-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Case</th>
                {!isClient && <th>Hash</th>}
                {!isClient && <th>Custody</th>}
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td className="font-medium">{doc.originalFileName}</td>
                  <td className="text-foreground-muted">{doc.documentType}</td>
                  <td className="font-mono text-[11px]">{doc.case?.caseNumber || doc.caseId}</td>
                  {!isClient && <td className="max-w-[200px]"><HashBlock value={doc.sha256Hash} /></td>}
                  {!isClient && <td><StatusBadge status={doc.integrityStatus || 'NOT_ANCHORED'} /></td>}
                  <td className="whitespace-nowrap text-foreground-muted">{doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/app/documents/${doc.id}`} className="text-xs font-medium text-primary">Open</Link>
                      {role === 'judge' && (
                        <Button size="sm" variant="ghost" disabled={doc.integrityStatus !== 'ANCHORED'} onClick={() => selectDocument(doc)} title={doc.integrityStatus !== 'ANCHORED' ? 'Document has no blockchain anchor.' : 'Verify document integrity'}>
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verify Integrity
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const IntegrityResult: React.FC<{ state: 'verified' | 'tampered' | 'unavailable'; title: string; details: string[] }> = ({ state, title, details }) => (
  <div className={`space-y-2 rounded-[8px] border p-3 text-xs ${state === 'verified' ? 'border-success/30 bg-success-soft' : state === 'tampered' ? 'border-danger/30 bg-danger-soft' : 'border-warning/30 bg-warning-soft'}`}>
    <div className="flex items-center gap-2 font-semibold">
      {state === 'verified' ? <CheckCircle2 className="h-4 w-4 text-success" /> : state === 'tampered' ? <XCircle className="h-4 w-4 text-danger" /> : <ShieldCheck className="h-4 w-4 text-warning" />}
      {title}
    </div>
    {details.map((detail) => <div key={detail} className="break-all font-mono text-[11px]">{detail}</div>)}
  </div>
);
