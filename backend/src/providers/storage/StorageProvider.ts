export interface StorageMetadata {
  contentType?: string;
  originalFileName?: string;
  [key: string]: unknown;
}

export interface StorageProvider {
  save(data: Buffer, metadata?: StorageMetadata): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete?(storageKey: string): Promise<void>;
}
