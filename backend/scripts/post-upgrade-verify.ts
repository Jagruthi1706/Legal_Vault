import { prisma } from '../src/utils/prisma';

const TARGET_DOCUMENT_IDS = [
  'auth-kesavananda-1973',
  'auth-maneka-1978',
  'auth-naz-delhi-hc-2009',
  'auth-hussainara-1979',
  'auth-dk-basu-1997',
  'auth-puttaswamy-2017',
];

const EXPECTED_SUB_AREA: Record<string, string> = {
  'auth-kesavananda-1973': 'Constitutional amendment and basic structure',
  'auth-maneka-1978': 'Personal liberty and fair procedure (Article 21)',
  'auth-naz-delhi-hc-2009': 'Equality, dignity and criminalization (reading down)',
  'auth-hussainara-1979': 'Speedy trial and personal liberty',
  'auth-dk-basu-1997': 'Arrest and detention safeguards (Article 21)',
  'auth-puttaswamy-2017': 'Privacy and proportionality',
};

const EXPECTED_APPLICABLE: Record<string, Record<string, string>> = {
  'auth-kesavananda-1973': { APPLICABLE_STATUTES: 'Constitution of India' },
  'auth-maneka-1978': { APPLICABLE_ARTICLES: 'Article 21' },
  'auth-naz-delhi-hc-2009': { APPLICABLE_ARTICLES: 'Articles 14, 15 and 21', APPLICABLE_STATUTES: 'Indian Penal Code, 1860', APPLICABLE_SECTIONS: 'Section 377' },
  'auth-hussainara-1979': { APPLICABLE_ARTICLES: 'Article 21' },
  'auth-dk-basu-1997': { APPLICABLE_ARTICLES: 'Article 21' },
  'auth-puttaswamy-2017': { APPLICABLE_ARTICLES: 'Articles 14, 19 and 21' },
};

const UNSUPPORTED_FIELDS = ['FACTS', 'ISSUES', 'ARGUMENTS', 'LEGAL_PRINCIPLE', 'RATIO', 'FINAL_OUTCOME', 'REMEDY', 'RELIEF', 'BENCH', 'JUDGES', 'RELATED_CASES', 'FOLLOWED_CASES', 'DISTINGUISHED_CASES', 'OVERRULED_STATUS', 'CURRENT_STATUS', 'TEMPORAL_METADATA', 'APPLICABLE_RULES'];

async function main() {
  console.log('=== POST-UPGRADE VERIFICATION (READ-ONLY) ===\n');

  const allRows = await prisma.legalAuthorityChunk.findMany({ orderBy: { id: 'asc' } });
  const totalRows = allRows.length;
  console.log('1. Total LegalAuthorityChunk rows:', totalRows, totalRows === 44 ? '✅' : '❌ EXPECTED 44');

  const targetRows = allRows.filter((row) => TARGET_DOCUMENT_IDS.includes(row.documentId));
  console.log('2. Target records found:', targetRows.length, targetRows.length === 6 ? '✅' : '❌');

  // Check each record
  let allChecksPass = true;
  for (const docId of TARGET_DOCUMENT_IDS) {
    const row = allRows.find((r) => r.documentId === docId);
    if (!row) {
      console.log(`❌ ${docId}: NOT FOUND`);
      allChecksPass = false;
      continue;
    }
    const meta = (row.metadata as Record<string, unknown>) || {};
    const prov = (row.provenance as Record<string, unknown>) || {};

    const checks: [string, boolean][] = [
      ['authorityKind=judicial_precedent', meta.authorityKind === 'judicial_precedent'],
      ['sourceType=legal_authority', meta.sourceType === 'legal_authority'],
      ['contentCompleteness=development-excerpt', meta.contentCompleteness === 'development-excerpt'],
      ['reportStatus=not-an-official-report', meta.reportStatus === 'not-an-official-report'],
      ['LEGAL_AREA=Constitutional Law', meta.LEGAL_AREA === 'Constitutional Law'],
      ['SUB_AREA correct', meta.SUB_AREA === EXPECTED_SUB_AREA[docId]],
      ['documentType=judgment', meta.documentType === 'judgment' || prov.documentType === 'judgment'],
      ['scope=LEGAL_AUTHORITY', row.scope === 'LEGAL_AUTHORITY'],
    ];

    // Check applicable fields
    const expectedAppl = EXPECTED_APPLICABLE[docId];
    for (const [key, val] of Object.entries(expectedAppl)) {
      checks.push([`${key}=${val}`, meta[key] === val]);
    }

    // Check unsupported fields absent
    for (const field of UNSUPPORTED_FIELDS) {
      checks.push([`${field} absent`, meta[field] === undefined]);
    }

    // Check provenance preserved
    checks.push(['provenance.source preserved', prov.source === 'KanoonGPT Indian Case Laws (development subset)']);
    checks.push(['provenance.license preserved', prov.license === 'Apache-2.0']);
    checks.push(['provenance.caseName preserved', typeof prov.caseName === 'string' && prov.caseName.length > 0]);
    checks.push(['provenance.citation preserved', typeof prov.citation === 'string' && prov.citation.length > 0]);

    const failed = checks.filter(([, pass]) => !pass);
    if (failed.length === 0) {
      console.log(`✅ ${docId}: ALL ${checks.length} checks passed`);
    } else {
      console.log(`❌ ${docId}: ${failed.length} failures`);
      for (const [name] of failed) console.log(`   - ${name}`);
      allChecksPass = false;
    }
  }

  // Check no new precedent rows created
  const precChunks = allRows.filter((r) => r.id.includes(':prec:'));
  console.log('\n3. New :prec: chunks created:', precChunks.length, precChunks.length === 0 ? '✅' : '❌');

  // Check statutory KB rows unchanged
  const statutoryRows = allRows.filter((r) => r.id.includes(':kb:'));
  console.log('4. Statutory KB rows (:kb:):', statutoryRows.length, statutoryRows.length === 24 ? '✅' : '⚠️ (expected 24)');

  // Check no PREC- documentIds
  const precDocIds = allRows.filter((r) => r.documentId.startsWith('PREC-'));
  console.log('5. PREC- documentIds created:', precDocIds.length, precDocIds.length === 0 ? '✅' : '❌');

  // Reference table counts
  const [cases, documents, evidence, blockchain] = await Promise.all([
    prisma.case.count(),
    prisma.document.count(),
    prisma.evidence.count(),
    prisma.blockchainTransaction.count(),
  ]);
  console.log('\n6. Reference table counts:');
  console.log('   cases:', cases, cases === 3 ? '✅' : '⚠️');
  console.log('   documents:', documents, documents === 16 ? '✅' : '⚠️');
  console.log('   evidence:', evidence, evidence === 3 ? '✅' : '⚠️');
  console.log('   blockchainTransactions:', blockchain, blockchain === 10 ? '✅' : '⚠️');

  console.log('\n=== VERIFICATION', allChecksPass ? 'PASSED ✅' : 'FAILED ❌', '===');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
