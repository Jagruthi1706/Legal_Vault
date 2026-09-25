import { prisma } from '../src/utils/prisma';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_CASE_NAMES = [
  'Kesavananda Bharati Sripadagalvaru v. State of Kerala',
  'Maneka Gandhi v. Union of India',
  'Naz Foundation v. Government of NCT of Delhi',
  'Hussainara Khatoon v. Home Secretary, State of Bihar',
  'D.K. Basu v. State of West Bengal',
  'Justice K.S. Puttaswamy (Retd.) v. Union of India',
];

const STRUCTURED_CORPUS_PATH = path.join(
  __dirname,
  '..',
  'src',
  'services',
  'ai',
  'legal',
  'knowledge-base',
  'precedents',
  'kanoongpt-dev-subset-batch1.txt',
);

function matchCase(caseName: string | undefined): string | undefined {
  if (typeof caseName !== 'string') return undefined;
  return TARGET_CASE_NAMES.find((t) => caseName.includes(t) || t.includes(caseName));
}

function parseCorpusFields(record: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of record.replace(/\r/g, '').split('\n')) {
    const m = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

async function main() {
  console.log('=== STAGE 14A — PRECEDENT UPGRADE AUDIT (READ-ONLY) ===\n');

  const allRows = await prisma.legalAuthorityChunk.findMany({ orderBy: { id: 'asc' } });

  const precedentRows = allRows.filter((row) => {
    const prov = (row.provenance as Record<string, unknown>) || {};
    const meta = (row.metadata as Record<string, unknown>) || {};
    const caseName = (prov.caseName || meta.caseName || meta.CASE_NAME) as string | undefined;
    return typeof caseName === 'string' && !!matchCase(caseName);
  });

  console.log('--- SIX EXISTING PRECORDS ---\n');
  for (const row of precedentRows) {
    const prov = (row.provenance as Record<string, unknown>) || {};
    const meta = (row.metadata as Record<string, unknown>) || {};
    const caseName = (prov.caseName || meta.caseName) as string | undefined;
    console.log('CASE:', matchCase(caseName));
    console.log('  id          :', row.id);
    console.log('  documentId  :', row.documentId);
    console.log('  scope       :', row.scope);
    console.log('  text length :', row.text.length);
    console.log('  text preview:', row.text.slice(0, 180).replace(/\n/g, ' '));
    console.log('  provenance  :', JSON.stringify(prov));
    console.log('  metadata    :', JSON.stringify(meta));
    console.log('');
  }

  // Corpus parsing
  const corpusText = fs.readFileSync(STRUCTURED_CORPUS_PATH, 'utf8');
  const corpusRecords = corpusText
    .split('='.repeat(80))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.startsWith('Record:'))
    .map(parseCorpusFields);

  console.log('\n--- STRUCTURED CORPUS RECORDS ---\n');
  console.log('Count:', corpusRecords.length);
  for (const cf of corpusRecords) {
    console.log('CASE:', cf['CASE_NAME']);
    console.log('  Record      :', cf['Record']);
    console.log('  COURT       :', cf['COURT']);
    console.log('  DATE        :', cf['DATE']);
    console.log('  CITATION    :', cf['CITATION']);
    console.log('  SOURCE_URL  :', cf['OFFICIAL_SOURCE_URL']);
    console.log('  IDENTIFIER  :', cf['OFFICIAL_IDENTIFIER']);
    console.log('  LEGAL_AREA  :', cf['LEGAL_AREA']);
    console.log('  SUB_AREA    :', cf['SUB_AREA']);
    console.log('  HOLDING len :', (cf['HOLDING'] || '').length);
    console.log('  HOLDING     :', (cf['HOLDING'] || 'N/A').slice(0, 160));
    console.log('  FACTS       :', cf['FACTS'] || 'N/A');
    console.log('  ISSUES      :', cf['ISSUES'] || 'N/A');
    console.log('  PRINCIPLE   :', cf['LEGAL_PRINCIPLE'] || 'N/A');
    console.log('  RATIO       :', cf['RATIO'] || 'N/A');
    console.log('  OUTCOME     :', cf['FINAL_OUTCOME'] || 'N/A');
    console.log('  REMEDY      :', cf['REMEDY'] || 'N/A');
    console.log('  VERIFICATION:', cf['VERIFICATION_STATUS']);
    console.log('');
  }

  // Cross-comparison
  console.log('\n--- CROSS-COMPARISON: DB vs CORPUS ---\n');
  for (const row of precedentRows) {
    const prov = (row.provenance as Record<string, unknown>) || {};
    const meta = (row.metadata as Record<string, unknown>) || {};
    const caseName = (prov.caseName || meta.caseName) as string | undefined;
    const matched = matchCase(caseName);
    const cf = corpusRecords.find((c) => {
      const cname = c['CASE_NAME'] || '';
      return cname.includes(matched || '') || (!!matched && matched.includes(cname));
    });
    console.log('CASE:', matched);
    console.log('  DB id           :', row.id);
    console.log('  DB sourceUrl    :', prov.sourceUrl);
    console.log('  Corpus sourceUrl:', cf?.['OFFICIAL_SOURCE_URL'] || 'N/A');
    console.log('  URLs match      :', prov.sourceUrl === cf?.['OFFICIAL_SOURCE_URL']);
    console.log('  DB citation     :', prov.citation);
    console.log('  Corpus citation :', cf?.['CITATION'] || 'N/A');
    console.log('  DB source       :', prov.source);
    console.log('  Corpus source   :', cf?.['OFFICIAL_SOURCE_NAME'] || 'N/A');
    console.log('  DB license      :', prov.license);
    console.log('  DB authorityKind:', meta.authorityKind);
    console.log('  DB text == Corpus HOLDING:', row.text.trim() === (cf?.['HOLDING'] || '').trim());
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
