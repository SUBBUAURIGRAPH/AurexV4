/**
 * WebSocket Manager
 * Handles real-time order updates and trade notifications
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * WebSocketManager
 * @class
 * @description Manages WebSocket connections for real-time market and trade data
 */
class WebSocketManager extends EventEmitter {
  /**
   * Initialize WebSocket Manager
   * @param {Object} config - Configuration
   * @param {Object} config.broker - Broker instance with WebSocket support
   * @param {Object} config.logger - Logger instance
   * @param {number} config.reconnectDelay - Delay in ms between reconnect attempts (default: 1000)
   * @param {number} config.maxReconnectAttempts - Max reconnect attempts before giving up (default: 10)
   */
  constructor(config = {}) {
    super();

    this.broker = config.broker;
    this.logger = config.logger || console;
    this.reconnectDelay = config.reconnectDelay || 1000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;

    // Connection state
    this.connected = false;
    this.reconnectAttempts = 0;
    this.websocket = null;
    this.subscriptions = new Set(); // Subscribed symbols and streams
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;

    // Message handlers
    this.messageHandlers = new Map();

    // Trade updates
    this.orderUpdates = new Map(); // Order ID -> latest status
    this.tradeNotifications = [];
    this.accountUpdates = null;

    // Binding for event handlers
    this._onMessage = this._onMessage.bind(this);
    this._onError = this._onError.bind(this);
    this._onClose = this._onClose.bind(this);
    this._onOpen = this._onOpen.bind(this);
  }

  /**
   * Connect to broker WebSocket
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      if (this.connected) {
        this.logger.warn('WebSocket already connected');
        return;
      }

      if (!this.broker.connectWebSocket) {
        throw new Error('Broker does not support WebSocket');
      }

      // Establish WebSocket connection
      this.websocket = await this.broker.connectWebSocket();

      if (!this.websocket) {
        throw new Error('Failed to establish WebSocket connection');
      }

      // Attach event listeners
      this.websocket.on('message', this._onMessage);
      this.websocket.on('error', this._onError);
      this.websocket.on('close', this._onClose);
      this.websocket.on('open', this._onOpen);

      // Wait for connection to establish
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);

        const onOpen = () => {
          clearTimeout(timeout);
          this.websocket.removeListener('open', onOpen);
          resolve();
        };

        this.websocket.once('open', onOpen);
      });

      this.connected = true;
      this.reconnectAttempts = 0;

      this.logger.info('WebSocket connected');
      this.emit('connected');

      // Start heartbeat
      this._startHeartbeat();

      // Resubscribe to previous subscriptions
      await this._resubscribeToAll();

      return;
    } catch (error) {
      this.logger.error('Failed to connect WebSocket', { error: error.message });
      this._attemptReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from broker WebSocket
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (!this.connected) {
        return;
      }

      this._stopHeartbeat();
      this.subscriptions.clear();

      if (this.websocket) {
        this.websocket.close();
      }

      this.connected = false;
      this.logger.info('WebSocket disconnected');
      this.emit('disconnected');

      return;
    } catch (error) {
      this.logger.error('Error disconnecting WebSocket', { error: error.message });
      throw error;
    }
  }

  /**
   * Subscribe to order updates
   * @param {string} orderId - Order ID to subscribe to
   * @returns {Promise<void>}
   */
  async subscribeToOrderUpdates(orderId) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const subscription = `order:${orderId}`;

    if (this.subscriptions.has(subscription)) {
      return;
    }

    try {
      await this._sendMessage({
        action: 'subscribe',
        type: 'order',
        id: orderId
      });

      this.subscriptions.add(subscription);
      this.logger.info(`Subscribed to order updates: ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to order: ${orderId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Subscribe to trade stream
   * @param {string} symbol - Stock symbol
   * @returns {Promise<void>}
   */
  async subscribeToTrades(symbol) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const subscription = `trade:${symbol}`;

    if (this.subscriptions.has(subscription)) {
      return;
    }

    try {
      await this._sendMessage({
        action: 'subscribe',
        type: 'trade',
        symbol: symbol.toUpperCase()
      });

      this.subscriptions.add(subscription);
      this.logger.info(`Subscribed to trades: ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to trades: ${symbol}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Subscribe to account updates
   * @returns {Promise<void>}
   */
  async subscribeToAccountUpdates() {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const subscription = 'account:updates';

    if (this.subscriptions.has(subscription)) {
      return;
    }

    try {
      await this._sendMessage({
        action: 'subscribe',
        type: 'account'
      });

      this.subscriptions.add(subscription);
      this.logger.info('Subscribed to account updates');
    } catch (error) {
      this.logger.error('Failed to subscribe to account updates', { error: error.message });
      throw error;
    }
  }

  /**
   * Subscribe to position updates
   * @returns {Promise<void>}
   */
  async subscribeToPositionUpdates() {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const subscription = 'position:updates';

    if (this.subscriptions.has(subscription)) {
      return;
    }

    try {
      await this._sendMessage({
        action: 'subscribe',
        type: 'position'
      });

      this.subscriptions.add(subscription);
      this.logger.info('Subscribed to position updates');
    } catch (error) {
      this.logger.error('Failed to subscribe to position updates', { error: error.message });
      throw error;
    }
  }

  /**
   * Unsubscribe from order updates
   * @param {string} orderId - Order ID
   * @returns {Promise<void>}
   */
  async unsubscribeFromOrderUpdates(orderId) {
    const subscription = `order:${orderId}`;

    if (!this.subscriptions.has(subscription)) {
      return;
    }

    try {
      await this._sendMessage({
        action: 'unsubscribe',
        type: 'order',
        id: orderId
      });

      this.subscriptions.delete(subscription);
      this.logger.info(`Unsubscribed from order updates: ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from order: ${orderId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get latest order status
   * @param {string} orderId - Order ID
   * @returns {Object} Order update or null
   */
  getOrderUpdate(orderId) {
    return this.orderUpdates.get(orderId) || null;
  }

  /**
   * Get all trade notifications
   * @param {number} limit - Max number of notifications
   * @returns {Array} Trade notifications
   */
  getTradeNotifications(limit = 100) {
    return this.tradeNotifications.slice(-limit);
  }

  /**
   * Clear trade notifications
   * @param {string} orderId - Optional order ID to clear specific notifications
   */
  clearTradeNotifications(orderId = null) {
    if (orderId) {
      this.tradeNotifications = this.tradeNotifications.filter(n => n.orderId !== orderId);
    } else {
      this.tradeNotifications = [];
    }
  }

  /**
   * Get account updates
   * @returns {Object} Latest account update
   */
  getAccountUpdate() {
    return this.accountUpdates;
  }

  /**
   * Check connection status
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.connected;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Handle incoming WebSocket messages
   * @private
   */
  _onMessage(data) {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;

      switch (message.type) {
        case 'order_update':
          this._handleOrderUpdate(message);
          break;
        case 'trade':
          this._handleTradeNotification(message);
          break;
        case 'account':
          this._handleAccountUpdate(message);
          break;
        case 'position':
          this._handlePositionUpdate(message);
          break;
        case 'heartbeat':
          this._handleHeartbeat();
          break;
        case 'error':
          this.logger.error('WebSocket error from broker', { message: message.message });
          this.emit('error', message.message);
          break;
        default:
          if (this.messageHandlers.has(message.type)) {
            this.messageHandlers.get(message.type)(message);
          }
      }
    } catch (error) {
      this.logger.error('Error processing WebSocket message', { error: error.message });
    }
  }

  /**
   * Handle WebSocket error
   * @private
   */
  _onError(error) {
    this.logger.error('WebSocket error', { error: error.message });
    this.emit('error', error);
  }

  /**
   * Handle WebSocket close
   * @private
   */
  _onClose() {
    this.logger.warn('WebSocket closed');
    this.connected = false;
    this._stopHeartbeat();
    this.emit('closed');
    this._attemptReconnect();
  }

  /**
   * Handle WebSocket open
   * @private
   */
  _onOpen() {
    this.logger.info('WebSocket opened');
  }

  /**
   * Handle order update message
   * @private
   */
  _handleOrderUpdate(message) {
    const { orderId, status, filledQuantity, filledPrice, totalFilled } = message;

    const update = {
      orderId,
      status,
      filledQuantity,
      filledPrice,
      totalFilled,
      updatedAt: new Date(),
      timestamp: message.timestamp
    };

    this.orderUpdates.set(orderId, update);

    this.logger.info(`Order update: ${orderId} - ${status}`, update);
    this.emit('orderUpdate', update);
  }

  /**
   * Handle trade notification
   * @private
   */
  _handleTradeNotification(message) {
    const notification = {
      ...message,
      receivedAt: new Date()
    };

    this.tradeNotifications.push(notification);

    // Keep only last 1000 notifications
    if (this.tradeNotifications.length > 1000) {
      this.tradeNotifications.shift();
    }

    this.logger.info('Trade notification', notification);
    this.emit('trade', notification);
  }

  /**
   * Handle account update
   * @private
   */
  _handleAccountUpdate(message) {
    this.accountUpdates = {
      ...message,
      updatedAt: new Date()
    };

    this.logger.info('Account update', this.accountUpdates);
    this.emit('accountUpdate', this.accountUpdates);
  }

  /**
   * Handle position update
   * @private
   */
  _handlePositionUpdate(message) {
    const update = {
      ...message,
      updatedAt: new Date()
    };

    this.logger.info('Position update', update);
    this.emit('positionUpdate', update);
  }

  /**
   * Handle heartbeat
   * @private
   */
  _handleHeartbeat() {
    clearTimeout(this.heartbeatTimeout);
    // Heartbeat received, connection is alive
  }

  /**
   * Send message via WebSocket
   * @private
   */
  async _sendMessage(message) {
    if (!this.websocket) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      try {
        this.websocket.send(JSON.stringify(message), (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start heartbeat mechanism
   * @private
   */
  _startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this._sendMessage({ action: 'heartbeat' });

        // Set timeout for heartbeat response
        this.heartbeatTimeout = setTimeout(() => {
          this.logger.warn('Heartbeat timeout, reconnecting...');
          this.disconnect().then(() => this.connect()).catch(err => {
            this.logger.error('Reconnection failed', { error: err.message });
          });
        }, 5000);
      } catch (error) {
        this.logger.error('Failed to send heartbeat', { error: error.message });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat mechanism
   * @private
   */
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Attempt to reconnect
   * @private
   */
  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts); // Exponential backoff
    this.reconnectAttempts++;

    this.logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

    setTimeout(() => {
      this.connect().catch(error => {
        this.logger.error('Reconnection attempt failed', { error: error.message });
      });
    }, delay);
  }

  /**
   * Resubscribe to all previous subscriptions
   * @private
   */
  async _resubscribeToAll() {
    const subscriptions = Array.from(this.subscriptions);

    for (const subscription of subscriptions) {
      try {
        const [type, value] = subscription.split(':');

        if (type === 'order') {
          await this.subscribeToOrderUpdates(value);
        } else if (type === 'trade') {
          await this.subscribeToTrades(value);
        } else if (type === 'account') {
          await this.subscribeToAccountUpdates();
        } else if (type === 'position') {
          await this.subscribeToPositionUpdates();
        }
      } catch (error) {
        this.logger.warn(`Failed to resubscribe to ${subscription}`, { error: error.message });
      }
    }
  }
}

module.exports = { WebSocketManager };
