import React, { useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { MetaRow } from '../../components/common/MetaRow';
import { useCopilot } from '../../contexts/CopilotContext';
import { legalApi, type LegalSearchHit } from '../../services/legalApi';

export const LegalResearchPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [query, setQuery] = useState('');
  const [court, setCourt] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [sort, setSort] = useState<'relevance' | 'date'>('relevance');
  const [hits, setHits] = useState<LegalSearchHit[]>([]);
  const [selected, setSelected] = useState<{ id: string; title: string; text: string; provenance: LegalSearchHit['provenance'] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setIsOpen: setCopilotOpen, sendMessage, activeCaseContext } = useCopilot();

  const runSearch = async () => {
    if (!query.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setSelected(null);
      const result = await legalApi.search({
        query: query.trim(),
        court: court || undefined,
        documentType: (documentType || undefined) as 'judgment' | 'statute' | 'other' | undefined,
        jurisdiction: jurisdiction || undefined,
        sort,
      });
      setHits(result.data || []);
      setSearched(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Legal search is unavailable.');
      setHits([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      setSelected((await legalApi.getById(id)).data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authority detail is unavailable.');
    }
  };

  return (
    <div className="space-y-4">
      {!embedded && <Breadcrumb items={[{ label: 'Legal Research' }]} />}
      {!embedded && (
        <div>
          <div className="lv-label">Licensed legal corpus</div>
          <h1 className="text-xl font-semibold tracking-tight">Legal authorities</h1>
          <p className="mt-1 text-xs text-foreground-muted">
            Results are ranked by exact citation/title, article or section match, phrase, keywords, then vector similarity. This is not a commercial reporter database.
          </p>
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void runSearch()} placeholder="e.g. Article 21" className="lv-input xl:col-span-2" aria-label="Search query" />
        <input value={court} onChange={(e) => setCourt(e.target.value)} placeholder="Court" className="lv-input" aria-label="Court filter" />
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="lv-input" aria-label="Document type">
          <option value="">All types</option>
          <option value="judgment">Judgment</option>
          <option value="statute">Statute</option>
          <option value="other">Other</option>
        </select>
        <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="Jurisdiction" className="lv-input" aria-label="Jurisdiction filter" />
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={sort} onChange={(e) => setSort(e.target.value as 'relevance' | 'date')} className="lv-input max-w-[200px]" aria-label="Sort">
          <option value="relevance">Sort: relevance</option>
          <option value="date">Sort: date</option>
        </select>
        <Button variant="primary" size="sm" disabled={loading} onClick={() => void runSearch()}>{loading ? 'Searching…' : 'Search'}</Button>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <LoadingState label="Searching licensed authorities…" />}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <div className="lv-label">Search results ({hits.length})</div>
          {!searched && <EmptyState title="No search yet" description="Enter a query. Placeholder judgments are not shown." />}
          {searched && hits.length === 0 && !error && <EmptyState title="Insufficient authorities" description="No matching records in the licensed corpus." />}
          <div className="divide-y divide-border overflow-y-auto lg:max-h-[70vh]">
            {hits.map((hit) => (
              <button
                key={`${hit.id}-${hit.pageOrSection}`}
                type="button"
                onClick={() => void openDetail(hit.id)}
                className="w-full space-y-1 px-1 py-3 text-left transition-colors duration-150 hover:bg-surface-subtle"
              >
                <div className="font-mono text-[11px] text-primary">{hit.provenance.citation || 'Citation not recorded'}</div>
                <div className="text-sm font-semibold text-foreground">{hit.title}</div>
                <div className="text-[11px] text-foreground-muted">{hit.provenance.court || 'Court not recorded'} · {hit.provenance.documentType}</div>
                {hit.excerpt && <p className="line-clamp-2 text-xs text-foreground-muted">{hit.excerpt}</p>}
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="lv-label">Authority</div>
          {selected ? (
            <div className="space-y-2 rounded-[10px] border border-info/20 bg-info-soft/40 p-4 text-xs">
              <div className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-info" /> {selected.title}</div>
              <MetaRow label="Court">{selected.provenance.court || 'Not recorded'}</MetaRow>
              <MetaRow label="Date">{selected.provenance.judgmentDate || 'Not recorded'}</MetaRow>
              <MetaRow label="Citation">{selected.provenance.citation || 'Not recorded'}</MetaRow>
              <MetaRow label="Jurisdiction">{selected.provenance.jurisdiction}</MetaRow>
              <MetaRow label="Source">{selected.provenance.source}</MetaRow>
              <MetaRow label="License">{selected.provenance.license}</MetaRow>
              <MetaRow label="Official URL">
                {selected.provenance.sourceUrl ? (
                  <a className="break-all text-primary underline" href={selected.provenance.sourceUrl} target="_blank" rel="noreferrer">{selected.provenance.sourceUrl}</a>
                ) : 'Not recorded'}
              </MetaRow>
              {selected.provenance.sourceUrl?.includes('123456789/15240') && (
                <p className="text-[11px] text-warning">This URL is the India Code Constitution record. Multiple articles share that official handle; provenance was not rewritten.</p>
              )}
              <div className="whitespace-pre-wrap leading-relaxed text-foreground">{selected.text}</div>
              {activeCaseContext?.caseId && (
                <Button size="sm" variant="ai" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => { setCopilotOpen(true); sendMessage(`Research licensed authorities related to: ${selected.title}`); }}>
                  Ask case copilot
                </Button>
              )}
            </div>
          ) : (
            <EmptyState title="Authority detail" description="Select an authority to read the stored excerpt and provenance." />
          )}
        </div>
      </div>
    </div>
  );
};
