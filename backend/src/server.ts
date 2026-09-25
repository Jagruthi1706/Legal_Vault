import 'dotenv/config';
import { createApp } from './app';
import { env } from './config';

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-session-secret-change-me') {
  throw new Error('JWT_SECRET must be set to a non-default value in production.');
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(
    `[${env.NODE_ENV}] ${env.APP_NAME} v${env.APP_VERSION} running on port ${env.PORT}`,
  );
});

const shutdown = (signal: string): void => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
