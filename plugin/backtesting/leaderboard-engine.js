/**
 * Backtesting Leaderboard Engine
 * Ranking and comparison of user backtests
 *
 * Features:
 * - User ranking by various metrics
 * - Strategy comparison
 * - Seasonal performance analysis
 * - Performance tracking over time
 */

const EventEmitter = require('events');

/**
 * Ranking Metric Types
 */
const RankingMetric = {
  SHARPE_RATIO: 'sharpe_ratio',
  TOTAL_RETURN: 'total_return',
  PROFIT_FACTOR: 'profit_factor',
  WIN_RATE: 'win_rate',
  MAX_DRAWDOWN: 'max_drawdown',  // Minimize
  CALMAR_RATIO: 'calmar_ratio'
};

/**
 * Leaderboard Engine
 * Manages user rankings and performance comparisons
 */
class LeaderboardEngine extends EventEmitter {
  constructor(config = {}) {
    super();

    this.database = config.database;
    this.logger = config.logger || console;

    this.leaderboards = new Map();  // metric -> leaderboard data
    this.userRankings = new Map();  // user_id -> rankings
  }

  /**
   * Calculate user ranking for all metrics
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User rankings
   */
  async calculateUserRankings(userId) {
    try {
      const rankings = {};

      for (const metric of Object.values(RankingMetric)) {
        rankings[metric] = await this._calculateMetricRank(userId, metric);
      }

      this.userRankings.set(userId, rankings);

      this.logger.info(`✅ Rankings calculated for user ${userId}`);
      this.emit('rankings:updated', { userId, rankings });

      return rankings;
    } catch (error) {
      this.logger.error(`Error calculating rankings for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get leaderboard for specific metric
   * @param {string} metric - Metric to rank by
   * @param {number} limit - Number of top users to return
   * @param {Object} filters - Additional filters (symbol, timeframe, etc.)
   * @returns {Promise<Array>} Leaderboard
   */
  async getLeaderboard(metric, limit = 100, filters = {}) {
    try {
      // Validate metric
      if (!Object.values(RankingMetric).includes(metric)) {
        throw new Error(`Invalid metric: ${metric}`);
      }

      // Build query
      let query = `
        SELECT
          u.id,
          u.username,
          u.email,
          br.${metric} as metric_value,
          COUNT(*) as backtest_count,
          AVG(br.total_return) as avg_return,
          MAX(br.sharpe_ratio) as best_sharpe,
          br.created_at as last_backtest
        FROM backtest_results br
        JOIN users u ON br.user_id = u.id
        WHERE 1=1
      `;

      const params = [];

      // Add symbol filter
      if (filters.symbol) {
        query += ` AND br.symbol = ?`;
        params.push(filters.symbol);
      }

      // Add date range filter
      if (filters.startDate) {
        query += ` AND br.created_at >= ?`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ` AND br.created_at <= ?`;
        params.push(filters.endDate);
      }

      // Add minimum trades filter
      if (filters.minTrades) {
        query += ` AND br.total_trades >= ?`;
        params.push(filters.minTrades);
      }

      // Order by metric
      const isMinimizeMetric = metric === RankingMetric.MAX_DRAWDOWN;
      query += ` GROUP BY u.id ORDER BY br.${metric} ${isMinimizeMetric ? 'ASC' : 'DESC'} LIMIT ?`;
      params.push(limit);

      const [rows] = await this.database.query(query, params);

      // Add ranking
      const leaderboard = rows.map((row, index) => ({
        rank: index + 1,
        userId: row.id,
        username: row.username,
        email: row.email,
        metricValue: row.metric_value,
        backtestCount: row.backtest_count,
        avgReturn: row.avg_return,
        bestSharpe: row.best_sharpe,
        lastBacktest: row.last_backtest
      }));

      this.leaderboards.set(metric, leaderboard);

      this.logger.info(`📊 Leaderboard generated for ${metric} (${leaderboard.length} users)`);
      this.emit('leaderboard:generated', { metric, count: leaderboard.length });

      return leaderboard;
    } catch (error) {
      this.logger.error(`Error generating leaderboard for ${metric}:`, error);
      throw error;
    }
  }

  /**
   * Get comparison between two strategies
   * @param {number} backtestId1 - First backtest
   * @param {number} backtestId2 - Second backtest
   * @returns {Promise<Object>} Comparison results
   */
  async compareStrategies(backtestId1, backtestId2) {
    try {
      const [rows1] = await this.database.query(
        `SELECT * FROM backtest_results WHERE id = ?`,
        [backtestId1]
      );
      const [rows2] = await this.database.query(
        `SELECT * FROM backtest_results WHERE id = ?`,
        [backtestId2]
      );

      if (!rows1 || rows1.length === 0 || !rows2 || rows2.length === 0) {
        throw new Error('One or both backtests not found');
      }

      const backtest1 = rows1[0];
      const backtest2 = rows2[0];

      const comparison = {
        backtest1: {
          id: backtest1.id,
          strategyName: backtest1.strategy_name,
          symbol: backtest1.symbol,
          return: backtest1.total_return,
          sharpe: backtest1.sharpe_ratio,
          maxDrawdown: backtest1.max_drawdown,
          winRate: backtest1.win_rate,
          profitFactor: backtest1.profit_factor,
          trades: backtest1.total_trades
        },
        backtest2: {
          id: backtest2.id,
          strategyName: backtest2.strategy_name,
          symbol: backtest2.symbol,
          return: backtest2.total_return,
          sharpe: backtest2.sharpe_ratio,
          maxDrawdown: backtest2.max_drawdown,
          winRate: backtest2.win_rate,
          profitFactor: backtest2.profit_factor,
          trades: backtest2.total_trades
        },
        winner: this._determineWinner(backtest1, backtest2),
        metrics: this._compareMetrics(backtest1, backtest2)
      };

      this.logger.info(`📊 Strategy comparison generated: ${backtest1.id} vs ${backtest2.id}`);
      this.emit('comparison:generated', { backtestId1, backtestId2 });

      return comparison;
    } catch (error) {
      this.logger.error('Error comparing strategies:', error);
      throw error;
    }
  }

  /**
   * Get seasonal performance analysis
   * @param {number} userId - User ID
   * @param {string} metric - Metric to analyze
   * @returns {Promise<Object>} Seasonal analysis
   */
  async getSeasonalAnalysis(userId, metric = RankingMetric.SHARPE_RATIO) {
    try {
      const query = `
        SELECT
          MONTH(br.created_at) as month,
          YEAR(br.created_at) as year,
          COUNT(*) as backtest_count,
          AVG(br.${metric}) as avg_metric,
          MAX(br.${metric}) as best_metric,
          MIN(br.${metric}) as worst_metric,
          AVG(br.total_return) as avg_return
        FROM backtest_results br
        WHERE br.user_id = ?
        GROUP BY YEAR(br.created_at), MONTH(br.created_at)
        ORDER BY year DESC, month DESC
        LIMIT 12
      `;

      const [rows] = await this.database.query(query, [userId]);

      const analysis = {
        userId,
        metric,
        months: rows.map((row) => ({
          month: this._getMonthName(row.month),
          year: row.year,
          backtestCount: row.backtest_count,
          avgMetric: row.avg_metric,
          bestMetric: row.best_metric,
          worstMetric: row.worst_metric,
          avgReturn: row.avg_return
        }))
      };

      this.logger.info(`📈 Seasonal analysis generated for user ${userId}`);
      this.emit('analysis:generated', { userId, metric });

      return analysis;
    } catch (error) {
      this.logger.error('Error generating seasonal analysis:', error);
      throw error;
    }
  }

  /**
   * Get user performance timeline
   * @param {number} userId - User ID
   * @param {number} days - Days to analyze (default: 30)
   * @returns {Promise<Array>} Performance data points
   */
  async getUserPerformanceTimeline(userId, days = 30) {
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);

      const query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as backtest_count,
          AVG(total_return) as avg_return,
          AVG(sharpe_ratio) as avg_sharpe,
          AVG(win_rate) as avg_win_rate,
          MAX(total_return) as best_return
        FROM backtest_results
        WHERE user_id = ? AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const [rows] = await this.database.query(query, [userId, daysAgo]);

      const timeline = rows.map((row) => ({
        date: row.date,
        backtestCount: row.backtest_count,
        avgReturn: row.avg_return,
        avgSharpe: row.avg_sharpe,
        avgWinRate: row.avg_win_rate,
        bestReturn: row.best_return
      }));

      this.logger.info(`📊 Performance timeline generated for user ${userId} (${days} days)`);
      this.emit('timeline:generated', { userId, days, count: timeline.length });

      return timeline;
    } catch (error) {
      this.logger.error('Error generating performance timeline:', error);
      throw error;
    }
  }

  /**
   * Get top performers overall
   * @param {number} limit - Number of top performers
   * @returns {Promise<Array>} Top performers
   */
  async getTopPerformers(limit = 50) {
    try {
      const query = `
        SELECT
          u.id,
          u.username,
          COUNT(br.id) as total_backtests,
          AVG(br.sharpe_ratio) as avg_sharpe,
          AVG(br.total_return) as avg_return,
          AVG(br.win_rate) as avg_win_rate,
          MAX(br.sharpe_ratio) as best_sharpe,
          MAX(br.total_return) as best_return
        FROM users u
        LEFT JOIN backtest_results br ON u.id = br.user_id
        GROUP BY u.id
        HAVING COUNT(br.id) >= 5
        ORDER BY avg_sharpe DESC
        LIMIT ?
      `;

      const [rows] = await this.database.query(query, [limit]);

      const topPerformers = rows.map((row, index) => ({
        rank: index + 1,
        userId: row.id,
        username: row.username,
        totalBacktests: row.total_backtests,
        avgSharpe: row.avg_sharpe,
        avgReturn: row.avg_return,
        avgWinRate: row.avg_win_rate,
        bestSharpe: row.best_sharpe,
        bestReturn: row.best_return
      }));

      this.logger.info(`🏆 Top performers generated (${topPerformers.length} users)`);
      this.emit('top_performers:generated', { count: topPerformers.length });

      return topPerformers;
    } catch (error) {
      this.logger.error('Error generating top performers:', error);
      throw error;
    }
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Calculate metric rank for user
   * @private
   */
  async _calculateMetricRank(userId, metric) {
    try {
      const isMinimizeMetric = metric === RankingMetric.MAX_DRAWDOWN;

      const query = `
        SELECT COUNT(*) as rank
        FROM backtest_results
        WHERE ${metric} ${isMinimizeMetric ? '<' : '>'} (
          SELECT ${metric}
          FROM backtest_results
          WHERE user_id = ?
          ORDER BY ${metric} ${isMinimizeMetric ? 'ASC' : 'DESC'}
          LIMIT 1
        ) + 1
      `;

      const [rows] = await this.database.query(query, [userId]);
      return rows[0]?.rank || null;
    } catch (error) {
      this.logger.warn(`Could not calculate rank for metric ${metric}:`, error);
      return null;
    }
  }

  /**
   * Determine winner between two backtests
   * @private
   */
  _determineWinner(backtest1, backtest2) {
    // Winner determined by Sharpe ratio (risk-adjusted return)
    const sharpe1 = backtest1.sharpe_ratio || 0;
    const sharpe2 = backtest2.sharpe_ratio || 0;

    if (sharpe1 > sharpe2) {
      return {
        winnerId: backtest1.id,
        winnerStrategy: backtest1.strategy_name,
        sharpeDifference: (sharpe1 - sharpe2).toFixed(3),
        reason: `Better Sharpe Ratio: ${sharpe1.toFixed(3)} vs ${sharpe2.toFixed(3)}`
      };
    } else if (sharpe2 > sharpe1) {
      return {
        winnerId: backtest2.id,
        winnerStrategy: backtest2.strategy_name,
        sharpeDifference: (sharpe2 - sharpe1).toFixed(3),
        reason: `Better Sharpe Ratio: ${sharpe2.toFixed(3)} vs ${sharpe1.toFixed(3)}`
      };
    } else {
      return {
        winnerId: null,
        winnerStrategy: 'Tie',
        sharpeDifference: '0',
        reason: 'Equal performance'
      };
    }
  }

  /**
   * Compare metrics between two backtests
   * @private
   */
  _compareMetrics(backtest1, backtest2) {
    const metrics = {};

    for (const metric of Object.values(RankingMetric)) {
      const val1 = backtest1[metric] || 0;
      const val2 = backtest2[metric] || 0;
      const diff = val1 - val2;
      const winner = diff > 0 ? 1 : (diff < 0 ? 2 : 0);

      metrics[metric] = {
        value1: val1.toFixed(3),
        value2: val2.toFixed(3),
        difference: diff.toFixed(3),
        winner: winner === 1 ? 'backtest1' : (winner === 2 ? 'backtest2' : 'tie')
      };
    }

    return metrics;
  }

  /**
   * Get month name from month number
   * @private
   */
  _getMonthName(month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || 'Unknown';
  }
}

// Export
module.exports = {
  LeaderboardEngine,
  RankingMetric
};
