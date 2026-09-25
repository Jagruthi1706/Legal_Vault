import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, FileText, Sparkles } from 'lucide-react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { PageHeader } from '../../components/common/PageHeader';
import { casesApi } from '../../services/casesApi';
import { documentsApi } from '../../services/documentsApi';
import type { CaseMetadata, DocumentMetadata } from '../../types/api';

const COLORS = ['#4F46E5', '#0284C7', '#059669', '#D97706', '#6366F1', '#64748B'];

export const DashboardPage: React.FC = () => {
  const { user, role } = useAuth();
  const isCitizen = role === 'client';
  const [cases, setCases] = useState<CaseMetadata[]>([]);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const [caseRes, docRes] = await Promise.all([casesApi.getCases(), documentsApi.getDocuments()]);
        setCases(caseRes.data || []);
        setDocuments(docRes.data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load authorized workspace data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const anchored = documents.filter((doc) => doc.integrityStatus === 'ANCHORED').length;
  const pendingCustody = Math.max(0, documents.length - anchored);
  const recentCases = [...cases].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 8);

  const typeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of cases) counts.set(item.caseType || 'OTHER', (counts.get(item.caseType || 'OTHER') || 0) + 1);
    return [...counts.entries()].map(([name, value], index) => ({ name, value, color: COLORS[index % COLORS.length] }));
  }, [cases]);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Workspace"
        title={user?.name ? `Welcome, ${user.name}` : 'Legal Vault'}
        description="What needs my attention — authorized cases, documents, and custody only."
        actions={
          <>
            <Link to="/app/cases"><Button variant="primary" size="sm" leftIcon={<Briefcase className="h-3.5 w-3.5" />}>{isCitizen ? 'My cases' : 'Open cases'}</Button></Link>
            <Link to="/app/evidence"><Button variant="outline" size="sm" leftIcon={<FileText className="h-3.5 w-3.5" />}>Evidence</Button></Link>
            {!isCitizen && <Link to="/app/ai-copilot"><Button variant="ai" size="sm" leftIcon={<Sparkles className="h-3.5 w-3.5" />}>Copilot</Button></Link>}
          </>
        }
      />

      {error && <ErrorState message={error} />}
      {loading && <LoadingState label="Loading authorized workspace data…" />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { title: 'Authorized cases', value: cases.length },
          { title: 'Case documents', value: documents.length },
          { title: 'Anchored documents', value: anchored },
          { title: 'Pending custody', value: pendingCustody },
        ].map((metric) => (
          <div key={metric.title} className="border-r border-border px-1 last:border-0">
            <div className="lv-label">{metric.title}</div>
            <div className="font-mono text-2xl font-semibold tabular-nums">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="lv-label">Recent authorized cases</div>
          {cases.length === 0 && !loading && <EmptyState title="No authorized cases" description="No cases were returned for this account." />}
          {recentCases.length > 0 && (
            <div className="lv-table-wrap">
              <table className="lv-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-mono text-[11px] text-primary">{item.caseNumber}</div>
                        <div className="font-medium">{item.title}</div>
                      </td>
                      <td className="text-foreground-muted">{item.caseType}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td className="whitespace-nowrap text-foreground-muted">{new Date(item.updatedAt).toLocaleString()}</td>
                      <td><Link to={`/app/cases/${item.id}`} className="text-xs font-medium text-primary">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="space-y-4 lg:col-span-4">
          <div className="lv-label">Cases by type</div>
          {typeDistribution.length === 0 ? (
            <EmptyState title="No chart data" description="Not enough authorized case data to chart." />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeDistribution} dataKey="value" nameKey="name" innerRadius={40} outerRadius={64} paddingAngle={3}>
                    {typeDistribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <EmptyState title="No hearing data connected" description="The hearing calendar integration has not been configured. Your case records remain available." />
        </div>
      </div>
    </div>
  );
};
