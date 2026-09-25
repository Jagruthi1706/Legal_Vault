const RECORD_DELIMITER = '='.repeat(80);

export interface ParsedKnowledgeBaseRecord {
  record: string;
  fields: Record<string, string>;
  rawText: string;
  /** Labels that appeared more than once inside the SAME record block. Every occurrence is preserved; strict validation refuses to choose. */
  repeatedFields: Record<string, string[]>;
  /** Lines after the field block that belong to the next corpus unit (e.g. a "Section N:" heading). Preserved verbatim, never merged into field values. */
  trailingLines: string[];
}

export interface KnowledgeBaseCorpusStats {
  delimiterSections: number;
  statutoryRecords: number;
  excludedCaseRecords: number;
  excludedNonRecordSections: number;
}

export interface ParsedKnowledgeBaseCorpus {
  records: ParsedKnowledgeBaseRecord[];
  stats: KnowledgeBaseCorpusStats;
}

/** The 32 recognized Knowledge Base statutory field labels, in source order. */
export const FIELD_NAMES = [
  'DOCUMENT_ID',
  'TITLE',
  'LEGAL_AREA',
  'SUB_AREA',
  'SOURCE_TYPE',
  'AUTHORITY_LEVEL',
  'JURISDICTION',
  'STATE_OR_UT',
  'COURT_OR_AUTHORITY',
  'STATUTE',
  'ARTICLE',
  'SECTION',
  'RULE',
  'LEGAL_PROPOSITION',
  'SIMPLE_EXPLANATION',
  'APPLICATION / WHEN RELEVANT',
  'EXCEPTIONS / LIMITATIONS',
  'IMPORTANT_QUALIFICATIONS',
  'RELATED_PROVISIONS',
  'RELATED_CASE_LAW',
  'CURRENT_STATUS',
  'EFFECTIVE_FROM',
  'EFFECTIVE_TO',
  'HISTORICAL_APPLICABILITY',
  'OFFICIAL_SOURCE_NAME',
  'OFFICIAL_SOURCE_URL',
  'OFFICIAL_IDENTIFIER',
  'OFFICIAL_CITATION',
  'VERIFICATION_STATUS',
  'LAST_VERIFIED_AT',
  'KEYWORDS',
  'VERSION',
] as const;

const fieldPattern = new RegExp(
  `^(${FIELD_NAMES.map(escapeRegExp).join('|')}):\\s*`,
);

/**
 * A line that opens a new top-level corpus unit terminates the previous record's
 * field block. Case-sensitive on purpose: the source corpus uses exactly these
 * uppercase headings, and field continuation lines must never be mistaken for
 * them. Verified against the V2.1 corpus: the only in-record occurrence is the
 * "Section 5: Master Landmark Judicial Precedents" heading that trails the final
 * statutory record.
 */
const TOP_LEVEL_HEADING_PATTERN = /^(?:Section \d+:|Case:|Record:|PART [IVX0-9])/;

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

export const parseKnowledgeBaseRecords = (
  text: string,
): ParsedKnowledgeBaseRecord[] =>
  parseKnowledgeBaseCorpus(text).records;

export const parseKnowledgeBaseCorpus = (
  text: string,
): ParsedKnowledgeBaseCorpus => {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ');

  const sections = normalized
    .split(RECORD_DELIMITER)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  const records: ParsedKnowledgeBaseRecord[] = [];
  const stats: KnowledgeBaseCorpusStats = {
    delimiterSections: sections.length,
    statutoryRecords: 0,
    excludedCaseRecords: 0,
    excludedNonRecordSections: 0,
  };

  for (const section of sections) {
    const lines = section
      .split('\n')
      .map(normalizeLine)
      .filter(Boolean);

    if (/^Case:\s*\S+/.test(lines[0] || '')) {
      // Precedent ("Case:") sections use a different record schema and are
      // excluded from statutory-record parsing. They are counted, never merged.
      stats.excludedCaseRecords += 1;
      continue;
    }

    const recordIndex = lines.findIndex((line) =>
      /^Record:\s*\S+/.test(line),
    );

    if (recordIndex === -1) {
      if (lines.length > 0) {
        stats.excludedNonRecordSections += 1;
      }
      continue;
    }

    const recordMatch = lines[recordIndex].match(/^Record:\s*(.+)$/);

    if (!recordMatch) {
      continue;
    }

    const record = recordMatch[1].trim();
    const fields: Record<string, string> = {};
    const repeatedFields: Record<string, string[]> = {};
    const trailingLines: string[] = [];

    let currentField: string | undefined;
    let fieldBlockOpen = true;

    for (const line of lines.slice(recordIndex + 1)) {
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
        // Multiline continuation: the complete value is preserved (joined),
        // never truncated.
        fields[currentField] = `${fields[currentField]} ${line}`.trim();
      }
    }

    for (const key of Object.keys(fields)) {
      fields[key] = normalizeValue(fields[key]);
    }

    stats.statutoryRecords += 1;
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

const REQUIRED_FIELDS = [
  'DOCUMENT_ID',
  'TITLE',
  'LEGAL_AREA',
  'SOURCE_TYPE',
  'AUTHORITY_LEVEL',
  'JURISDICTION',
  'LEGAL_PROPOSITION',
  'CURRENT_STATUS',
  'EFFECTIVE_FROM',
  'EFFECTIVE_TO',
  'OFFICIAL_SOURCE_NAME',
  'OFFICIAL_SOURCE_URL',
  'VERIFICATION_STATUS',
  'VERSION',
] as const;

const OFFICIAL_SOURCE_URL_PATTERN = /^https?:\/\/\S+$/i;

export const validateKnowledgeBaseRecords = (
  records: ParsedKnowledgeBaseRecord[],
): void => {
  if (records.length === 0) {
    throw new Error('No Knowledge Base records were parsed.');
  }

  const seen = new Set<string>();

  for (const item of records) {
    if (!item.record) {
      throw new Error('Knowledge Base record is missing its Record identifier.');
    }

    if (seen.has(item.record)) {
      throw new Error(`Duplicate Knowledge Base record: ${item.record}`);
    }

    seen.add(item.record);

    const documentId = item.fields.DOCUMENT_ID;

    if (!documentId) {
      throw new Error(
        `Knowledge Base record ${item.record} is missing DOCUMENT_ID.`,
      );
    }

    if (documentId !== item.record) {
      throw new Error(
        `Knowledge Base record ${item.record} has mismatched DOCUMENT_ID: ${documentId}`,
      );
    }

    const repeated = Object.keys(item.repeatedFields);
    if (repeated.length > 0) {
      throw new Error(
        `Knowledge Base record ${item.record} contains duplicate field labels (strict ingestion refuses to choose): ${repeated.join(', ')}`,
      );
    }

    for (const requiredField of REQUIRED_FIELDS) {
      if (!item.fields[requiredField]) {
        throw new Error(
          `Knowledge Base record ${item.record} is missing required field ${requiredField}.`,
        );
      }
    }

    if (!OFFICIAL_SOURCE_URL_PATTERN.test(item.fields.OFFICIAL_SOURCE_URL)) {
      throw new Error(
        `Knowledge Base record ${item.record} has an invalid OFFICIAL_SOURCE_URL: ${item.fields.OFFICIAL_SOURCE_URL}`,
      );
    }
  }
};