import { getAIConfig } from '../../../config/ai.config';
import { legalAuthorityStore } from './in-memory.store';
import { PostgresVectorStore } from './postgres.store';
import { VectorStore } from './types';

export const createVectorStore = (override?: 'memory' | 'postgres'): VectorStore => {
  const mode = override ?? getAIConfig().vectorStore;
  if (mode === 'postgres') {
    return new PostgresVectorStore(legalAuthorityStore);
  }
  return legalAuthorityStore;
};

let legalStore: VectorStore | undefined;

export const getLegalVectorStore = (): VectorStore => {
  if (!legalStore) {
    legalStore = createVectorStore();
  }
  return legalStore;
};
