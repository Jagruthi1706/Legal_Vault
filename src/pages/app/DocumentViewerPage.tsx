import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, ShieldCheck } from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { HashBlock } from '../../components/common/HashBlock';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { BlockchainTab } from '../../components/workspace/BlockchainTab';
import { documentsApi } from '../../services/documentsApi';
import type { DocumentMetadata } from '../../types/api';

export const DocumentViewerPage: React.FC = () => {
  const { docId } = useParams<{ docId?: string }>();
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;
    void (async () => {
      try {
        setLoading(true);
        setDocument((await documentsApi.getDocumentById(docId)).data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Document not found or not authorized.');
      } finally {
        setLoading(false);
      }
    })();
  }, [docId]);

  if (loading) return <LoadingState label="Loading authorized document…" />;
  if (error || !document) return <ErrorState message={error || 'Document not found or not authorized.'} />;

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Documents', href: '/app/documents' }, { label: document.originalFileName }]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" /> {document.originalFileName}</div>
          <div className="text-xs text-foreground-muted">Type: {document.documentType}</div>
          <HashBlock value={document.sha256Hash} />
          <StatusBadge status={document.integrityStatus || 'NOT_ANCHORED'} />
          {document.integrityStatus === 'ANCHORED' && (
            <div className="text-[11px] text-success">✓ Anchored on Ethereum Sepolia</div>
          )}
          <EmptyState title="Preview not configured" description="In-browser PDF rendering is not configured. Download remains available from the case workspace for authorized users." />
        </div>
        <div className="space-y-4 lg:col-span-5">
          <div className="text-xs text-foreground-muted">
            Synthetic document summaries, invented probabilities, and mock examination questions are disabled. Use the case workspace copilot for case-scoped answers with sources.
          </div>
          <div>
            <div className="lv-label mb-2 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Custody</div>
            <BlockchainTab caseId={document.caseId} focusDocumentId={document.id} />
          </div>
        </div>
      </div>
    </div>
  );
};
