import { ingestLegalAuthorities, RawLegalAuthority } from './ingestion.pipeline';
import { extractLegalDocumentText, deterministicLegalId } from './extract-text';
import { LocalEmbeddingClient } from '../vector/embeddings';
import { VectorStore } from '../vector/types';
import { getLegalVectorStore } from '../vector/store.factory';
import { AppError } from '../../../utils/AppError';
import { HTTP_STATUS } from '../../../constants/app.constants';

export interface LegalIngestInput {
  title: string;
  source: string;
  sourceUrl: string;
  license: string;
  documentType: 'judgment' | 'statute' | 'other';
  jurisdiction: string;
  court?: string;
  caseName?: string;
  caseNumber?: string;
  judgmentDate?: string;
  citation?: string;
  attribution?: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export class LegalIngestService {
  constructor(
    private readonly store: VectorStore = getLegalVectorStore(),
    private readonly embeddings = new LocalEmbeddingClient(),
  ) {}

  async ingestFile(input: LegalIngestInput): Promise<{ id: string; chunks: number }> {
    if (input.mimeType.toLowerCase().includes('octet-stream') && input.fileName.toLowerCase().includes('candidate')) {
      throw new AppError('Candidate tamper-check files cannot be ingested.', HTTP_STATUS.BAD_REQUEST);
    }

    const text = extractLegalDocumentText(input.bytes, input.mimeType, input.fileName);
    const id = deterministicLegalId(input.sourceUrl, input.title);
    const document: RawLegalAuthority = {
      id,
      title: input.title,
      text,
      source: input.source,
      sourceUrl: input.sourceUrl,
      license: input.license,
      court: input.court || '',
      caseName: input.caseName || '',
      caseNumber: input.caseNumber || '',
      judgmentDate: input.judgmentDate || '',
      citation: input.citation || '',
      documentType: input.documentType,
      jurisdiction: input.jurisdiction,
      attribution: input.attribution,
      ingestedAt: new Date().toISOString().slice(0, 10),
      version: 'phase6-ingest',
    };

    const chunks = await ingestLegalAuthorities(this.store, this.embeddings, [document]);
    return { id, chunks };
  }
}

export const legalIngestService = new LegalIngestService();
