import React from 'react';
import { UserCheck, Shield, Mail, Phone, Scale } from 'lucide-react';
import { Party } from '../../types';

interface EntitiesTabProps {
  parties: Party[];
  bench?: string;
}

export const EntitiesTab: React.FC<EntitiesTabProps> = ({ parties, bench }) => {
  return (
    <div className="space-y-4">
      {/* Bench Details */}
      {bench && (
        <div className="p-3.5 rounded-xl bg-[#FAFAF8] dark:bg-[#18181A] border border-border">
          <div className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider font-heading flex items-center gap-1.5 mb-1">
            <Scale className="w-3.5 h-3.5 text-foreground" />
            Presiding Judicial Bench
          </div>
          <div className="text-xs font-semibold text-foreground">
            {bench}
          </div>
        </div>
      )}

      {/* Litigants & Counsel Table */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-foreground-muted uppercase tracking-wider font-heading">
          Key Litigants & Representing Counsel
        </div>

        <div className="space-y-2">
          {parties.map((party) => (
            <div
              key={party.id}
              className="p-3.5 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-foreground">
                    {party.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-subtle text-foreground text-[10px] font-semibold font-mono border border-[#E7E5E4] dark:border-[#333]">
                    {party.role}
                  </span>
                </div>
                {party.counselName && (
                  <div className="text-[11px] text-foreground-muted mt-1 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-foreground" />
                    Counsel: <span className="font-medium text-foreground">{party.counselName}</span>
                  </div>
                )}
              </div>

              <div className="text-right text-[10px] text-foreground-muted font-mono">
                Verified Party Record
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
