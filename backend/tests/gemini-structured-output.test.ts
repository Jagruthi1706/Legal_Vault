import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiProvider } from '../src/services/ai/gemini.provider';
import { AI_APPLICATION_INSTRUCTIONS, AIGenerateInput, RetrievedChunk } from '../src/services/ai/types';

/**
 * Focused regression coverage for the Stage 16 real-runtime bug: the configured
 * Gemini model returned `facts`/`unsupported` as multi-line strings, the strict
 * schema rejected the whole response, and a valid grounded answer was replaced
 * by unavailableAnswer(...). The fake fetch keeps this test hermetic (no
 * network, no real API key) while exercising the real provider code path.
 */

const CASE_CHUNK: RetrievedChunk = {
  caseId: 'case-1',
  documentId: 'attachment:1',
  chunkId: 'no-case:attachment:1',
  documentName: 'fir.txt',
  pageOrSection: 'Section 1',
  text:
    'FIRST INFORMATION REPORT UNDER SECTION 154. The complainant states he was wrongfully restrained ' +
    'near the market gate and an offence under section 341 may be registered.',
  relevance: 1,
  sourceType: 'document',
  scope: 'CASE_DOCUMENT',
};

const buildInput = (): AIGenerateInput => ({
  applicationInstructions: AI_APPLICATION_INSTRUCTIONS,
  // Fully covered by CASE_CHUNK text so the assembler coverage gate stays 'ok'
  // and the model's own 'grounded' status passes through to the assertion.
  userQuery: 'report section offence',
  context: [CASE_CHUNK],
  caseContext: [CASE_CHUNK],
  legalContext: [],
  precedentContext: [],
  operation: 'answer',
});

const providerWithModelJson = (modelJson: unknown): GeminiProvider =>
  new GeminiProvider(
    { apiKey: 'test-only-key', model: 'gemini-test-model', timeoutMs: 200, maxRetries: 0 },
    (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(modelJson) }] } }],
      }),
    })) as unknown as typeof fetch,
  );

const assertNotUnavailable = (
  result: Awaited<ReturnType<GeminiProvider['generateAnswer']>>,
) => {
  assert.equal(result.status === 'unavailable', false, `expected a grounded answer, got: ${JSON.stringify(result.warnings)}`);
  assert.equal(
    result.warnings.some((warning) => warning.includes('not valid structured output')),
    false,
  );
};

describe('Gemini structured output normalization (Stage 16 runtime regression)', () => {
  it('accepts facts/unsupported returned as string arrays (unchanged behavior)', async () => {
    const provider = providerWithModelJson({
      answer: 'Grounded answer from the sources.',
      facts: ['Fact one from the report.', 'Fact two from the report.'],
      explanation: 'Explained from the retrieved case evidence.',
      unsupported: ['Nothing invented.'],
      status: 'grounded',
      confidence: 0.7,
    });
    const result = await provider.generateAnswer(buildInput());
    assertNotUnavailable(result);
    assert.deepEqual(result.facts, ['Fact one from the report.', 'Fact two from the report.']);
    assert.deepEqual(result.unsupported, ['Nothing invented.']);
    assert.equal(result.mode, 'GEMINI');
  });

  it('normalizes facts/unsupported returned as single multi-line strings', async () => {
    const provider = providerWithModelJson({
      answer: 'Grounded answer from the sources.',
      facts: 'Fact one from the report.\nFact two from the report.\n\n  Fact three from the report.  \n',
      explanation: 'Explained from the retrieved case evidence.',
      unsupported: 'Nothing invented.\nDo not infer judges.',
      status: 'grounded',
      confidence: 0.7,
    });
    const result = await provider.generateAnswer(buildInput());
    assertNotUnavailable(result);
    assert.deepEqual(result.facts, [
      'Fact one from the report.',
      'Fact two from the report.',
      'Fact three from the report.',
    ]);
    assert.deepEqual(result.unsupported, ['Nothing invented.', 'Do not infer judges.']);
    assert.equal(result.status, 'grounded');
  });

  it('still rejects invalid unrelated fields and non-list types', async () => {
    const badAnswer = await providerWithModelJson({
      answer: 123,
      facts: ['Fact one from the report.'],
      explanation: 'Explained.',
      unsupported: [],
    }).generateAnswer(buildInput());
    assert.equal(badAnswer.status, 'unavailable');
    assert.ok(badAnswer.warnings.some((warning) => warning.includes('not valid structured output')));

    const objectFacts = await providerWithModelJson({
      answer: 'Grounded answer from the sources.',
      facts: { not: 'a list' },
      explanation: 'Explained.',
      unsupported: [],
    }).generateAnswer(buildInput());
    assert.equal(objectFacts.status, 'unavailable');
    assert.ok(objectFacts.warnings.some((warning) => warning.includes('not valid structured output')));
  });

  it('previously reproduced Gemini-shaped response reaches assembleAnswer instead of unavailableAnswer', async () => {
    // Shape mirroring the real captured gemini-3.6-flash response: list fields as strings.
    const provider = providerWithModelJson({
      answer:
        'ANSWER:\nAn analysis of the attached report indicates allegations of wrongful restraint.\n\nRELEVANT FACTS FROM ATTACHED DOCUMENT:\n- Document Type: First Information Report under Section 154.',
      facts:
        'Document Type: First Information Report under Section 154.\nIncident: wrongful restraint near the market gate.',
      explanation: 'The answer relies only on the attached case evidence.',
      unsupported: 'Judicial precedents were not retrieved for this question.',
      status: 'grounded',
      confidence: 0.8,
    });
    const result = await provider.generateAnswer(buildInput());
    assertNotUnavailable(result);
    assert.equal(result.status, 'grounded');
    assert.equal(result.mode, 'GEMINI');
    assert.ok(result.answer.includes('analysis of the attached report'));
    assert.equal(result.caseSources.length, 1);
    assert.equal(result.caseSources[0].documentName, 'fir.txt');
    assert.equal(result.facts.length, 2);
    assert.deepEqual(result.unsupported, ['Judicial precedents were not retrieved for this question.']);
  });
});
