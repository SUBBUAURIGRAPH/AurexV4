/**
 * Base Broker Interface
 * Abstract base class for broker implementations
 * @version 1.0.0
 */

/**
 * BaseBroker
 * @abstract
 * @class
 * @description Base class for broker implementations
 */
class BaseBroker {
  /**
   * Initialize broker
   * @param {Object} config - Configuration object
   * @throws {Error} If required configuration missing
   */
  constructor(config = {}) {
    if (this.constructor === BaseBroker) {
      throw new Error('BaseBroker is abstract and cannot be instantiated directly');
    }

    this.name = config.name || 'Unknown Broker';
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseURL = config.baseURL;
    this.logger = config.logger || console;

    // Order and position tracking
    this.orders = new Map();
    this.positions = new Map();
    this.account = null;
  }

  /**
   * Validate configuration
   * @abstract
   * @throws {Error} If configuration invalid
   */
  validateConfig() {
    throw new Error('validateConfig() must be implemented by subclass');
  }

  /**
   * Connect to broker
   * @abstract
   * @returns {Promise<boolean>} True if connected
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Get account information
   * @abstract
   * @returns {Promise<Object>} Account details
   */
  async getAccount() {
    throw new Error('getAccount() must be implemented by subclass');
  }

  /**
   * Get all positions
   * @abstract
   * @returns {Promise<Array>} Array of positions
   */
  async getPositions() {
    throw new Error('getPositions() must be implemented by subclass');
  }

  /**
   * Get position by symbol
   * @abstract
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Position details or null
   */
  async getPosition(symbol) {
    throw new Error('getPosition() must be implemented by subclass');
  }

  /**
   * Place order
   * @abstract
   * @param {Object} orderRequest - Order details
   * @returns {Promise<Object>} Order confirmation
   */
  async placeOrder(orderRequest) {
    throw new Error('placeOrder() must be implemented by subclass');
  }

  /**
   * Get order by ID
   * @abstract
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Order details
   */
  async getOrder(orderId) {
    throw new Error('getOrder() must be implemented by subclass');
  }

  /**
   * Get all orders
   * @abstract
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of orders
   */
  async getOrders(filters) {
    throw new Error('getOrders() must be implemented by subclass');
  }

  /**
   * Cancel order
   * @abstract
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Cancellation confirmation
   */
  async cancelOrder(orderId) {
    throw new Error('cancelOrder() must be implemented by subclass');
  }

  /**
   * Close position
   * @abstract
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Close confirmation
   */
  async closePosition(symbol) {
    throw new Error('closePosition() must be implemented by subclass');
  }

  /**
   * Get order status
   * @param {string} orderId - Order ID
   * @returns {string} Status (pending, filled, cancelled, rejected, etc)
   */
  getOrderStatus(orderId) {
    const order = this.orders.get(orderId);
    return order?.status || 'unknown';
  }

  /**
   * Calculate P&L for position
   * @param {string} symbol - Stock symbol
   * @param {number} currentPrice - Current price
   * @returns {Object} P&L details
   */
  calculatePnL(symbol, currentPrice) {
    const position = this.positions.get(symbol);
    if (!position) {
      return null;
    }

    const quantity = position.quantity;
    const avgCost = position.avg_fill_price || position.cost_basis / quantity;
    const marketValue = quantity * currentPrice;
    const costBasis = quantity * avgCost;
    const unrealizedPnL = marketValue - costBasis;
    const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;

    return {
      symbol,
      quantity,
      avgCost: avgCost.toFixed(2),
      currentPrice: currentPrice.toFixed(2),
      costBasis: costBasis.toFixed(2),
      marketValue: marketValue.toFixed(2),
      unrealizedPnL: unrealizedPnL.toFixed(2),
      unrealizedPnLPercent: unrealizedPnLPercent.toFixed(2),
      timestamp: new Date()
    };
  }

  /**
   * Validate order request
   * @param {Object} orderRequest - Order details
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateOrder(orderRequest) {
    const errors = [];

    if (!orderRequest.symbol) {
      errors.push('Symbol is required');
    }

    if (!orderRequest.quantity || orderRequest.quantity <= 0) {
      errors.push('Quantity must be positive');
    }

    if (!['buy', 'sell'].includes(orderRequest.side)) {
      errors.push('Side must be buy or sell');
    }

    const validOrderTypes = ['market', 'limit', 'stop', 'stop-limit'];
    if (!validOrderTypes.includes(orderRequest.type)) {
      errors.push('Invalid order type');
    }

    if (orderRequest.type === 'limit' && !orderRequest.limit_price) {
      errors.push('Limit price required for limit orders');
    }

    if (orderRequest.type === 'stop' && !orderRequest.stop_price) {
      errors.push('Stop price required for stop orders');
    }

    if (orderRequest.type === 'stop-limit' && (!orderRequest.stop_price || !orderRequest.limit_price)) {
      errors.push('Both stop and limit prices required for stop-limit orders');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format order for API
   * @protected
   * @param {Object} orderRequest - Order details
   * @returns {Object} Formatted order
   */
  formatOrder(orderRequest) {
    return {
      symbol: orderRequest.symbol.toUpperCase(),
      qty: orderRequest.quantity,
      side: orderRequest.side.toLowerCase(),
      type: orderRequest.type.toLowerCase(),
      time_in_force: orderRequest.time_in_force || 'day',
      limit_price: orderRequest.limit_price,
      stop_price: orderRequest.stop_price,
      extended_hours: orderRequest.extended_hours || false
    };
  }

  /**
   * Log broker action
   * @protected
   * @param {string} action - Action description
   * @param {Object} details - Additional details
   */
  log(action, details = {}) {
    this.logger.info(`[${this.name}] ${action}`, details);
  }

  /**
   * Log broker error
   * @protected
   * @param {string} error - Error message
   * @param {Object} details - Additional details
   */
  logError(error, details = {}) {
    this.logger.error(`[${this.name}] ${error}`, details);
  }

  /**
   * Get broker capabilities
   * @returns {Object} Supported features
   */
  getCapabilities() {
    return {
      name: this.name,
      marketOrders: true,
      limitOrders: true,
      stopOrders: true,
      stopLimitOrders: true,
      extendedHours: true,
      paperTrading: false,
      realTimeQuotes: true,
      historicalData: true,
      marginTrading: true,
      shortSelling: true
    };
  }

  /**
   * Get broker status
   * @returns {Object} Connection status
   */
  getStatus() {
    return {
      broker: this.name,
      connected: this.account !== null,
      account: this.account ? {
        id: this.account.id,
        equity: this.account.equity,
        cash: this.account.cash,
        buying_power: this.account.buying_power
      } : null,
      positions: this.positions.size,
      orders: this.orders.size,
      timestamp: new Date()
    };
  }
}

module.exports = BaseBroker;
