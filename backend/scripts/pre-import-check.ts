import { prisma } from '../src/utils/prisma';

const TARGET_RECORD_IDS = [
  'PREC-SUPREMECOURT-1973-AUTH-KESAVANANDA-1973',
  'PREC-SUPREMECOURT-1978-AUTH-MANEKA-1978',
  'PREC-DELHIHC-2009-AUTH-NAZ-DELHI-HC-2009',
  'PREC-SUPREMECOURT-1979-AUTH-HUSSAINARA-1979',
  'PREC-SUPREMECOURT-1996-AUTH-DK-BASU-1997',
  'PREC-SUPREMECOURT-2017-AUTH-PUTTASWAMY-2017',
];

const TARGET_CHUNK_PREFIXES = TARGET_RECORD_IDS.map((id) => `${id}:prec:`);

async function main() {
  // 1. Total chunks
  const total = await prisma.legalAuthorityChunk.count();
  console.log('=== PRE-IMPORT DATABASE CHECK (READ-ONLY) ===');
  console.log('Total LegalAuthorityChunk rows:', total);

  // 2. All rows with full detail
  const allRows = await prisma.legalAuthorityChunk.findMany({
    select: {
      id: true,
      documentId: true,
      scope: true,
      provenance: true,
      metadata: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log('\n--- ALL EXISTING ROWS ---');
  for (const row of allRows) {
    console.log(
      JSON.stringify({
        id: row.id,
        documentId: row.documentId,
        scope: row.scope,
        sourceType: row.sourceType,
        provenance: row.provenance,
        metadata: row.metadata,
      }),
    );
  }

  // 3. Check for exact record ID matches
  const exactRecordMatches = allRows.filter((row) =>
    TARGET_RECORD_IDS.includes(row.documentId),
  );
  console.log('\n--- EXACT RECORD ID MATCHES ---');
  console.log('Count:', exactRecordMatches.length);
  for (const row of exactRecordMatches) {
    console.log('MATCH:', row.id, '| documentId:', row.documentId);
  }

  // 4. Check for chunk ID prefix matches (any :prec: chunks)
  const precChunks = allRows.filter((row) =>
    row.id.includes(':prec:'),
  );
  console.log('\n--- ANY PRECEDENT (:prec:) CHUNKS ---');
  console.log('Count:', precChunks.length);
  for (const row of precChunks) {
    console.log('PREC CHUNK:', row.id, '| documentId:', row.documentId);
  }

  // 5. Check for same logical cases under different IDs (by caseName in metadata/provenance)
  const caseNames = [
    'Kesavananda Bharati Sripadagalvaru v. State of Kerala',
    'Maneka Gandhi v. Union of India',
    'Naz Foundation v. Government of NCT of Delhi',
    'Hussainara Khatoon v. Home Secretary, State of Bihar',
    'D.K. Basu v. State of West Bengal',
    'Justice K.S. Puttaswamy (Retd.) v. Union of India',
  ];
  const caseNameMatches = allRows.filter((row) => {
    const prov = (row.provenance as Record<string, unknown>) || {};
    const meta = (row.metadata as Record<string, unknown>) || {};
    const candidates = [prov.caseName, meta.caseName, meta.CASE_NAME];
    return candidates.some((c) => typeof c === 'string' && caseNames.includes(c));
  });
  console.log('\n--- SAME CASE (by caseName) UNDER ANY ID ---');
  console.log('Count:', caseNameMatches.length);
  for (const row of caseNameMatches) {
    const prov = (row.provenance as Record<string, unknown>) || {};
    console.log(
      'CASE MATCH:',
      row.id,
      '| documentId:',
      row.documentId,
      '| caseName:',
      prov.caseName,
      '| authorityKind:',
      (row.metadata as Record<string, unknown>)?.authorityKind,
    );
  }

  // 6. Reference table counts
  const [cases, documents, evidence, blockchain] = await Promise.all([
    prisma.case.count(),
    prisma.document.count(),
    prisma.evidence.count(),
    prisma.blockchainTransaction.count(),
  ]);
  console.log('\n--- REFERENCE TABLE COUNTS ---');
  console.log('cases:', cases);
  console.log('documents:', documents);
  console.log('evidence:', evidence);
  console.log('blockchainTransactions:', blockchain);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
