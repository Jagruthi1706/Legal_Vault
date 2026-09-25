import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_VERSION: z.string().default('v1'),
  APP_NAME: z.string().default('Legal Vault Backend'),
  APP_VERSION: z.string().default('1.0.0'),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:3002'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  /**
   * General API ceiling per window, per authenticated user (or per IP when
   * anonymous).
   *
   * This limiter runs before every route — including /auth and /ai — so it must
   * be sized for normal single-page-application traffic rather than for a
   * handful of requests. A single page load performs several calls (/auth/me,
   * /cases, /documents, /blockchain/network), and each additional browser tab
   * repeats them. The previous default of 100 requests per 15 minutes was
   * exhausted by ordinary 3–5 tab usage, producing spurious HTTP 429s that
   * looked like provider or blockchain failures. Abuse is still bounded: the
   * dedicated auth/AI/blockchain limiters below stay deliberately tight.
   */
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(3_000),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(30),
  AI_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
  BLOCKCHAIN_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:password@localhost:5432/legal_vault?schema=public'),
  DIRECT_URL: z.string().url().optional(),
  BLOCKCHAIN_RPC_URL: z.string().default('http://127.0.0.1:8545'),
  BLOCKCHAIN_PRIVATE_KEY: z.string().optional(),
  BLOCKCHAIN_CONTRACT_ADDRESS: z.string().optional(),
  BLOCKCHAIN_CHAIN_ID: z.coerce.number().int().positive().optional(),
  STORAGE_DIR: z.string().default('storage'),
  JWT_SECRET: z.string().default('dev-session-secret-change-me'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28_800),
  AI_PROVIDER: z.enum(['mock', 'openai', 'gemini']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().min(1).default('gpt-4o-mini'),
  AI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  VECTOR_STORE: z.enum(['memory', 'postgres']).default('memory'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Environment validation failed:\n${formatted}`);
}

export const env = parsed.data;

/** A pooled Supabase/Supavisor endpoint is served from *.pooler.supabase.com. */
const isPooledDatabaseUrl = (url: string): boolean => /pooler\.supabase\.com/i.test(url);

const isLocalDatabaseUrl = (url: string): boolean =>
  /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(url);

if (env.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (env.JWT_SECRET === 'dev-session-secret-change-me') missing.push('JWT_SECRET');
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');

  // A pooled runtime URL cannot run migrations (Supavisor in transaction mode
  // does not support the advisory locks / prepared statements Prisma migrate
  // needs). Migrations must go through a direct connection, so require a
  // separate DIRECT_URL whenever the runtime URL is pooled.
  if (env.DATABASE_URL && isPooledDatabaseUrl(env.DATABASE_URL) && !env.DIRECT_URL) {
    missing.push('DIRECT_URL (required because DATABASE_URL is a pooled Supabase endpoint)');
  }

  if (missing.length > 0) {
    throw new Error(
      `Production environment is missing required configuration: ${missing.join(', ')}`,
    );
  }

  // Production must never silently fall back to a developer machine database.
  // Localhost is only legitimate when NODE_ENV is development or test.
  if (isLocalDatabaseUrl(env.DATABASE_URL)) {
    throw new Error(
      'Production DATABASE_URL points at localhost. Configure the managed database URL explicitly.',
    );
  }
}

export type Env = typeof env;
