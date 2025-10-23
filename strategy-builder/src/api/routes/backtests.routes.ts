/**
 * Backtest Routes
 * Backtesting endpoints
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { UserRole } from '../../types';

const router = Router();

router.use(authenticate);

/**
 * POST /api/v1/backtests
 * Start new backtest job
 */
router.post(
  '/',
  requireRole(UserRole.TRADER),
  asyncHandler(async (req, res) => {
    // TODO: Implement backtest job creation
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Backtest creation not yet implemented'
      }
    });
  })
);

/**
 * GET /api/v1/backtests/:id
 * Get backtest job status
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement get backtest status
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get backtest status not yet implemented'
      }
    });
  })
);

/**
 * GET /api/v1/backtests/:id/result
 * Get backtest results
 */
router.get(
  '/:id/result',
  asyncHandler(async (req, res) => {
    // TODO: Implement get backtest results
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get backtest results not yet implemented'
      }
    });
  })
);

/**
 * DELETE /api/v1/backtests/:id
 * Cancel backtest job
 */
router.delete(
  '/:id',
  requireRole(UserRole.TRADER),
  asyncHandler(async (req, res) => {
    // TODO: Implement backtest cancellation
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Backtest cancellation not yet implemented'
      }
    });
  })
);

export default router;
