import React from 'react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="py-12 px-4 md:px-8 max-w-4xl mx-auto space-y-6 text-xs leading-relaxed text-foreground">
      <h1 className="text-3xl font-extrabold font-heading">Data Governance & Judicial Privacy Policy</h1>
      <p>
        Legal Vault adheres strictly to the Digital Personal Data Protection (DPDP) Act 2023 and the e-Courts National Data Governance Policy.
      </p>
      <div className="p-6 bg-surface border border-border rounded-xl space-y-3">
        <h3 className="font-bold text-sm font-heading">1. Cryptographic Hash Integrity</h3>
        <p>All case filings and evidence uploads are hashed locally prior to transmission. No unencrypted confidential documents are accessible to unauthorized third parties.</p>
      </div>
    </div>
  );
};
