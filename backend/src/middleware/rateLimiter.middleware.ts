import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config';
import { ERROR_MESSAGES, HTTP_STATUS } from '../constants/app.constants';

const keyByUserOrIp = (req: any) =>
  req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip || req.socket?.remoteAddress || 'unknown')}`;

const tooManyRequestsMessage = {
  success: false,
  message: ERROR_MESSAGES.TOO_MANY_REQUESTS,
};

export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequestsMessage,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequestsMessage,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

export const aiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: env.AI_RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequestsMessage,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

export const blockchainRateLimiter = rateLimit({
  windowMs: 60_000,
  max: env.BLOCKCHAIN_RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequestsMessage,
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});
