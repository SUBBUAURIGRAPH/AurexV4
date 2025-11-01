/**
 * Trades Routes
 * Express routes for trades and holdings endpoints
 * @version 1.0.0
 */

import { Router } from 'express';
import tradesController from '../controllers/tradesController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * Apply authentication to all routes
 */
router.use(authMiddleware);

/**
 * GET /api/v1/trades/recent
 * Fetch recent trades (paginated)
 * Query params: limit (default 20, max 100), offset (default 0)
 */
router.get('/recent', (req, res, next) =>
  tradesController.getRecentTrades(req, res, next)
);

/**
 * GET /api/v1/trades/holdings
 * Fetch current portfolio holdings
 */
router.get('/holdings', (req, res, next) =>
  tradesController.getCurrentHoldings(req, res, next)
);

/**
 * GET /api/v1/trades/:tradeId
 * Fetch specific trade details
 */
router.get('/:tradeId', (req, res, next) =>
  tradesController.getTradeDetails(req, res, next)
);

export default router;
