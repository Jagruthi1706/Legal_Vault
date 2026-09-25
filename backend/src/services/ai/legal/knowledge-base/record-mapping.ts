import {
  FIELD_NAMES,
  ParsedKnowledgeBaseRecord,
} from './record-parser';

/**
 * Deterministic field-to-model grouping for Knowledge Base statutory records.
 * Every one of the 32 source labels belongs to exactly one group; values are
 * carried verbatim — nothing is renamed, reinterpreted, or dropped.
 */
export const KB_FIELD_GROUPS = {
  IDENTITY: ['DOCUMENT_ID', 'TITLE'],
  CLASSIFICATION: [
    'LEGAL_AREA',
    'SUB_AREA',
    'SOURCE_TYPE',
    'AUTHORITY_LEVEL',
    'JURISDICTION',
    'STATE_OR_UT',
    'COURT_OR_AUTHORITY',
  ],
  LEGAL_REFERENCE: ['STATUTE', 'ARTICLE', 'SECTION', 'RULE'],
  CORE_LEGAL_TEXT: [
    'LEGAL_PROPOSITION',
    'SIMPLE_EXPLANATION',
    'APPLICATION / WHEN RELEVANT',
    'EXCEPTIONS / LIMITATIONS',
    'IMPORTANT_QUALIFICATIONS',
    'RELATED_PROVISIONS',
    'RELATED_CASE_LAW',
    'HISTORICAL_APPLICABILITY',
  ],
  LIFECYCLE: ['CURRENT_STATUS', 'EFFECTIVE_FROM', 'EFFECTIVE_TO'],
  OFFICIAL_PROVENANCE: [
    'OFFICIAL_SOURCE_NAME',
    'OFFICIAL_SOURCE_URL',
    'OFFICIAL_IDENTIFIER',
    'OFFICIAL_CITATION',
    'VERIFICATION_STATUS',
    'LAST_VERIFIED_AT',
    'VERSION',
  ],
  DISCOVERY: ['KEYWORDS'],
} as const;

export type KBFieldGroup = keyof typeof KB_FIELD_GROUPS;

const labelToGroup = new Map<string, KBFieldGroup>();
for (const group of Object.keys(KB_FIELD_GROUPS) as KBFieldGroup[]) {
  for (const label of KB_FIELD_GROUPS[group]) {
    labelToGroup.set(label, group);
  }
}

export interface MappedKnowledgeBaseRecord {
  recordId: string;
  identity: Record<string, string>;
  classification: Record<string, string>;
  legalReference: Record<string, string>;
  coreLegalText: Record<string, string>;
  lifecycle: Record<string, string>;
  officialProvenance: Record<string, string>;
  discovery: Record<string, string>;
  /** Verbatim copy of every source field — losslessness guarantee for audits. */
  fields: Record<string, string>;
}

const groupOf = (record: ParsedKnowledgeBaseRecord, group: KBFieldGroup): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const label of KB_FIELD_GROUPS[group]) {
    const value = record.fields[label];
    if (value !== undefined) {
      out[label] = value;
    }
  }
  return out;
};

export const mapKnowledgeBaseRecord = (
  record: ParsedKnowledgeBaseRecord,
): MappedKnowledgeBaseRecord => ({
  recordId: record.record,
  identity: groupOf(record, 'IDENTITY'),
  classification: groupOf(record, 'CLASSIFICATION'),
  legalReference: groupOf(record, 'LEGAL_REFERENCE'),
  coreLegalText: groupOf(record, 'CORE_LEGAL_TEXT'),
  lifecycle: groupOf(record, 'LIFECYCLE'),
  officialProvenance: groupOf(record, 'OFFICIAL_PROVENANCE'),
  discovery: groupOf(record, 'DISCOVERY'),
  fields: { ...record.fields },
});

/**
 * Temporal safety helper. Returns the leading ISO date (YYYY-MM-DD) ONLY when
 * the value starts with one unambiguously; otherwise null. The original source
 * string always remains the authoritative value — complex values such as
 * "2023-08-11 (Act Assent); Rules Notified 2025; Staggered Operational Phase-in"
 * keep the derivation optional and lossless, and values such as "Open" or
 * "N/A" yield null instead of an invented date.
 */
const ISO_DATE_START = /^(\d{4}-\d{2}-\d{2})(?:\b|$)/;

export const derivePrimaryIsoDate = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const match = value.trim().match(ISO_DATE_START);
  return match ? match[1] : null;
};

/** All 32 recognized labels — re-exported so tests can verify full coverage. */
export const KB_ALL_LABELS: readonly string[] = FIELD_NAMES;
