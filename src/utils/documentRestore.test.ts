import assert from 'node:assert/strict';
import test from 'node:test';
import {
  explorerTxUrlFor,
  toAnchorState,
  toUploadedDoc,
} from './documentRestore';
import type { DocumentMetadata } from '../types/api';

const baseDoc: DocumentMetadata = {
  id: 'doc-1',
  caseId: 'case-1',
  uploadedById: 'user-1',
  originalFileName: 'Case001_Tamper_Test_Original.txt',
  mimeType: 'text/plain',
  fileSize: 120,
  documentType: 'EVIDENCE',
  description: null,
  version: 1,
  sha256Hash: 'a'.repeat(64),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  integrityStatus: 'ANCHORED',
  lastTransactionHash: '0xabc123',
  lastBlockNumber: 11467711,
  lastChainId: 11155111,
  lastContractAddress: '0x28e2D8761c1fBaA937f6Fc35A8E8111b973ae4F0',
};

test('10. frontend restore helpers rebuild document + anchor panels after refresh', () => {
  const uploaded = toUploadedDoc(baseDoc);
  assert.equal(uploaded.persistenceStatus, 'PERSISTED');
  assert.equal(uploaded.integrityStatus, 'ANCHORED');
  assert.equal(uploaded.sha256Hash, baseDoc.sha256Hash);

  const anchor = toAnchorState(baseDoc);
  assert.ok(anchor);
  assert.equal(anchor!.alreadyAnchored, true);
  assert.equal(anchor!.transactionHash, '0xabc123');
  assert.equal(anchor!.blockNumber, 11467711);
  assert.equal(anchor!.networkName, 'Ethereum Sepolia');
  assert.equal(
    anchor!.explorerTxUrl,
    explorerTxUrlFor(11155111, '0xabc123'),
  );
});

test('10b. restore without anchor metadata stays unanchored', () => {
  const doc: DocumentMetadata = {
    ...baseDoc,
    integrityStatus: 'NOT_ANCHORED',
    lastTransactionHash: null,
    lastBlockNumber: null,
    lastChainId: null,
    lastContractAddress: null,
    blockchainTransactions: [],
  };
  assert.equal(toUploadedDoc(doc).integrityStatus, 'NOT_ANCHORED');
  assert.equal(toAnchorState(doc), null);
});
