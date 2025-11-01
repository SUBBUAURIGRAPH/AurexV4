/**
 * Paper Trading API Endpoints
 * Provides REST endpoints for paper trading functionality
 * @version 1.0.0
 */

class PaperTradingEndpoints {
  /**
   * Initialize paper trading endpoints
   * @param {Object} config - Configuration
   * @param {Object} config.paperTradingManager - PaperTradingManager instance
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.paperTradingManager = config.paperTradingManager;
    this.logger = config.logger || console;
  }

  // ==================== Account Endpoints ====================

  /**
   * POST /api/paper-trading/accounts
   * Create a new paper trading account
   */
  async handleCreateAccount(req, res, userId, body = {}) {
    try {
      const {
        name,
        initialCapital,
        commissionRate,
        slippageBuy,
        slippageSell,
        allowShortSelling,
        maxPositions
      } = body;

      const options = {
        name,
        initialCapital: initialCapital ? parseFloat(initialCapital) : 100000,
        commissionRate: commissionRate ? parseFloat(commissionRate) : 0.001,
        slippageBuy: slippageBuy ? parseFloat(slippageBuy) : 0.001,
        slippageSell: slippageSell ? parseFloat(slippageSell) : 0.001,
        allowShortSelling: allowShortSelling !== undefined ? allowShortSelling : true,
        maxPositions: maxPositions || 10
      };

      const account = await this.paperTradingManager.createAccount(userId, options);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        account,
        message: 'Paper trading account created successfully'
      }));
    } catch (error) {
      this.logger.error('Failed to create paper trading account', { error: error.message, userId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Account creation failed',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/paper-trading/accounts/{accountId}
   * Get paper trading account by ID
   */
  async handleGetAccount(req, res, accountId, userId) {
    try {
      const account = await this.paperTradingManager.getAccount(accountId);

      // Authorization check
      if (account.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: 'Cannot access another user\'s account'
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        account
      }));
    } catch (error) {
      this.logger.error('Failed to get account', { error: error.message, accountId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve account',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/paper-trading/accounts
   * Get all paper trading accounts for user
   */
  async handleGetUserAccounts(req, res, userId) {
    try {
      const accounts = await this.paperTradingManager.getUserAccounts(userId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: accounts.length,
        accounts
      }));
    } catch (error) {
      this.logger.error('Failed to get user accounts', { error: error.message, userId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve accounts',
        message: error.message
      }));
    }
  }

  /**
   * PATCH /api/paper-trading/accounts/{accountId}
   * Update account settings
   */
  async handleUpdateAccount(req, res, accountId, userId, body = {}) {
    try {
      // Verify ownership
      const account = await this.paperTradingManager.getAccount(accountId);
      if (account.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }));
        return;
      }

      const updatedAccount = await this.paperTradingManager.updateAccountSettings(accountId, body);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        account: updatedAccount,
        message: 'Account updated successfully'
      }));
    } catch (error) {
      this.logger.error('Failed to update account', { error: error.message, accountId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Update failed',
        message: error.message
      }));
    }
  }

  // ==================== Order Endpoints ====================

  /**
   * POST /api/paper-trading/accounts/{accountId}/orders
   * Submit a paper trade order
   */
  async handleSubmitOrder(req, res, accountId, userId, body = {}) {
    try {
      // Verify ownership
      const account = await this.paperTradingManager.getAccount(accountId);
      if (account.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }));
        return;
      }

      const {
        symbol,
        side,
        type,
        quantity,
        limitPrice,
        stopPrice,
        timeInForce,
        extendedHours
      } = body;

      const orderData = {
        symbol,
        side,
        type,
        quantity: parseInt(quantity),
        limitPrice: limitPrice ? parseFloat(limitPrice) : undefined,
        stopPrice: stopPrice ? parseFloat(stopPrice) : undefined,
        timeInForce: timeInForce || 'day',
        extendedHours: extendedHours || false
      };

      const order = await this.paperTradingManager.submitOrder(accountId, orderData);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        order,
        message: 'Paper trade executed successfully'
      }));
    } catch (error) {
      this.logger.error('Failed to submit paper trade', { error: error.message, accountId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Order submission failed',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/paper-trading/accounts/{accountId}/orders
   * Get orders for account
   */
  async handleGetOrders(req, res, accountId, userId, query = {}) {
    try {
      // Verify ownership
      const account = await this.paperTradingManager.getAccount(accountId);
      if (account.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }));
        return;
      }

      const filters = {
        status: query.status,
        symbol: query.symbol,
        side: query.side,
        limit: query.limit ? parseInt(query.limit) : undefined
      };

      const orders = await this.paperTradingManager.getAccountOrders(accountId, filters);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: orders.length,
        orders
      }));
    } catch (error) {
      this.logger.error('Failed to get orders', { error: error.message, accountId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve orders',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/paper-trading/orders/{orderId}
   * Get order by ID
   */
  async handleGetOrder(req, res, orderId, userId) {
    try {
      const order = await this.paperTradingManager.getOrder(orderId);

      // Authorization check
      if (order.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        order
      }));
    } catch (error) {
      this.logger.error('Failed to get order', { error: error.message, orderId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve order',
        message: error.message
      }));
    }
  }

  // ==================== Position Endpoints ====================

  /**
   * GET /api/paper-trading/accounts/{accountId}/positions
   * Get positions for account
   */
  async handleGetPositions(req, res, accountId, userId) {
    try {
      // Verify ownership
      const account = await this.paperTradingManager.getAccount(accountId);
      if (account.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }));
        return;
      }

      const positions = await this.paperTradingManager.getAccountPositions(accountId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: positions.length,
        positions
      }));
    } catch (error) {
      this.logger.error('Failed to get positions', { error: error.message, accountId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve positions',
        message: error.message
      }));
    }
  }

  /**
   * POST /api/paper-trading/accounts/{accountId}/positions/refresh
   * Update position prices with current market data
   */
  async handleRefreshPositions(req, res, accountId, userId) {
    try {
      // Verify ownership
      const account = await this.paperTradingManager.getAccount(accountId);
      if (account.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }));
        return;
      }

      await this.paperTradingManager.updatePositionPrices(accountId);
      const positions = await this.paperTradingManager.getAccountPositions(accountId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: positions.length,
        positions,
        message: 'Positions refreshed successfully'
      }));
    } catch (error) {
      this.logger.error('Failed to refresh positions', { error: error.message, accountId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to refresh positions',
        message: error.message
      }));
    }
  }

  // ==================== Performance Endpoints ====================

  /**
   * GET /api/paper-trading/accounts/{accountId}/performance
   * Get performance summary
   */
  async handleGetPerformance(req, res, accountId, userId) {
    try {
      // Verify ownership
      const account = await this.paperTradingManager.getAccount(accountId);
      if (account.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }));
        return;
      }

      const performance = await this.paperTradingManager.getPerformanceSummary(accountId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        performance
      }));
    } catch (error) {
      this.logger.error('Failed to get performance', { error: error.message, accountId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve performance',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/paper-trading/accounts/{accountId}/equity-history
   * Get equity curve data
   */
  async handleGetEquityHistory(req, res, accountId, userId, query = {}) {
    try {
      // Verify ownership
      const account = await this.paperTradingManager.getAccount(accountId);
      if (account.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }));
        return;
      }

      // Get equity history from database
      let queryStr = 'SELECT * FROM paper_trading_equity_history WHERE account_id = ?';
      const values = [accountId];

      if (query.startDate) {
        queryStr += ' AND timestamp >= ?';
        values.push(query.startDate);
      }
      if (query.endDate) {
        queryStr += ' AND timestamp <= ?';
        values.push(query.endDate);
      }

      queryStr += ' ORDER BY timestamp ASC';

      if (query.limit) {
        queryStr += ' LIMIT ?';
        values.push(parseInt(query.limit));
      }

      const [rows] = await this.paperTradingManager.db.query(queryStr, values);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: rows.length,
        equityHistory: rows.map(row => ({
          timestamp: row.timestamp,
          totalEquity: parseFloat(row.total_equity),
          cash: parseFloat(row.cash),
          positionValue: parseFloat(row.position_value),
          unrealizedPl: parseFloat(row.unrealized_pl),
          realizedPl: parseFloat(row.realized_pl),
          totalPl: parseFloat(row.total_pl),
          dailyReturn: row.daily_return ? parseFloat(row.daily_return) : null,
          totalReturn: row.total_return ? parseFloat(row.total_return) : null,
          positionCount: row.position_count
        }))
      }));
    } catch (error) {
      this.logger.error('Failed to get equity history', { error: error.message, accountId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve equity history',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/paper-trading/health
   * Health check for paper trading service
   */
  handlePaperTradingHealth(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'paper-trading-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      components: {
        paperTradingManager: !!this.paperTradingManager,
        database: !!this.paperTradingManager?.db,
        marketData: !!this.paperTradingManager?.marketData
      }
    }));
  }

  // ==================== Helper Methods ====================

  /**
   * Parse request body as JSON
   * @param {Object} req - Request object
   * @returns {Promise<Object>} - Parsed body
   */
  async parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Parse URL query parameters
   * @param {string} url - URL string
   * @returns {Object} - Parsed query parameters
   */
  parseQuery(url) {
    const urlObj = new URL(url, 'http://localhost');
    const query = {};
    for (const [key, value] of urlObj.searchParams.entries()) {
      query[key] = value;
    }
    return query;
  }
}

module.exports = { PaperTradingEndpoints };
