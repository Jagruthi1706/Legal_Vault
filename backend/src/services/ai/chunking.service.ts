import { RetrievedChunk } from './types';

export const chunkDocument = (
  input: Omit<RetrievedChunk, 'chunkId' | 'pageOrSection' | 'relevance'> & {
    chunkId?: string;
  },
): RetrievedChunk[] => {
  const sections = input.text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  const usable = (sections.length > 0 ? sections : [input.text.trim() || '']).slice(0, 8);

  return usable.map((text, index) => ({
    ...input,
    text: text.slice(0, 1200),
    chunkId: input.chunkId ?? `${input.documentId}:section:${index + 1}`,
    pageOrSection: `Section ${index + 1}`,
    relevance: 1 / (index + 1),
    sourceType: input.sourceType ?? 'document',
  }));
};
