import React from 'react';
import { BookOpen, Code, Terminal, Shield } from 'lucide-react';

export const DocumentationPage: React.FC = () => {
  return (
    <div className="py-12 px-4 md:px-8 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <span className="text-xs font-mono text-foreground-muted uppercase font-bold">API & Integration Specs</span>
        <h1 className="text-3xl font-extrabold font-heading text-foreground">
          Legal Vault Technical Documentation
        </h1>
        <p className="text-xs text-foreground-muted">
          SDK references, gRPC API specifications, and Hyperledger Fabric smart contract endpoints
        </p>
      </div>

      <div className="p-6 bg-surface border border-border rounded-xl space-y-4 font-mono text-xs">
        <div className="p-3 bg-[#0B0B0B] text-white rounded-lg leading-relaxed">
          <span className="text-emerald-400"># REST API Endpoint for E-Filing Verification</span><br />
          POST /api/v4/vault/cases/verify-hash<br />
          Host: njdg-node04.legalvault.gov.in<br />
          Authorization: Bearer &lt;HSM_SESSION_TOKEN&gt;
        </div>
      </div>
    </div>
  );
};
