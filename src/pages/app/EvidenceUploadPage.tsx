import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Upload,
  Link2,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { FileUploadZone, FileItem } from '../../components/common/FileUploadZone';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../contexts/AuthContext';
import { casesApi } from '../../services/casesApi';
import { documentsApi } from '../../services/documentsApi';
import type { TamperCheckResult } from '../../services/documentsApi';
import { blockchainApi, VerifyResponse } from '../../services/blockchainApi';
import { DocumentMetadata } from '../../types/api';
import {
  toAnchorState,
  toUploadedDoc,
  type RestoredAnchorState,
  type RestoredUploadedDocument,
} from '../../utils/documentRestore';
import toast from 'react-hot-toast';
import { getEvidenceWorkflowVisibility } from '../../utils/permissions';

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

const SELECTED_CASE_KEY = 'legal_vault_demo_case_id';
const SELECTED_DOC_KEY = 'legal_vault_demo_document_id';

const CARD =
  'mb-6 rounded-xl border border-border bg-surface p-6 shadow-2xs';
const HASH =
  'break-all rounded border border-border bg-surface-subtle px-2 py-1 font-mono text-xs text-foreground-muted';
const TITLE = 'font-semibold text-foreground';
const ANCHORED_BADGE =
  'rounded-full border border-success/50 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success';
const PERSISTED_BADGE =
  'rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning';

export const EvidenceUploadPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState(() => localStorage.getItem(SELECTED_CASE_KEY) || '');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [caseDocuments, setCaseDocuments] = useState<DocumentMetadata[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [networkLabel, setNetworkLabel] = useState('Ethereum Sepolia');
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<RestoredUploadedDocument | null>(null);
  const [anchor, setAnchor] = useState<RestoredAnchorState | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse['data'] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Tamper detection (read-only; never anchors candidate)
  const [tamperOriginalId, setTamperOriginalId] = useState('');
  const [tamperCandidate, setTamperCandidate] = useState<File | null>(null);
  const [tamperComparing, setTamperComparing] = useState(false);
  const [tamperResult, setTamperResult] = useState<TamperCheckResult | null>(null);
  const tamperFileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || null;
  const visibility = getEvidenceWorkflowVisibility(user);
  // Clients must never see technical custody detail (SHA-256, transaction
  // hashes, anchoring, verification, tamper detection). The backend continues
  // to hash, store and anchor documents; only the client-facing presentation is
  // reduced to plain-language upload status.
  const showCustodyDetails = user?.role !== 'client';
  const isAlreadyAnchored =
    uploadedDoc?.integrityStatus === 'ANCHORED' || Boolean(anchor?.alreadyAnchored);

  const anchoredDocuments = caseDocuments.filter(
    (d) => d.integrityStatus === 'ANCHORED' || Boolean(d.lastTransactionHash),
  );
  const tamperOriginal =
    anchoredDocuments.find((d) => d.id === tamperOriginalId) || null;

  const applyDocumentSelection = useCallback((doc: DocumentMetadata | null) => {
    if (!doc) {
      setUploadedDoc(null);
      setAnchor(null);
      setVerifyResult(null);
      localStorage.removeItem(SELECTED_DOC_KEY);
      return;
    }

    setUploadedDoc(toUploadedDoc(doc));
    const restoredAnchor = toAnchorState(doc);
    setAnchor(restoredAnchor);
    setVerifyResult(null);
    localStorage.setItem(SELECTED_DOC_KEY, doc.id);

    if (restoredAnchor) {
      setNetworkLabel(restoredAnchor.networkName);
      if (restoredAnchor.contractAddress) {
        setContractAddress(restoredAnchor.contractAddress);
      }
    }
  }, []);

  const loadCaseDocuments = useCallback(
    async (caseId: string, preferredDocumentId?: string | null) => {
      if (!caseId) {
        setCaseDocuments([]);
        applyDocumentSelection(null);
        return;
      }

      setLoadingDocuments(true);
      try {
        const res = await documentsApi.getDocuments(caseId);
        const docs = res.data || [];
        setCaseDocuments(docs);

        const preferredId = preferredDocumentId || localStorage.getItem(SELECTED_DOC_KEY);
        const preferred = preferredId ? docs.find((d) => d.id === preferredId) : undefined;
        const selected = preferred || docs[0] || null;
        applyDocumentSelection(selected);
      } catch (err: any) {
        setCaseDocuments([]);
        applyDocumentSelection(null);
        toast.error(err?.message || 'Failed to load persisted documents');
      } finally {
        setLoadingDocuments(false);
      }
    },
    [applyDocumentSelection],
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const load = async () => {
      setLoadingCases(true);
      try {
        const [casesRes, networkRes] = await Promise.all([
          casesApi.getCases(),
          blockchainApi.getNetworkStatus(),
        ]);
        const list = (casesRes.data || []).map((c: any) => ({
          id: c.id,
          caseNumber: c.caseNumber,
          title: c.title,
        }));
        setCases(list);

        const savedCaseId = localStorage.getItem(SELECTED_CASE_KEY);
        const nextCaseId =
          (savedCaseId && list.some((c) => c.id === savedCaseId) && savedCaseId) ||
          list[0]?.id ||
          '';
        setSelectedCaseId(nextCaseId);
        if (nextCaseId) {
          localStorage.setItem(SELECTED_CASE_KEY, nextCaseId);
        }

        setNetworkLabel(networkRes.data.networkName || 'Ethereum Sepolia');
        setContractAddress(networkRes.data.contractAddress);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load demo cases');
      } finally {
        setLoadingCases(false);
      }
    };

    void load();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !selectedCaseId) return;
    localStorage.setItem(SELECTED_CASE_KEY, selectedCaseId);
    setTamperCandidate(null);
    setTamperResult(null);
    void loadCaseDocuments(selectedCaseId);
  }, [isAuthenticated, selectedCaseId, loadCaseDocuments]);

  useEffect(() => {
    const anchored = caseDocuments.filter(
      (d) => d.integrityStatus === 'ANCHORED' || Boolean(d.lastTransactionHash),
    );
    if (anchored.length === 0) {
      setTamperOriginalId('');
      return;
    }
    setTamperOriginalId((prev) =>
      prev && anchored.some((d) => d.id === prev) ? prev : anchored[0].id,
    );
  }, [caseDocuments]);

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 1800);
  };

  const handleUpload = async () => {
    if (!selectedCaseId) {
      toast.error('Select a real case before uploading.');
      return;
    }
    if (files.length === 0 || !files[0].fileObj) {
      toast.error('Select a file to upload.');
      return;
    }

    setUploading(true);
    setVerifyResult(null);

    try {
      const response = await documentsApi.uploadDocument(
        files[0].fileObj,
        selectedCaseId,
        'EVIDENCE',
      );
      const created = response.data;
      toast.success('Document persisted. Backend SHA-256 calculated from file bytes.');

      const refreshed = await documentsApi.getDocuments(selectedCaseId);
      const docs = refreshed.data || [];
      setCaseDocuments(docs);
      const selected = docs.find((d) => d.id === created.id) || created;
      applyDocumentSelection(selected);
      setFiles([]);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAnchor = async () => {
    if (!uploadedDoc) {
      toast.error('Upload a document first.');
      return;
    }

    if (isAlreadyAnchored && anchor) {
      toast.success('Document hash is already anchored on-chain.');
      return;
    }

    setAnchoring(true);
    setVerifyResult(null);
    try {
      const response = await blockchainApi.anchorDocument({
        documentId: uploadedDoc.id,
        caseId: uploadedDoc.caseId,
        documentHash: uploadedDoc.sha256Hash,
        eventType: 'EVIDENCE_UPLOAD',
      });

      setAnchor({
        transactionHash: response.data.blockchain.transactionHash,
        blockNumber: response.data.blockchain.blockNumber,
        contractAddress: response.data.blockchain.contractAddress,
        chainId: response.data.blockchain.chainId,
        networkName: response.data.blockchain.networkName,
        status: response.data.blockchain.confirmationStatus.toUpperCase(),
        explorerTxUrl: response.data.explorerTxUrl,
        documentHash: response.data.documentHash,
        alreadyAnchored: false,
      });
      setUploadedDoc((prev) =>
        prev ? { ...prev, integrityStatus: 'ANCHORED' } : prev,
      );
      setNetworkLabel(response.data.blockchain.networkName);
      setContractAddress(response.data.blockchain.contractAddress);
      toast.success('SHA-256 anchored on-chain via LegalVault smart contract.');
      await loadCaseDocuments(uploadedDoc.caseId, uploadedDoc.id);
    } catch (err: any) {
      const message = err?.message || 'Anchoring failed';
      if (/already anchored/i.test(message)) {
        toast.error(message);
        await loadCaseDocuments(uploadedDoc.caseId, uploadedDoc.id);
      } else {
        toast.error(message);
      }
    } finally {
      setAnchoring(false);
    }
  };

  const handleVerify = async () => {
    if (!uploadedDoc) {
      toast.error('Select or upload a document first.');
      return;
    }

    setVerifying(true);
    try {
      const response = await blockchainApi.verifyDocument({
        documentId: uploadedDoc.id,
      });
      setVerifyResult(response.data);
      if (response.data.verified) {
        toast.success('On-chain verification: VERIFIED');
      } else {
        toast.error(response.data.status || response.data.reason || 'Not verified');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleTamperCompare = async () => {
    if (!tamperOriginalId) {
      toast.error('Select an original anchored document first.');
      return;
    }
    if (!tamperCandidate) {
      toast.error('Select a candidate file to compare.');
      return;
    }

    setTamperComparing(true);
    setTamperResult(null);
    try {
      const response = await documentsApi.tamperCheck(tamperOriginalId, tamperCandidate);
      setTamperResult(response.data);
      if (response.data.hashMatches) {
        toast.success('VERIFIED — file unmodified');
      } else {
        toast.error('TAMPER DETECTED — hash mismatch');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Tamper comparison failed');
    } finally {
      setTamperComparing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-16 text-xs text-foreground-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Checking authentication...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto space-y-4 p-6 bg-surface border border-border rounded-xl">
        <h1 className="text-lg font-extrabold font-heading">Authentication required</h1>
        <p className="text-xs text-foreground-muted">
          Sign in with a backend account before running the Ethereum Sepolia document demo.
        </p>
        <Link to="/login">
          <Button variant="primary">Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb items={[{ label: 'Ethereum Sepolia Document Demo' }]} />

      <div className={`${CARD} space-y-2`}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-surface-subtle p-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground md:text-2xl">
              LegalVault On-chain Anchor Demo
            </h1>
            <p className="text-sm text-foreground-muted">
              Upload → SHA-256 from file bytes → LegalVault smart contract on {networkLabel} → verify
            </p>
          </div>
        </div>
        <div className="font-mono text-xs text-foreground-muted">
          Signed in as {user.name} ({user.email}) · role {user.role}
        </div>
      </div>

      <div className={`${CARD} space-y-3`}>
        <h2 className={`text-sm ${TITLE}`}>1. Select Case</h2>
        {loadingCases ? (
          <div className="text-xs flex items-center gap-2 text-foreground-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading cases...
          </div>
        ) : cases.length === 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            No case participants found for this user. Run the demo seed, then refresh.
          </p>
        ) : (
          <select
            value={selectedCaseId}
            onChange={(e) => {
              setSelectedCaseId(e.target.value);
              setVerifyResult(null);
            }}
            className="w-full rounded-lg border border-border bg-surface-subtle p-2.5 text-xs text-foreground"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.caseNumber} — {c.title}
              </option>
            ))}
          </select>
        )}
        {selectedCase && (
          <div className={`mt-1 ${HASH}`}>
            Case ID: {selectedCase.id}
          </div>
        )}
      </div>

      <div className={CARD}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className={`text-sm ${TITLE}`}>Persisted Documents (from database)</h2>
          {loadingDocuments && (
            <span className="flex items-center gap-1 text-[11px] text-foreground-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Restoring...
            </span>
          )}
        </div>
        {caseDocuments.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No persisted documents for this case yet. Upload a file below.
          </p>
        ) : (
          <div className="space-y-2">
            {caseDocuments.map((doc) => {
              const anchored = doc.integrityStatus === 'ANCHORED' || Boolean(doc.lastTransactionHash);
              const selected = uploadedDoc?.id === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => applyDocumentSelection(doc)}
                  className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                    selected
                      ? 'border-border-strong bg-surface-subtle'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={TITLE}>{doc.originalFileName}</span>
                    <span className={anchored ? ANCHORED_BADGE : PERSISTED_BADGE}>
                      {anchored ? 'Already Anchored' : 'Persisted'}
                    </span>
                  </div>
                  {showCustodyDetails && <div className={`mt-2 ${HASH}`}>{doc.sha256Hash}</div>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {visibility.uploadEvidence && (
        <div className={CARD}>
          <h2 className={`mb-4 text-sm ${TITLE}`}>2. Upload Document</h2>
          <FileUploadZone
            title="Select a legal document or evidence file"
            description={
              showCustodyDetails
                ? 'The backend calculates the authoritative SHA-256 hash from the uploaded file bytes and stores the file locally.'
                : 'Choose a file to file with your case. Accepted types include PDF, Word, images, video and text up to 25 MB.'
            }
            allowedExtensions=".pdf,.doc,.docx,.png,.jpg,.jpeg,.mp4,.txt,.csv,.log"
            maxSizeMB={25}
            initialFiles={files}
            onFilesUpdated={setFiles}
            vaultCertified={false}
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={uploading}
              onClick={handleUpload}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload & Persist Document
            </button>
          </div>
        </div>
      )}

      {uploadedDoc && showCustodyDetails && (
        <div className={`${CARD} space-y-3 text-xs`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={`text-sm ${TITLE}`}>3. Document & SHA-256 Document Hash</h2>
            {isAlreadyAnchored && <span className={ANCHORED_BADGE}>Already Anchored</span>}
          </div>
          <div>File: <span className={TITLE}>{uploadedDoc.originalFileName}</span></div>
          <div>Document ID: <span className={HASH}>{uploadedDoc.id}</span></div>
          <div>
            Persistence status:{' '}
            <span className={PERSISTED_BADGE}>{uploadedDoc.persistenceStatus}</span>
          </div>
          <div>
            Blockchain status:{' '}
            {isAlreadyAnchored ? (
              <span className={ANCHORED_BADGE}>Already Anchored</span>
            ) : (
              <span className={PERSISTED_BADGE}>{uploadedDoc.integrityStatus}</span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <div className={`flex-1 ${HASH}`}>SHA-256: {uploadedDoc.sha256Hash}</div>
            <button type="button" onClick={() => handleCopy(uploadedDoc.sha256Hash)} className="shrink-0 text-foreground-muted hover:text-foreground">
              {copied === uploadedDoc.sha256Hash ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="pt-2 flex flex-wrap gap-2">
            {visibility.anchorCustody && !isAlreadyAnchored ? (
              <Button
                variant="primary"
                onClick={handleAnchor}
                isLoading={anchoring}
                leftIcon={<Link2 className="w-4 h-4" />}
              >
                Anchor Hash on Ethereum
              </Button>
            ) : visibility.anchorCustody ? (
              <Button variant="outline" disabled>
                Already Anchored
              </Button>
            ) : null}
            {visibility.officialVerify && <Button variant="outline" onClick={handleVerify} isLoading={verifying}>
              Verify Against Blockchain
            </Button>}
          </div>
        </div>
      )}

      {showCustodyDetails && <div className={`${CARD} space-y-2 text-xs`}>
        <h2 className={`text-sm ${TITLE}`}>4. Ethereum Network & LegalVault Smart Contract</h2>
        <div>Network: <span className={TITLE}>{networkLabel}</span></div>
        <div>Contract address: <span className={HASH}>{contractAddress || 'Not configured'}</span></div>
        <div>
          Anchor status:{' '}
          {anchor?.alreadyAnchored ? (
            <span className={ANCHORED_BADGE}>Already Anchored</span>
          ) : (
            <span className={PERSISTED_BADGE}>{anchor?.status || 'Not anchored yet'}</span>
          )}
        </div>
      </div>}

      {/* Client-facing confirmation. Every technical custody panel above is
          suppressed for clients, so without this block a client would receive
          no feedback at all that their filing succeeded. */}
      {uploadedDoc && !showCustodyDetails && (
        <div className={`${CARD} space-y-2 text-xs`}>
          <h2 className={`text-sm ${TITLE}`}>Document filed</h2>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Your document has been received and stored securely.</span>
          </div>
          <div>
            File: <span className={TITLE}>{uploadedDoc.originalFileName}</span>
          </div>
          {selectedCase && (
            <div>
              Case: <span className={TITLE}>{selectedCase.caseNumber} — {selectedCase.title}</span>
            </div>
          )}
          <p className="text-foreground-muted">
            The court and your advocate can access this filing as authorized. You can file additional
            documents for this case at any time.
          </p>
        </div>
      )}

      {anchor && showCustodyDetails && (
        <div className={`${CARD} space-y-2 text-xs`}>
          <h2 className={`text-sm ${TITLE}`}>5. On-chain Anchor</h2>
          <div>
            Status:{' '}
            {anchor.alreadyAnchored ? (
              <span className={ANCHORED_BADGE}>Already Anchored</span>
            ) : (
              <span className={PERSISTED_BADGE}>{anchor.status}</span>
            )}
          </div>
          <div>Transaction hash: <span className={HASH}>{anchor.transactionHash}</span></div>
          <div>Block number: #{anchor.blockNumber}</div>
          <div>Chain ID: {anchor.chainId}</div>
          <div>Document hash anchored: <span className={HASH}>{anchor.documentHash}</span></div>
          {anchor.explorerTxUrl ? (
            <a
              href={anchor.explorerTxUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold"
            >
              View on Sepolia Etherscan <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <p className="text-amber-700 dark:text-amber-300">
              No public explorer link for this chain ID ({anchor.chainId}).
            </p>
          )}
        </div>
      )}

      {visibility.officialVerify && verifyResult && showCustodyDetails && (
        <div
          className={`p-5 rounded-xl border text-xs space-y-2 ${
            verifyResult.verified
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
          }`}
        >
          <h2 className="font-heading font-extrabold text-sm flex items-center gap-2">
            {verifyResult.verified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            Blockchain Verification: {verifyResult.status || (verifyResult.verified ? 'VERIFIED' : 'FAILED')}
          </h2>
          {verifyResult.reason && <p>{verifyResult.reason}</p>}
          {verifyResult.currentHash && (
            <div className={HASH}>Current file SHA-256: {verifyResult.currentHash}</div>
          )}
          {verifyResult.onChain && (
            <div className="font-mono text-[11px]">
              On-chain actor: {verifyResult.onChain.actor} · event: {verifyResult.onChain.eventType}
            </div>
          )}
        </div>
      )}

      {visibility.tamperDetection && showCustodyDetails && <div className={`${CARD} space-y-4 text-xs`}>
        <div>
          <h2 className={`text-sm ${TITLE}`}>6. Tamper Detection</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Compare a candidate file&apos;s SHA-256 against an original blockchain-anchored fingerprint.
            This is read-only: the candidate is never persisted or anchored.
          </p>
        </div>

        {anchoredDocuments.length === 0 ? (
          <p className="text-amber-700 dark:text-amber-300">
            Anchor at least one document on Ethereum Sepolia before running tamper detection.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <label className="font-semibold">Select Original Anchored Evidence</label>
              <select
                value={tamperOriginalId}
                onChange={(e) => {
                  setTamperOriginalId(e.target.value);
                  setTamperResult(null);
                }}
                className="w-full rounded-lg border border-border bg-surface-subtle p-2.5 text-xs text-foreground"
              >
                {anchoredDocuments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.originalFileName}
                  </option>
                ))}
              </select>
            </div>

            {tamperOriginal && (
              <div className="space-y-2 rounded-lg border border-border bg-surface-subtle p-3">
                <div className={HASH}>
                  Original SHA-256: {tamperOriginal.sha256Hash}
                </div>
                <div className={ANCHORED_BADGE}>
                  Anchored on {networkLabel}
                </div>
                {tamperOriginal.lastTransactionHash && (
                  <div className={HASH}>
                    Anchor tx: {tamperOriginal.lastTransactionHash}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <input
                ref={tamperFileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setTamperCandidate(file);
                  setTamperResult(null);
                }}
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => tamperFileInputRef.current?.click()}
              >
                Select Candidate File
              </Button>
              {tamperCandidate && (
                <div className="text-[11px]">
                  Candidate: <span className="font-semibold">{tamperCandidate.name}</span>
                  <span className="text-foreground-muted"> · {tamperCandidate.size} bytes</span>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              onClick={handleTamperCompare}
              isLoading={tamperComparing}
              disabled={!tamperOriginalId || !tamperCandidate}
            >
              Compare With Original
            </Button>
          </>
        )}

        {tamperResult && (
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              tamperResult.hashMatches
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="font-heading font-extrabold text-sm flex items-center gap-2">
              {tamperResult.hashMatches ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  VERIFIED — FILE UNMODIFIED
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  TAMPER DETECTED
                </>
              )}
            </div>
            <p>{tamperResult.message}</p>
            <div className={`font-mono break-all ${HASH}`}>Original SHA-256: {tamperResult.originalHash}</div>
            <div className={`font-mono break-all ${HASH}`}>Candidate SHA-256: {tamperResult.candidateHash}</div>
            <div>
              Blockchain: <span className="font-semibold">{tamperResult.network}</span>
              {tamperResult.chainId != null ? ` · Chain ID ${tamperResult.chainId}` : ''}
            </div>
            <div className={HASH}>
              Original anchor: {tamperResult.transactionHash}
              {tamperResult.blockNumber != null ? ` · Block #${tamperResult.blockNumber}` : ''}
            </div>
            {tamperResult.explorerTxUrl && (
              <a
                href={tamperResult.explorerTxUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold"
              >
                View original anchor on Sepolia Etherscan <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <p className="text-[11px] text-foreground-muted">
              No blockchain transaction was created for the candidate file.
              Candidate persisted: {String(tamperResult.candidatePersisted)} ·
              Blockchain tx created: {String(tamperResult.blockchainTransactionCreated)}
            </p>
          </div>
        )}
      </div>}
    </div>
  );
};
