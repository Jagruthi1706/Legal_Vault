import { Request, Response, NextFunction } from 'express';
import { ERROR_MESSAGES, HTTP_STATUS } from '../constants/app.constants';

export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `${ERROR_MESSAGES.NOT_FOUND} [${req.method} ${req.originalUrl}]`,
  });
};
