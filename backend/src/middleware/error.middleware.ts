import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config';
import { ERROR_MESSAGES, HTTP_STATUS } from '../constants/app.constants';
import { IApiErrorResponse } from '../interfaces';
import { AppError } from '../utils';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message: string = ERROR_MESSAGES.INTERNAL_SERVER;
  let errors: Record<string, string[]> | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof ZodError) {
    statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;
    message = 'Validation failed';
    errors = err.issues.reduce<Record<string, string[]>>((acc, issue) => {
      const key = issue.path.join('.') || 'root';
      acc[key] = acc[key] ?? [];
      acc[key].push(issue.message);
      return acc;
    }, {});
  }

  const response: IApiErrorResponse = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};
