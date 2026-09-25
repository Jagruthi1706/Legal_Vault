import React from 'react';

export const TermsPage: React.FC = () => {
  return (
    <div className="py-12 px-4 md:px-8 max-w-4xl mx-auto space-y-6 text-xs leading-relaxed text-foreground">
      <h1 className="text-3xl font-extrabold font-heading">Terms of Service & Judicial Usage Rules</h1>
      <p>
        By accessing Legal Vault, advocates, judicial officers, and litigants agree to comply with Supreme Court e-Filing Rules and IT Act Section 65B protocols.
      </p>
      <div className="p-6 bg-surface border border-border rounded-xl space-y-3">
        <h3 className="font-bold text-sm font-heading">1. Digital Signatures</h3>
        <p>Orders signed using Hardware Security Module (HSM) tokens carry binding legal validity under Section 3 of the Information Technology Act 2000.</p>
      </div>
    </div>
  );
};
