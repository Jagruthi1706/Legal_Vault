import { Router } from 'express';
import { blockchainRateLimiter, requireAuth, requireRole } from '../middleware';
import {
  anchorDocument,
  verifyDocument,
  getTransactions,
  getTransactionByHash,
  getNetworkStatus,
  addAuthorizedAnchor,
  removeAuthorizedAnchor,
  checkAuthorizedAnchor,
} from '../controllers/blockchain.controller';

const blockchainRouter = Router();
blockchainRouter.use(blockchainRateLimiter);

// GET /api/v1/blockchain/network
blockchainRouter.get('/network', requireAuth, getNetworkStatus);

// POST /api/v1/blockchain/anchor
blockchainRouter.post('/anchor', requireAuth, requireRole('LAWYER'), anchorDocument);

// POST /api/v1/blockchain/verify
blockchainRouter.post('/verify', requireAuth, requireRole('JUDGE'), verifyDocument);

// GET /api/v1/blockchain/transactions
blockchainRouter.get('/transactions', requireAuth, getTransactions);

// GET /api/v1/blockchain/tx/:transactionHash
blockchainRouter.get('/tx/:transactionHash', requireAuth, getTransactionByHash);

// Admin-only authorized anchor management
blockchainRouter.post('/authorized-anchors', requireAuth, requireRole('ADMIN'), addAuthorizedAnchor);
blockchainRouter.post('/authorized-anchors/remove', requireAuth, requireRole('ADMIN'), removeAuthorizedAnchor);
blockchainRouter.get('/authorized-anchors/:address', requireAuth, checkAuthorizedAnchor);

export { blockchainRouter };
