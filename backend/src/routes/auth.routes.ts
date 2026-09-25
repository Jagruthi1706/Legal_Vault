import { Router } from 'express';
import { googleCallback, googleStart, googleStatus, login, me } from '../controllers/auth.controller';
import { authRateLimiter, requireAuth } from '../middleware';

const authRouter = Router();

authRouter.post('/login', authRateLimiter, login);
authRouter.get('/google/status', googleStatus);
authRouter.get('/google', authRateLimiter, googleStart);
authRouter.get('/google/callback', authRateLimiter, googleCallback);
authRouter.get('/me', requireAuth, me);

export { authRouter };
