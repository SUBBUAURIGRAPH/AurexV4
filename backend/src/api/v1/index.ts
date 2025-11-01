/**
 * API v1 Router
 * Combines all API v1 route modules
 * @version 1.0.0
 */

import { Router } from 'express';
import portfolioRoutes from '../routes/portfolioRoutes.js';
import tradesRoutes from '../routes/tradesRoutes.js';
import analyticsRoutes from '../routes/analyticsRoutes.js';

const router = Router();

/**
 * Mount route modules under /api/v1
 */
router.use('/portfolio', portfolioRoutes);
router.use('/trades', tradesRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/market', analyticsRoutes); // Market routes are part of analytics

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;
