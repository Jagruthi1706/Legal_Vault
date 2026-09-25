/**
 * Structured Judicial Precedent record parser & validator (Stage 11 foundation).
 *
 * Mirrors the statutory Knowledge Base parser conventions (record-per-section,
 * strict duplicate rejection, lossless field preservation) while recognizing the
 * Judicial Precedent field vocabulary. Parsing is deterministic: re-parsing the
 * same input always yields the same records, fields, ids and corpus stats.
 *
 * Ingestion is fail-closed: a precedent record that is missing identity fields,
 * carries ambiguous/duplicate fields, or has no legal content is rejected rather
 * than stored with fabricated metadata. Provenance/license compatibility is
 * deliberately NOT decided here — it is resolved fail-closed by
 * `precedent-provenance.ts` (`resolvePrecedentRegistryEntry`) at the import
 * stage. No database write happens anywhere in this module.
 */

const RECORD_DELIMITER = '='.repeat(80);

/**
 * The recognized Judicial Precedent field labels, in source order.
 * These intentionally mirror the statutory FIELD_NAMES where the concepts
 * overlap (identity, official source, verification) and extend them with the
 * precedent-specific doctrine/ratio/outcome fields.
 */
export const PRECEDENT_FIELD_NAMES = [
  'CASE_ID',
  'CASE_NAME',
  'COURT',
  'BENCH',
  'JUDGES',
  'DATE',
  'CASE_NUMBER',
  'CITATION',
  'LEGAL_AREA',
  'SUB_AREA',
  'FACTS',
  'ISSUES',
  'ARGUMENTS',
  'APPLICABLE_ARTICLES',
  'APPLICABLE_STATUTES',
  'APPLICABLE_SECTIONS',
  'APPLICABLE_RULES',
  'LEGAL_PRINCIPLE',
  'RATIO',
  'HOLDING',
  'FINAL_OUTCOME',
  'REMEDY',
  'RELIEF',
  'RELATED_CASES',
  'FOLLOWED_CASES',
  'DISTINGUISHED_CASES',
  'OVERRULED_STATUS',
  'CURRENT_STATUS',
  'TEMPORAL_METADATA',
  'VERSION',
  'OFFICIAL_SOURCE_NAME',
  'OFFICIAL_SOURCE_URL',
  'OFFICIAL_IDENTIFIER',
  'VERIFICATION_STATUS',
  'LAST_VERIFIED_AT',
] as const;

export type PrecedentFieldName = (typeof PRECEDENT_FIELD_NAMES)[number];

/** Required identity/provenance fields — a precedent without these is unusable. */
const REQUIRED_FIELDS: readonly PrecedentFieldName[] = [
  'CASE_ID',
  'CASE_NAME',
  'COURT',
  'DATE',
  'CASE_NUMBER',
  'CITATION',
  'LEGAL_AREA',
  'OFFICIAL_SOURCE_NAME',
  'OFFICIAL_SOURCE_URL',
  'OFFICIAL_IDENTIFIER',
  'VERIFICATION_STATUS',
  'LAST_VERIFIED_AT',
  'VERSION',
];

/** At least one of these legal-text fields must carry real doctrine content. */
const LEGAL_TEXT_FIELDS: readonly PrecedentFieldName[] = [
  'FACTS',
  'ISSUES',
  'ARGUMENTS',
  'LEGAL_PRINCIPLE',
  'RATIO',
  'HOLDING',
  'FINAL_OUTCOME',
  'REMEDY',
];

const OFFICIAL_SOURCE_URL_PATTERN = /^https?:\/\/\S+$/i;

export interface ParsedPrecedentRecord {
  /** Stable case identifier, e.g. `PREC-IND-SC-2024-ND-0001`. */
  record: string;
  /** Field label → value. Empty string means the label was absent. */
  fields: Record<string, string>;
  /** Raw record text (source-verbatim). */
  rawText: string;
  /** Field labels that appeared more than once in this record. */
  repeatedFields: Record<string, string[]>;
  /** Lines after the field block that belong to the next corpus unit. */
  trailingLines: string[];
}

export interface PrecedentCorpusStats {
  delimiterSections: number;
  precedentRecords: number;
  excludedNonPrecedentSections: number;
}

export interface ParsedPrecedentCorpus {
  records: ParsedPrecedentRecord[];
  stats: PrecedentCorpusStats;
}

/**
 * A line that opens a new top-level corpus unit terminates the previous record's
 * field block. Case-sensitive on purpose (the source corpus uses uppercase
 * `Record:` headings); field continuation lines must never be mistaken for them.
 */
const TOP_LEVEL_HEADING_PATTERN = /^(?:Record:|Case:|Section \d+:|PART [IVX0-9])/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const normalizeLine = (line: string): string =>
  line
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+$/g, '')
    .trim();

const normalizeValue = (value: string): string =>
  value
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();

const fieldPattern = new RegExp(
  `^(${PRECEDENT_FIELD_NAMES.map(escapeRegExp).join('|')}):\\s*`,
);

export const parsePrecedentRecords = (text: string): ParsedPrecedentRecord[] =>
  parsePrecedentCorpus(text).records;

/** Parse a precedent corpus: split on the delimiter, then extract field blocks. */
export const parsePrecedentCorpus = (text: string): ParsedPrecedentCorpus => {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ');

  const sections = normalized
    .split(RECORD_DELIMITER)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  const records: ParsedPrecedentRecord[] = [];
  const stats: PrecedentCorpusStats = {
    delimiterSections: sections.length,
    precedentRecords: 0,
    excludedNonPrecedentSections: 0,
  };

  for (const section of sections) {
    const lines = section.split('\n');
    const fields: Record<string, string> = {};
    const repeatedFields: Record<string, string[]> = {};
    const trailingLines: string[] = [];
    let record = '';
    let currentField: string | null = null;
    let fieldBlockOpen = true;

    for (let i = 0; i < lines.length; i += 1) {
      const line = normalizeLine(lines[i]);

      if (i === 0) {
        const match = line.match(/^Record:\s*(.+)$/);
        if (match) {
          record = match[1].trim();
          continue;
        }
        // First line is not a Record: header — the section is not a precedent.
        fieldBlockOpen = false;
        trailingLines.push(line);
        continue;
      }

      if (fieldBlockOpen && TOP_LEVEL_HEADING_PATTERN.test(line)) {
        // Everything from here on belongs to the next corpus unit.
        fieldBlockOpen = false;
      }

      if (!fieldBlockOpen) {
        trailingLines.push(line);
        continue;
      }

      const match = line.match(fieldPattern);
      if (match) {
        const label = match[1];
        const value = line.slice(match[0].length).trim();
        if (Object.prototype.hasOwnProperty.call(fields, label)) {
          // Never silently overwrite: keep every occurrence explicitly.
          repeatedFields[label] = repeatedFields[label] || [fields[label]];
          repeatedFields[label].push(value);
        } else {
          fields[label] = value;
        }
        currentField = label;
        continue;
      }

      if (currentField) {
        fields[currentField] = `${fields[currentField]} ${line}`.trim();
      }
    }

    for (const key of Object.keys(fields)) {
      fields[key] = normalizeValue(fields[key]);
    }

    record = record.trim();
    if (!record) {
      // No Record: header → not a precedent record; count and move on.
      stats.excludedNonPrecedentSections += 1;
      continue;
    }

    stats.precedentRecords += 1;
    records.push({
      record,
      fields,
      rawText: section,
      repeatedFields,
      trailingLines,
    });
  }

  return { records, stats };
};

/**
 * Fail-closed single-record validation. Returns the error message for the first
 * structural problem found, or null when the record is structurally valid:
 *  - missing Record identifier
 *  - mismatched CASE_ID vs Record (when CASE_ID present)
 *  - duplicate field labels (ambiguous values are never silently overwritten)
 *  - missing required identity/provenance fields
 *  - invalid OFFICIAL_SOURCE_URL
 *  - missing legal text (no facts/issues/ratio/holding/outcome content)
 *
 * Used by the corpus-level `validatePrecedentRecords` (all-or-nothing) and by the
 * Stage 12 import planner, which must CLASSIFY invalid records (and report the
 * reason per record) instead of aborting the whole corpus on the first failure.
 *
 * NOTE: license/provenance compatibility is deliberately NOT enforced here; it is
 * enforced by `resolvePrecedentRegistryEntry` (or the future import pipeline)
 * through the existing fail-closed `assertCompatibleLicense`. The parser only
 * verifies deterministic structure.
 */
export const getPrecedentValidationError = (
  item: ParsedPrecedentRecord,
): string | null => {
  if (!item.record) {
    return 'Precedent record is missing its Record identifier.';
  }

  const caseId = item.fields.CASE_ID;
  if (!caseId) {
    return `Precedent record ${item.record} is missing CASE_ID.`;
  }
  if (caseId !== item.record) {
    return `Precedent record ${item.record} has mismatched CASE_ID: ${caseId}`;
  }

  const repeated = Object.keys(item.repeatedFields);
  if (repeated.length > 0) {
    return `Precedent record ${item.record} contains duplicate field labels (strict ingestion refuses to choose): ${repeated.join(', ')}`;
  }

  for (const requiredField of REQUIRED_FIELDS) {
    if (!item.fields[requiredField]) {
      return `Precedent record ${item.record} is missing required field ${requiredField}.`;
    }
  }

  if (!OFFICIAL_SOURCE_URL_PATTERN.test(item.fields.OFFICIAL_SOURCE_URL)) {
    return `Precedent record ${item.record} has an invalid OFFICIAL_SOURCE_URL: ${item.fields.OFFICIAL_SOURCE_URL}`;
  }

  const hasLegalText = LEGAL_TEXT_FIELDS.some(
    (field) => Boolean(item.fields[field]) && !/^(N\/A|none)$/i.test(item.fields[field]),
  );
  if (!hasLegalText) {
    return `Precedent record ${item.record} contains no legal text (facts/issues/ratio/holding/outcome).`;
  }

  return null;
};

/**
 * Fail-closed corpus-level validation. Throws on the first problem:
 *  - empty corpus
 *  - duplicate Record identifiers
 *  - any per-record structural error (see `getPrecedentValidationError`)
 */
export const validatePrecedentRecords = (records: ParsedPrecedentRecord[]): void => {
  if (records.length === 0) {
    throw new Error('No precedent records were parsed.');
  }

  const seen = new Set<string>();

  for (const item of records) {
    if (seen.has(item.record)) {
      throw new Error(`Duplicate precedent record: ${item.record}`);
    }
    seen.add(item.record);

    const error = getPrecedentValidationError(item);
    if (error) {
      throw new Error(error);
    }
  }
};
