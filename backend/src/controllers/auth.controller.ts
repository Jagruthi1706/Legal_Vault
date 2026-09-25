import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { createSessionToken } from '../utils/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants/app.constants';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { Role } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';

const publicRole = (role: string) => role === 'CITIZEN' ? 'CLIENT' : role;

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleProfileResponse {
  email?: string;
  email_verified?: boolean | string;
  name?: string;
}

const googleCallbackUrl = () =>
  env.GOOGLE_CALLBACK_URL || `http://localhost:${env.PORT}/api/v1/auth/google/callback`;

/**
 * Google sign-in requires externally provisioned Google Cloud OAuth credentials.
 * When they are absent the feature is reported as NOT CONFIGURED and the API
 * degrades gracefully instead of failing with a raw 500 or, worse, pretending
 * a sign-in succeeded.
 */
const isGoogleConfigured = (): boolean => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Sends the browser back to the frontend sign-in page with a readable reason. */
const redirectToFrontendError = (res: Response, code: string): void => {
  let target: URL;
  try {
    target = new URL('/login', env.FRONTEND_URL);
  } catch {
    target = new URL('/login', 'http://localhost:3000');
  }
  target.searchParams.set('error', code);
  res.redirect(target.toString());
};

const createOAuthState = (): string => {
  const payload = Buffer.from(JSON.stringify({ provider: 'google', createdAt: Date.now() })).toString('base64url');
  const signature = createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
};

const validateOAuthState = (state?: string): boolean => {
  if (!state) return false;
  const [payload, signature] = state.split('.');
  if (!payload || !signature) return false;
  const expectedSignature = createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex');
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length) return false;
  if (!timingSafeEqual(provided, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { provider?: string; createdAt?: number };
    return parsed.provider === 'google' && typeof parsed.createdAt === 'number' && Date.now() - parsed.createdAt <= 600_000;
  } catch {
    return false;
  }
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    throw new AppError('Email and password are required.', HTTP_STATUS.BAD_REQUEST);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Invalid credentials.', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Invalid credentials.', HTTP_STATUS.UNAUTHORIZED);
  }

  const token = createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
      role: publicRole(user.role),
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: publicRole(user.role),
      },
      token,
    },
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED);
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: publicRole(req.user.role),
    },
  });
});

/** Public capability probe so the frontend can avoid offering an unusable button. */
export const googleStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      provider: 'google',
      enabled: isGoogleConfigured(),
    },
  });
});

export const googleStart = asyncHandler(async (_req: Request, res: Response) => {
  if (!isGoogleConfigured()) {
    redirectToFrontendError(res, 'google_not_configured');
    return;
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: googleCallbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    state: createOAuthState(),
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  if (!isGoogleConfigured()) {
    redirectToFrontendError(res, 'google_not_configured');
    return;
  }

  if (typeof req.query.error === 'string') {
    redirectToFrontendError(res, 'google_denied');
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  if (!code || !validateOAuthState(state)) {
    redirectToFrontendError(res, 'google_invalid_callback');
    return;
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: googleCallbackUrl(),
      grant_type: 'authorization_code',
    }),
  });

  const tokenJson = (await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenJson.access_token) {
    redirectToFrontendError(res, 'google_token_exchange_failed');
    return;
  }

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => ({})) as GoogleProfileResponse;
  const email = typeof profile.email === 'string' ? profile.email.toLowerCase() : '';
  const emailVerified = profile.email_verified === true || profile.email_verified === 'true';
  if (!profileResponse.ok || !email || !emailVerified) {
    redirectToFrontendError(res, 'google_email_unverified');
    return;
  }

  // Role policy: Google authenticates identity ONLY. Legal Vault owns the role.
  //  - existing account  -> existing database role is preserved (update touches
  //    `name` only, so a Google sign-in can never escalate privileges)
  //  - new account       -> CLIENT/CITIZEN
  // No Google profile field, query parameter, frontend value or localStorage
  // entry may influence role assignment.
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : email,
    },
    create: {
      email,
      name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : email,
      role: Role.CITIZEN,
    },
  });

  const token = createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: publicRole(user.role),
  });

  const redirect = new URL('/auth/oauth/callback', env.FRONTEND_URL);
  redirect.searchParams.set('token', token);
  res.redirect(redirect.toString());
});
