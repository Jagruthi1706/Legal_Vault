/**
 * Stage 12 Judicial Precedent import CLI (backend-only, run from the backend/ dir).
 *
 *   npx ts-node --transpile-only src/services/ai/legal/knowledge-base/precedent-import.cli.ts --dry-run
 *   npx ts-node --transpile-only src/services/ai/legal/knowledge-base/precedent-import.cli.ts --dry-run --expect 3
 *   npx ts-node --transpile-only src/services/ai/legal/knowledge-base/precedent-import.cli.ts --import --expect 3
 *
 * --dry-run (default): full plan report, ZERO database writes.
 * --import: real import into the existing PostgresVectorStore/LegalAuthorityChunk
 * table, followed by Prisma persistence verification. A real import REQUIRES an
 * explicit `--expect N` record-count expectation and aborts on: record-count
 * mismatch, embedding-dimension mismatch, any invalid/duplicate record,
 * non-Postgres target, provenance-blocked-everything, preflight failure, or any
 * chunk missing from PostgreSQL afterwards.
 *
 * DRY-RUN FIRST: this CLI never performs a real import unless `--import` is
 * explicitly passed. No precedent corpus has been approved yet, so the default
 * dry-run over the (currently empty) precedents/ folder reports zero records.
 */

import 'dotenv/config';
import { precedentImportService } from './precedent-import.service';

const readExpectOption = (): number | undefined => {
  const index = process.argv.indexOf('--expect');
  if (index === -1) {
    return undefined;
  }
  const raw = process.argv[index + 1];
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0 || `${parsed}` !== raw) {
    throw new Error(`Invalid --expect value: ${raw}. Use a non-negative integer, e.g. --expect 3.`);
  }
  return parsed;
};

const run = async (): Promise<number> => {
  const isRealImport = process.argv.includes('--import');
  const expectedRecordCount = readExpectOption();

  if (!isRealImport) {
    const plan = await precedentImportService.dryRun({ expectedRecordCount });
    console.log('[precedent dry-run] (zero database writes performed)');
    console.log(JSON.stringify(plan, null, 2));
    if (!plan.usingPostgresStore) {
      console.error(
        `[precedent dry-run] ABORT: target vector store is "${plan.targetVectorStore}", not postgres.`,
      );
      return 1;
    }
    if (!plan.recordCountMatchesExpectation) {
      console.error(
        `[precedent dry-run] ABORT: precedent record count ${plan.precedentRecordsFound} != expected ${plan.expectedRecordCount}.`,
      );
      return 1;
    }
    console.log(
      `[precedent dry-run] plan OK: ${plan.precedentRecordsFound} record(s) discovered — ` +
        `${plan.readyRecords.length} ready (${plan.chunksToWrite} chunks), ` +
        `${plan.blockedRecords.length} blocked by provenance/license validation, ` +
        `${plan.invalidRecords.length} structurally invalid, ` +
        `${plan.duplicateRecordIds.length} duplicate record id(s).`,
    );
    return 0;
  }

  if (expectedRecordCount === undefined) {
    console.error(
      '[precedent import] ABORT: a real import requires an explicit --expect N record-count expectation.',
    );
    return 1;
  }

  console.log('[precedent import] starting real import…');
  const result = await precedentImportService.import({
    expectedRecordCount,
  });
  console.log(
    `[precedent import] wrote ${result.writtenChunkIds.length} chunk(s) from ${result.readyRecords.length} record(s); ` +
      `${result.blockedRecords.length} record(s) blocked by provenance/license validation.`,
  );
  if (result.blockedRecords.length > 0) {
    console.log('[precedent import] blocked records (fail-closed, NOT stored):');
    for (const blocked of result.blockedRecords) {
      console.log(
        `  - ${blocked.recordId} (${blocked.officialSourceName}, ${blocked.officialSourceUrl}): ${blocked.reason}`,
      );
    }
  }
  console.log('[precedent import] persistence verification:');
  console.log(JSON.stringify(result.verification, null, 2));
  return result.verification.ok ? 0 : 1;
};

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(
      '[precedent import] FAILED:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
