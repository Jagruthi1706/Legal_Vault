import { Express, json, urlencoded } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '../config';
import { generalRateLimiter } from './rateLimiter.middleware';
import { attachAuthUser } from './auth.middleware';

export const applyMiddleware = (app: Express): void => {
  app.set('trust proxy', 1);

  const allowedOrigins = new Set(
    env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.use(attachAuthUser);
  app.use(generalRateLimiter);

  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }
};

export { errorHandler } from './error.middleware';
export { notFoundHandler } from './notFound.middleware';
export { generalRateLimiter, authRateLimiter, aiRateLimiter, blockchainRateLimiter } from './rateLimiter.middleware';
export { attachAuthUser, requireAuth, requireRole } from './auth.middleware';
