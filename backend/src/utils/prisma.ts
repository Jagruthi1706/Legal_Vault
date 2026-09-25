import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Supabase's Supavisor pooler (…pooler.supabase.com) multiplexes many clients
 * onto a small number of Postgres backends.
 *
 * The "Supabase URL stops working after a few days" symptom is not credential
 * expiry. It is connection exhaustion: when a pooled runtime URL is used
 * *without* PgBouncer-compatible settings, every process (dev server, build,
 * test runner, each ts-node watcher restart) opens its own default-sized pool.
 * Supavisor eventually refuses new backends ("Max client connections reached"),
 * Prisma surfaces that as a connection/prepared-statement error, and the natural
 * reaction is to paste a freshly generated URL — which only resets the cycle.
 *
 * The durable fix is to declare the pooler's contract explicitly, which this
 * normalizer does at runtime. Migration/DDL traffic is deliberately NOT routed
 * through here: Supavisor in transaction mode cannot hold the advisory locks or
 * prepared statements `prisma migrate` needs, so migrations use `DIRECT_URL`
 * (see the `directUrl` datasource field in prisma/schema.prisma).
 */
const SUPABASE_POOLER_HOST = /(^|\.)pooler\.supabase\.com$/i;

export const SUPABASE_RUNTIME_POOL_DEFAULTS = {
  /** Route through PgBouncer semantics (no prepared statements). */
  pgbouncer: 'true',
  /** One backend per Node process; Supavisor multiplexes the rest. */
  connection_limit: '1',
  /** Fail fast instead of queueing forever when the pool is saturated. */
  pool_timeout: '20',
} as const;

/**
 * Applies Supavisor-safe pool parameters to a Supabase pooled runtime URL.
 * Non-Supabase and non-pooled URLs are returned byte-identical, so local
 * development and test databases keep their existing connection behaviour.
 * Any parameter already present in the URL wins — this only fills gaps.
 */
export const normalizeRuntimeDatabaseUrl = (rawUrl: string | undefined): string | undefined => {
  if (!rawUrl) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    // Malformed URLs are reported by Prisma; env validation already rejects
    // non-URL values. Do not mask it here.
    return rawUrl;
  }

  if (!SUPABASE_POOLER_HOST.test(parsed.hostname)) return rawUrl;

  let mutated = false;
  for (const [key, value] of Object.entries(SUPABASE_RUNTIME_POOL_DEFAULTS)) {
    if (!parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, value);
      mutated = true;
    }
  }
  if (!parsed.searchParams.has('sslmode')) {
    parsed.searchParams.set('sslmode', 'require');
    mutated = true;
  }

  return mutated ? parsed.toString() : rawUrl;
};

const runtimeDatabaseUrl = normalizeRuntimeDatabaseUrl(env.DATABASE_URL);

if (env.DATABASE_URL && runtimeDatabaseUrl !== env.DATABASE_URL) {
  // Never log the URL itself.
  console.warn(
    '[database] Applied Supabase Supavisor pool defaults (pgbouncer, connection_limit, pool_timeout, sslmode) ' +
      'to the runtime DATABASE_URL. Migrations continue to use DIRECT_URL.',
  );
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: runtimeDatabaseUrl });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
