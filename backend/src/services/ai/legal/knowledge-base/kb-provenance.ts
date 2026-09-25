import { ParsedKnowledgeBaseRecord } from './record-parser';

/**
 * Record-sourced provenance for a Knowledge Base statutory record.
 *
 * Every value is taken verbatim from the record's own OFFICIAL_* / VERIFICATION_*
 * / VERSION fields — nothing is invented. `license` is deliberately ABSENT:
 * the source corpus does not state a license for its content, and the existing
 * provenance registry (`../provenance.registry.ts`) gates ingestion on a
 * registry-approved license. Fabricating one is prohibited, so license
 * resolution is deferred to the persistence stage (fail-closed): each record's
 * official source must either match a registered trusted source or be
 * explicitly reviewed before any ingestion can pass
 * `assertCompatibleLicense`.
 */
export interface KBRecordProvenance {
  source: string;
  sourceUrl: string;
  officialIdentifier: string;
  officialCitation: string;
  verificationStatus: string;
  lastVerifiedAt: string;
  version: string;
  jurisdiction: string;
  documentType: 'judgment' | 'statute' | 'other';
}

const documentTypeFrom = (sourceType: string): KBRecordProvenance['documentType'] => {
  const value = sourceType.toLowerCase();
  if (value.includes('statute') || value.includes('act') || value.includes('rules')) {
    return 'statute';
  }
  if (value.includes('judgment') || value.includes('precedent') || value.includes('case')) {
    return 'judgment';
  }
  return 'other';
};

export const kbRecordProvenance = (
  record: ParsedKnowledgeBaseRecord,
): KBRecordProvenance => ({
  source: record.fields.OFFICIAL_SOURCE_NAME,
  sourceUrl: record.fields.OFFICIAL_SOURCE_URL,
  officialIdentifier: record.fields.OFFICIAL_IDENTIFIER || '',
  officialCitation: record.fields.OFFICIAL_CITATION || '',
  verificationStatus: record.fields.VERIFICATION_STATUS || '',
  lastVerifiedAt: record.fields.LAST_VERIFIED_AT || '',
  version: record.fields.VERSION || '',
  jurisdiction: record.fields.JURISDICTION || '',
  documentType: documentTypeFrom(record.fields.SOURCE_TYPE || ''),
});

/**
 * Deterministic (fail-closed) match of a record's official source against the
 * EXISTING provenance registry. Only verifiable matches are returned; there is
 * deliberately no default/fallback registration and no invented license.
 *
 * Matches the registered "india-code" dataset entry, whose attribution covers
 * "Official India Code / Government of India legislative publication":
 * - indiacode.nic.in (the India Code portal itself), and
 * - lddashboard.nic.in / "Legislative Department" records — the Legislative
 *   Department, Ministry of Law and Justice is the Government of India
 *   department that operates India Code and publishes the same legislative
 *   texts, so the already-registered license applies unchanged.
 * Every other official source stays unregistered until a real license decision
 * is made; such records must fail import rather than store fabricated provenance.
 */
export const matchKbRegistryEntry = (
  record: ParsedKnowledgeBaseRecord,
): { registryId: string } | null => {
  const url = record.fields.OFFICIAL_SOURCE_URL || '';
  const sourceName = record.fields.OFFICIAL_SOURCE_NAME || '';
  if (/^https:\/\/[^/]*indiacode\.nic\.in(\/|$)/i.test(url)) {
    return { registryId: 'india-code' };
  }
  if (
    /^https:\/\/[^/]*lddashboard\.nic\.in(\/|$)/i.test(url) ||
    (/^https:\/\//i.test(url) && /Legislative Department/i.test(sourceName))
  ) {
    return { registryId: 'india-code' };
  }
  return null;
};
