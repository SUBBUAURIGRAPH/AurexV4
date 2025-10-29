/**
 * Chart API Endpoints
 * Provides endpoints for chart data and technical indicators
 * @version 1.0.0
 */

const { CandlestickChart } = require('../chart-data/candlestick-chart');
const { PortfolioVisualizations } = require('../chart-data/portfolio-visualizations');
const MarketDataClient = require('../market-data/client');

/**
 * Chart Endpoints Handler
 * @class ChartEndpoints
 * @description Handles all chart-related API endpoints
 */
class ChartEndpoints {
  /**
   * Initialize chart endpoints
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.marketDataClient = config.marketDataClient;
    this.brokerManager = config.brokerManager;
    this.portfolioManager = config.portfolioManager;
    this.logger = config.logger || console;

    this.chartCache = new Map();
    this.cacheExpiry = 60 * 1000; // 1 minute
  }

  /**
   * GET /api/charts/history/{symbol}
   * Get OHLCV history for a symbol
   */
  async handleChartHistory(req, res, symbol, query = {}) {
    try {
      const {
        period = '1D',
        limit = 100,
        startDate,
        endDate
      } = query;

      // Validate symbol
      if (!symbol || typeof symbol !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Invalid symbol',
          message: 'Symbol must be a non-empty string'
        }));
        return;
      }

      // Get market data
      if (!this.marketDataClient) {
        res.writeHead(500);
        res.end(JSON.stringify({
          error: 'Market data client not configured'
        }));
        return;
      }

      const ohlcData = await this.marketDataClient.getIntraday(symbol, period);

      // Limit results
      const data = ohlcData.slice(-Math.min(limit, ohlcData.length));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        symbol,
        period,
        count: data.length,
        data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      this.logger.error('Chart history error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Failed to get chart history',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/charts/indicators/{symbol}
   * Get technical indicators for a symbol
   */
  async handleChartIndicators(req, res, symbol, query = {}) {
    try {
      const {
        period = '1D',
        indicators = 'sma20,sma50,rsi14,macd',
        limit = 100
      } = query;

      // Validate symbol
      if (!symbol || typeof symbol !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Invalid symbol',
          message: 'Symbol must be a non-empty string'
        }));
        return;
      }

      // Get market data
      if (!this.marketDataClient) {
        res.writeHead(500);
        res.end(JSON.stringify({
          error: 'Market data client not configured'
        }));
        return;
      }

      // Get OHLCV data
      const ohlcData = await this.marketDataClient.getIntraday(symbol, period);
      const data = ohlcData.slice(-Math.min(limit, ohlcData.length));

      // Create candlestick chart to calculate indicators
      const chart = new CandlestickChart({ symbol });
      chart.loadData(data);

      // Parse requested indicators
      const requestedIndicators = indicators.split(',').map(i => i.trim());

      const result = {
        success: true,
        symbol,
        period,
        count: data.length,
        indicators: {},
        timestamp: new Date().toISOString()
      };

      // Calculate each requested indicator
      if (requestedIndicators.includes('sma20')) {
        result.indicators.sma20 = chart.indicators.sma(20);
      }
      if (requestedIndicators.includes('sma50')) {
        result.indicators.sma50 = chart.indicators.sma(50);
      }
      if (requestedIndicators.includes('sma200')) {
        result.indicators.sma200 = chart.indicators.sma(200);
      }
      if (requestedIndicators.includes('ema12')) {
        result.indicators.ema12 = chart.indicators.ema(12);
      }
      if (requestedIndicators.includes('ema26')) {
        result.indicators.ema26 = chart.indicators.ema(26);
      }
      if (requestedIndicators.includes('rsi14')) {
        result.indicators.rsi14 = chart.indicators.rsi(14);
      }
      if (requestedIndicators.includes('macd')) {
        result.indicators.macd = chart.indicators.macd();
      }

      // Add signals
      result.signals = chart.getSignals();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Chart indicators error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Failed to get chart indicators',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/portfolio/summary
   * Get portfolio summary with all positions
   */
  async handlePortfolioSummary(req, res, userId) {
    try {
      if (!this.brokerManager) {
        res.writeHead(500);
        res.end(JSON.stringify({
          error: 'Broker manager not configured'
        }));
        return;
      }

      // Get account info
      const account = await this.brokerManager.getAccount();

      // Get positions
      const positions = await this.brokerManager.getPositions();

      // Format positions
      const formattedPositions = positions.map(p => ({
        symbol: p.symbol,
        quantity: p.quantity,
        avgCost: p.avg_fill_price,
        currentPrice: p.current_price,
        marketValue: p.market_value,
        costBasis: p.cost_basis,
        unrealizedPL: p.unrealized_pl,
        unrealizedPLPercent: p.unrealized_plpc * 100
      }));

      // Calculate totals
      const totalValue = formattedPositions.reduce((sum, p) => sum + p.marketValue, 0);
      const totalCost = formattedPositions.reduce((sum, p) => sum + p.costBasis, 0);
      const totalPL = formattedPositions.reduce((sum, p) => sum + p.unrealizedPL, 0);
      const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

      const result = {
        success: true,
        account: {
          buyingPower: account.buying_power,
          equity: account.equity,
          portfolioValue: totalValue
        },
        positions: formattedPositions,
        summary: {
          totalValue,
          totalCost,
          totalUnrealizedPL: totalPL,
          totalUnrealizedPLPercent: totalPLPercent,
          positionCount: positions.length,
          largestPosition: Math.max(...formattedPositions.map(p => p.marketValue)),
          smallestPosition: Math.min(...formattedPositions.map(p => p.marketValue))
        },
        timestamp: new Date().toISOString()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Portfolio summary error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Failed to get portfolio summary',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/portfolio/allocation
   * Get portfolio allocation data for visualization
   */
  async handlePortfolioAllocation(req, res, userId) {
    try {
      if (!this.brokerManager) {
        res.writeHead(500);
        res.end(JSON.stringify({
          error: 'Broker manager not configured'
        }));
        return;
      }

      const positions = await this.brokerManager.getPositions();

      const formattedPositions = positions.map(p => ({
        symbol: p.symbol,
        marketValue: p.market_value,
        quantity: p.qty,
        sector: p.sector || 'Unknown'
      }));

      // Create charts
      const allocationChart = PortfolioVisualizations.createAllocationChart(formattedPositions);
      const sectorChart = PortfolioVisualizations.createSectorChart(formattedPositions);

      const result = {
        success: true,
        charts: {
          allocation: allocationChart,
          sector: sectorChart
        },
        positions: formattedPositions,
        timestamp: new Date().toISOString()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Portfolio allocation error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Failed to get portfolio allocation',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/portfolio/performance
   * Get detailed performance metrics
   */
  async handlePortfolioPerformance(req, res, userId, query = {}) {
    try {
      const { days = 30 } = query;

      if (!this.brokerManager) {
        res.writeHead(500);
        res.end(JSON.stringify({
          error: 'Broker manager not configured'
        }));
        return;
      }

      const positions = await this.brokerManager.getPositions();

      // Create performance chart
      const performanceChart = PortfolioVisualizations.createPerformanceChart(positions);

      // Get portfolio history (simulated)
      const history = this.generatePortfolioHistory(days);
      const portfolioValueChart = PortfolioVisualizations.createPortfolioValueChart(history);
      const cumulativeReturnChart = PortfolioVisualizations.createCumulativeReturnChart(history);
      const drawdownChart = PortfolioVisualizations.createDrawdownChart(history);

      const result = {
        success: true,
        period: `${days} days`,
        charts: {
          performance: performanceChart,
          portfolioValue: portfolioValueChart,
          cumulativeReturn: cumulativeReturnChart,
          drawdown: drawdownChart
        },
        timestamp: new Date().toISOString()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Portfolio performance error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Failed to get portfolio performance',
        message: error.message
      }));
    }
  }

  /**
   * Generate simulated portfolio history
   * @private
   */
  generatePortfolioHistory(days) {
    const history = [];
    let value = 100000; // Starting value

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));

      // Simulate random walk
      const change = (Math.random() - 0.49) * 1000; // Slight upward bias
      value += change;

      history.push({
        date,
        value: Math.max(50000, value),
        invested: 100000
      });
    }

    return history;
  }

  /**
   * GET /api/charts/health
   * Health check for chart service
   */
  handleChartsHealth(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'chart-service',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }));
  }
}

module.exports = {
  ChartEndpoints
};
