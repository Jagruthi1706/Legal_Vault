import { VectorRecord } from './types';

export const dedupeByDocumentId = <T extends { metadata?: Record<string, string | number | boolean | undefined>; score?: number; id?: string }>(
  hits: T[],
): T[] => {
  const best = new Map<string, T>();
  for (const hit of hits) {
    const documentId = String(hit.metadata?.documentId || hit.id || '');
    const current = best.get(documentId);
    if (!current || (hit.score ?? 0) > (current.score ?? 0)) {
      best.set(documentId, hit);
    }
  }
  return [...best.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
};

export const rejectCaseDocuments = (records: VectorRecord[]): VectorRecord[] =>
  records.filter((record) => record.scope === 'LEGAL_AUTHORITY');

const ARTICLE_RE = /\b(?:article|art\.?)\s*(\d+[a-z]?)\b/i;
const SECTION_RE = /\b(?:section|s\.?)\s*(\d+[a-z]?)\b/i;

export const lexicalAuthorityScore = (
  query: string,
  fields: { title?: string; citation?: string; text?: string; caseName?: string },
): number => {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return 0;
  const title = String(fields.title || '').toLowerCase();
  const citation = String(fields.citation || '').toLowerCase();
  const text = String(fields.text || '').toLowerCase();
  const caseName = String(fields.caseName || '').toLowerCase();
  const heading = `${title} ${citation} ${caseName}`;
  let score = 0;

  if (title === q || citation === q) score += 20;
  if (title.includes(q)) score += 12;
  if (citation.includes(q)) score += 12;
  if (caseName.includes(q) && q.length > 4) score += 6;
  if (text.includes(q)) score += 3;

  const article = q.match(ARTICLE_RE);
  const section = q.match(SECTION_RE);
  if (article) {
    const n = article[1].toLowerCase();
    const exact = new RegExp(`\\b(?:article|art\\.?)\\s*${n}\\b`, 'i');
    const other = new RegExp(`\\b(?:article|art\\.?)\\s*(?!${n}\\b)\\d+`, 'i');
    if (exact.test(heading)) score += 18;
    else if (exact.test(text)) score += 4;
    if (other.test(title) && !exact.test(heading)) score -= 12;
  }
  if (section) {
    const n = section[1].toLowerCase();
    const exact = new RegExp(`\\b(?:section|s\\.?)\\s*${n}\\b`, 'i');
    const other = new RegExp(`\\b(?:section|s\\.?)\\s*(?!${n}\\b)\\d+`, 'i');
    if (exact.test(heading)) score += 18;
    else if (exact.test(text)) score += 4;
    if (other.test(title) && !exact.test(heading)) score -= 12;
  }

  for (const term of q.split(' ').filter((item) => item.length > 2)) {
    if (heading.includes(term)) score += 0.5;
    else if (text.includes(term)) score += 0.1;
  }

  return score;
};

export const combinedAuthorityScore = (vectorScore: number, lexicalScore: number): number =>
  lexicalScore * 5 + vectorScore;
