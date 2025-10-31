/**
 * Portfolio Routes
 * Express routes for portfolio endpoints
 * @version 1.0.0
 */

import { Router } from 'express';
import portfolioController from '../controllers/portfolioController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * Apply authentication to all routes
 */
router.use(authMiddleware);

/**
 * GET /api/v1/portfolio/summary
 * Fetch portfolio summary
 */
router.get('/summary', (req, res, next) =>
  portfolioController.getPortfolioSummary(req, res, next)
);

/**
 * GET /api/v1/portfolio/allocation
 * Fetch asset allocation
 */
router.get('/allocation', (req, res, next) =>
  portfolioController.getPortfolioAllocation(req, res, next)
);

/**
 * GET /api/v1/portfolio/performance/:period
 * Fetch performance data for period (1W, 1M, 3M, 1Y, ALL)
 */
router.get('/performance/:period', (req, res, next) =>
  portfolioController.getPortfolioPerformance(req, res, next)
);

/**
 * GET /api/v1/portfolio/positions/:symbol
 * Fetch specific position details
 */
router.get('/positions/:symbol', (req, res, next) =>
  portfolioController.getPositionDetails(req, res, next)
);

export default router;
