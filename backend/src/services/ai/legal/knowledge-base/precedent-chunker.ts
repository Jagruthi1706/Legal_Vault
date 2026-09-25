/**
 * Judicial Precedent chunker (Stage 11 foundation).
 *
 * Semantically organizes a parsed precedent record into source-ordered sections:
 *   1. identity/citation
 *   2. facts/issues
 *   3. ratio/holding
 *   4. statutory linkage (applicable articles/statutes/sections/rules)
 *   5. outcome/remedy
 *
 * Deterministic: identical input always yields identical chunk ids, texts and
 * metadata. The shared `chunking.service.ts` file is intentionally NOT used;
 * this keeps the precedent chunker aligned with the statutory KB chunker
 * convention (its own module, same maximum chunk length).
 */
import {
  ParsedPrecedentRecord,
  PRECEDENT_FIELD_NAMES,
} from './precedent-record';
import { precedentChunkId } from './precedent-id';

export const PRECEDENT_MAX_CHUNK_LENGTH = 1200;

/** True when a value is empty or an explicit placeholder (never rendered as text). */
const isPlaceholderValue = (value: string | undefined): boolean =>
  !value || value === 'N/A' || value === 'None' || value === 'none';

/** Split long text deterministically on word boundaries. */
const splitOnWordBoundaries = (text: string, max: number): string[] => {
  if (text.length <= max) return [text];
  const pieces: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    pieces.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > 0) pieces.push(remaining);
  return pieces;
};

/** Semantic section descriptors for the precedent record. */
interface SectionDescriptor {
  label: string;
  fields: string[];
  relatedFields?: string[];
}

const SECTIONS: SectionDescriptor[] = [
  {
    label: 'Identity & citation',
    fields: [
      'CASE_ID', 'CASE_NAME', 'COURT', 'BENCH', 'JUDGES', 'DATE',
      'CASE_NUMBER', 'CITATION', 'LEGAL_AREA', 'SUB_AREA',
    ],
  },
  {
    label: 'Facts & issues',
    fields: ['FACTS', 'ISSUES', 'ARGUMENTS'],
  },
  {
    label: 'Ratio & holding',
    fields: ['LEGAL_PRINCIPLE', 'RATIO', 'HOLDING'],
  },
  {
    label: 'Statutory linkage',
    fields: [
      'APPLICABLE_ARTICLES',
      'APPLICABLE_STATUTES',
      'APPLICABLE_SECTIONS',
      'APPLICABLE_RULES',
    ],
  },
  {
    label: 'Outcome & remedy',
    fields: ['FINAL_OUTCOME', 'REMEDY', 'RELIEF'],
    relatedFields: [
      'RELATED_CASES', 'FOLLOWED_CASES', 'DISTINGUISHED_CASES', 'OVERRULED_STATUS',
    ],
  },
];

export interface PrecedentChunk {
  chunkId: string;
  documentId: string;
  recordId: string;
  title: string;
  chunkIndex: number;
  chunkCount: number;
  pageOrSection: string;
  sourceType: 'legal_authority';
  scope: 'LEGAL_AUTHORITY';
  text: string;
  /** Lossless field metadata: every source field not rendered in this chunk's text. */
  metadata: Record<string, string>;
  /** Provenance payload for the source record (from `toPrecedentProvenance`). */
  provenance: Record<string, string>;
  /** Retrieval guard: distinguishes precedent from statute in metadata only. */
  authorityKind: 'judicial_precedent';
}

export interface PrecedentChunkInput {
  record: ParsedPrecedentRecord;
  /** Provenance payload for the source record (mapped from its OFFICIAL_* fields). */
  provenance: Record<string, string>;
}

interface PrecedentBlock {
  section: string;
  label: string;
  text: string;
}

const buildBlocks = (record: ParsedPrecedentRecord): PrecedentBlock[] => {
  const blocks: PrecedentBlock[] = [];
  for (const section of SECTIONS) {
    for (const label of [...section.fields, ...(section.relatedFields ?? [])]) {
      const value = record.fields[label];
      if (isPlaceholderValue(value)) {
        continue;
      }
      blocks.push({ section: section.label, label, text: `${label}: ${value}` });
    }
  }
  return blocks;
};

const packSectionBlocks = (
  blocks: PrecedentBlock[],
): Array<{ text: string; labels: string[]; section: string }> => {
  const packed: Array<{ text: string; labels: string[]; section: string }> = [];
  let currentText = '';
  let currentLabels: string[] = [];
  let currentSection = '';

  const flush = () => {
    if (currentText.trim().length > 0) {
      packed.push({
        text: currentText.trim(),
        labels: [...currentLabels],
        section: currentSection,
      });
    }
    currentText = '';
    currentLabels = [];
    currentSection = '';
  };

  for (const block of blocks) {
    if (block.text.length > PRECEDENT_MAX_CHUNK_LENGTH) {
      flush();
      const pieces = splitOnWordBoundaries(block.text, PRECEDENT_MAX_CHUNK_LENGTH);
      pieces.forEach((piece, index) => {
        packed.push({
          text: piece,
          labels: [block.label],
          section:
            pieces.length > 1 ? `${block.section} (part ${index + 1})` : block.section,
        });
      });
      continue;
    }

    if (currentText.length === 0) {
      currentText = block.text;
      currentLabels = [block.label];
      currentSection = block.section;
      continue;
    }

    if (currentText.length + 1 + block.text.length <= PRECEDENT_MAX_CHUNK_LENGTH) {
      currentText += `\n${block.text}`;
      currentLabels.push(block.label);
      continue;
    }

    flush();
    currentText = block.text;
    currentLabels = [block.label];
    currentSection = block.section;
  }

  flush();
  return packed;
};

/**
 * Pack blocks into chunks. Unlike the statutory KB chunker (which packs
 * opportunistically across its fixed sections), the precedent chunker is
 * SEMANTIC: blocks from one semantic section never merge with another section.
 * Each section therefore yields at least one self-contained chunk, matching the
 * accepted Stage 10 chunk plan (identity/citation, facts/issues, ratio/holding,
 * statutory linkage, outcome/remedy). Sections keep their source order; the
 * packing within a section is deterministic.
 */
const packBlocks = (
  blocks: PrecedentBlock[],
): Array<{ text: string; labels: string[]; section: string }> => {
  const bySection = new Map<string, PrecedentBlock[]>();
  for (const block of blocks) {
    const sectionBlocks = bySection.get(block.section) ?? [];
    sectionBlocks.push(block);
    bySection.set(block.section, sectionBlocks);
  }

  const packed: Array<{ text: string; labels: string[]; section: string }> = [];
  for (const sectionBlocks of bySection.values()) {
    packed.push(...packSectionBlocks(sectionBlocks));
  }
  return packed;
};

/**
 * Chunks one parsed precedent record. Deterministic: identical input always
 * yields identical chunk ids, texts, and metadata. Chunk ids follow the
 * precedent convention `${recordId}:prec:${index}` with a 1-based index
 * (aligned with the statutory `${documentId}:kb:${index}` chunker).
 *
 * Losslessness: every source label that is not rendered into a chunk's text is
 * carried in that chunk's metadata — no source field is ever discarded, and no
 * legally meaningful content is truncated (an oversized field is split on word
 * boundaries, never shortened).
 */
export const chunkPrecedentRecord = (input: PrecedentChunkInput): PrecedentChunk[] => {
  const { record } = input;
  const blocks = buildBlocks(record);
  const packed = packBlocks(blocks);

  const presentLabels = PRECEDENT_FIELD_NAMES.filter(
    (label) => record.fields[label] !== undefined,
  );

  return packed.map((chunk, index) => {
    const chunkIndex = index + 1;

    // Losslessness: any source label not rendered into this chunk's text
    // travels in the chunk metadata. The authority-kind marker also travels in
    // metadata so it survives persistence into the existing vector store.
    const metadata: Record<string, string> = {
      authorityKind: 'judicial_precedent',
    };
    for (const label of presentLabels) {
      if (!chunk.labels.includes(label)) {
        metadata[label] = record.fields[label];
      }
    }

    return {
      chunkId: precedentChunkId(record.record, chunkIndex),
      documentId: record.record,
      recordId: record.record,
      title: record.fields.CASE_NAME || record.record,
      chunkIndex,
      chunkCount: packed.length,
      pageOrSection: chunk.section,
      sourceType: 'legal_authority' as const,
      scope: 'LEGAL_AUTHORITY' as const,
      text: chunk.text,
      metadata,
      provenance: { ...input.provenance },
      authorityKind: 'judicial_precedent' as const,
    };
  });
};