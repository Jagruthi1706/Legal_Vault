import React, { useState, useEffect } from 'react';
import { ShieldCheck, Copy, Check, Loader2, ExternalLink, AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { BlockchainRecord } from '../../types';
import { blockchainApi, BlockchainTransaction } from '../../services/blockchainApi';
import { TrustChecklist } from '../common/TrustChecklist';
import { EmptyState } from '../common/EmptyState';
import { HashBlock } from '../common/HashBlock';

interface BlockchainTabProps {
  blockchainRecord?: BlockchainRecord;
  caseId?: string;
  focusDocumentId?: string | null;
}

export const BlockchainTab: React.FC<BlockchainTabProps> = ({ caseId, focusDocumentId }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = React.useState(false);
  const [liveTransactions, setLiveTransactions] = useState<BlockchainTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchLiveData = async () => {
    if (!caseId) return;
    setLoading(true);
    setLiveError(null);
    try {
      const res = await blockchainApi.getCaseBlockchain(caseId);
      setLiveTransactions(res.data?.transactions || []);
      setLiveLoaded(true);
    } catch (err: unknown) {
      setLiveTransactions([]);
      setLiveLoaded(false);
      setLiveError(err instanceof Error ? err.message : 'Unable to load on-chain data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      void fetchLiveData();
    }
  }, [caseId]);

  if (!caseId) {
    return <EmptyState title="No case selected" description="Open a case workspace to look up on-chain custody." />;
  }

  const primary = (focusDocumentId
    ? liveTransactions.find((tx) => tx.documentId === focusDocumentId)
    : liveTransactions[0]) || liveTransactions[0];

  const headline = !liveLoaded
    ? 'Custody pending'
    : focusDocumentId
      ? primary
        ? 'Document anchor found'
        : 'Document not anchored'
      : 'Case blockchain custody';

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[10px] border border-info/20 bg-info-soft p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-info" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">{headline}</h4>
          <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
            {liveLoaded
              ? `${liveTransactions.length} on-chain anchor(s) found for this case.`
              : 'Showing only real on-chain Legal Vault anchors.'}
          </p>
          {primary && <p className="mt-2 text-[11px] text-success">✓ {focusDocumentId ? 'Document anchored on' : 'Anchors recorded on'} Ethereum Sepolia</p>}
        </div>
      </div>

      {liveError && (
        <div className="flex items-start gap-2 rounded-[8px] border border-warning/20 bg-warning-soft p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{liveError}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center py-4 text-xs text-foreground-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading live blockchain data...
        </div>
      )}

      {!loading && liveLoaded && !primary && (
        <EmptyState title="No on-chain anchors" description="No custody transactions have been recorded for this case yet." />
      )}

      {primary && (
        <div className="space-y-3 text-xs">
          <TrustChecklist
            title={focusDocumentId ? 'Document blockchain anchor' : 'Case blockchain custody'}
            tone="chain"
            items={[
              { label: 'SHA-256 fingerprint', ok: Boolean(primary.documentHash) },
              { label: 'Blockchain anchor', ok: Boolean(primary.transactionHash) },
              { label: 'Transaction confirmed', ok: Boolean(primary.status) },
            ]}
          />
          <HashBlock value={primary.documentHash} />
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            Technical details <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
          </button>
          {expanded && (
            <div className="space-y-3 font-mono">
              <div>
                <div className="lv-label">Transaction hash</div>
                <div className="lv-tech flex items-center justify-between break-all p-2">
                  <span>{primary.transactionHash}</span>
                  <button onClick={() => handleCopy(primary.transactionHash)} className="ml-2 shrink-0 text-foreground-muted" aria-label="Copy transaction hash">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="lv-label">Block</div>
                  <div className="mt-0.5 text-sm font-semibold">#{primary.blockNumber}</div>
                </div>
                <div>
                  <div className="lv-label">Status</div>
                  <div className="mt-0.5 text-sm font-semibold text-success">{primary.status}</div>
                </div>
              </div>
              <div className="space-y-1 border-t border-border pt-2 text-[11px] text-foreground-muted">
                <div>Network: <span className="font-semibold text-foreground">{primary.networkName || `Chain ${primary.chainId}`}</span></div>
                <div>Contract: <span className="font-semibold text-foreground">{primary.contractAddress}</span></div>
                <div>Timestamp: <span className="font-semibold text-foreground">{new Date(primary.createdAt).toLocaleString('en-IN')}</span></div>
                {primary.explorerTxUrl && (
                  <a href={primary.explorerTxUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-info">
                    View on explorer <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {liveTransactions.length > 1 && (
        <div className="space-y-2">
          <div className="lv-label">All anchors ({liveTransactions.length})</div>
          {liveTransactions.slice(1).map((tx) => (
            <div key={tx.id} className="lv-tech space-y-1 p-3 text-[10px]">
              <div className="flex justify-between">
                <span className="font-semibold">Tx: {tx.transactionHash.slice(0, 18)}...</span>
                <span className="text-success">Block #{tx.blockNumber}</span>
              </div>
              <div className="text-foreground-muted">
                {tx.eventType} • {new Date(tx.createdAt).toLocaleString('en-IN')}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => void fetchLiveData()}
        disabled={loading}
        className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        Refresh blockchain data
      </button>
    </div>
  );
};
