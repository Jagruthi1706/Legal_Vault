import React from 'react';
import { Scale, Sparkles, ShieldCheck, BookOpen, FileCheck, BarChart3 } from 'lucide-react';

export const FeaturesPage: React.FC = () => {
  const features = [
    { title: 'Flagship Case Workspace', desc: 'Dual-pane split PDF reader paired with real-time AI precedent synthesis and statutory section highlights.', icon: Scale },
    { title: 'Legal Vault AI Copilot', desc: 'Docked right-panel intelligence model providing confidence scores and citation references for Indian law.', icon: Sparkles },
    { title: 'Blockchain Evidence Vault', desc: 'SHA-256 immutable ledger anchoring across Hyperledger Fabric nodes for tamper-evident digital records.', icon: ShieldCheck },
    { title: 'Precedent Research Engine', desc: 'Semantic search across 100+ years of Supreme Court Reports (SCR) and High Court judgments.', icon: BookOpen },
    { title: 'Hardware Digital Signatures', desc: 'PKI / HSM digital signing suite for judicial officers and advocates to issue court orders instantly.', icon: FileCheck },
    { title: 'Judicial Analytics Dashboard', desc: 'Pendency tracking, disposal ratios, and courtroom scheduling metrics.', icon: BarChart3 }
  ];

  return (
    <div className="py-12 px-4 md:px-8 max-w-6xl mx-auto space-y-10">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold font-heading text-foreground">
          Platform Capabilities & Engineering Standards
        </h1>
        <p className="text-sm text-foreground-muted max-w-2xl mx-auto">
          Built to government-grade specifications for seamless integration into the Indian e-Courts ecosystem.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <div key={i} className="p-6 bg-surface border border-border rounded-xl space-y-3 shadow-xs">
              <Icon className="w-6 h-6 text-foreground" />
              <h3 className="font-heading font-extrabold text-base text-foreground">{f.title}</h3>
              <p className="text-xs text-foreground-muted leading-relaxed">{f.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
