import { createHash } from 'crypto';

export type HashInput = string | Buffer | Uint8Array;

export function sha256(input: HashInput): string {
  if (input === null || input === undefined) {
    throw new TypeError('sha256 requires a non-null input');
  }

  const hash = createHash('sha256');
  hash.update(input);
  return hash.digest('hex').toLowerCase();
}
