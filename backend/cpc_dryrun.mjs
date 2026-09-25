import { extractDocxText } from './src/services/ai/legal/knowledge-base/docx-parser.ts';
import { parseKnowledgeBaseCorpus } from './src/services/ai/legal/knowledge-base/record-parser.ts';
import { chunkLegalRecord } from './src/services/ai/legal/knowledge-base/legal-record-chunker.ts';
import { kbRecordProvenance, matchKbRegistryEntry } from './src/services/ai/legal/knowledge-base/kb-provenance.ts';
import fs from 'fs';
import path from 'path';

const p = path.join('src', 'services', 'ai', 'legal', 'knowledge-base', 'Indian_Legal_Knowledge_Base_V2.1_Final.docx');
const { text } = await extractDocxText(fs.readFileSync(p));
const { records, stats } = parseKnowledgeBaseCorpus(text);

const out = [];
out.push('=== FULL DOCX STATS ===');
out.push('total records: ' + records.length);
out.push('excludedCaseRecords (Case:/precedent sections): ' + stats.excludedCaseRecords);
out.push('');

out.push('=== ALL 16 RECORDS ===');
out.push('ID | STATUTE | SECTION/ARTICLE | OFFICIAL_SOURCE_URL | REGISTRY');
for (const r of records) {
  const reg = matchKbRegistryEntry(r);
  out.push(r.record + ' | ' + (r.fields.STATUTE || '').slice(0,55) + ' | ' + (r.fields.SECTION || r.fields.ARTICLE || 'N/A') + ' | ' + (r.fields.OFFICIAL_SOURCE_URL || '') + ' | ' + (reg ? reg.registryId : 'BLOCKED'));
}

// CPC records
const cpcRecords = records.filter(r => r.fields.STATUTE && r.fields.STATUTE.includes('Code of Civil Procedure, 1908') && r.fields.SOURCE_TYPE === 'Central Statute');
out.push('');
out.push('=== CPC RECORDS: CHUNK ANALYSIS ===');
for (const r of cpcRecords) {
  const prov = kbRecordProvenance(r);
  const reg = matchKbRegistryEntry(r);
  out.push('--- ' + r.record + ' ---');
  out.push('  TITLE: ' + r.fields.TITLE);
  out.push('  SECTION: ' + r.fields.SECTION);
  out.push('  OFFICIAL_IDENTIFIER: ' + r.fields.OFFICIAL_IDENTIFIER);
  out.push('  OFFICIAL_CITATION: ' + r.fields.OFFICIAL_CITATION);
  out.push('  OFFICIAL_SOURCE_URL: ' + r.fields.OFFICIAL_SOURCE_URL);
  out.push('  VERIFICATION_STATUS: ' + r.fields.VERIFICATION_STATUS);
  out.push('  LAST_VERIFIED_AT: ' + r.fields.LAST_VERIFIED_AT);
  out.push('  registry match: ' + (reg ? reg.registryId : 'BLOCKED'));
  const chunks = chunkLegalRecord({ record: r, provenance: { source: prov.source } });
  out.push('  CHUNK COUNT: ' + chunks.length);
  for (const c of chunks) {
    out.push('  chunk: ' + c.chunkId + ' | section: ' + c.pageOrSection + ' | textLen: ' + c.text.length + ' | labels: ' + (c.metadata ? Object.keys(c.metadata).join(',') : 'none'));
  }
  out.push('  provenance source: ' + prov.source);
  out.push('  provenance sourceUrl: ' + prov.sourceUrl);
  out.push('  provenance officialIdentifier: ' + prov.officialIdentifier);
  out.push('  provenance officialCitation: ' + prov.officialCitation);
  out.push('');
}

// Count how many sections each CPC record references in RELATED_PROVISIONS
out.push('=== CPC RELATED_PROVISIONS ===');
for (const r of cpcRecords) {
  out.push(r.record + ' -> RELATED_PROVISIONS: ' + (r.fields.RELATED_PROVISIONS || 'N/A'));
}

fs.writeFileSync('cpc_dryrun_result.txt', out.join('\n'));
console.log('Written to cpc_dryrun_output.txt');
console.log(out.join('\n'));
