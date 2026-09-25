import assert from 'node:assert/strict';
import test from 'node:test';
import { Interface } from 'ethers';
import { BlockchainService } from '../src/services/blockchain.service';
import { LEGAL_VAULT_ABI } from '../src/config/blockchain';

const documentHash = `0x${'ab'.repeat(32)}`;
const referenceId = `0x${'cd'.repeat(32)}`;
const actor = '0x0000000000000000000000000000000000000001';
const eventType = 'EVIDENCE_UPLOAD';
const timestamp = 123n;

const createServiceWithReceipt = (logs: readonly unknown[], receipt: object | null) => {
  const service = new BlockchainService({
    rpcUrl: 'http://127.0.0.1:8545',
    contractAddress: '0x0000000000000000000000000000000000000002',
  });
  const implementation = service as unknown as {
    provider: { getTransactionReceipt: (hash: string) => Promise<object | null> };
  };
  implementation.provider = {
    getTransactionReceipt: async () => receipt ? { ...receipt, logs } : null,
  };
  return service;
};

test('reads the DocumentAnchored event from a confirmed transaction receipt', async () => {
  const contractInterface = new Interface(LEGAL_VAULT_ABI);
  const encoded = contractInterface.encodeEventLog(
    contractInterface.getEvent('DocumentAnchored'),
    [documentHash, referenceId, actor, eventType, timestamp],
  );
  const service = createServiceWithReceipt([{ topics: encoded.topics, data: encoded.data }], { status: 1 });

  const anchor = await service.getAnchoredHashFromTransaction('0xtransaction');

  assert.equal(anchor.documentHash, documentHash.slice(2));
  assert.equal(anchor.referenceId, referenceId);
  assert.equal(anchor.actor, actor);
  assert.equal(anchor.eventType, eventType);
  assert.equal(anchor.timestamp, Number(timestamp));
});

test('fails safely when the transaction receipt is missing or has no anchor event', async () => {
  const missing = createServiceWithReceipt([], null);
  await assert.rejects(() => missing.getAnchoredHashFromTransaction('0xmissing'));

  const noEvent = createServiceWithReceipt([{ topics: [], data: '0x' }], { status: 1 });
  await assert.rejects(() => noEvent.getAnchoredHashFromTransaction('0xno-event'));
});

test('anchor receipt lookup is read-only and performs no wallet operation', async () => {
  const contractInterface = new Interface(LEGAL_VAULT_ABI);
  const encoded = contractInterface.encodeEventLog(
    contractInterface.getEvent('DocumentAnchored'),
    [documentHash, referenceId, actor, eventType, timestamp],
  );
  const service = createServiceWithReceipt([{ topics: encoded.topics, data: encoded.data }], { status: 1 });

  await service.getAnchoredHashFromTransaction('0xtransaction');
  assert.equal((service as unknown as { wallet?: unknown }).wallet, undefined);
});