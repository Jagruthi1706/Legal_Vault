import { env } from './env';

export const databaseConfig = {
  url: env.DATABASE_URL,
} as const;

// Prisma client will be instantiated here once models are defined.
export const prismaConfig = {
  log:
    env.NODE_ENV === 'development'
      ? (['query', 'info', 'warn', 'error'] as const)
      : (['error'] as const),
} as const;
