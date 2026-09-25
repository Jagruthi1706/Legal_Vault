import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { HTTP_STATUS } from '../../constants/app.constants';
import { StorageMetadata, StorageProvider } from './StorageProvider';

const safeBaseName = (input: string): string => {
  return path.basename(input).replace(/[^a-zA-Z0-9._-]/g, '_');
};

const storageDirectory = env.STORAGE_DIR || path.resolve(process.cwd(), 'storage');

export class LocalStorageProvider implements StorageProvider {
  private baseDirectory: string;

  constructor(baseDirectory: string = storageDirectory) {
    this.baseDirectory = path.resolve(baseDirectory);
  }

  async save(data: Buffer, _metadata?: StorageMetadata): Promise<string> {
    await fs.mkdir(this.baseDirectory, { recursive: true });

    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const fileName = `${timestamp}-${randomSuffix}`;
    const storageKey = `${fileName}.bin`;
    const filePath = path.join(this.baseDirectory, storageKey);

    if (filePath !== this.baseDirectory && !filePath.startsWith(this.baseDirectory + path.sep)) {
      throw new AppError('Invalid storage path.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    try {
      await fs.writeFile(filePath, data, { flag: 'wx' });
    } catch {
      throw new AppError('Failed to write stored file.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    const safeKey = safeBaseName(storageKey);
    const filePath = path.join(this.baseDirectory, safeKey);

    if (filePath !== this.baseDirectory && !filePath.startsWith(this.baseDirectory + path.sep)) {
      throw new AppError('Invalid storage key.', HTTP_STATUS.BAD_REQUEST);
    }

    try {
      return await fs.readFile(filePath);
    } catch {
      throw new AppError('Stored file not found.', HTTP_STATUS.NOT_FOUND);
    }
  }

  async delete(storageKey: string): Promise<void> {
    const safeKey = safeBaseName(storageKey);
    const filePath = path.join(this.baseDirectory, safeKey);

    if (filePath !== this.baseDirectory && !filePath.startsWith(this.baseDirectory + path.sep)) {
      throw new AppError('Invalid storage key.', HTTP_STATUS.BAD_REQUEST);
    }

    try {
      await fs.unlink(filePath);
    } catch {
      // best-effort cleanup, ignore if already deleted
    }
  }
}
