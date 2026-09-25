import React, { useEffect, useMemo, useState } from 'react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { casesApi } from '../../services/casesApi';
import { documentsApi } from '../../services/documentsApi';
import type { CaseMetadata, DocumentMetadata } from '../../types/api';

export const AnalyticsPage: React.FC = () => {
  const { role } = useAuth();
  const [cases, setCases] = useState<CaseMetadata[]>([]);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === 'client') return;
    void Promise.all([casesApi.getCases(), documentsApi.getDocuments()])
      .then(([c, d]) => {
        setCases(c.data || []);
        setDocuments(d.data || []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [role]);

  const metrics = useMemo(() => {
    const byStatus = (status: string) => cases.filter((item) => item.status === status).length;
    const anchored = documents.filter((doc) => doc.integrityStatus === 'ANCHORED').length;
    const evidence = cases.reduce((sum, item) => sum + (item.evidence?.length || 0), 0);
    return [
      ['Total cases', cases.length],
      ['Active', byStatus('ACTIVE')],
      ['Hearing', byStatus('HEARING')],
      ['Filed', byStatus('FILED')],
      ['Documents', documents.length],
      ['Anchored documents', anchored],
      ['Pending custody', Math.max(0, documents.length - anchored)],
      ['Evidence records', evidence],
    ] as Array<[string, number]>;
  }, [cases, documents]);

  if (role === 'client') {
    return <EmptyState title="Restricted" description="Judicial analytics are restricted for client accounts." />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Breadcrumb items={[{ label: 'Analytics' }]} />
      <div className="rounded-xl border border-lv-border bg-lv-surface p-5">
        <h1 className="font-heading text-xl font-extrabold">Authorized case analytics</h1>
        <p className="mt-1 text-xs text-lv-muted">Counts come only from APIs you are allowed to call. NJDG / bench performance charts are not configured.</p>
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metrics.map(([label, value]) => (
          <Card key={label} className="flex items-center justify-between p-4 text-xs">
            <span>{label}</span>
            <span className="font-mono text-lg font-bold">{value}</span>
          </Card>
        ))}
      </div>
    </div>
  );
};
