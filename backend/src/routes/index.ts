import { Router } from 'express';
import { API } from '../constants/app.constants';
import { healthRouter } from './health.routes';
import { documentRouter } from './document.routes';
import { blockchainRouter } from './blockchain.routes';
import { caseRouter } from './case.routes';
import { evidenceRouter } from './evidence.routes';
import { authRouter } from './auth.routes';
import { usersRouter } from './users.routes';
import { aiRouter, aiNoCaseRouter } from './ai.routes';
import { legalRouter } from './legal.routes';
import { requireAuth } from '../middleware';
import {
  getDocumentBlockchainHistory,
  getCaseBlockchainHistory,
} from '../controllers/blockchain.controller';

const v1Router = Router();

v1Router.use('/health', healthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/documents', documentRouter);
v1Router.use('/blockchain', blockchainRouter);
v1Router.use('/cases', caseRouter);
v1Router.use('/cases/:caseId/ai', aiRouter);
v1Router.use('/ai', aiNoCaseRouter);
v1Router.use('/evidence', evidenceRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/legal', legalRouter);

// GET /api/v1/documents/:documentId/blockchain
v1Router.get('/documents/:documentId/blockchain', requireAuth, getDocumentBlockchainHistory);

// GET /api/v1/cases/:caseId/blockchain
v1Router.get('/cases/:caseId/blockchain', requireAuth, getCaseBlockchainHistory);

const apiRouter = Router();

apiRouter.use(`/${API.VERSION}`, v1Router);

export { apiRouter, v1Router };
