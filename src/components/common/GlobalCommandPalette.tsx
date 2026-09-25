import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Briefcase, BookOpen, Sparkles, Shield, ArrowRight, Scale } from 'lucide-react';
import { useCommandPalette } from '../../contexts/CommandPaletteContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCopilot } from '../../contexts/CopilotContext';
import { casesApi } from '../../services/casesApi';
import { documentsApi } from '../../services/documentsApi';
import { legalApi, type LegalSearchHit } from '../../services/legalApi';
import type { CaseMetadata, DocumentMetadata, EvidenceMetadata } from '../../types/api';

export const GlobalCommandPalette: React.FC = () => {
  const { isOpen, closePalette } = useCommandPalette();
  const { role } = useAuth();
  const { setIsOpen: setCopilotOpen, sendMessage } = useCopilot();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cases, setCases] = useState<CaseMetadata[]>([]);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [authorities, setAuthorities] = useState<LegalSearchHit[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      try {
        setLoadError(null);
        const [caseRes, docRes] = await Promise.all([casesApi.getCases(), documentsApi.getDocuments()]);
        setCases(caseRes.data || []);
        setDocuments(docRes.data || []);
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load authorized records.');
        setCases([]);
        setDocuments([]);
      }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setAuthorities([]);
      return;
    }
    const timer = setTimeout(() => {
      void legalApi.search({ query: query.trim() }).then((res) => setAuthorities(res.data || [])).catch(() => setAuthorities([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [isOpen, query]);

  if (!isOpen) return null;

  const handleNavigate = (path: string) => {
    navigate(path);
    closePalette();
    setQuery('');
  };

  const q = query.toLowerCase();
  const filteredCases = cases.filter((item) => `${item.title} ${item.caseNumber} ${item.caseType}`.toLowerCase().includes(q));
  const filteredDocs = documents.filter((item) => `${item.originalFileName} ${item.documentType}`.toLowerCase().includes(q));
  const evidence: EvidenceMetadata[] = cases.flatMap((item) => item.evidence || []).filter((item) => `${item.title} ${item.evidenceNumber}`.toLowerCase().includes(q));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closePalette} className="fixed inset-0 bg-black/50" />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-lv-border bg-lv-surface shadow-2xl">
          <div className="flex items-center border-b border-lv-border px-4 py-3">
            <Search className="mr-3 h-5 w-5 shrink-0 text-lv-muted" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search authorized cases, documents, evidence, authorities" className="w-full bg-transparent text-sm focus:outline-none" aria-label="Global search" />
          </div>
          <div className="max-h-[380px] space-y-4 overflow-y-auto p-2">
            {loadError && <div className="px-3 py-2 text-xs text-lv-danger">{loadError}</div>}
            {!query && (
              <div className="space-y-1">
                <button onClick={() => handleNavigate('/app/cases')} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-lv-elevated">
                  <span className="flex items-center gap-2.5">{role === 'client' ? <Briefcase className="h-4 w-4" /> : <Scale className="h-4 w-4" />} {role === 'client' ? 'View my case filings' : 'Open authorized cases'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { setCopilotOpen(true); sendMessage('Summarize the authorized records in this case'); closePalette(); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs hover:bg-lv-elevated">
                  <Sparkles className="h-4 w-4" /> Ask case-scoped copilot
                </button>
                <button onClick={() => handleNavigate('/app/blockchain')} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-lv-elevated">
                  <span className="flex items-center gap-2.5"><Shield className="h-4 w-4" /> Blockchain custody</span><ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleNavigate('/app/research')} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-lv-elevated">
                  <span className="flex items-center gap-2.5"><BookOpen className="h-4 w-4" /> Licensed legal research</span><ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {filteredCases.map((item) => (
              <button key={item.id} onClick={() => handleNavigate(`/app/cases/${item.id}`)} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-lv-elevated">
                <span className="flex items-center gap-2 font-medium"><Briefcase className="h-3.5 w-3.5" /> {item.title}</span>
                <span className="pl-5 font-mono text-[10px] text-lv-muted">{item.caseNumber}</span>
              </button>
            ))}
            {filteredDocs.map((item) => (
              <button key={item.id} onClick={() => handleNavigate(`/app/documents/${item.id}`)} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-lv-elevated">
                <span className="flex items-center gap-2 font-medium"><FileText className="h-3.5 w-3.5" /> {item.originalFileName}</span>
              </button>
            ))}
            {evidence.map((item) => (
              <button key={item.id} onClick={() => handleNavigate(`/app/cases/${item.caseId}`)} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-lv-elevated">
                Evidence {item.evidenceNumber}: {item.title}
              </button>
            ))}
            {authorities.map((item) => (
              <button key={item.id} onClick={() => handleNavigate('/app/research')} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-lv-elevated">
                <span className="flex items-center gap-2 font-medium"><BookOpen className="h-3.5 w-3.5" /> {item.title}</span>
                <span className="pl-5 font-mono text-[10px] text-lv-muted">{item.provenance.citation}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
