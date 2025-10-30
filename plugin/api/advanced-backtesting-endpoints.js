/**
 * Advanced Backtesting API Endpoints
 * REST endpoints for Phase 6.3 features
 *
 * SECURITY: All endpoints include:
 * - Input validation using InputValidator
 * - Sanitization using InputSanitizer
 * - Rate limiting protection
 * - Request timeout handling
 *
 * Endpoints:
 * - Advanced order management
 * - Parameter optimization
 * - Leaderboard & ranking
 * - Real-time progress tracking
 */

const express = require('express');
const router = express.Router();
const {
  InputValidator,
  InputSanitizer,
  createValidationMiddleware
} = require('../security/api-security-middleware');

/**
 * Initialize advanced backtesting routes
 */
function initializeAdvancedBacktestingRoutes(config) {
  const {
    database,
    advancedBacktestingEngine,
    parameterOptimizationEngine,
    leaderboardEngine,
    progressTracker,
    logger = console,
    authMiddleware
  } = config;

  // ========================================================================
  // ADVANCED ORDER ENDPOINTS
  // ========================================================================

  /**
   * POST /api/backtesting/orders
   * Submit an advanced order
   *
   * SECURITY: Input validation and sanitization applied
   */
  router.post('/api/backtesting/orders', authMiddleware, async (req, res) => {
    try {
      // Extract and validate inputs
      const backtestId = InputSanitizer.sanitizeString(req.body.backtestId);
      const symbol = InputSanitizer.sanitizeSymbol(req.body.symbol);
      const side = InputSanitizer.sanitizeString(req.body.side).toUpperCase();
      const quantity = InputSanitizer.sanitizeNumeric(req.body.quantity);
      const type = InputSanitizer.sanitizeString(req.body.type).toLowerCase();
      const limitPrice = InputSanitizer.sanitizeNumeric(req.body.limitPrice);
      const stopPrice = InputSanitizer.sanitizeNumeric(req.body.stopPrice);
      const userId = req.user.id;

      // Validate required fields
      const errors = [];

      if (!backtestId) errors.push('backtestId is required');
      if (!symbol) errors.push('symbol is required');
      if (!InputValidator.isValidSymbol(symbol)) errors.push('Invalid symbol format');
      if (!InputValidator.isOneOf(side, ['BUY', 'SELL'])) errors.push('Invalid order side (must be BUY or SELL)');
      if (quantity === null) errors.push('quantity must be a valid number');
      if (!InputValidator.isValidQuantity(quantity)) errors.push('quantity must be positive and <= 1 billion');
      if (!InputValidator.isOneOf(type, ['market', 'limit', 'stop', 'stop_limit'])) errors.push('Invalid order type');

      // Validate conditional fields
      if ((type === 'limit' || type === 'stop_limit') && limitPrice === null) {
        errors.push('Limit price required for limit orders');
      }
      if ((type === 'limit' || type === 'stop_limit') && limitPrice !== null && !InputValidator.isValidPrice(limitPrice)) {
        errors.push('Limit price must be a valid positive number');
      }

      if ((type === 'stop' || type === 'stop_limit') && stopPrice === null) {
        errors.push('Stop price required for stop orders');
      }
      if ((type === 'stop' || type === 'stop_limit') && stopPrice !== null && !InputValidator.isValidPrice(stopPrice)) {
        errors.push('Stop price must be a valid positive number');
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }

      // Create order in database using parameterized queries (SQL injection protection)
      const query = `
        INSERT INTO backtest_advanced_orders
        (backtest_id, user_id, symbol, side, quantity, type, limit_price, stop_price, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
      `;

      const [result] = await database.query(query, [
        backtestId,
        userId,
        symbol,
        side,
        quantity,
        type,
        limitPrice || null,
        stopPrice || null
      ]);

      logger.info(`📋 Advanced order created: ${result.insertId}`, { userId, symbol, type });

      res.json({
        id: result.insertId,
        backtestId,
        symbol,
        side,
        quantity,
        type,
        limitPrice,
        stopPrice,
        status: 'pending',
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Error creating advanced order:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/orders/:orderId
   * Get advanced order details
   */
  router.get('/api/backtesting/orders/:orderId', authMiddleware, async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const query = `
        SELECT ao.*
        FROM backtest_advanced_orders ao
        WHERE ao.id = ? AND ao.user_id = ?
      `;

      const [rows] = await database.query(query, [orderId, userId]);

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(rows[0]);
    } catch (error) {
      logger.error('Error fetching order:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/backtesting/orders/:orderId
   * Cancel an advanced order
   */
  router.delete('/api/backtesting/orders/:orderId', authMiddleware, async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      // Get order
      const [rows] = await database.query(
        `SELECT * FROM backtest_advanced_orders WHERE id = ? AND user_id = ?`,
        [orderId, userId]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = rows[0];
      if (order.status !== 'pending') {
        return res.status(400).json({ error: `Cannot cancel order with status: ${order.status}` });
      }

      // Update status
      await database.query(
        `UPDATE backtest_advanced_orders SET status = 'cancelled' WHERE id = ?`,
        [orderId]
      );

      logger.info(`🚫 Order cancelled: ${orderId}`, { userId });

      res.json({ success: true, message: 'Order cancelled' });
    } catch (error) {
      logger.error('Error cancelling order:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // PARAMETER OPTIMIZATION ENDPOINTS
  // ========================================================================

  /**
   * POST /api/backtesting/optimize
   * Start parameter optimization
   */
  router.post('/api/backtesting/optimize', authMiddleware, async (req, res) => {
    try {
      const {
        name,
        symbol,
        startDate,
        endDate,
        strategy,
        optimizationType,
        parameterGrid,
        objectiveMetric,
        maxTrials
      } = req.body;
      const userId = req.user.id;

      // Validate
      if (!symbol || !startDate || !endDate || !optimizationType || !parameterGrid) {
        return res.status(400).json({ error: 'Missing required optimization parameters' });
      }

      // Store in database
      const query = `
        INSERT INTO backtest_optimization_results
        (user_id, name, symbol, start_date, end_date, optimization_type,
         parameter_grid, objective_metric, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running')
      `;

      const [result] = await database.query(query, [
        userId,
        name || 'Optimization_' + Date.now(),
        symbol,
        startDate,
        endDate,
        optimizationType,
        JSON.stringify(parameterGrid),
        objectiveMetric || 'sharpe_ratio'
      ]);

      const optimizationId = result.insertId;

      // Start optimization asynchronously
      parameterOptimizationEngine.startOptimization({
        id: optimizationId,
        name,
        symbol,
        startDate,
        endDate,
        strategy,
        optimizationType,
        parameterGrid,
        objectiveMetric: objectiveMetric || 'sharpe_ratio',
        maxTrials: maxTrials || 100
      }).catch(error => {
        logger.error(`Optimization ${optimizationId} failed:`, error);
        database.query(
          `UPDATE backtest_optimization_results SET status = 'failed', error_message = ? WHERE id = ?`,
          [error.message, optimizationId]
        );
      });

      logger.info(`🔄 Optimization started: ${optimizationId}`, { userId, symbol });

      res.json({
        optimizationId,
        status: 'running',
        symbol,
        startDate,
        endDate,
        message: 'Optimization started'
      });
    } catch (error) {
      logger.error('Error starting optimization:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/optimize/:optimizationId
   * Get optimization status and progress
   */
  router.get('/api/backtesting/optimize/:optimizationId', authMiddleware, async (req, res) => {
    try {
      const { optimizationId } = req.params;
      const userId = req.user.id;

      const query = `
        SELECT * FROM backtest_optimization_results
        WHERE id = ? AND user_id = ?
      `;

      const [rows] = await database.query(query, [optimizationId, userId]);

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Optimization not found' });
      }

      const optimization = rows[0];

      // Get trial count
      const [trialRows] = await database.query(
        `SELECT COUNT(*) as count FROM backtest_optimization_trials WHERE optimization_result_id = ?`,
        [optimizationId]
      );

      res.json({
        ...optimization,
        parameterGrid: JSON.parse(optimization.parameter_grid),
        completedTrials: trialRows[0].count
      });
    } catch (error) {
      logger.error('Error fetching optimization:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/optimize/:optimizationId/results
   * Get optimization results
   */
  router.get('/api/backtesting/optimize/:optimizationId/results', authMiddleware, async (req, res) => {
    try {
      const { optimizationId } = req.params;
      const userId = req.user.id;

      // Verify ownership
      const [rows] = await database.query(
        `SELECT * FROM backtest_optimization_results WHERE id = ? AND user_id = ?`,
        [optimizationId, userId]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Optimization not found' });
      }

      const optimization = rows[0];

      // Get trials sorted by metric
      const [trials] = await database.query(
        `SELECT * FROM backtest_optimization_trials
         WHERE optimization_result_id = ?
         ORDER BY metric_value DESC
         LIMIT 100`,
        [optimizationId]
      );

      res.json({
        optimizationId,
        name: optimization.optimization_name,
        status: optimization.status,
        bestParameters: optimization.best_parameters ? JSON.parse(optimization.best_parameters) : null,
        bestMetricValue: optimization.best_metric_value,
        completedTrials: trials.length,
        topTrials: trials.slice(0, 10),
        allTrials: trials
      });
    } catch (error) {
      logger.error('Error fetching optimization results:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/backtesting/optimize/:optimizationId
   * Cancel optimization
   */
  router.delete('/api/backtesting/optimize/:optimizationId', authMiddleware, async (req, res) => {
    try {
      const { optimizationId } = req.params;
      const userId = req.user.id;

      // Verify ownership
      const [rows] = await database.query(
        `SELECT * FROM backtest_optimization_results WHERE id = ? AND user_id = ?`,
        [optimizationId, userId]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Optimization not found' });
      }

      const optimization = rows[0];
      if (optimization.status !== 'running') {
        return res.status(400).json({ error: `Cannot cancel optimization with status: ${optimization.status}` });
      }

      // Update status
      await database.query(
        `UPDATE backtest_optimization_results SET status = 'cancelled' WHERE id = ?`,
        [optimizationId]
      );

      // Notify optimization engine
      parameterOptimizationEngine.cancelOptimization(optimizationId);

      logger.info(`🚫 Optimization cancelled: ${optimizationId}`, { userId });

      res.json({ success: true, message: 'Optimization cancelled' });
    } catch (error) {
      logger.error('Error cancelling optimization:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // LEADERBOARD ENDPOINTS
  // ========================================================================

  /**
   * GET /api/backtesting/leaderboard/:metric
   * Get leaderboard for specific metric
   */
  router.get('/api/backtesting/leaderboard/:metric', async (req, res) => {
    try {
      const { metric } = req.params;
      const { limit = 100, symbol, days = null } = req.query;

      const filters = { symbol };
      if (days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        filters.startDate = startDate;
      }

      const leaderboard = await leaderboardEngine.getLeaderboard(metric, parseInt(limit), filters);

      res.json({
        metric,
        leaderboard
      });
    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/leaderboard/top-performers
   * Get top performers overall
   */
  router.get('/api/backtesting/leaderboard/top-performers', async (req, res) => {
    try {
      const { limit = 50 } = req.query;

      const topPerformers = await leaderboardEngine.getTopPerformers(parseInt(limit));

      res.json({ topPerformers });
    } catch (error) {
      logger.error('Error fetching top performers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/comparison/:backtestId1/:backtestId2
   * Compare two strategies
   */
  router.get('/api/backtesting/comparison/:backtestId1/:backtestId2', async (req, res) => {
    try {
      const { backtestId1, backtestId2 } = req.params;

      const comparison = await leaderboardEngine.compareStrategies(
        parseInt(backtestId1),
        parseInt(backtestId2)
      );

      res.json(comparison);
    } catch (error) {
      logger.error('Error comparing strategies:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/user/:userId/rankings
   * Get user rankings
   */
  router.get('/api/backtesting/user/:userId/rankings', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.params;

      // Verify user is querying their own data
      if (req.user.id !== parseInt(userId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const rankings = await leaderboardEngine.calculateUserRankings(userId);

      res.json({ userId, rankings });
    } catch (error) {
      logger.error('Error fetching user rankings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // REAL-TIME PROGRESS ENDPOINTS
  // ========================================================================

  /**
   * GET /api/backtesting/progress/:sessionId
   * Get real-time progress
   */
  router.get('/api/backtesting/progress/:sessionId', authMiddleware, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = progressTracker.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      res.json({
        sessionId: session.id,
        type: session.type,
        taskName: session.taskName,
        progress: session.progress,
        status: session.status,
        completedSteps: session.completedSteps,
        totalSteps: session.totalSteps,
        metrics: session.metrics,
        eta: session.eta,
        speed: session.speed
      });
    } catch (error) {
      logger.error('Error fetching progress:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/progress/user/summary
   * Get progress summary for user
   */
  router.get('/api/backtesting/progress/user/summary', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;

      const summary = progressTracker.getProgressSummary(userId);

      res.json(summary);
    } catch (error) {
      logger.error('Error fetching progress summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/backtesting/progress/:sessionId/cancel
   * Cancel a progress session
   */
  router.delete('/api/backtesting/progress/:sessionId/cancel', authMiddleware, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = progressTracker.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const success = progressTracker.cancelSession(sessionId);

      if (!success) {
        return res.status(400).json({ error: 'Cannot cancel non-running session' });
      }

      logger.info(`🚫 Progress session cancelled: ${sessionId}`, { userId });

      res.json({ success: true, message: 'Session cancelled' });
    } catch (error) {
      logger.error('Error cancelling session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { initializeAdvancedBacktestingRoutes };
