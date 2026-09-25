import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { verifySessionToken } from '../utils/auth';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants/app.constants';

export const attachAuthUser = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  const user = verifySessionToken(token);
  if (!user) {
    req.user = undefined;
    next();
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!dbUser) {
    req.user = undefined;
    next();
    return;
  }

  req.user = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
  next();
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED));
    return;
  }
  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', HTTP_STATUS.UNAUTHORIZED));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError('Forbidden.', HTTP_STATUS.FORBIDDEN));
      return;
    }

    next();
  };
};
