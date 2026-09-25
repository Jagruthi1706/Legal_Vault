import { LocalLegalKnowledgeSource } from '../src/services/ai/legal/local-knowledge.source';
import { InMemoryVectorStore } from '../src/services/ai/vector/in-memory.store';
import { LocalEmbeddingClient } from '../src/services/ai/vector/embeddings';
import { VectorRecord } from '../src/services/ai/vector/types';

export function makeStatuteChunk(id: string, docId: string, title: string, text: string): VectorRecord {
  return {
    id,
    text,
    embedding: [],
    scope: 'LEGAL_AUTHORITY',
    metadata: {
      documentId: docId,
      title,
      source: 'India Code',
      sourceUrl: 'https://www.indiacode.nic.in',
      license: 'Government of India public legislative text',
      court: '',
      caseName: '',
      caseNumber: '',
      judgmentDate: '1950-01-26',
      citation: `Constitution of India, ${id}`,
      documentType: 'statute',
      jurisdiction: 'India',
      attribution: 'India Code / Government of India.',
      ingestedAt: '2026-08-14',
      version: 'phase6-dev-1',
      pageOrSection: 'Section 1',
    },
  };
}

export function makePrecedentChunk(id: string, docId: string, title: string, text: string): VectorRecord {
  return {
    id,
    text,
    embedding: [],
    scope: 'LEGAL_AUTHORITY',
    metadata: {
      documentId: docId,
      title,
      source: 'KanoonGPT Indian Case Laws (development subset)',
      sourceUrl: 'https://indiankanoon.org/doc/123456/',
      license: 'Apache-2.0',
      court: 'Supreme Court of India',
      caseName: title,
      caseNumber: 'Writ Petition No. 1 of 1950',
      judgmentDate: '1978-01-25',
      citation: '(1978) 1 SCC 248',
      documentType: 'judgment',
      jurisdiction: 'India',
      attribution: 'Public Supreme Court holding; development excerpt.',
      ingestedAt: '2026-08-14',
      version: 'phase5-dev-1',
      pageOrSection: 'Section 1',
      authorityKind: 'judicial_precedent',
      sourceType: 'legal_authority',
      contentCompleteness: 'development-excerpt',
      reportStatus: 'not-an-official-report',
      LEGAL_AREA: 'Constitutional Law',
      SUB_AREA: 'Personal liberty and fair procedure (Article 21)',
      APPLICABLE_ARTICLES: 'Article 21',
    },
  };
}

export async function createTestSource(chunks: VectorRecord[]): Promise<LocalLegalKnowledgeSource> {
  const store = new InMemoryVectorStore();
  const embeddings = new LocalEmbeddingClient();
  await store.upsert(chunks);
  return new LocalLegalKnowledgeSource(store, embeddings, []);
}

export const STATUTE_CHUNKS = [
  makeStatuteChunk('statute-art21:kb:1', 'statute-art21', 'Constitution of India — Article 21', 'Article 21 protects life and personal liberty.'),
  makeStatuteChunk('statute-art14:kb:1', 'statute-art14', 'Constitution of India — Article 14', 'Article 14 guarantees equality before law.'),
];

export const PRECEDENT_CHUNKS = [
  makePrecedentChunk('prec-maneka:section:1', 'prec-maneka', 'Maneka Gandhi v. Union of India', 'The procedure under Article 21 must be fair just and reasonable.'),
  makePrecedentChunk('prec-hussainara:section:1', 'prec-hussainara', 'Hussainara Khatoon v. State of Bihar', 'Speedy trial is part of personal liberty under Article 21.'),
];
