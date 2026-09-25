import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { casesApi } from '../../services/casesApi';
import type { CaseMetadata } from '../../types/api';

export const CasesPage: React.FC = () => {
  const { role } = useAuth();
  const [cases, setCases] = useState<CaseMetadata[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setCases((await casesApi.getCases()).data || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unable to load permitted cases.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = useMemo(
    () => cases.filter((item) => `${item.caseNumber} ${item.title} ${item.caseType}`.toLowerCase().includes(search.toLowerCase())),
    [cases, search],
  );

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Cases' }]} />
      <PageHeader
        title={role === 'judge' ? 'Assigned cases' : 'Permitted cases'}
        description="Live case records scoped by your authenticated access."
      />
      <div className="relative max-w-md">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-foreground-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cases" className="lv-input pl-9" />
      </div>
      {loading && <LoadingState label="Loading cases…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && visible.length === 0 && (
        <EmptyState title="No permitted cases" description="No cases were returned for this account." />
      )}
      {visible.length > 0 && (
        <div className="lv-table-wrap">
          <table className="lv-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Type</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="font-mono text-[11px] text-primary">{item.caseNumber}</div>
                    <div className="font-medium">{item.title}</div>
                  </td>
                  <td className="text-foreground-muted">{item.caseType}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="whitespace-nowrap text-foreground-muted">{new Date(item.updatedAt).toLocaleDateString()}</td>
                  <td><Link to={`/app/cases/${item.id}`} className="text-xs font-medium text-primary">Open workspace</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
