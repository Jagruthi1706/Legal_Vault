import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Stage 14B — In-place metadata upgrade for the 6 existing judicial precedents.
 *
 * MATCHING: corpus OFFICIAL_IDENTIFIER === DB documentId (exact, deterministic).
 * STRATEGY: additive metadata only. No IDs, text, embeddings, or provenance touched.
 * SAFETY: --dry-run by default; --apply required for writes. Idempotent.
 */

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

/** The 6 documentIds we intend to upgrade. */
const TARGET_DOCUMENT_IDS = [
  'auth-kesavananda-1973',
  'auth-maneka-1978',
  'auth-naz-delhi-hc-2009',
  'auth-hussainara-1979',
  'auth-dk-basu-1997',
  'auth-puttaswamy-2017',
];

/** Fields we are allowed to add from the verified corpus. */
const SUPPORTED_CORPUS_FIELDS = [
  'APPLICABLE_ARTICLES',
  'APPLICABLE_STATUTES',
  'APPLICABLE_SECTIONS',
] as const;

interface CorpusRecord {
  recordId: string;
  officialIdentifier: string;
  subArea: string;
  APPLICABLE_ARTICLES: string;
  APPLICABLE_STATUTES: string;
  APPLICABLE_SECTIONS: string;
}

interface UpgradePlan {
  documentId: string;
  chunkId: string;
  citation: string;
  sourceUrl: string;
  matched: boolean;
  corpusRecordId: string;
  existingMetadata: Record<string, unknown>;
  additions: Record<string, unknown>;
  alreadyPresent: Record<string, unknown>;
  unchanged: boolean;
}

export function parseCorpus(text: string): CorpusRecord[] {
  const records: CorpusRecord[] = [];
  const sections = text.split('='.repeat(80)).map((s) => s.trim()).filter((s) => s.length > 0);
  for (const section of sections) {
    if (!section.startsWith('Record:')) continue;
    const fields: Record<string, string> = {};
    for (const line of section.replace(/\r/g, '').split('\n')) {
      const m = line.match(/^([A-Z_]+):\s*(.*)$/);
      if (m) fields[m[1]] = m[2].trim();
    }
    const identifier = fields['OFFICIAL_IDENTIFIER'];
    if (!identifier) continue;
    records.push({
      recordId: fields['Record'] || fields['CASE_ID'] || '',
      officialIdentifier: identifier,
      subArea: fields['SUB_AREA'] || '',
      APPLICABLE_ARTICLES: fields['APPLICABLE_ARTICLES'] || '',
      APPLICABLE_STATUTES: fields['APPLICABLE_STATUTES'] || '',
      APPLICABLE_SECTIONS: fields['APPLICABLE_SECTIONS'] || '',
    });
  }
  return records;
}

export function isPlaceholder(value: string): boolean {
  return !value || value === 'N/A' || value === 'None' || value === 'none';
}

export function computeAdditiveMetadata(
  existing: Record<string, unknown>,
  corpus: CorpusRecord,
): Record<string, unknown> {
  const additions: Record<string, unknown> = {};

  if (existing.authorityKind !== 'judicial_precedent') {
    additions.authorityKind = 'judicial_precedent';
  }
  if (existing.sourceType !== 'legal_authority') {
    additions.sourceType = 'legal_authority';
  }
  if (existing.contentCompleteness !== 'development-excerpt') {
    additions.contentCompleteness = 'development-excerpt';
  }
  if (existing.reportStatus !== 'not-an-official-report') {
    additions.reportStatus = 'not-an-official-report';
  }
  if (existing.LEGAL_AREA !== 'Constitutional Law') {
    additions.LEGAL_AREA = 'Constitutional Law';
  }
  if (!isPlaceholder(corpus.subArea) && existing.SUB_AREA !== corpus.subArea) {
    additions.SUB_AREA = corpus.subArea;
  }
  for (const field of SUPPORTED_CORPUS_FIELDS) {
    const corpusValue = corpus[field];
    if (!isPlaceholder(corpusValue) && existing[field] !== corpusValue) {
      additions[field] = corpusValue;
    }
  }
  return additions;
}

function formatPlan(plan: UpgradePlan): string {
  const lines: string[] = [];
  lines.push(`  documentId: ${plan.documentId}`);
  lines.push(`  chunkId:    ${plan.chunkId}`);
  lines.push(`  citation:   ${plan.citation}`);
  lines.push(`  sourceUrl:  ${plan.sourceUrl}`);
  lines.push(`  matched:    ${plan.matched} (corpus: ${plan.corpusRecordId})`);
  lines.push(`  status:     ${plan.unchanged ? 'ALREADY UPGRADED' : 'NEEDS UPGRADE'}`);
  if (!plan.unchanged) {
    lines.push(`  additions:  ${JSON.stringify(plan.additions)}`);
  }
  if (Object.keys(plan.alreadyPresent).length > 0) {
    lines.push(`  present:    ${JSON.stringify(plan.alreadyPresent)}`);
  }
  return lines.join('\n');
}

export interface PrecedentUpgrader {
  dryRun(): Promise<{
    totalDbRows: number;
    recordsFound: number;
    recordsMatched: number;
    recordsMissing: string[];
    plans: UpgradePlan[];
    totalUpdates: number;
  }>;
  apply(): Promise<{ updated: number; plans: UpgradePlan[] }>;
}

export function createPrecedentUpgrader(
  prismaClient: PrismaClient,
  corpusText: string,
  targetIds: string[] = TARGET_DOCUMENT_IDS,
): PrecedentUpgrader {
  const corpusRecords = parseCorpus(corpusText);
  const corpusById = new Map(corpusRecords.map((r) => [r.officialIdentifier, r]));

  async function dryRun() {
    const allRows = await prismaClient.legalAuthorityChunk.findMany({ orderBy: { id: 'asc' } });
    const targetRows = allRows.filter((row) => targetIds.includes(row.documentId));

    const plans: UpgradePlan[] = [];
    const recordsMissing: string[] = [];

    for (const docId of targetIds) {
      const rows = targetRows.filter((r) => r.documentId === docId);
      if (rows.length === 0) {
        recordsMissing.push(docId);
        continue;
      }
      const row = rows[0];
      const prov = (row.provenance as Record<string, unknown>) || {};
      const meta = (row.metadata as Record<string, unknown>) || {};
      const corpus = corpusById.get(docId);

      if (!corpus) {
        recordsMissing.push(docId);
        continue;
      }

      const additions = computeAdditiveMetadata(meta, corpus);
      const allKeys = ['authorityKind', 'sourceType', 'contentCompleteness', 'reportStatus', 'LEGAL_AREA', 'SUB_AREA', ...SUPPORTED_CORPUS_FIELDS];
      const alreadyPresent: Record<string, unknown> = {};
      for (const key of allKeys) {
        if (meta[key] !== undefined && additions[key] === undefined) {
          alreadyPresent[key] = meta[key];
        }
      }

      plans.push({
        documentId: docId,
        chunkId: row.id,
        citation: (prov.citation || meta.citation) as string,
        sourceUrl: (prov.sourceUrl || meta.sourceUrl) as string,
        matched: true,
        corpusRecordId: corpus.recordId,
        existingMetadata: meta,
        additions,
        alreadyPresent,
        unchanged: Object.keys(additions).length === 0,
      });
    }

    return {
      totalDbRows: allRows.length,
      recordsFound: targetRows.length,
      recordsMatched: plans.filter((p) => p.matched).length,
      recordsMissing,
      plans,
      totalUpdates: plans.filter((p) => !p.unchanged).length,
    };
  }

  async function apply() {
    const plan = await dryRun();
    if (plan.recordsMissing.length > 0) {
      throw new Error(`Cannot apply: missing records: ${plan.recordsMissing.join(', ')}`);
    }

    let updated = 0;
    for (const p of plan.plans) {
      if (p.unchanged) continue;
      const merged = { ...p.existingMetadata, ...p.additions };
      await prismaClient.legalAuthorityChunk.update({
        where: { id: p.chunkId },
        data: { metadata: merged },
      });
      updated++;
    }
    return { updated, plans: plan.plans };
  }

  return { dryRun, apply };
}

async function main() {
  const { prisma } = await import('../src/utils/prisma');
  const isApply = process.argv.includes('--apply');

  console.log('=== Stage 14B — Precedent Metadata Upgrade ===');
  console.log('Mode:', isApply ? 'APPLY (writes enabled)' : 'DRY-RUN (zero writes)');

  const corpusText = fs.readFileSync(STRUCTURED_CORPUS_PATH, 'utf8');
  const upgrader = createPrecedentUpgrader(prisma, corpusText);

  if (!isApply) {
    const plan = await upgrader.dryRun();
    console.log('\n--- DRY-RUN REPORT ---');
    console.log('Total DB LegalAuthorityChunk rows:', plan.totalDbRows);
    console.log('Target records found:', plan.recordsFound);
    console.log('Target records matched to corpus:', plan.recordsMatched);
    console.log('Records missing/unmatched:', plan.recordsMissing.length, plan.recordsMissing.length > 0 ? plan.recordsMissing : '(none)');
    console.log('Records needing update:', plan.totalUpdates);
    console.log('Records already upgraded:', plan.plans.filter((p) => p.unchanged).length);
    console.log('\n--- PER-RECORD PLANS ---');
    for (const p of plan.plans) {
      console.log('----------------------------------------');
      console.log(formatPlan(p));
    }
    console.log('\n--- DRY-RUN COMPLETE — ZERO DATABASE WRITES ---');
    await prisma.$disconnect();
    return;
  }

  console.log('\nValidating via dry-run first...');
  const validation = await upgrader.dryRun();
  if (validation.recordsMissing.length > 0) {
    console.error('ABORT: missing records:', validation.recordsMissing.join(', '));
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\nApplying upgrades...');
  const result = await upgrader.apply();
  console.log('Records updated:', result.updated);
  console.log('\n--- POST-APPLY STATE ---');
  for (const p of result.plans) {
    console.log('----------------------------------------');
    console.log(formatPlan(p));
  }
  console.log('\n--- APPLY COMPLETE ---');
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
