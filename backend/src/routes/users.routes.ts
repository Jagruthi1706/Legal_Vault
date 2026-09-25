import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants/app.constants';
import { prisma } from '../utils/prisma';

const usersRouter = Router();
const publicRole = (role: Role) => role === Role.CITIZEN ? 'CLIENT' : role;

usersRouter.get('/', requireAuth, requireRole('ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.status(HTTP_STATUS.OK).json({ success: true, data: users.map((user) => ({ ...user, role: publicRole(user.role) })) });
}));

usersRouter.patch('/:id/role', requireAuth, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const requestedRole = String(req.body?.role ?? '').toUpperCase();
  const roleMap: Record<string, Role> = {
    CLIENT: Role.CITIZEN,
    LAWYER: Role.LAWYER,
    JUDGE: Role.JUDGE,
    ADMIN: Role.ADMIN,
  };
  const role = roleMap[requestedRole];
  if (!role) throw new AppError('Role must be CLIENT, LAWYER, JUDGE, or ADMIN.', HTTP_STATUS.BAD_REQUEST);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
  }).catch(() => null);
  if (!user) throw new AppError('User not found.', HTTP_STATUS.NOT_FOUND);
  res.status(HTTP_STATUS.OK).json({ success: true, data: { ...user, role: publicRole(user.role) } });
}));

export { usersRouter };
