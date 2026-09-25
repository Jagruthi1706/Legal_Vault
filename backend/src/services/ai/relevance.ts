/**
 * Shared lexical helpers for retrieval gating and answer coverage checks.
 * Kept framework-free and deterministic so both the case retrieval path and the
 * provider-level grounding checks apply the same definition of "topical".
 */

const STOP_TERMS = new Set(['the', 'and', 'for', 'this', 'that', 'from', 'with', 'are', 'was', 'were', 'not', 'but', 'you', 'your', 'any', 'all', 'what', 'which', 'does', 'did', 'has', 'have', 'had', 'its', 'his', 'her', 'their', 'each', 'into', 'about', 'between', 'within', 'under', 'over', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'list', 'give', 'tell', 'please', 'should', 'would', 'could', 'there', 'here', 'been', 'being', 'also', 'only', 'some', 'both', 'per', 'via', 'than', 'then', 'them', 'they']);

// Structural/administrative words. They appear in every case profile, so they can
// never independently establish topical relevance (Phase 12 requirement).
const GENERIC_TERMS = new Set(['case', 'cases', 'legal', 'law', 'laws', 'document', 'documents', 'doc', 'issue', 'issues', 'court', 'courts', 'evidence', 'matter', 'matters', 'party', 'parties', 'judge', 'judges', 'citation', 'citations', 'cite', 'record', 'records', 'file', 'files', 'key', 'support', 'supports', 'supporting', 'summary', 'summarize', 'outline', 'overview', 'status', 'question', 'questions', 'answer', 'answers', 'explain', 'information', 'info', 'content', 'text', 'page', 'pages', 'section', 'sections', 'act', 'acts', 'order', 'orders', 'rule', 'rules', 'provision', 'provisions', 'defendant', 'plaintiff', 'petitioner', 'respondent', 'accused']);

export const stem = (term: string): string =>
  term.length > 3 && term.endsWith('s') && !term.endsWith('ss') && !term.endsWith('us')
    ? term.slice(0, -1)
    : term;

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Topical terms of the query: stop words, structural/generic legal words and
 * possessives removed, lightly stemmed so singular/plural forms match. */
export const extractContentTerms = (query: string): string[] =>
  query
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_TERMS.has(term) && !GENERIC_TERMS.has(term))
    .map(stem);

/** Word-boundary check tolerant of simple plural forms. */
export const termOccurs = (term: string, haystackLower: string): boolean =>
  new RegExp(`\\b${escapeRegExp(term)}(?:s|es)?\\b`).test(haystackLower);

const DEICTIC_RE =
  /\b(this\s+(case|matter|suit|dispute|file|record)|the\s+case|our\s+case|current\s+case|summar(y|ize|ise)\b|these\s+documents|the\s+documents?)\b/i;

/**
 * True when the question refers to the currently open case rather than to an
 * external topic (e.g. "Summarize this case.", "What are the key issues in
 * this case?"). Deictic questions legitimately ride on the case-retrieval
 * gate and must not be rejected for lacking self-contained content terms.
 */
export const isDeicticQuery = (query: string): boolean => {
  if (DEICTIC_RE.test(query)) return true;
  if (/\b(case|matter|suit|dispute)\b/i.test(query) && query.trim().split(/\s+/).length <= 4) {
    return true;
  }
  return false;
};

export interface AnswerCoverage {
  terms: string[];
  missing: string[];
  nonGenericMatched: number;
  nonGenericTotal: number;
  ratio: number;
  decision: 'ok' | 'partial' | 'insufficient';
}

const COVERAGE_RATIO = 0.34;

/** Shared topical-relevance ratio (case retrieval gate, answer coverage, and the
 * legal-authority retrieval gate all use the same definition). */
export const RELEVANCE_RATIO = COVERAGE_RATIO;

/**
 * Checks whether the query's content terms are actually represented in the
 * supplied source text. Distinctive (non-generic) terms carry the decision:
 * if NONE of them appear, the sources cannot support an answer and the caller
 * must report insufficient evidence instead of fabricating one.
 */
export const answerCoverage = (query: string, sourceText: string): AnswerCoverage => {
  const terms = extractContentTerms(query);
  const haystack = sourceText.toLowerCase();
  const missing: string[] = [];
  let nonGenericTotal = 0;
  let nonGenericMatched = 0;
  let matched = 0;

  for (const term of terms) {
    const generic = GENERIC_TERMS.has(term) || GENERIC_TERMS.has(stem(term));
    const hit = termOccurs(term, haystack);
    if (hit) matched += 1;
    else missing.push(term);
    if (!generic) {
      nonGenericTotal += 1;
      if (hit) nonGenericMatched += 1;
    }
  }

  const ratio = terms.length === 0 ? 1 : matched / terms.length;
  let decision: AnswerCoverage['decision'] = 'ok';
  if (terms.length > 0 && nonGenericTotal > 0 && nonGenericMatched === 0) {
    decision = 'insufficient';
  } else if (terms.length > 0 && ratio < COVERAGE_RATIO) {
    decision = 'partial';
  }

  return { terms, missing, nonGenericMatched, nonGenericTotal, ratio, decision };
};
