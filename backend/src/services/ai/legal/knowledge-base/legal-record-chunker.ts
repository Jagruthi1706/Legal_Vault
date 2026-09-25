/**
 * Knowledge Base legal-record chunking (Stage 2 implementation).
 *
 * Deterministic, no LLM. Isolated from the shared case-document chunker
 * (`chunking.service.ts`), which must never be modified for Knowledge Base
 * purposes. Both use the same maximum chunk length (1200 characters) so
 * downstream embedding/storage assumptions stay aligned, but this module keeps
 * its own constant and NEVER imports or invokes the shared chunker.
 *
 * Strategy:
 * - Fixed, source-ordered sections: identity/reference, core legal text,
 *   historical applicability, related authorities + keywords.
 * - A field is kept whole whenever it fits; only a field that individually
 *   exceeds the maximum chunk length is split, on word boundaries.
 * - Lifecycle/classification/provenance values are attached as chunk metadata
 *   instead of being repeated in every chunk's text.
 * - Losslessness: every source label that is not present in a chunk's text is
 *   carried in that chunk's metadata. No source field is ever discarded.
 * - Chunk IDs are deterministic and stable across repeated ingestion:
 *   `${documentId}:kb:${index}`.
 */

import { FIELD_NAMES, ParsedKnowledgeBaseRecord } from './record-parser';

export const KB_MAX_CHUNK_LENGTH = 1200;

export interface LegalRecordChunkInput {
  record: ParsedKnowledgeBaseRecord;
  /** Provenance payload for the source record (mapped from its OFFICIAL_* fields). */
  provenance: Record<string, string>;
}

export interface LegalRecordChunk {
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
  metadata: Record<string, string>;
  provenance: Record<string, string>;
}

interface KBBlock {
  section: string;
  label: string;
  text: string;
}

const SECTIONS = [
  {
    name: 'Identity & statutory reference',
    labels: ['TITLE', 'DOCUMENT_ID', 'STATUTE', 'ARTICLE', 'SECTION', 'RULE'],
  },
  {
    name: 'Core legal text',
    labels: [
      'LEGAL_PROPOSITION',
      'SIMPLE_EXPLANATION',
      'APPLICATION / WHEN RELEVANT',
      'EXCEPTIONS / LIMITATIONS',
      'IMPORTANT_QUALIFICATIONS',
    ],
  },
  { name: 'Historical applicability', labels: ['HISTORICAL_APPLICABILITY'] },
  {
    name: 'Related authorities & keywords',
    labels: ['RELATED_PROVISIONS', 'RELATED_CASE_LAW', 'KEYWORDS'],
  },
] as const;

/** Placeholder values are content-free: kept in metadata, never rendered as text. */
const isPlaceholderValue = (value: string): boolean => value === 'N/A';

const splitOnWordBoundaries = (text: string, max: number): string[] => {
  if (text.length <= max) {
    return [text];
  }
  const pieces: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf(' ', max);
    if (cut <= 0) {
      cut = max; // single token longer than max: hard split, still deterministic
    }
    pieces.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > 0) {
    pieces.push(remaining);
  }
  return pieces;
};

const buildBlocks = (record: ParsedKnowledgeBaseRecord): KBBlock[] => {
  const blocks: KBBlock[] = [];
  for (const section of SECTIONS) {
    for (const label of section.labels) {
      const value = record.fields[label];
      if (value === undefined || isPlaceholderValue(value)) {
        continue;
      }
      blocks.push({ section: section.name, label, text: `${label}: ${value}` });
    }
  }
  return blocks;
};

const packBlocks = (
  blocks: KBBlock[],
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
    if (block.text.length > KB_MAX_CHUNK_LENGTH) {
      flush();
      const pieces = splitOnWordBoundaries(block.text, KB_MAX_CHUNK_LENGTH);
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

    if (currentText.length + 1 + block.text.length <= KB_MAX_CHUNK_LENGTH) {
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
 * Chunks one parsed Knowledge Base record. Deterministic: identical input
 * always yields identical chunk ids, texts, and metadata.
 */
export const chunkLegalRecord = (input: LegalRecordChunkInput): LegalRecordChunk[] => {
  const { record } = input;
  const blocks = buildBlocks(record);
  const packed = packBlocks(blocks);

  const presentLabels = FIELD_NAMES.filter(
    (label) => record.fields[label] !== undefined,
  );

  return packed.map((chunk, index) => {
    // Losslessness: any source label not rendered into this chunk's text
    // travels in the chunk metadata.
    const metadata: Record<string, string> = {};
    for (const label of presentLabels) {
      if (!chunk.labels.includes(label)) {
        metadata[label] = record.fields[label];
      }
    }

    return {
      chunkId: `${record.record}:kb:${index + 1}`,
      documentId: record.record,
      recordId: record.record,
      title: record.fields.TITLE || record.record,
      chunkIndex: index + 1,
      chunkCount: packed.length,
      pageOrSection: chunk.section,
      sourceType: 'legal_authority' as const,
      scope: 'LEGAL_AUTHORITY' as const,
      text: chunk.text,
      metadata,
      provenance: { ...input.provenance },
    };
  });
};
