import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { blockchainApi, BlockchainTransaction, VerifyResponse } from '../../services/blockchainApi';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { can } from '../../utils/permissions';

export const BlockchainPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const [hashInput, setHashInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyResponse['data'] | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState('Ethereum Sepolia');
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoadingTx(true);
    setLoadError(null);
    try {
      const [txRes, networkRes] = await Promise.all([
        blockchainApi.getTransactions(),
        blockchainApi.getNetworkStatus(),
      ]);
      setTransactions(txRes.data || []);
      setNetworkName(networkRes.data.networkName);
      setContractAddress(networkRes.data.contractAddress);
      setChainId(networkRes.data.chainId);
    } catch (err: any) {
      setTransactions([]);
      setLoadError(err?.message || 'Failed to load blockchain data');
      toast.error(err?.message || 'Failed to load transactions');
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void fetchTransactions();
    }
  }, [isAuthenticated]);

  const handleVerifyHash = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = hashInput.trim();
    if (!trimmed) return;

    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await blockchainApi.verifyDocument({ documentHash: trimmed });
      setVerifyResult(res.data);
      if (res.data.verified) {
        toast.success('SHA-256 hash verified on-chain');
      } else {
        toast.error(res.data.status || res.data.reason || 'Hash not verified on-chain');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-16 text-xs text-foreground-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Checking authentication...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto space-y-4 p-6 bg-surface border border-border rounded-xl">
        <h1 className="text-lg font-extrabold font-heading">Authentication required</h1>
        <p className="text-xs text-foreground-muted">
          Sign in to view real LegalVault on-chain anchors. No mock blockchain data is shown here.
        </p>
        <Link to="/login">
          <Button variant="primary">Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Blockchain Ledger' }]} />

      <div className="p-6 bg-surface border border-border rounded-xl shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-surface-subtle text-foreground">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold font-heading text-foreground">
              LegalVault Blockchain Ledger
            </h1>
            <p className="text-xs text-foreground-muted">
              {networkName}
              {chainId != null ? ` · Chain ID ${chainId}` : ''}
              {contractAddress ? ` · Contract ${contractAddress.slice(0, 10)}…` : ''}
            </p>
          </div>
        </div>
        {can({ role }, 'anchorCustody') ? <Link to="/app/evidence/upload" className="text-xs font-semibold underline">Open document anchor demo</Link> : <p className="text-xs text-foreground-muted">Custody anchoring is available to participating lawyers; official verification is judge-only.</p>}
      </div>

      {can({ role }, 'officialVerify') ? <Card className="p-5 space-y-3">
        <h3 className="font-heading font-extrabold text-sm text-foreground">
          Inspect & Verify SHA-256 Document Hash
        </h3>
        <form onSubmit={handleVerifyHash} className="flex gap-2">
          <input
            type="text"
            value={hashInput}
            onChange={(e) => {
              setHashInput(e.target.value);
              setVerifyResult(null);
            }}
            placeholder="Paste SHA-256 hash (64 hex chars)"
            className="flex-1 p-2.5 rounded-lg bg-surface-subtle border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
          />
          <Button variant="primary" type="submit" disabled={verifying}>
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify On-chain'}
          </Button>
        </form>

        {verifyResult && (
          <div
            className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
              verifyResult.verified
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}
          >
            <span className="flex items-center gap-2 font-bold">
              {verifyResult.verified ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  VERIFIED — on-chain LegalVault match
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  {verifyResult.status || verifyResult.reason || 'Not verified'}
                </>
              )}
            </span>
          </div>
        )}
      </Card> : <Card className="p-5 text-xs text-foreground-muted">Official blockchain verification is a judicial action. Your authenticated role can view the custody history permitted for your cases, but cannot perform verification.</Card>}

      <div className="bg-surface border border-border rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="font-heading font-extrabold text-sm text-foreground">
            Recent On-chain Anchors
          </div>
          <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loadingTx}>
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTx ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loadError && (
          <div className="p-3 rounded-lg border border-red-200 text-xs text-red-700 dark:text-red-300">
            {loadError}
          </div>
        )}

        {loadingTx ? (
          <div className="flex items-center justify-center p-10 text-xs text-foreground-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading blockchain transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-foreground-muted border border-dashed border-border rounded-xl">
            No blockchain anchors recorded yet. Use the document demo to upload and anchor a hash.
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 rounded-xl bg-surface-subtle border border-border space-y-2 text-xs font-mono"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    Tx: {tx.transactionHash.slice(0, 18)}...{tx.transactionHash.slice(-6)}
                    <button
                      onClick={() => handleCopy(tx.transactionHash)}
                      className="text-foreground-muted hover:text-foreground"
                    >
                      {copiedHash === tx.transactionHash ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-success-soft text-success dark:text-emerald-400 font-bold text-[10px]">
                      Block #{tx.blockNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      {tx.status}
                    </span>
                  </div>
                </div>

                {tx.case && (
                  <div className="text-foreground font-sans font-semibold">
                    Case: {tx.case.caseNumber} • {tx.case.title}
                  </div>
                )}

                {tx.document && (
                  <div className="text-[11px] text-foreground-muted">
                    Document: {tx.document.originalFileName}
                  </div>
                )}

                <div className="text-[11px] text-foreground-muted flex flex-wrap items-center gap-2">
                  <span>{tx.networkName || `Chain ${tx.chainId}`}</span>
                  <span>•</span>
                  <span>Contract: {tx.contractAddress.slice(0, 10)}...{tx.contractAddress.slice(-4)}</span>
                  <span>•</span>
                  <span>Event: {tx.eventType}</span>
                  <span>•</span>
                  <span>{formatDate(tx.createdAt)}</span>
                </div>

                {tx.explorerTxUrl && (
                  <a
                    href={tx.explorerTxUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold"
                  >
                    View on Sepolia Etherscan <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <div className="pt-1 border-t border-border text-[10px] text-foreground-muted dark:text-[#71717A] flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  SHA-256: {tx.documentHash}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
