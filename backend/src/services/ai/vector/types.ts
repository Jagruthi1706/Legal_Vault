export type VectorScope = 'CASE_DOCUMENT' | 'LEGAL_AUTHORITY';

export interface VectorRecord {
  id: string;
  text: string;
  embedding: number[];
  scope: VectorScope;
  metadata: Record<string, string | number | boolean | undefined>;
}

export interface VectorSearchOptions {
  limit?: number;
  scope?: VectorScope;
  filter?: Record<string, string | undefined>;
}

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  search(embedding: number[], options?: VectorSearchOptions): Promise<Array<VectorRecord & { score: number }>>;
  delete(ids: string[]): Promise<void>;
}

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};
