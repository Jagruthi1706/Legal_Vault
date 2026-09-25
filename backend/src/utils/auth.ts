import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface SessionPayload extends Partial<AuthUser> {
  sub?: string;
  iat?: number;
  exp?: number;
}

const SESSION_SECRET = env.JWT_SECRET;

export const createSessionToken = (user: AuthUser, ttlSeconds = env.SESSION_TTL_SECONDS): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      iat: now,
      exp: now + ttlSeconds,
    }),
  ).toString('base64url');

  const signature = createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
};

export const verifySessionToken = (token?: string): AuthUser | null => {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;
  const expectedSignature = createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) {
    return null;
  }

  try {
    if (!timingSafeEqual(provided, expected)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.sub || !parsed.email || !parsed.role || !parsed.iat || !parsed.exp || parsed.exp <= now) {
      return null;
    }

    return {
      id: parsed.sub,
      email: parsed.email,
      name: parsed.name ?? parsed.email,
      role: parsed.role,
    };
  } catch {
    return null;
  }
};
