import express, { Application } from 'express';
import { API } from './constants/app.constants';
import {
  applyMiddleware,
  errorHandler,
  notFoundHandler,
} from './middleware';
import { apiRouter } from './routes';

export const createApp = (): Application => {
  const app = express();

  applyMiddleware(app);

  app.use(API.PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
