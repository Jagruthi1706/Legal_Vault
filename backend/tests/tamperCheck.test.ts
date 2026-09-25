import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { sha256 } from '../src/utils/hash';
import { normalizeDocument } from '../src/utils/documentNormalize';
import {
  compareCandidateToOriginalHash,
  performTamperCheck,
} from '../src/services/tamperCheck.service';
const ORIGINAL = 'This is the original legal evidence.\nVersion 1.0.';
const ONE_CHAR_MODIFIED = 'This is the original legal evidence.\nVersion 1.1.';
const COMPLETELY_DIFFERENT = 'Totally unrelated binary-looking payload @@##';

const HASH_A = sha256(ORIGINAL);

/** Mirrors BlockchainService.toBytes32Hash without loading env/RPC. */
function toBytes32Hash(hash: string): string {
  const cleaned = hash.replace(/^0x/i, '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    throw new Error('Invalid SHA-256 hash format. Expected 64 hexadecimal characters.');
  }
  return `0x${cleaned.toLowerCase()}`;
}

test('1. original anchored + identical candidate → UNMODIFIED', () => {
  const result = compareCandidateToOriginalHash(HASH_A, Buffer.from(ORIGINAL, 'utf8'));
  assert.equal(result.status, 'UNMODIFIED');
  assert.equal(result.hashMatches, true);
  assert.equal(result.originalHash, HASH_A);
  assert.equal(result.candidateHash, HASH_A);
});

test('2. original anchored + one-character modification → TAMPERED', () => {
  const result = compareCandidateToOriginalHash(HASH_A, Buffer.from(ONE_CHAR_MODIFIED, 'utf8'));
  assert.equal(result.status, 'TAMPERED');
  assert.equal(result.hashMatches, false);
  assert.equal(result.originalHash, HASH_A);
  assert.notEqual(result.candidateHash, HASH_A);
});

test('3. original anchored + completely different file → TAMPERED', () => {
  const result = compareCandidateToOriginalHash(
    HASH_A,
    Buffer.from(COMPLETELY_DIFFERENT, 'utf8'),
  );
  assert.equal(result.status, 'TAMPERED');
  assert.equal(result.hashMatches, false);
});

test('4. same filename but modified bytes → TAMPERED (filename ignored)', async () => {
  let anchorCalls = 0;
  let createTxCalls = 0;
  let createDocCalls = 0;

  const result = await performTamperCheck(
    {
      userId: 'user-1',
      originalDocumentId: 'doc-1',
      candidateBytes: Buffer.from(ONE_CHAR_MODIFIED, 'utf8'),
      candidateFileName: 'Case001_Tamper_Test_Original.txt',
      candidateMimeType: 'text/plain',
      candidateFileSize: ONE_CHAR_MODIFIED.length,
    },
    {
      getOriginalDocument: async () => ({
        id: 'doc-1',
        originalFileName: 'Case001_Tamper_Test_Original.txt',
        sha256Hash: HASH_A,
      }),
      getAnchorTransaction: async () => ({
        documentHash: HASH_A,
        transactionHash: '0xabc',
        blockNumber: 1,
        chainId: 11155111,
        contractAddress: '0xcontract',
      }),
      getAnchoredHashFromTransaction: async () => ({
        documentHash: HASH_A,
        referenceId: '0x1',
        actor: '0xactor',
        eventType: 'EVIDENCE_UPLOAD',
        timestamp: 1,
      }),
      verifyOriginalHashOnChain: async () => ({
        exists: true,
        referenceId: '0x1',
        actor: '0xactor',
        eventType: 'EVIDENCE_UPLOAD',
        timestamp: 1,
      }),
      anchorDocument: async () => {
        anchorCalls += 1;
        return null;
      },
      createBlockchainTransaction: async () => {
        createTxCalls += 1;
        return null;
      },
      createDocument: async () => {
        createDocCalls += 1;
        return null;
      },
    },
  );

  assert.equal(result.status, 'TAMPERED');
  assert.equal(result.hashMatches, false);
  assert.equal(result.candidateFileName, 'Case001_Tamper_Test_Original.txt');
  assert.equal(anchorCalls, 0);
  assert.equal(createTxCalls, 0);
  assert.equal(createDocCalls, 0);
});

test('5. different filename but identical bytes → UNMODIFIED', async () => {
  const result = await performTamperCheck(
    {
      userId: 'user-1',
      originalDocumentId: 'doc-1',
      candidateBytes: Buffer.from(ORIGINAL, 'utf8'),
      candidateFileName: 'Case001_Copy.pdf',
      candidateMimeType: 'application/pdf',
      candidateFileSize: ORIGINAL.length,
    },
    {
      getOriginalDocument: async () => ({
        id: 'doc-1',
        originalFileName: 'Case001_Tamper_Test_Original.txt',
        sha256Hash: HASH_A,
      }),
      getAnchorTransaction: async () => ({
        documentHash: HASH_A,
        transactionHash: '0xabc',
        blockNumber: 42,
        chainId: 11155111,
        contractAddress: '0xcontract',
      }),
      getAnchoredHashFromTransaction: async () => ({
        documentHash: HASH_A,
        referenceId: '0x1',
        actor: '0xactor',
        eventType: 'EVIDENCE_UPLOAD',
        timestamp: 1,
      }),
      verifyOriginalHashOnChain: async () => ({
        exists: true,
        referenceId: '0x1',
        actor: '0xactor',
        eventType: 'EVIDENCE_UPLOAD',
        timestamp: 1,
      }),
    },
  );

  assert.equal(result.status, 'UNMODIFIED');
  assert.equal(result.hashMatches, true);
  assert.equal(result.candidateFileName, 'Case001_Copy.pdf');
  assert.equal(result.candidatePersisted, false);
  assert.equal(result.blockchainTransactionCreated, false);
});

test('6 + 7. candidate comparison does NOT create BlockchainTransaction or send Ethereum tx', async () => {
  let anchorCalls = 0;
  let createTxCalls = 0;
  let ethSendCalls = 0;

  await performTamperCheck(
    {
      userId: 'user-1',
      originalDocumentId: 'doc-1',
      candidateBytes: Buffer.from(ONE_CHAR_MODIFIED, 'utf8'),
      candidateFileName: 'x.txt',
      candidateMimeType: 'text/plain',
      candidateFileSize: 10,
    },
    {
      getOriginalDocument: async () => ({
        id: 'doc-1',
        originalFileName: 'orig.txt',
        sha256Hash: HASH_A,
      }),
      getAnchorTransaction: async () => ({
        documentHash: HASH_A,
        transactionHash: '0xabc',
        blockNumber: 1,
        chainId: 11155111,
        contractAddress: '0xcontract',
      }),
      getAnchoredHashFromTransaction: async () => ({
        documentHash: HASH_A,
        referenceId: '0x1',
        actor: '0xactor',
        eventType: 'EVIDENCE_UPLOAD',
        timestamp: 1,
      }),
      verifyOriginalHashOnChain: async () => {
        // read-only verify path
        return {
          exists: true,
          referenceId: '0x1',
          actor: '0xactor',
          eventType: 'EVIDENCE_UPLOAD',
          timestamp: 1,
        };
      },
      anchorDocument: async () => {
        ethSendCalls += 1;
        anchorCalls += 1;
        throw new Error('should not send eth tx');
      },
      createBlockchainTransaction: async () => {
        createTxCalls += 1;
        throw new Error('should not create db tx');
      },
    },
  );

  assert.equal(anchorCalls, 0);
  assert.equal(createTxCalls, 0);
  assert.equal(ethSendCalls, 0);
});

test('8. existing anchor flow helpers still work (hash + bytes32)', () => {
  const digest = sha256(Buffer.from(ORIGINAL, 'utf8'));
  assert.equal(digest.length, 64);
  assert.equal(toBytes32Hash(digest), `0x${digest}`);
  assert.equal(
    createHash('sha256').update(ORIGINAL, 'utf8').digest('hex'),
    digest,
  );
});

test('9. existing blockchain verification semantics still work (exact hash match)', () => {
  const stored = HASH_A;
  const currentUnmodified = sha256(Buffer.from(ORIGINAL, 'utf8'));
  const currentModified = sha256(Buffer.from(ONE_CHAR_MODIFIED, 'utf8'));

  assert.equal(currentUnmodified, stored);
  assert.notEqual(currentModified, stored);

  // verify path: unmodified content against stored hash → match
  assert.equal(currentUnmodified === stored, true);
  // verify/tamper path: modified content against stored hash → mismatch
  assert.equal(currentModified === stored, false);
});

test('10. refreshing restores persisted documents from API normalize shape', () => {
  const persisted = normalizeDocument({
    id: 'doc-1',
    caseId: 'case-1',
    uploadedById: 'user-1',
    originalFileName: 'Case001_Tamper_Test_Original.txt',
    mimeType: 'text/plain',
    fileSize: 100,
    documentType: 'EVIDENCE',
    description: null,
    version: 1,
    sha256Hash: HASH_A,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blockchainTransactions: [
      {
        createdAt: new Date().toISOString(),
        transactionHash: '0xdeadbeef',
        chainId: 11155111,
        contractAddress: '0xcontract',
        blockNumber: 11467711,
        documentHash: HASH_A,
      },
    ],
  });

  assert.equal(persisted.integrityStatus, 'ANCHORED');
  assert.equal(persisted.lastTransactionHash, '0xdeadbeef');
  assert.equal(persisted.lastBlockNumber, 11467711);
  assert.equal(persisted.lastChainId, 11155111);
  assert.equal(persisted.sha256Hash, HASH_A);

  const notAnchored = normalizeDocument({
    id: 'doc-2',
    caseId: 'case-1',
    uploadedById: 'user-1',
    originalFileName: 'pending.txt',
    mimeType: 'text/plain',
    fileSize: 10,
    documentType: 'EVIDENCE',
    description: null,
    version: 1,
    sha256Hash: sha256('pending'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blockchainTransactions: [],
  });
  assert.equal(notAnchored.integrityStatus, 'NOT_ANCHORED');
  assert.equal(notAnchored.lastTransactionHash, null);
});

test('11. blockchain event hash is authoritative over local document and transaction hashes', async () => {
  const alternateHash = sha256('database-only-hash');
  const result = await performTamperCheck(
    {
      userId: 'user-1',
      originalDocumentId: 'doc-1',
      candidateBytes: Buffer.from(ORIGINAL, 'utf8'),
      candidateFileName: 'original.txt',
      candidateMimeType: 'text/plain',
      candidateFileSize: ORIGINAL.length,
    },
    {
      getOriginalDocument: async () => ({
        id: 'doc-1',
        originalFileName: 'original.txt',
        sha256Hash: alternateHash,
      }),
      getAnchorTransaction: async () => ({
        documentHash: alternateHash,
        transactionHash: '0xabc',
        blockNumber: 1,
        chainId: 11155111,
        contractAddress: '0xcontract',
      }),
      getAnchoredHashFromTransaction: async () => ({
        documentHash: HASH_A,
        referenceId: '0x1',
        actor: '0xactor',
        eventType: 'EVIDENCE_UPLOAD',
        timestamp: 1,
      }),
      verifyOriginalHashOnChain: async (hash) => ({
        exists: hash === HASH_A,
        referenceId: '0x1',
        actor: '0xactor',
        eventType: 'EVIDENCE_UPLOAD',
        timestamp: 1,
      }),
    },
  );

  assert.equal(result.originalHash, HASH_A);
  assert.equal(result.status, 'UNMODIFIED');
});

test('12. candidate differing from blockchain event hash is tampered even when local hashes agree', async () => {
  const databaseHash = sha256(ONE_CHAR_MODIFIED);
  const result = await performTamperCheck(
    {
      userId: 'user-1',
      originalDocumentId: 'doc-1',
      candidateBytes: Buffer.from(ONE_CHAR_MODIFIED, 'utf8'),
      candidateFileName: 'modified.txt',
      candidateMimeType: 'text/plain',
      candidateFileSize: ONE_CHAR_MODIFIED.length,
    },
    {
      getOriginalDocument: async () => ({
        id: 'doc-1',
        originalFileName: 'original.txt',
        sha256Hash: databaseHash,
      }),
      getAnchorTransaction: async () => ({
        documentHash: databaseHash,
        transactionHash: '0xabc',
        blockNumber: 1,
        chainId: 11155111,
        contractAddress: '0xcontract',
      }),
      getAnchoredHashFromTransaction: async () => ({
        documentHash: HASH_A,
        referenceId: '0x1',
        actor: '0xactor',
        eventType: 'EVIDENCE_UPLOAD',
        timestamp: 1,
      }),
      verifyOriginalHashOnChain: async () => ({
        exists: true,
        referenceId: '0x1',
        actor: '0xactor',
        eventType: 'EVIDENCE_UPLOAD',
        timestamp: 1,
      }),
    },
  );

  assert.equal(result.originalHash, HASH_A);
  assert.equal(result.status, 'TAMPERED');
  assert.equal(result.hashMatches, false);
});
