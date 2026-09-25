/**
 * Deterministic IDs for Judicial Precedent records and their chunks.
 *
 * The record ID derives from official identity only (court + year + neutral
 * citation/number) so it is stable across re-ingests and independent of
 * whitespace or field ordering. The chunk ID follows the existing statutory
 * convention `${recordId}:prec:${index}`.
 */

/**
 * Deterministic precedent record ID.
 *
 * Inputs: court, judgment year, and an official identifier (neutral citation,
 * case number, or registry id). The result is uppercase, alphanumeric and
 * collision-resistant within a (court, year, identifier) triple.
 */
export const deterministicPrecedentId = (
  court: string,
  judgmentDate: string,
  officialIdentifier: string,
): string => {
  const year = (judgmentDate || '').slice(0, 4);
  // Uppercase court short code: Supreme Court -> SC, High Court -> HC, etc.
  const courtCode = (court || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 12) || 'COURT';

  const identifier = (officialIdentifier || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 40) || 'UNKNOWN';

  const yearPart = /^\d{4}$/.test(year) ? `-${year}` : '';

  return `PREC-${courtCode}${yearPart}-${identifier}`;
};

/** Deterministic, stable chunk id following the statutory `:prec:N` convention. */
export const precedentChunkId = (recordId: string, index: number): string =>
  `${recordId}:prec:${index}`;