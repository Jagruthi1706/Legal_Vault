/**
 * Stage 3 Knowledge Base import CLI (backend-only, run from the backend/ dir).
 *
 *   npx ts-node --transpile-only src/services/ai/legal/knowledge-base/kb-import.cli.ts --dry-run
 *   npx ts-node --transpile-only src/services/ai/legal/knowledge-base/kb-import.cli.ts --import
 *
 * --dry-run (default): full plan report, ZERO database writes.
 * --import: real import into the existing PostgresVectorStore/LegalAuthorityChunk
 * table, followed by Prisma persistence verification. Aborts on: record-count
 * mismatch, non-Postgres target, provenance-blocked-everything, preflight
 * failure, or any chunk missing from PostgreSQL afterwards.
 */

import 'dotenv/config';
import {
  KB_EXPECTED_STATUTORY_RECORDS,
  kbImportService,
} from './kb-import.service';

const run = async (): Promise<number> => {
  const isRealImport = process.argv.includes('--import');

  if (!isRealImport) {
    const plan = await kbImportService.dryRun({
      expectedRecordCount: KB_EXPECTED_STATUTORY_RECORDS,
    });
    console.log('[KB dry-run] (zero database writes performed)');
    console.log(JSON.stringify(plan, null, 2));
    if (!plan.recordCountMatchesExpectation) {
      console.error(
        `[KB dry-run] ABORT: statutory record count ${plan.statutoryRecordsFound} != expected ${KB_EXPECTED_STATUTORY_RECORDS}.`,
      );
      return 1;
    }
    if (!plan.usingPostgresStore) {
      console.error(
        `[KB dry-run] ABORT: target vector store is "${plan.targetVectorStore}", not postgres.`,
      );
      return 1;
    }
    console.log(
      `[KB dry-run] plan OK: ${plan.readyRecords.length} record(s) ready (${plan.chunksToWrite} chunks), ` +
        `${plan.blockedRecords.length} blocked by provenance/license validation.`,
    );
    return 0;
  }

  console.log('[KB import] starting real import…');
  const result = await kbImportService.import({
    expectedRecordCount: KB_EXPECTED_STATUTORY_RECORDS,
  });
  console.log(
    `[KB import] wrote ${result.writtenChunkIds.length} chunk(s) from ${result.readyRecords.length} record(s); ` +
      `${result.blockedRecords.length} record(s) blocked by provenance/license validation.`,
  );
  if (result.blockedRecords.length > 0) {
    console.log('[KB import] blocked records (fail-closed, NOT stored):');
    for (const blocked of result.blockedRecords) {
      console.log(
        `  - ${blocked.recordId} (${blocked.officialSourceName}, ${blocked.officialSourceUrl}): ${blocked.reason}`,
      );
    }
  }
  console.log('[KB import] persistence verification:');
  console.log(JSON.stringify(result.verification, null, 2));
  return result.verification.ok ? 0 : 1;
};

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error('[KB import] FAILED:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });