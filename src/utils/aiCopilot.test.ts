import assert from 'node:assert/strict';
import test from 'node:test';
import { caseScopedEmptyState, mapAIResponseToMessage } from './aiCopilot';
import type { AIResponse } from '../services/aiApi';

test('Phase 4: copilot maps mock sources without inventing citations', () => {
  const result: AIResponse = {
    answer: 'Source facts:\n- From affidavit-a.txt\nGenerated explanation: mock\nUnsupported information: none invented',
    mode: 'MOCK',
    status: 'grounded',
    confidence: 0.4,
    warnings: ['Development mock provider. No external LLM is connected.'],
    citations: [
      {
        documentId: 'doc-a1',
        documentName: 'affidavit-a.txt',
        chunkId: 'doc-a1:section:1',
        pageOrSection: 'Section 1',
        relevance: 2,
      },
    ],
    sources: [],
    caseId: 'case-a',
  };

  const message = mapAIResponseToMessage(result, '12:00');
  assert.equal(message.providerMode, 'MOCK');
  assert.deepEqual(message.sources, ['affidavit-a.txt — Section 1']);
  assert.deepEqual(message.caseSources, ['affidavit-a.txt — Section 1']);
  assert.equal(message.text.includes('AIR'), false);
});

test('Phase 4: missing case context stays empty instead of using a global copilot', () => {
  assert.equal(caseScopedEmptyState(undefined)?.includes('case workspace'), true);
  assert.equal(caseScopedEmptyState('case-a'), null);
});

test('Stage 6: temporal metadata survives from Legal KB through to answer/source representation', () => {
  const result: AIResponse = {
    answer: 'The Limitation Act 1963 governs condonation of delay.',
    mode: 'MOCK',
    status: 'grounded',
    confidence: 0.85,
    warnings: [],
    citations: [],
    sources: [],
    legalSources: [
      {
        documentId: 'IND-PROC-LIM001-V2',
        documentName: 'Limitation Act 1963 - Condonation of Delay',
        chunkId: 'IND-PROC-LIM001-V2:kb:1',
        pageOrSection: 'Core legal text',
        relevance: 0.95,
        sourceType: 'legal_authority',
        scope: 'LEGAL_AUTHORITY',
        source: 'India Code Portal, Legislative Department',
        sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/1566',
        license: 'Government of India public legislative text',
        citation: 'Limitation Act 1963, SS. 3 & 5',
        jurisdiction: 'Union of India',
        documentType: 'statute',
        temporal: {
          currentStatus: 'CURRENT LAW',
          effectiveFrom: '1964-01-01',
          effectiveTo: 'Open',
        },
      },
    ],
    caseId: 'case-a',
  };

  const message = mapAIResponseToMessage(result, '12:00');

  // Temporal metadata must survive the full path
  assert.ok(message.temporal, 'temporal metadata should be preserved');
  assert.equal(message.temporal?.currentStatus, 'CURRENT LAW');
  assert.equal(message.temporal?.effectiveFrom, '1964-01-01');
  assert.equal(message.temporal?.effectiveTo, 'Open');

  // Other fields should still be preserved
  assert.equal(message.status, 'grounded');
  assert.equal(message.confidenceScore, 0.85);
  assert.equal(message.legalSources?.length, 1);
});
