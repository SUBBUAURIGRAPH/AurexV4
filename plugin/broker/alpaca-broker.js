/**
 * Alpaca Broker Implementation
 * Real broker integration with Alpaca API
 * @version 1.0.0
 */

const https = require('https');
const BaseBroker = require('./base-broker');

/**
 * AlpacaBroker
 * @class
 * @extends BaseBroker
 * @description Alpaca broker implementation for stock trading
 */
class AlpacaBroker extends BaseBroker {
  /**
   * Initialize Alpaca broker
   * @param {Object} config - Configuration
   * @param {string} config.apiKey - Alpaca API key
   * @param {string} config.apiSecret - Alpaca API secret
   * @param {boolean} config.paperTrading - Use paper trading (default: true)
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    const baseURL = config.paperTrading !== false
      ? 'paper-api.alpaca.markets'
      : 'api.alpaca.markets';

    super({
      name: 'Alpaca',
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseURL,
      logger: config.logger
    });

    this.paperTrading = config.paperTrading !== false;
    this.dataURL = 'data.alpaca.markets';

    this.validateConfig();
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Alpaca API key and secret are required');
    }
  }

  /**
   * Connect to Alpaca
   * @returns {Promise<boolean>} True if connected
   */
  async connect() {
    try {
      this.account = await this.getAccount();
      this.log('Connected successfully', { account: this.account.id });
      return true;
    } catch (error) {
      this.logError('Connection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get account information
   * @returns {Promise<Object>} Account details
   */
  async getAccount() {
    try {
      const response = await this.makeRequest('GET', '/v2/account');
      return response;
    } catch (error) {
      this.logError('Failed to get account', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all positions
   * @returns {Promise<Array>} Array of positions
   */
  async getPositions() {
    try {
      const response = await this.makeRequest('GET', '/v2/positions');
      this.positions.clear();

      for (const position of response) {
        this.positions.set(position.symbol, {
          symbol: position.symbol,
          quantity: parseFloat(position.qty),
          avg_fill_price: parseFloat(position.avg_fill_price),
          market_value: parseFloat(position.market_value),
          cost_basis: parseFloat(position.cost_basis),
          unrealized_pl: parseFloat(position.unrealized_pl),
          unrealized_plpc: parseFloat(position.unrealized_plpc),
          current_price: parseFloat(position.current_price),
          side: position.side,
          asset_id: position.asset_id
        });
      }

      return response;
    } catch (error) {
      this.logError('Failed to get positions', { error: error.message });
      throw error;
    }
  }

  /**
   * Get position by symbol
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Position details
   */
  async getPosition(symbol) {
    try {
      const response = await this.makeRequest('GET', `/v2/positions/${symbol.toUpperCase()}`);
      return response;
    } catch (error) {
      if (error.message.includes('404')) {
        return null; // No position
      }
      this.logError(`Failed to get position for ${symbol}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Place order
   * @param {Object} orderRequest - Order details
   * @returns {Promise<Object>} Order confirmation
   */
  async placeOrder(orderRequest) {
    try {
      // Validate order
      const validation = this.validateOrder(orderRequest);
      if (!validation.valid) {
        throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
      }

      // Format order for Alpaca API
      const order = {
        symbol: orderRequest.symbol.toUpperCase(),
        qty: orderRequest.quantity,
        side: orderRequest.side.toLowerCase(),
        type: orderRequest.type.toLowerCase(),
        time_in_force: orderRequest.time_in_force || 'day',
        extended_hours: orderRequest.extended_hours || false
      };

      // Add price parameters if needed
      if (orderRequest.limit_price) {
        order.limit_price = orderRequest.limit_price;
      }
      if (orderRequest.stop_price) {
        order.stop_price = orderRequest.stop_price;
      }

      // Send order to Alpaca
      const response = await this.makeRequest('POST', '/v2/orders', order);

      // Store in local cache
      this.orders.set(response.id, response);

      this.log('Order placed', {
        orderId: response.id,
        symbol: response.symbol,
        quantity: response.qty,
        side: response.side,
        status: response.status
      });

      return response;
    } catch (error) {
      this.logError('Failed to place order', { error: error.message });
      throw error;
    }
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Order details
   */
  async getOrder(orderId) {
    try {
      const response = await this.makeRequest('GET', `/v2/orders/${orderId}`);
      this.orders.set(orderId, response);
      return response;
    } catch (error) {
      this.logError(`Failed to get order ${orderId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get all orders
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of orders
   */
  async getOrders(filters = {}) {
    try {
      let path = '/v2/orders?';

      if (filters.status) path += `status=${filters.status}&`;
      if (filters.limit) path += `limit=${filters.limit}&`;
      if (filters.after) path += `after=${filters.after}&`;
      if (filters.until) path += `until=${filters.until}&`;
      if (filters.direction) path += `direction=${filters.direction}&`;
      if (filters.nested) path += `nested=${filters.nested}&`;

      const response = await this.makeRequest('GET', path.slice(0, -1));

      for (const order of response) {
        this.orders.set(order.id, order);
      }

      return response;
    } catch (error) {
      this.logError('Failed to get orders', { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel order
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Cancellation confirmation
   */
  async cancelOrder(orderId) {
    try {
      await this.makeRequest('DELETE', `/v2/orders/${orderId}`);
      this.orders.delete(orderId);

      this.log('Order cancelled', { orderId });

      return { success: true, orderId };
    } catch (error) {
      this.logError(`Failed to cancel order ${orderId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Close position
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Close confirmation
   */
  async closePosition(symbol) {
    try {
      const response = await this.makeRequest('DELETE', `/v2/positions/${symbol.toUpperCase()}`);
      this.positions.delete(symbol);

      this.log('Position closed', {
        symbol,
        proceeds: response.proceeds
      });

      return response;
    } catch (error) {
      this.logError(`Failed to close position for ${symbol}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get market data
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Market data
   */
  async getMarketData(symbol) {
    try {
      const response = await this.makeRequest(
        'GET',
        `/v1/last/stocks/${symbol.toUpperCase()}`,
        null,
        true // Use data URL
      );
      return response;
    } catch (error) {
      this.logError(`Failed to get market data for ${symbol}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Make HTTP request to Alpaca API
   * @private
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} body - Request body
   * @param {boolean} useDataURL - Use data URL instead of trading URL
   * @returns {Promise<Object>} Response data
   */
  makeRequest(method, path, body = null, useDataURL = false) {
    return new Promise((resolve, reject) => {
      const hostname = useDataURL ? this.dataURL : this.baseURL;

      const options = {
        hostname,
        port: 443,
        path,
        method,
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            if (res.statusCode >= 400) {
              const error = new Error(parsed.message || `API error: ${res.statusCode}`);
              error.statusCode = res.statusCode;
              reject(error);
            } else {
              resolve(parsed);
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Get broker capabilities
   * @returns {Object} Supported features
   */
  getCapabilities() {
    return {
      name: 'Alpaca',
      paperTrading: this.paperTrading,
      marketOrders: true,
      limitOrders: true,
      stopOrders: true,
      stopLimitOrders: true,
      extendedHours: true,
      realTimeQuotes: true,
      historicalData: true,
      marginTrading: true,
      shortSelling: true,
      fractionalShares: true,
      multiLegOrders: false
    };
  }
}

module.exports = AlpacaBroker;
