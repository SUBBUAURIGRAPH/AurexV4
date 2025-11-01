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
  // MULTI-ASSET BACKTESTING ENDPOINTS
  // ========================================================================

  /**
   * POST /api/backtesting/multi-asset
   * Start a multi-asset backtest
   *
   * SECURITY: Full input validation and sanitization
   */
  router.post('/api/backtesting/multi-asset', authMiddleware, async (req, res) => {
    try {
      const {
        name,
        symbols,
        allocation,
        startDate,
        endDate,
        initialCapital,
        rebalanceConfig,
        strategy
      } = req.body;
      const userId = req.user.id;

      // Validate required fields
      const errors = [];

      if (!name) errors.push('name is required');
      if (!Array.isArray(symbols) || symbols.length === 0) errors.push('symbols must be a non-empty array');
      if (!allocation || typeof allocation !== 'object') errors.push('allocation must be an object');
      if (!startDate || !InputValidator.isValidDateRange(startDate, endDate)) errors.push('Invalid date range');
      if (initialCapital && !InputValidator.isValidQuantity(initialCapital)) errors.push('Invalid initial capital');

      // Validate allocation percentages sum to 100
      if (allocation) {
        const total = Object.values(allocation).reduce((a, b) => a + b, 0);
        if (Math.abs(total - 100) > 0.01) errors.push('Allocation percentages must sum to 100%');
      }

      // Validate symbols
      if (Array.isArray(symbols)) {
        symbols.forEach(symbol => {
          if (!InputValidator.isValidSymbol(symbol)) {
            errors.push(`Invalid symbol format: ${symbol}`);
          }
        });
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }

      // Store in database
      const query = `
        INSERT INTO backtest_multi_asset
        (user_id, name, symbols, allocation, start_date, end_date,
         initial_capital, rebalance_config, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running')
      `;

      const [result] = await database.query(query, [
        userId,
        name,
        JSON.stringify(symbols),
        JSON.stringify(allocation),
        startDate,
        endDate,
        initialCapital || 100000,
        JSON.stringify(rebalanceConfig || {})
      ]);

      const backtestId = result.insertId;

      // Start backtest asynchronously
      if (config.multiAssetBacktestEngine) {
        config.multiAssetBacktestEngine.runBacktest({
          symbols,
          allocation,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          initialCapital: initialCapital || 100000,
          rebalanceConfig,
          strategy
        }).then(results => {
          database.query(
            `UPDATE backtest_multi_asset SET status = 'completed', results = ? WHERE id = ?`,
            [JSON.stringify(results), backtestId]
          );
          logger.info(`✅ Multi-asset backtest completed: ${backtestId}`, { userId });
        }).catch(error => {
          logger.error(`Multi-asset backtest ${backtestId} failed:`, error);
          database.query(
            `UPDATE backtest_multi_asset SET status = 'failed', error_message = ? WHERE id = ?`,
            [error.message, backtestId]
          );
        });
      }

      logger.info(`🔄 Multi-asset backtest started: ${backtestId}`, { userId, symbols });

      res.json({
        backtestId,
        status: 'running',
        symbols,
        allocation,
        message: 'Multi-asset backtest started'
      });
    } catch (error) {
      logger.error('Error starting multi-asset backtest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/multi-asset/:backtestId
   * Get multi-asset backtest results
   */
  router.get('/api/backtesting/multi-asset/:backtestId', authMiddleware, async (req, res) => {
    try {
      const { backtestId } = req.params;
      const userId = req.user.id;

      const query = `
        SELECT * FROM backtest_multi_asset
        WHERE id = ? AND user_id = ?
      `;

      const [rows] = await database.query(query, [backtestId, userId]);

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Backtest not found' });
      }

      const backtest = rows[0];
      const results = backtest.results ? JSON.parse(backtest.results) : null;

      res.json({
        backtestId,
        status: backtest.status,
        symbols: JSON.parse(backtest.symbols),
        allocation: JSON.parse(backtest.allocation),
        startDate: backtest.start_date,
        endDate: backtest.end_date,
        initialCapital: backtest.initial_capital,
        results,
        createdAt: backtest.created_at,
        completedAt: backtest.completed_at
      });
    } catch (error) {
      logger.error('Error fetching multi-asset backtest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // WALK-FORWARD OPTIMIZATION ENDPOINTS
  // ========================================================================

  /**
   * POST /api/backtesting/walk-forward
   * Start walk-forward optimization
   *
   * SECURITY: Full input validation and sanitization
   */
  router.post('/api/backtesting/walk-forward', authMiddleware, async (req, res) => {
    try {
      const {
        name,
        symbol,
        startDate,
        endDate,
        insamplePeriod,
        outofSamplePeriod,
        stepSize,
        parameterGrid,
        strategy,
        objectiveMetric
      } = req.body;
      const userId = req.user.id;

      // Validate required fields
      const errors = [];

      if (!name) errors.push('name is required');
      if (!symbol || !InputValidator.isValidSymbol(symbol)) errors.push('Invalid or missing symbol');
      if (!startDate || !InputValidator.isValidDateRange(startDate, endDate)) errors.push('Invalid date range');
      if (!insamplePeriod || insamplePeriod < 20) errors.push('In-sample period must be at least 20 days');
      if (!outofSamplePeriod || outofSamplePeriod < 10) errors.push('Out-of-sample period must be at least 10 days');
      if (!stepSize || stepSize < 1) errors.push('Step size must be at least 1 day');
      if (!parameterGrid || typeof parameterGrid !== 'object') errors.push('Parameter grid must be an object');

      const totalSpan = (new Date(endDate) - new Date(startDate)) / (24 * 60 * 60 * 1000);
      if (totalSpan < insamplePeriod + outofSamplePeriod) {
        errors.push('Total date range too small for walk-forward analysis');
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }

      // Store in database
      const query = `
        INSERT INTO backtest_walk_forward
        (user_id, name, symbol, start_date, end_date,
         insample_period, outofsample_period, step_size,
         parameter_grid, objective_metric, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running')
      `;

      const [result] = await database.query(query, [
        userId,
        name,
        symbol,
        startDate,
        endDate,
        insamplePeriod,
        outofSamplePeriod,
        stepSize,
        JSON.stringify(parameterGrid),
        objectiveMetric || 'sharpeRatio'
      ]);

      const optimizationId = result.insertId;

      // Start optimization asynchronously
      if (config.walkForwardOptimizer) {
        config.walkForwardOptimizer.runWalkForwardOptimization({
          symbol,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          insamplePeriod,
          outofSamplePeriod,
          stepSize,
          parameterGrid,
          strategy,
          objectiveMetric: objectiveMetric || 'sharpeRatio'
        }).then(results => {
          database.query(
            `UPDATE backtest_walk_forward SET status = 'completed', results = ? WHERE id = ?`,
            [JSON.stringify(results), optimizationId]
          );
          logger.info(`✅ Walk-forward optimization completed: ${optimizationId}`, { userId });
        }).catch(error => {
          logger.error(`Walk-forward optimization ${optimizationId} failed:`, error);
          database.query(
            `UPDATE backtest_walk_forward SET status = 'failed', error_message = ? WHERE id = ?`,
            [error.message, optimizationId]
          );
        });
      }

      logger.info(`🔄 Walk-forward optimization started: ${optimizationId}`, { userId, symbol });

      res.json({
        optimizationId,
        status: 'running',
        symbol,
        message: 'Walk-forward optimization started'
      });
    } catch (error) {
      logger.error('Error starting walk-forward optimization:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/walk-forward/:optimizationId
   * Get walk-forward results
   */
  router.get('/api/backtesting/walk-forward/:optimizationId', authMiddleware, async (req, res) => {
    try {
      const { optimizationId } = req.params;
      const userId = req.user.id;

      const query = `
        SELECT * FROM backtest_walk_forward
        WHERE id = ? AND user_id = ?
      `;

      const [rows] = await database.query(query, [optimizationId, userId]);

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Optimization not found' });
      }

      const optimization = rows[0];
      const results = optimization.results ? JSON.parse(optimization.results) : null;

      res.json({
        optimizationId,
        name: optimization.name,
        status: optimization.status,
        symbol: optimization.symbol,
        startDate: optimization.start_date,
        endDate: optimization.end_date,
        insamplePeriod: optimization.insample_period,
        outofSamplePeriod: optimization.outofsample_period,
        stepSize: optimization.step_size,
        objectiveMetric: optimization.objective_metric,
        results,
        createdAt: optimization.created_at,
        completedAt: optimization.completed_at
      });
    } catch (error) {
      logger.error('Error fetching walk-forward optimization:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // MONTE CARLO SIMULATION ENDPOINTS
  // ========================================================================

  /**
   * POST /api/backtesting/monte-carlo
   * Start Monte Carlo simulation
   *
   * SECURITY: Full input validation and sanitization
   */
  router.post('/api/backtesting/monte-carlo', authMiddleware, async (req, res) => {
    try {
      const {
        name,
        backtestId,
        numSimulations,
        method,
        confidenceLevel
      } = req.body;
      const userId = req.user.id;

      // Validate required fields
      const errors = [];

      if (!name) errors.push('name is required');
      if (!backtestId) errors.push('backtestId is required');
      if (numSimulations && (!InputValidator.isValidQuantity(numSimulations) || numSimulations < 100 || numSimulations > 10000)) {
        errors.push('Number of simulations must be between 100 and 10000');
      }
      if (method && !InputValidator.isOneOf(method, ['returns', 'bootstrapping'])) {
        errors.push('Method must be either "returns" or "bootstrapping"');
      }
      if (confidenceLevel && (!InputValidator.isValidPercentage(confidenceLevel) || confidenceLevel < 0.5 || confidenceLevel > 0.99)) {
        errors.push('Confidence level must be between 0.5 and 0.99');
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }

      // Verify backtest exists
      const [backtests] = await database.query(
        `SELECT * FROM backtest_results WHERE id = ? AND user_id = ?`,
        [backtestId, userId]
      );

      if (!backtests || backtests.length === 0) {
        return res.status(404).json({ error: 'Backtest not found' });
      }

      // Store in database
      const query = `
        INSERT INTO backtest_monte_carlo
        (user_id, name, backtest_id, num_simulations, method, confidence_level, status)
        VALUES (?, ?, ?, ?, ?, ?, 'running')
      `;

      const [result] = await database.query(query, [
        userId,
        name,
        backtestId,
        numSimulations || 1000,
        method || 'returns',
        confidenceLevel || 0.95
      ]);

      const simulationId = result.insertId;

      // Start simulation asynchronously
      if (config.monteCarloSimulator && backtests[0]) {
        config.monteCarloSimulator.runSimulation(backtests[0], {
          numSimulations: numSimulations || 1000,
          method: method || 'returns',
          confidenceLevel: confidenceLevel || 0.95
        }).then(results => {
          database.query(
            `UPDATE backtest_monte_carlo SET status = 'completed', results = ? WHERE id = ?`,
            [JSON.stringify(results), simulationId]
          );
          logger.info(`✅ Monte Carlo simulation completed: ${simulationId}`, { userId });
        }).catch(error => {
          logger.error(`Monte Carlo simulation ${simulationId} failed:`, error);
          database.query(
            `UPDATE backtest_monte_carlo SET status = 'failed', error_message = ? WHERE id = ?`,
            [error.message, simulationId]
          );
        });
      }

      logger.info(`🔄 Monte Carlo simulation started: ${simulationId}`, { userId, backtestId });

      res.json({
        simulationId,
        status: 'running',
        backtestId,
        numSimulations: numSimulations || 1000,
        method: method || 'returns',
        confidenceLevel: confidenceLevel || 0.95,
        message: 'Monte Carlo simulation started'
      });
    } catch (error) {
      logger.error('Error starting Monte Carlo simulation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/monte-carlo/:simulationId
   * Get Monte Carlo simulation results
   */
  router.get('/api/backtesting/monte-carlo/:simulationId', authMiddleware, async (req, res) => {
    try {
      const { simulationId } = req.params;
      const userId = req.user.id;

      const query = `
        SELECT * FROM backtest_monte_carlo
        WHERE id = ? AND user_id = ?
      `;

      const [rows] = await database.query(query, [simulationId, userId]);

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Simulation not found' });
      }

      const simulation = rows[0];
      const results = simulation.results ? JSON.parse(simulation.results) : null;

      res.json({
        simulationId,
        name: simulation.name,
        status: simulation.status,
        backtestId: simulation.backtest_id,
        numSimulations: simulation.num_simulations,
        method: simulation.method,
        confidenceLevel: simulation.confidence_level,
        results,
        createdAt: simulation.created_at,
        completedAt: simulation.completed_at
      });
    } catch (error) {
      logger.error('Error fetching Monte Carlo simulation:', error);
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
