import React from 'react';
import { Scale, ShieldCheck } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="py-12 px-4 md:px-8 max-w-4xl mx-auto space-y-8">
      <div className="space-y-3 text-center">
        <span className="text-xs font-mono font-bold text-foreground-muted uppercase tracking-wider">About Legal Vault</span>
        <h1 className="text-3xl font-extrabold font-heading text-foreground">
          Transforming the Indian Judiciary through AI & Immutable Ledgers
        </h1>
        <p className="text-sm text-foreground-muted">
          Designed in accordance with the e-Courts Phase III vision for zero-trust digital justice delivery.
        </p>
      </div>

      <div className="p-8 bg-surface border border-border rounded-xl space-y-4 text-xs text-foreground leading-relaxed font-sans">
        <p>
          Legal Vault is an enterprise judicial intelligence architecture developed to address pendency challenges across Indian High Courts and District Judiciary. By combining modern TypeScript engineering with local Hyperledger nodes and neural precedent vectors, Legal Vault ensures that evidence integrity is guaranteed and judgment drafting time is reduced by up to 40%.
        </p>
        <p>
          Our platform guarantees absolute data privacy, zero-trust security standards, and seamless integration with Supreme Court practice directions.
        </p>
      </div>
    </div>
  );
};
