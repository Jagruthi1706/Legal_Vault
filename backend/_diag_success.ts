import 'dotenv/config';

/** Isolated repro of provider-failure-messaging success-path failure. */
async function main() {
  const { GeminiProvider } = await import('./src/services/ai/gemini.provider');
  const legalChunk = {
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
  const stub = (async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
  })) as unknown as typeof fetch;
  const provider = new GeminiProvider(
    { apiKey: 'test-key', model: 'gemini-test', timeoutMs: 500, maxRetries: 0 },
    stub,
  );
  const result = await provider.generateAnswer({
    applicationInstructions: 'Legal Vault Copilot.',
    userQuery: 'What is Section 9 CPC?',
    context: [],
    caseContext: [],
    legalContext: [legalChunk],
    precedentContext: [],
    operation: 'answer',
  });
  console.log('status:', result.status);
  console.log('answer:', result.answer.slice(0, 300));
  console.log('warnings:', JSON.stringify(result.warnings));
  console.log('legalSources:', result.legalSources.length);
}
main().catch((e) => { console.error('fatal:', e); process.exit(1); });
