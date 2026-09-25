import 'dotenv/config';

/** Read-only: run the real answerCoverage gate against real DB chunk texts. */
async function main() {
  const { prisma } = await import('./src/utils/prisma');
  const { answerCoverage, extractContentTerms } = await import('./src/services/ai/relevance');

  const questions = [
    'Define civil case',
    'What is Section 9 CPC?',
    'What are the particulars of a plaint under Order VII Rule 1 CPC?',
  ];

  const rows = await prisma.legalAuthorityChunk.findMany({ take: 1000 });

  // 1) Raw metadata keys + a sample of texts.
  const keySets = new Map<string, number>();
  for (const r of rows) {
    const md = (r.metadata ?? {}) as Record<string, unknown>;
    const sig = Object.keys(md).sort().join(',');
    keySets.set(sig, (keySets.get(sig) ?? 0) + 1);
  }
  for (const [sig, count] of [...keySets.entries()].slice(0, 10)) {
    console.log(`[keys] ${count} rows: ${sig}`);
  }
  const cpcToken = rows.filter((r) => /\bcpc\b/i.test(r.text)).length;
  const civilToken = rows.filter((r) => /\bcivil\b/i.test(r.text)).length;
  const plaintToken = rows.filter((r) => /\bplaint\b/i.test(r.text)).length;
  console.log(`[text] rows containing 'cpc'=${cpcToken} 'civil'=${civilToken} 'plaint'=${plaintToken} of ${rows.length}`);
  const s9 = rows.find((r) => /section-9(?!\d)/i.test(r.id) || /section\s*9/i.test(r.text.slice(0, 200)));
  if (s9) {
    console.log(`[sample] id=${s9.id}`);
    console.log(`[sample] text[0..400]: ${s9.text.slice(0, 400).replace(/\s+/g, ' ')}`);
    const cov = answerCoverage('What is Section 9 CPC?', s9.text);
    console.log(`[sample] coverage decision=${cov.decision} terms=[${cov.terms.join(',')}] missing=[${cov.missing.join(',')}]`);
  } else {
    console.log('[sample] no section-9 chunk found');
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error('[diag] fatal:', e instanceof Error ? e.message : e); process.exit(1); });
