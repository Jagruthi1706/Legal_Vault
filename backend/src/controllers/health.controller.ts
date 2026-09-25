import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/app.constants';
import { healthService } from '../services';
import { asyncHandler } from '../utils';

export const getHealth = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const health = healthService.getHealthStatus();
    res.status(HTTP_STATUS.OK).json(health);
  },
);
