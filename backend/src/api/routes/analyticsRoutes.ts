/**
 * Analytics Routes
 * Express routes for analytics and market data endpoints
 * @version 1.0.0
 */

import { Router } from 'express';
import analyticsController from '../controllers/analyticsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * Apply authentication to all routes
 */
router.use(authMiddleware);

/**
 * GET /api/v1/market/status
 * Fetch current market status
 */
router.get('/market/status', (req, res, next) =>
  analyticsController.getMarketStatus(req, res, next)
);

/**
 * GET /api/v1/analytics/risk-score
 * Fetch AI risk score analysis
 */
router.get('/risk-score', (req, res, next) =>
  analyticsController.getAIRiskScore(req, res, next)
);

/**
 * GET /api/v1/analytics/summary
 * Fetch complete analytics summary
 */
router.get('/summary', (req, res, next) =>
  analyticsController.getAnalyticsSummary(req, res, next)
);

export default router;
