/**
 * Provenance/verification mapping for Judicial Precedent records.
 *
 * Uses the SAME fail-closed architecture as the statutory KB: a record resolves
 * to a registered provenance entry only when its claimed source identity is
 * EXACTLY verified — the registered dataset name verbatim AND either (a) a
 * verbatim member document of the registered development subset, or (b) the
 * exact approved upstream dataset URL/path. No license is ever invented.
 * Records that do not resolve are BLOCKED (returning null), and the caller must
 * refuse to ingest them.
 */
import { ParsedPrecedentRecord } from './precedent-record';
import authorities from '../corpus/authorities.json';
import { getProvenanceRegistry } from '../provenance.registry';
import { LegalProvenance } from '../../types';

export interface PrecedentProvenance {
  /** Mapped to the existing LegalProvenance shape consumed by LegalAuthorityChunk. */
  legal: LegalProvenance;
  /** Raw verification metadata preserved verbatim from the record. */
  verification: {
    officialSourceName: string;
    officialSourceUrl: string;
    officialIdentifier: string;
    verificationStatus: string;
    lastVerifiedAt: string;
  };
  registryId?: string;
  /** Evidence basis of the resolution (auditable; never a hostname match). */
  membership?: 'registered_member' | 'dataset_url';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const normalizeUrl = (url: string): string => url.trim().replace(/\/+$/, '');

/**
 * Registry entries whose registered license is compatible with JUDICIAL
 * PRECEDENT text. Deliberately narrow (fail-closed):
 *  - "india-code" is EXCLUDED: its registered license covers official
 *    legislative text only, never judgment text. A statute portal is not a
 *    judgment license (Stage 10 precedent provenance rule).
 *  - "kanoongpt-dev-subset" (Apache-2.0) is a development dataset of case-law
 *    holdings. It covers ONLY records genuinely sourced from that dataset; it
 *    must never be treated as permission to ingest arbitrary official court
 *    judgment text.
 * Any future official judgment source requires a NEW registry entry explicitly
 * approved for judgment text — none exists today.
 */
const PRECEDENT_COMPATIBLE_REGISTRY_IDS = ['kanoongpt-dev-subset'] as const;

/**
 * EXACT approved upstream dataset identity — verified on 2026-09-05 through the
 * public Hugging Face datasets API:
 *   - dataset id:  KanoonGPT/indian-case-laws
 *   - URL:         https://huggingface.co/datasets/KanoonGPT/indian-case-laws
 *   - license:     apache-2.0 (matches the registry entry)
 *   - files:       sample/v1/indian_case_laws_sample_v1.parquet and
 *                  structured/v1/year=1950..2026/*.parquet (parquet, ~80 GB)
 * A bare `huggingface.co` hostname, any other dataset path (including the
 * sibling KanoonGPT/indian-legal-documents statutes dataset), or any court or
 * government portal must NEVER resolve to this registry entry.
 */
const APPROVED_DATASET_URL =
  'https://huggingface.co/datasets/KanoonGPT/indian-case-laws';

const matchesApprovedDatasetUrl = (url: string): boolean =>
  new RegExp(`^${escapeRegExp(APPROVED_DATASET_URL)}(/|$)`).test(url);

/**
 * Verified member document URLs of the REGISTERED development subset — the
 * dataset actually ingested for Legal Vault (per the registry attribution:
 * "Full remote dataset is not ingested"). A member URL is the `sourceUrl` of a
 * judgment entry in the registered corpus (`authorities.json`) whose `source`
 * is exactly the registered dataset name. Membership is therefore verbatim,
 * local and auditable — never assumed from a hostname.
 */
const verifiedDatasetMemberUrls = (registryId: string): Set<string> => {
  const entry = getProvenanceRegistry(registryId);
  if (!entry) {
    return new Set();
  }
  return new Set(
    authorities
      .filter(
        (item) =>
          item.documentType === 'judgment' && item.source === entry.datasetName,
      )
      .map((item) => normalizeUrl(item.sourceUrl)),
  );
};

/**
 * Resolve a precedent record to a registered provenance entry. Fail-closed.
 * Resolution requires BOTH gates — a claimed source NAME alone, a hostname
 * alone, or a name/URL contradiction always stays BLOCKED:
 *
 *   Gate 1 (identity):  OFFICIAL_SOURCE_NAME === the registered dataset name,
 *                       verbatim.
 *   Gate 2 (evidence):  OFFICIAL_SOURCE_URL is either
 *                       (a) a verbatim member document URL of the registered
 *                           development subset (`registered_member`), or
 *                       (b) the exact approved upstream dataset URL/path
 *                           (`dataset_url`).
 *
 * Concretely BLOCKED by this design: any other huggingface.co URL (including
 * the sibling KanoonGPT/indian-legal-documents statutes dataset), any court or
 * ministry portal (e.g. main.sci.gov.in), any statute portal, and any record
 * whose claimed source name does not match the registered dataset exactly.
 *
 * NOTE: resolution is necessary but NOT sufficient for ingestion. The import
 * stage must still enforce `assertCompatibleLicense`, and records whose only
 * evidence is the upstream dataset URL (`dataset_url`) additionally require
 * content-level verification during corpus review before any real import.
 */
export const resolvePrecedentRegistryEntry = (
  record: ParsedPrecedentRecord,
): { registryId: string; membership: 'registered_member' | 'dataset_url' } | null => {
  const url = normalizeUrl(record.fields.OFFICIAL_SOURCE_URL || '');
  const sourceName = record.fields.OFFICIAL_SOURCE_NAME || '';

  for (const id of PRECEDENT_COMPATIBLE_REGISTRY_IDS) {
    const entry = getProvenanceRegistry(id);
    if (!entry) {
      continue;
    }
    // Gate 1 — exact dataset identity (name must match the registry verbatim).
    if (sourceName !== entry.datasetName) {
      continue;
    }
    // Gate 2 — verified provenance basis.
    if (verifiedDatasetMemberUrls(id).has(normalizeUrl(url))) {
      return { registryId: entry.id, membership: 'registered_member' };
    }
    if (matchesApprovedDatasetUrl(url)) {
      return { registryId: entry.id, membership: 'dataset_url' };
    }
  }
  return null;
};

/**
 * Build the persisted provenance payload for a precedent record.
 * `resolution` comes from `resolvePrecedentRegistryEntry`; if the caller passes
 * a record that does not resolve, this throws (fail-closed). The resolution
 * basis (`membership`) is preserved for auditability.
 */
export const toPrecedentProvenance = (
  record: ParsedPrecedentRecord,
  resolution?: { registryId: string; membership?: 'registered_member' | 'dataset_url' },
): PrecedentProvenance => {
  const resolved = resolution ?? resolvePrecedentRegistryEntry(record) ?? undefined;
  if (!resolved) {
    throw new Error(
      `Precedent record ${record.record} has no registered provenance source; refusing to build provenance.`,
    );
  }
  const registry = getProvenanceRegistry(resolved.registryId);
  if (!registry) {
    throw new Error(
      `Precedent record ${record.record} resolved to unknown registry ${resolved.registryId}.`,
    );
  }

  const legal: LegalProvenance = {
    source: record.fields.OFFICIAL_SOURCE_NAME,
    sourceUrl: record.fields.OFFICIAL_SOURCE_URL,
    license: registry.license,
    court: record.fields.COURT || undefined,
    caseName: record.fields.CASE_NAME || undefined,
    caseNumber: record.fields.CASE_NUMBER || undefined,
    judgmentDate: record.fields.DATE || undefined,
    citation: record.fields.CITATION || undefined,
    documentType: 'judgment',
    jurisdiction: record.fields.JURISDICTION || 'India',
    attribution: registry.attribution,
    ingestedAt: undefined,
    version: record.fields.VERSION || undefined,
  };

  return {
    legal,
    verification: {
      officialSourceName: record.fields.OFFICIAL_SOURCE_NAME,
      officialSourceUrl: record.fields.OFFICIAL_SOURCE_URL,
      officialIdentifier: record.fields.OFFICIAL_IDENTIFIER || '',
      verificationStatus: record.fields.VERIFICATION_STATUS || '',
      lastVerifiedAt: record.fields.LAST_VERIFIED_AT || '',
    },
    registryId: resolved.registryId,
    membership: resolved.membership,
  };
};