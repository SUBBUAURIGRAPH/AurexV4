/**
 * Order API Endpoints
 * Provides REST endpoints for order lifecycle management
 * @version 1.0.0
 */

const { validateOrderRequest, validateOrderId } = require('../auth/input-validator');

/**
 * OrderEndpoints Handler
 * @class
 * @description Handles all order-related API endpoints
 */
class OrderEndpoints {
  /**
   * Initialize order endpoints
   * @param {Object} config - Configuration
   * @param {Object} config.orderManager - OrderManager instance
   * @param {Object} config.positionTracker - PositionTracker instance
   * @param {Object} config.plCalculator - PLCalculator instance
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.orderManager = config.orderManager;
    this.positionTracker = config.positionTracker;
    this.plCalculator = config.plCalculator;
    this.logger = config.logger || console;
  }

  /**
   * POST /api/orders/create
   * Create order and return pending confirmation
   */
  async handleCreateOrder(req, res, userId, body = {}) {
    try {
      const {
        symbol,
        quantity,
        side,
        type,
        limit_price,
        stop_price,
        time_in_force,
        extended_hours
      } = body;

      // Validate request body
      if (!symbol || !quantity || !side || !type) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Missing required fields',
          message: 'symbol, quantity, side, type are required'
        }));
        return;
      }

      const orderRequest = {
        symbol,
        quantity: parseInt(quantity),
        side,
        type,
        limit_price: limit_price ? parseFloat(limit_price) : undefined,
        stop_price: stop_price ? parseFloat(stop_price) : undefined,
        time_in_force: time_in_force || 'day',
        extended_hours: extended_hours || false
      };

      const result = await this.orderManager.createOrder(orderRequest, userId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        orderId: result.orderId,
        confirmationToken: result.confirmationToken,
        order: result.order,
        warnings: result.warnings,
        expiresAt: result.expiresAt,
        message: 'Order pending confirmation. Use confirmationToken to confirm within 5 minutes.'
      }));
    } catch (error) {
      this.logger.error('Failed to create order', { error: error.message, userId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Order creation failed',
        message: error.message
      }));
    }
  }

  /**
   * POST /api/orders/confirm
   * Confirm pending order and submit to broker
   */
  async handleConfirmOrder(req, res, userId, body = {}) {
    try {
      const { confirmationToken } = body;

      if (!confirmationToken) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Missing confirmation token'
        }));
        return;
      }

      const result = await this.orderManager.confirmOrder(confirmationToken, userId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        orderId: result.orderId,
        brokerOrderId: result.brokerOrderId,
        status: result.status,
        submittedAt: result.submittedAt
      }));
    } catch (error) {
      this.logger.error('Failed to confirm order', { error: error.message, userId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Order confirmation failed',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/orders/{orderId}
   * Get order status and details
   */
  async handleGetOrder(req, res, orderId, userId) {
    try {
      if (!orderId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Missing order ID'
        }));
        return;
      }

      const order = await this.orderManager.getOrderStatus(orderId);

      // Check authorization
      if (order.userId !== userId && userId !== 'system') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: 'Cannot access another user\'s order'
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        order: {
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          quantity: order.quantity,
          filledQuantity: order.filledQuantity,
          limitPrice: order.limitPrice,
          stopPrice: order.stopPrice,
          averageFillPrice: order.averageFillPrice,
          status: order.status,
          createdAt: order.createdAt,
          submittedAt: order.submittedAt,
          filledAt: order.filledAt,
          cancelledAt: order.cancelledAt,
          totalCost: order.totalCost
        }
      }));
    } catch (error) {
      this.logger.error('Failed to get order', { error: error.message, orderId, userId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve order',
        message: error.message
      }));
    }
  }

  /**
   * DELETE /api/orders/{orderId}
   * Cancel order
   */
  async handleCancelOrder(req, res, orderId, userId) {
    try {
      if (!orderId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Missing order ID'
        }));
        return;
      }

      const result = await this.orderManager.cancelOrder(orderId, userId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        orderId: result.orderId,
        status: result.status,
        message: 'Order cancelled successfully'
      }));
    } catch (error) {
      this.logger.error('Failed to cancel order', { error: error.message, orderId, userId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Order cancellation failed',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/orders
   * Get all orders for user with optional filters
   */
  async handleGetOrders(req, res, userId, query = {}) {
    try {
      const { status, symbol, side, limit } = query;

      const filters = {};
      if (status) filters.status = status;
      if (symbol) filters.symbol = symbol;
      if (side) filters.side = side;

      const orders = this.orderManager.getOrdersByUser(userId, filters);

      // Apply limit
      const results = limit ? orders.slice(0, parseInt(limit)) : orders;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: results.length,
        orders: results.map(o => ({
          orderId: o.orderId,
          symbol: o.symbol,
          side: o.side,
          type: o.type,
          quantity: o.quantity,
          filledQuantity: o.filledQuantity,
          status: o.status,
          createdAt: o.createdAt,
          submittedAt: o.submittedAt,
          filledAt: o.filledAt,
          averageFillPrice: o.averageFillPrice
        }))
      }));
    } catch (error) {
      this.logger.error('Failed to get orders', { error: error.message, userId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve orders',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/orders/active
   * Get all active orders
   */
  async handleGetActiveOrders(req, res) {
    try {
      const activeOrders = this.orderManager.getActiveOrders();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: activeOrders.length,
        orders: activeOrders.map(o => ({
          orderId: o.orderId,
          userId: o.userId,
          symbol: o.symbol,
          side: o.side,
          type: o.type,
          quantity: o.quantity,
          filledQuantity: o.filledQuantity,
          status: o.status,
          createdAt: o.createdAt,
          submittedAt: o.submittedAt
        }))
      }));
    } catch (error) {
      this.logger.error('Failed to get active orders', { error: error.message });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve active orders',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/orders/statistics
   * Get order statistics for user
   */
  async handleGetOrderStatistics(req, res, userId) {
    try {
      const stats = this.orderManager.getStatistics(userId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        statistics: {
          total: stats.total,
          completed: stats.completed,
          pending: stats.pending,
          cancelled: stats.cancelled,
          rejected: stats.rejected,
          winRate: stats.avgFillPrice ? '100%' : '0%',
          totalVolume: stats.totalVolume,
          totalCost: stats.totalCost,
          averageFillPrice: stats.avgFillPrice
        }
      }));
    } catch (error) {
      this.logger.error('Failed to get order statistics', { error: error.message, userId });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve statistics',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/portfolio/positions
   * Get current positions
   */
  async handleGetPositions(req, res) {
    try {
      if (!this.positionTracker) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Position tracker not configured'
        }));
        return;
      }

      const positions = this.positionTracker.getPositions();
      const metrics = this.positionTracker.getPortfolioMetrics();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        positions: positions.map(p => ({
          symbol: p.symbol,
          quantity: p.quantity,
          currentPrice: p.currentPrice,
          costBasis: p.costBasis,
          marketValue: p.marketValue,
          unrealizedPL: p.unrealizedPL,
          unrealizedPLPercent: p.unrealizedPLPercent,
          sector: p.sector,
          side: p.side
        })),
        metrics: {
          totalValue: metrics.totalValue,
          totalCost: metrics.totalCost,
          totalUnrealizedPL: metrics.totalUnrealizedPL,
          totalUnrealizedPLPercent: metrics.totalUnrealizedPLPercent,
          positionCount: metrics.positionCount,
          lastSyncTime: metrics.lastSyncTime
        }
      }));
    } catch (error) {
      this.logger.error('Failed to get positions', { error: error.message });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve positions',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/portfolio/pnl
   * Get P&L summary
   */
  async handleGetPnL(req, res, query = {}) {
    try {
      if (!this.plCalculator || !this.positionTracker) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'P&L calculator or position tracker not configured'
        }));
        return;
      }

      const positions = this.positionTracker.getPositions();
      const pnl = this.plCalculator.calculateUnrealizedPL(positions);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        unrealizedPL: {
          totalUnrealizedPL: pnl.totalUnrealizedPL,
          totalUnrealizedPLPercent: pnl.totalUnrealizedPLPercent,
          totalMarketValue: pnl.totalMarketValue,
          totalCostBasis: pnl.totalCostBasis,
          gainersCount: pnl.gainers.length,
          losersCount: pnl.losers.length,
          neutralCount: pnl.neutral.length,
          topGainers: pnl.gainers.slice(0, 5).map(p => ({
            symbol: p.symbol,
            unrealizedPLPercent: p.unrealizedPLPercent
          })),
          topLosers: pnl.losers.slice(0, 5).map(p => ({
            symbol: p.symbol,
            unrealizedPLPercent: p.unrealizedPLPercent
          }))
        }
      }));
    } catch (error) {
      this.logger.error('Failed to get P&L', { error: error.message });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to retrieve P&L data',
        message: error.message
      }));
    }
  }

  /**
   * GET /api/orders/health
   * Health check for order service
   */
  handleOrdersHealth(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'order-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      components: {
        orderManager: !!this.orderManager,
        positionTracker: !!this.positionTracker,
        plCalculator: !!this.plCalculator
      }
    }));
  }
}

module.exports = { OrderEndpoints };
