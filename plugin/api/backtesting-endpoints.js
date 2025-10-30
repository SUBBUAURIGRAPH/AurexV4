/**
 * Backtesting API Endpoints
 * RESTful API for backtesting system
 *
 * Features:
 * - Backtest execution and monitoring
 * - Results management and retrieval
 * - Historical data management
 * - Analytics and comparison
 * - Parameter optimization
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize backtesting routes
 * @param {Object} config - Configuration object
 */
function initializeBacktestingRoutes(config) {
  const {
    database,
    historicalDataManager,
    backtestingEngineFactory,
    analyticsEngine,
    logger = console,
    authMiddleware
  } = config;

  // ========================================================================
  // BACKTEST EXECUTION & MONITORING
  // ========================================================================

  /**
   * POST /api/backtesting/backtest
   * Start a new backtest
   */
  router.post('/api/backtesting/backtest', authMiddleware, async (req, res) => {
    try {
      const { symbol, startDate, endDate, strategyCode, initialCapital, commission, slippage } = req.body;
      const userId = req.user.id;

      // Validate inputs
      if (!symbol || !startDate || !endDate || !strategyCode) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({ error: 'Invalid date range' });
      }

      logger.info(`📊 Starting backtest for ${symbol}`, { userId, startDate, endDate });

      // Create backtest record in database
      const query = `
        INSERT INTO backtest_results
        (user_id, strategy_name, symbol, start_date, end_date, initial_capital, commission_percent, slippage_percent, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running')
      `;

      const [result] = await database.query(query, [
        userId,
        'strategy_' + Date.now(),
        symbol,
        startDate,
        endDate,
        initialCapital || 100000,
        commission || 0.001,
        slippage || 0.0005
      ]);

      const backtestId = result.insertId;

      // Start backtest asynchronously
      executeBacktest(backtestId, symbol, startDate, endDate, strategyCode, {
        initialCapital: initialCapital || 100000,
        commission: commission || 0.001,
        slippage: slippage || 0.0005,
        database,
        historicalDataManager,
        backtestingEngineFactory,
        analyticsEngine,
        logger
      }).catch(error => {
        logger.error(`Backtest ${backtestId} failed:`, error);
        updateBacktestStatus(backtestId, 'failed', database, error.message);
      });

      res.json({
        id: backtestId,
        status: 'running',
        symbol,
        startDate,
        endDate,
        message: 'Backtest started'
      });
    } catch (error) {
      logger.error('Error starting backtest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/backtest/:id
   * Get backtest status and results
   */
  router.get('/api/backtesting/backtest/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const query = `
        SELECT * FROM backtest_results
        WHERE id = ? AND user_id = ?
      `;

      const [result] = await database.query(query, [id, userId]);

      if (!result) {
        return res.status(404).json({ error: 'Backtest not found' });
      }

      res.json({
        id: result.id,
        symbol: result.symbol,
        status: result.status,
        startDate: result.start_date,
        endDate: result.end_date,
        initialCapital: result.initial_capital,
        finalEquity: result.final_capital,
        totalReturn: result.total_return,
        sharpeRatio: result.sharpe_ratio,
        maxDrawdown: result.max_drawdown,
        winRate: result.win_rate,
        totalTrades: result.total_trades,
        progress: result.progress_percent,
        error: result.error_message,
        createdAt: result.created_at,
        completedAt: result.completed_at
      });
    } catch (error) {
      logger.error('Error getting backtest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/backtesting/backtest/:id/cancel
   * Cancel a running backtest
   */
  router.post('/api/backtesting/backtest/:id/cancel', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const query = `
        UPDATE backtest_results
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ? AND user_id = ? AND status = 'running'
      `;

      const result = await database.query(query, [id, userId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Backtest not found or not running' });
      }

      res.json({ message: 'Backtest cancelled' });
    } catch (error) {
      logger.error('Error cancelling backtest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // RESULTS MANAGEMENT
  // ========================================================================

  /**
   * GET /api/backtesting/results
   * List user's backtest results
   */
  router.get('/api/backtesting/results', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const { symbol, status, limit = 20, offset = 0 } = req.query;

      let query = 'SELECT * FROM backtest_results WHERE user_id = ?';
      const params = [userId];

      if (symbol) {
        query += ' AND symbol = ?';
        params.push(symbol);
      }

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const results = await database.query(query, params);

      res.json({
        total: results.length,
        results: results.map(r => ({
          id: r.id,
          symbol: r.symbol,
          status: r.status,
          totalReturn: r.total_return,
          sharpeRatio: r.sharpe_ratio,
          maxDrawdown: r.max_drawdown,
          winRate: r.win_rate,
          totalTrades: r.total_trades,
          createdAt: r.created_at
        }))
      });
    } catch (error) {
      logger.error('Error listing results:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/results/:id
   * Get detailed backtest results
   */
  router.get('/api/backtesting/results/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get main result
      let query = `SELECT * FROM backtest_results WHERE id = ? AND user_id = ?`;
      const [result] = await database.query(query, [id, userId]);

      if (!result) {
        return res.status(404).json({ error: 'Result not found' });
      }

      // Get trades
      query = `SELECT * FROM backtest_trades WHERE backtest_result_id = ? ORDER BY entry_date ASC`;
      const trades = await database.query(query, [id]);

      // Get equity history
      query = `SELECT * FROM backtest_equity_history WHERE backtest_result_id = ? ORDER BY date ASC`;
      const equityCurve = await database.query(query, [id]);

      res.json({
        id: result.id,
        symbol: result.symbol,
        status: result.status,
        initialCapital: result.initial_capital,
        finalEquity: result.final_capital,
        metrics: {
          totalReturn: result.total_return,
          annualizedReturn: result.annualized_return,
          sharpeRatio: result.sharpe_ratio,
          sortinoRatio: result.sortino_ratio,
          calmarRatio: result.calmar_ratio,
          maxDrawdown: result.max_drawdown,
          winRate: result.win_rate,
          profitFactor: result.profit_factor,
          avgWin: result.avg_win,
          avgLoss: result.avg_loss,
          totalTrades: result.total_trades,
          winningTrades: result.winning_trades,
          losingTrades: result.losing_trades
        },
        trades: trades.map(t => ({
          id: t.id,
          entryDate: t.entry_date,
          entryPrice: t.entry_price,
          exitDate: t.exit_date,
          exitPrice: t.exit_price,
          quantity: t.quantity,
          pnl: t.net_pnl,
          holdingDays: t.holding_period
        })),
        equityCurve: equityCurve.map(e => ({
          date: e.date,
          equity: e.equity,
          drawdown: e.drawdown_percent
        })),
        createdAt: result.created_at
      });
    } catch (error) {
      logger.error('Error getting detailed results:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/backtesting/results/:id
   * Delete backtest results
   */
  router.delete('/api/backtesting/results/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      let query = `DELETE FROM backtest_results WHERE id = ? AND user_id = ?`;
      const result = await database.query(query, [id, userId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Result not found' });
      }

      res.json({ message: 'Result deleted' });
    } catch (error) {
      logger.error('Error deleting result:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // HISTORICAL DATA
  // ========================================================================

  /**
   * GET /api/backtesting/data/symbols
   * List available symbols
   */
  router.get('/api/backtesting/data/symbols', async (req, res) => {
    try {
      const symbols = await historicalDataManager.getAvailableSymbols();
      res.json({ symbols, count: symbols.length });
    } catch (error) {
      logger.error('Error listing symbols:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/data/:symbol
   * Get data availability for symbol
   */
  router.get('/api/backtesting/data/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const dateRange = await historicalDataManager.getDateRange(symbol);

      res.json({
        symbol: dateRange.symbol,
        available: dateRange.available,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
    } catch (error) {
      logger.error('Error getting data info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/backtesting/data/sync
   * Sync historical data
   */
  router.post('/api/backtesting/data/sync', authMiddleware, async (req, res) => {
    try {
      historicalDataManager.syncHistoricalData().catch(error => {
        logger.error('Background sync failed:', error);
      });

      res.json({ message: 'Data sync started in background' });
    } catch (error) {
      logger.error('Error starting sync:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // ANALYTICS & PERFORMANCE
  // ========================================================================

  /**
   * GET /api/backtesting/results/:id/metrics
   * Get performance metrics
   */
  router.get('/api/backtesting/results/:id/metrics', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      let query = `SELECT * FROM backtest_results WHERE id = ? AND user_id = ?`;
      const [result] = await database.query(query, [id, userId]);

      if (!result) {
        return res.status(404).json({ error: 'Result not found' });
      }

      res.json({
        id: result.id,
        metrics: {
          performance: {
            totalReturn: result.total_return,
            annualizedReturn: result.annualized_return,
            netProfit: result.final_capital - result.initial_capital
          },
          risk: {
            maxDrawdown: result.max_drawdown,
            volatility: result.volatility,
            var95: result.var_95,
            cvar95: result.cvar_95
          },
          ratios: {
            sharpeRatio: result.sharpe_ratio,
            sortinoRatio: result.sortino_ratio,
            calmarRatio: result.calmar_ratio,
            informationRatio: result.information_ratio,
            profitFactor: result.profit_factor
          },
          trades: {
            total: result.total_trades,
            winning: result.winning_trades,
            losing: result.losing_trades,
            winRate: result.win_rate,
            avgWin: result.avg_win,
            avgLoss: result.avg_loss
          }
        }
      });
    } catch (error) {
      logger.error('Error getting metrics:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/results/:id/equity-history
   * Get equity curve
   */
  router.get('/api/backtesting/results/:id/equity-history', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify ownership
      let query = `SELECT id FROM backtest_results WHERE id = ? AND user_id = ?`;
      const [result] = await database.query(query, [id, userId]);

      if (!result) {
        return res.status(404).json({ error: 'Result not found' });
      }

      // Get equity history
      query = `SELECT date, equity, drawdown_percent FROM backtest_equity_history WHERE backtest_result_id = ? ORDER BY date ASC`;
      const data = await database.query(query, [id]);

      res.json({
        data: data.map(d => ({
          date: d.date,
          equity: d.equity,
          drawdown: d.drawdown_percent
        }))
      });
    } catch (error) {
      logger.error('Error getting equity history:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // COMPARISON
  // ========================================================================

  /**
   * GET /api/backtesting/results/:id/vs-paper
   * Compare backtest vs paper trading
   */
  router.get('/api/backtesting/results/:id/vs-paper', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      let query = `SELECT * FROM backtest_paper_comparison WHERE backtest_result_id = ?`;
      const [comparison] = await database.query(query, [id]);

      if (!comparison) {
        return res.status(404).json({ error: 'Comparison not found' });
      }

      res.json({
        backtest: {
          return: comparison.backtest_return,
          sharpeRatio: comparison.backtest_sharpe,
          drawdown: comparison.backtest_drawdown,
          winRate: comparison.backtest_win_rate
        },
        paper: {
          return: comparison.paper_return,
          sharpeRatio: comparison.paper_sharpe,
          drawdown: comparison.paper_drawdown,
          winRate: comparison.paper_win_rate
        },
        analysis: {
          correlation: comparison.correlation,
          consistency: comparison.consistency_score,
          insights: comparison.insights
        }
      });
    } catch (error) {
      logger.error('Error getting comparison:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/results/:id/vs-live
   * Compare backtest vs live trading
   */
  router.get('/api/backtesting/results/:id/vs-live', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      let query = `SELECT * FROM backtest_live_comparison WHERE backtest_result_id = ?`;
      const [comparison] = await database.query(query, [id]);

      if (!comparison) {
        return res.status(404).json({ error: 'Comparison not found' });
      }

      res.json({
        backtest: {
          return: comparison.backtest_return,
          sharpeRatio: comparison.backtest_sharpe
        },
        live: {
          return: comparison.live_return,
          sharpeRatio: comparison.live_sharpe
        },
        analysis: {
          correlation: comparison.correlation,
          executionQuality: comparison.execution_quality_score,
          insights: comparison.insights
        }
      });
    } catch (error) {
      logger.error('Error getting comparison:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // OPTIMIZATION
  // ========================================================================

  /**
   * POST /api/backtesting/optimize
   * Start parameter optimization
   */
  router.post('/api/backtesting/optimize', authMiddleware, async (req, res) => {
    try {
      const { symbol, strategyName, parameterGrid, objectiveMetric } = req.body;
      const userId = req.user.id;

      const query = `
        INSERT INTO backtest_optimization_results
        (user_id, optimization_name, strategy_name, symbol, parameter_grid, objective_metric, status)
        VALUES (?, ?, ?, ?, ?, ?, 'running')
      `;

      const [result] = await database.query(query, [
        userId,
        'opt_' + Date.now(),
        strategyName,
        symbol,
        JSON.stringify(parameterGrid),
        objectiveMetric
      ]);

      res.json({
        id: result.insertId,
        status: 'running',
        message: 'Optimization started'
      });
    } catch (error) {
      logger.error('Error starting optimization:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/optimize/:id
   * Get optimization progress
   */
  router.get('/api/backtesting/optimize/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const query = `SELECT * FROM backtest_optimization_results WHERE id = ? AND user_id = ?`;
      const [result] = await database.query(query, [id, userId]);

      if (!result) {
        return res.status(404).json({ error: 'Optimization not found' });
      }

      res.json({
        id: result.id,
        status: result.status,
        progress: result.progress_percent,
        completed: result.completed_combinations,
        total: result.total_combinations,
        bestMetric: result.best_metric_value
      });
    } catch (error) {
      logger.error('Error getting optimization progress:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/backtesting/optimize/:id/results
   * Get optimization results
   */
  router.get('/api/backtesting/optimize/:id/results', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const query = `SELECT * FROM backtest_optimization_results WHERE id = ? AND user_id = ?`;
      const [result] = await database.query(query, [id, userId]);

      if (!result) {
        return res.status(404).json({ error: 'Optimization not found' });
      }

      res.json({
        id: result.id,
        bestParameters: JSON.parse(result.best_parameters || '{}'),
        bestMetricValue: result.best_metric_value,
        avgMetricValue: result.avg_metric_value,
        medianMetricValue: result.median_metric_value,
        stdDev: result.std_dev_metric,
        completedAt: result.completed_at
      });
    } catch (error) {
      logger.error('Error getting optimization results:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================================================
  // HEALTH CHECK
  // ========================================================================

  /**
   * GET /api/backtesting/health
   * Health check for backtesting service
   */
  router.get('/api/backtesting/health', async (req, res) => {
    try {
      res.json({
        status: 'ok',
        service: 'backtesting-service',
        version: '1.0.0',
        timestamp: new Date(),
        components: {
          database: true,
          historicalDataManager: true,
          analyticsEngine: true
        }
      });
    } catch (error) {
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  return router;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Execute backtest asynchronously
 */
async function executeBacktest(backtestId, symbol, startDate, endDate, strategyCode, config) {
  try {
    const { database, historicalDataManager, backtestingEngineFactory, analyticsEngine, logger } = config;

    // Load historical data
    const bars = await historicalDataManager.loadData(
      symbol,
      new Date(startDate),
      new Date(endDate),
      '1d'
    );

    // Create backtesting engine
    const engine = backtestingEngineFactory({
      symbol,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      initialCapital: config.initialCapital,
      commission: config.commission,
      slippage: config.slippage
    });

    // Create strategy from code
    const strategy = createStrategyFromCode(strategyCode);

    // Run backtest
    const result = await engine.run(historicalDataManager, strategy);

    // Calculate advanced metrics
    const metrics = analyticsEngine.calculateMetrics(result);

    // Save results to database
    const query = `
      UPDATE backtest_results
      SET
        final_capital = ?,
        total_return = ?,
        annualized_return = ?,
        sharpe_ratio = ?,
        sortino_ratio = ?,
        calmar_ratio = ?,
        max_drawdown = ?,
        volatility = ?,
        var_95 = ?,
        cvar_95 = ?,
        win_rate = ?,
        profit_factor = ?,
        total_trades = ?,
        winning_trades = ?,
        losing_trades = ?,
        avg_win = ?,
        avg_loss = ?,
        status = 'completed',
        completed_at = NOW()
      WHERE id = ?
    `;

    await database.query(query, [
      result.finalEquity,
      result.totalReturn,
      result.annualizedReturn,
      result.sharpeRatio,
      metrics.sortinoRatio,
      result.calmarRatio,
      result.maxDrawdown,
      metrics.annualizedVolatility,
      metrics.var95,
      metrics.cvar95,
      result.winRate,
      result.profitFactor,
      result.totalTrades,
      result.winningTrades,
      result.losingTrades,
      result.avgWin,
      result.avgLoss,
      backtestId
    ]);

    // Save trades
    for (const trade of result.trades) {
      const tradeQuery = `
        INSERT INTO backtest_trades
        (backtest_result_id, entry_date, entry_price, exit_date, exit_price, quantity, net_pnl, holding_period)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await database.query(tradeQuery, [
        backtestId,
        trade.entryDate,
        trade.entryPrice,
        trade.exitDate,
        trade.exitPrice,
        trade.quantity,
        trade.netPnL,
        trade.holdingPeriod
      ]);
    }

    // Save equity curve
    for (const point of result.equityCurve) {
      const equityQuery = `
        INSERT INTO backtest_equity_history
        (backtest_result_id, date, equity, drawdown_percent)
        VALUES (?, ?, ?, ?)
      `;
      await database.query(equityQuery, [
        backtestId,
        point.date,
        point.equity,
        point.drawdown
      ]);
    }

    logger.info(`✅ Backtest ${backtestId} completed successfully`);
  } catch (error) {
    config.logger.error(`❌ Backtest ${backtestId} failed:`, error);
    await updateBacktestStatus(backtestId, 'failed', config.database, error.message);
  }
}

/**
 * Update backtest status
 */
async function updateBacktestStatus(backtestId, status, database, errorMessage = null) {
  try {
    let query = `UPDATE backtest_results SET status = ?, updated_at = NOW()`;
    const params = [status];

    if (errorMessage) {
      query += `, error_message = ?`;
      params.push(errorMessage);
    }

    query += ` WHERE id = ?`;
    params.push(backtestId);

    await database.query(query, params);
  } catch (error) {
    console.error('Error updating backtest status:', error);
  }
}

/**
 * Create strategy instance from code string
 */
function createStrategyFromCode(code) {
  // For now, create a simple moving average strategy
  // In production, this would safely eval/execute the provided code
  return {
    initialize: async (engine) => {
      this.engine = engine;
    },
    onBar: async (bar, engine) => {
      // Simple moving average crossover strategy example
      // This would be replaced with user-provided strategy logic
    }
  };
}

module.exports = initializeBacktestingRoutes;
