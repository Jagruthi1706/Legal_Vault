import { LocalStorageProvider } from '../providers/storage/LocalStorageProvider';
import { StorageProvider } from '../providers/storage/StorageProvider';

export class StorageService {
  private provider: StorageProvider;

  constructor(provider?: StorageProvider) {
    this.provider = provider ?? new LocalStorageProvider();
  }

  async save(data: Buffer, metadata?: Parameters<StorageProvider['save']>[1]) {
    return this.provider.save(data, metadata);
  }

  async read(storageKey: string) {
    return this.provider.read(storageKey);
  }

  async delete(storageKey: string) {
    if (typeof this.provider.delete === 'function') {
      return this.provider.delete(storageKey);
    }
  }
}

export const storageService = new StorageService();