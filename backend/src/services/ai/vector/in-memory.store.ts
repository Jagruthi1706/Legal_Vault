import { cosineSimilarity, VectorRecord, VectorSearchOptions, VectorStore } from './types';

export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, VectorRecord>();

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  async search(embedding: number[], options: VectorSearchOptions = {}): Promise<Array<VectorRecord & { score: number }>> {
    const limit = options.limit ?? 6;
    const scored: Array<VectorRecord & { score: number }> = [];

    for (const record of this.records.values()) {
      if (options.scope && record.scope !== options.scope) {
        continue;
      }
      if (options.filter) {
        const mismatch = Object.entries(options.filter).some(([key, value]) => {
          if (value === undefined) return false;
          return String(record.metadata[key] ?? '') !== value;
        });
        if (mismatch) continue;
      }
      scored.push({ ...record, score: cosineSimilarity(embedding, record.embedding) });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.records.delete(id);
    }
  }
}

export const legalAuthorityStore = new InMemoryVectorStore();
