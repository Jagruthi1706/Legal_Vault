import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiProvider } from '../src/services/ai/gemini.provider';
import { AIGenerateInput, RetrievedChunk } from '../src/services/ai/types';

/**
 * Regression tests for provider-failure messaging (Gemini boundary).
 *
 * Root cause fixed: when the Gemini provider failed (HTTP 429 rate limit,
 * network error, timeout, empty or invalid response) the generic unavailable
 * answer claimed "retrieval did not return supporting sources" even though the
 * retrieval pipeline HAD returned supporting sources. The user was misled into
 * thinking the retrieval/grounding pipeline was broken.
 *
 * Grounding is NOT weakened here: every failure path still returns
 * status='unavailable' with no inferred facts and no fabricated sources.
 */

const legalChunk: RetrievedChunk = {
  caseId: 'legal-corpus',
  documentId: 'statute-cpc-1908-section-9',
  chunkId: 'statute-cpc-1908-section-9:kb:1',
  documentName: 'Code of Civil Procedure, 1908 — section 9',
  pageOrSection: 'Section 9',
  text:
    'The courts shall (subject to the provisions herein contained) have jurisdiction to try all suits of a civil nature excepting suits of which their cognizance is either expressly or impliedly barred.',
  relevance: 0.92,
  sourceType: 'legal_authority',
  scope: 'LEGAL_AUTHORITY',
  provenance: {
    source: 'India Code',
    sourceUrl: 'https://www.indiacode.nic.in/',
    license: 'public-domain',
    citation: 'Section 9, Code of Civil Procedure, 1908',
    documentType: 'statute',
    jurisdiction: 'India',
  },
};

const groundedInput: AIGenerateInput = {
  applicationInstructions: 'Legal Vault Copilot.',
  userQuery: 'What is Section 9 CPC?',
  context: [],
  caseContext: [],
  legalContext: [legalChunk],
  precedentContext: [],
  operation: 'answer',
};

const providerConfig = { apiKey: 'test-key-not-a-secret', model: 'gemini-test', timeoutMs: 500, maxRetries: 0 };

const stubResponse = (status: number, payload: unknown): typeof fetch =>
  (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  })) as unknown as typeof fetch;

test('HTTP 429 with retrieved sources reports provider rate limit, not retrieval failure', async () => {
  const provider = new GeminiProvider(providerConfig, stubResponse(429, { error: { code: 429, message: 'quota' } }));
  const result = await provider.generateAnswer(groundedInput);

  assert.equal(result.status, 'unavailable');
  assert.ok(!result.answer.includes('retrieval did not return supporting sources'));
  assert.ok(result.answer.includes('rate-limited'));
  assert.ok(result.warnings.includes('Provider rate-limited the request.'));
});

test('network failure with retrieved sources reports provider outage, not retrieval failure', async () => {
  const fetchImpl = (async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  const provider = new GeminiProvider(providerConfig, fetchImpl);
  const result = await provider.generateAnswer(groundedInput);

  assert.equal(result.status, 'unavailable');
  assert.ok(!result.answer.includes('retrieval did not return supporting sources'));
  assert.ok(result.answer.includes('AI provider could not be reached'));
  assert.ok(result.warnings.includes('Provider request failed.'));
});

test('invalid provider JSON with retrieved sources reports provider failure, not retrieval failure', async () => {
  const provider = new GeminiProvider(
    providerConfig,
    stubResponse(200, { candidates: [{ content: { parts: [{ text: 'not json' }] } }] }),
  );
  const result = await provider.generateAnswer(groundedInput);

  assert.equal(result.status, 'unavailable');
  assert.ok(!result.answer.includes('retrieval did not return supporting sources'));
  assert.ok(result.answer.includes('AI provider could not be reached'));
});

test('empty provider response with retrieved sources reports provider failure, not retrieval failure', async () => {
  const provider = new GeminiProvider(providerConfig, stubResponse(200, {}));
  const result = await provider.generateAnswer(groundedInput);

  assert.equal(result.status, 'unavailable');
  assert.ok(!result.answer.includes('retrieval did not return supporting sources'));
  assert.ok(result.warnings.includes('Provider returned an empty response.'));
});

test('zero retrieved sources still reports retrieval unavailability (grounding intact)', async () => {
  let fetchCalled = false;
  const fetchImpl = (async () => {
    fetchCalled = true;
    throw new Error('provider must not be called when no sources were retrieved');
  }) as unknown as typeof fetch;
  const provider = new GeminiProvider(providerConfig, fetchImpl);
  const result = await provider.generateAnswer({ ...groundedInput, legalContext: [], precedentContext: [] });

  assert.equal(fetchCalled, false);
  assert.equal(result.status, 'unavailable');
  assert.ok(result.answer.includes('retrieval did not return supporting sources'));
  assert.equal(result.legalSources.length, 0);
});

test('successful provider call returns grounded answer with provenance-intact legal sources', async () => {
  const payload = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                answer: 'Section 9 CPC vests civil jurisdiction in the courts.',
                facts: ['Section 9 of the Code of Civil Procedure, 1908.'],
                explanation: 'Derived from the retrieved statutory text.',
                unsupported: [],
                status: 'grounded',
                confidence: 0.9,
              }),
            },
          ],
        },
      },
    ],
  };
  const provider = new GeminiProvider(providerConfig, stubResponse(200, payload));
  const result = await provider.generateAnswer(groundedInput);

  // The key assertion is that when the provider succeeds, we get a valid grounded answer
  // This distinguishes from the failure cases which return unavailable status
  assert.equal(result.status, 'grounded', 'Status should be grounded when provider succeeds');
  assert.ok(result.answer.length > 0, 'Answer should be present when provider succeeds');
  assert.ok(result.facts.length > 0, 'Facts should be present when provider succeeds');
  assert.ok(result.answer.includes('Section 9 CPC'), 'Answer should contain the expected content');
  assert.equal(result.legalSources.length, 1, 'Legal sources should be preserved from retrieval');
  assert.equal(result.legalSources[0].documentId, 'statute-cpc-1908-section-9', 'Legal source document ID should match');
});
