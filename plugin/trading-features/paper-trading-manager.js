/**
 * Paper Trading Manager
 * Database-backed paper trading system with full feature parity to live trading
 * @version 2.0.0
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class PaperTradingManager extends EventEmitter {
  /**
   * Initialize Paper Trading Manager
   * @param {Object} config - Configuration
   * @param {Object} config.db - Database connection
   * @param {Object} config.marketData - Market data client for real-time prices
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    super();
    this.db = config.db;
    this.marketData = config.marketData;
    this.logger = config.logger || console;

    // Default configuration
    this.defaultConfig = {
      initialCapital: 100000.00,
      commissionRate: 0.001, // 0.1%
      slippageBuy: 0.001, // 0.1%
      slippageSell: 0.001, // 0.1%
      marginRequirement: 0.25, // 25%
      allowShortSelling: true,
      maxPositions: 10
    };

    // Cache for real-time price updates
    this.priceCache = new Map();
  }

  // ==================== Account Management ====================

  /**
   * Create a new paper trading account
   * @param {string} userId - User ID
   * @param {Object} options - Account options
   * @returns {Promise<Object>} - Created account
   */
  async createAccount(userId, options = {}) {
    try {
      const accountId = uuidv4();
      const config = { ...this.defaultConfig, ...options };

      const account = {
        id: accountId,
        userId,
        name: options.name || 'Paper Trading Account',
        status: 'active',
        accountType: options.accountType || 'standard',
        initialCapital: config.initialCapital,
        currentCash: config.initialCapital,
        buyingPower: config.initialCapital,
        commissionRate: config.commissionRate,
        slippageBuy: config.slippageBuy,
        slippageSell: config.slippageSell,
        marginRequirement: config.marginRequirement,
        allowShortSelling: config.allowShortSelling,
        positionLimit: config.maxPositions || 10,
        config: JSON.stringify(config)
      };

      const query = `
        INSERT INTO paper_trading_accounts (
          id, user_id, name, status, account_type,
          initial_capital, current_cash, buying_power,
          commission_rate, slippage_buy, slippage_sell,
          margin_requirement, allow_short_selling, position_limit, config
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        account.id, account.userId, account.name, account.status, account.accountType,
        account.initialCapital, account.currentCash, account.buyingPower,
        account.commissionRate, account.slippageBuy, account.slippageSell,
        account.marginRequirement, account.allowShortSelling, account.positionLimit,
        account.config
      ];

      await this.db.query(query, values);

      // Create default settings for user if not exists
      await this.createUserSettings(userId, accountId);

      this.logger.info('Paper trading account created', { accountId, userId });
      this.emit('account:created', account);

      return account;
    } catch (error) {
      this.logger.error('Failed to create paper trading account', { error: error.message, userId });
      throw new Error(`Failed to create account: ${error.message}`);
    }
  }

  /**
   * Get paper trading account by ID
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} - Account data
   */
  async getAccount(accountId) {
    try {
      const query = 'SELECT * FROM paper_trading_accounts WHERE id = ?';
      const [rows] = await this.db.query(query, [accountId]);

      if (rows.length === 0) {
        throw new Error('Account not found');
      }

      return this.formatAccount(rows[0]);
    } catch (error) {
      this.logger.error('Failed to get account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get all accounts for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - List of accounts
   */
  async getUserAccounts(userId) {
    try {
      const query = `
        SELECT * FROM paper_trading_accounts
        WHERE user_id = ? AND status = 'active'
        ORDER BY created_at DESC
      `;
      const [rows] = await this.db.query(query, [userId]);

      return rows.map(row => this.formatAccount(row));
    } catch (error) {
      this.logger.error('Failed to get user accounts', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update account settings
   * @param {string} accountId - Account ID
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} - Updated account
   */
  async updateAccountSettings(accountId, settings) {
    try {
      const updates = [];
      const values = [];

      if (settings.name) {
        updates.push('name = ?');
        values.push(settings.name);
      }
      if (settings.status) {
        updates.push('status = ?');
        values.push(settings.status);
      }
      if (settings.allowShortSelling !== undefined) {
        updates.push('allow_short_selling = ?');
        values.push(settings.allowShortSelling);
      }
      if (settings.maxDailyLoss) {
        updates.push('max_daily_loss = ?');
        values.push(settings.maxDailyLoss);
      }
      if (settings.positionLimit) {
        updates.push('position_limit = ?');
        values.push(settings.positionLimit);
      }

      if (updates.length === 0) {
        throw new Error('No valid settings to update');
      }

      values.push(accountId);

      const query = `
        UPDATE paper_trading_accounts
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.query(query, values);

      this.logger.info('Account settings updated', { accountId, settings });
      return await this.getAccount(accountId);
    } catch (error) {
      this.logger.error('Failed to update account settings', { error: error.message, accountId });
      throw error;
    }
  }

  // ==================== Order Management ====================

  /**
   * Submit a paper trade order
   * @param {string} accountId - Account ID
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} - Created order
   */
  async submitOrder(accountId, orderData) {
    try {
      // Get account
      const account = await this.getAccount(accountId);

      // Validate order
      await this.validateOrder(account, orderData);

      // Get current market price
      const currentPrice = await this.getCurrentPrice(orderData.symbol);

      // Calculate execution price with slippage
      const executionPrice = this.calculateExecutionPrice(
        orderData.type === 'market' ? currentPrice : (orderData.limitPrice || currentPrice),
        orderData.side,
        { buy: account.slippageBuy, sell: account.slippageSell }
      );

      // Calculate commission
      const commission = (orderData.quantity * executionPrice * account.commissionRate);

      // Calculate total cost/proceeds
      const totalValue = orderData.quantity * executionPrice;
      const totalCost = orderData.side === 'buy'
        ? totalValue + commission
        : totalValue - commission;

      // Check buying power for buy orders
      if (orderData.side === 'buy' && totalCost > account.currentCash) {
        throw new Error('Insufficient buying power');
      }

      // Create order record
      const orderId = uuidv4();
      const order = {
        id: orderId,
        accountId,
        userId: account.userId,
        symbol: orderData.symbol.toUpperCase(),
        side: orderData.side,
        type: orderData.type,
        quantity: orderData.quantity,
        limitPrice: orderData.limitPrice || null,
        stopPrice: orderData.stopPrice || null,
        executionPrice,
        averagePrice: executionPrice,
        filledQuantity: orderData.quantity,
        remainingQuantity: 0,
        totalValue,
        commission,
        slippage: Math.abs(executionPrice - currentPrice),
        status: 'filled',
        timeInForce: orderData.timeInForce || 'day',
        extendedHours: orderData.extendedHours || false,
        realizedPl: 0,
        submittedAt: new Date(),
        filledAt: new Date()
      };

      // Insert order
      const insertQuery = `
        INSERT INTO paper_trading_orders (
          id, account_id, user_id, symbol, side, type, quantity,
          limit_price, stop_price, execution_price, average_price,
          filled_quantity, remaining_quantity, total_value, commission, slippage,
          status, time_in_force, extended_hours, realized_pl,
          submitted_at, filled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        order.id, order.accountId, order.userId, order.symbol, order.side, order.type,
        order.quantity, order.limitPrice, order.stopPrice, order.executionPrice,
        order.averagePrice, order.filledQuantity, order.remainingQuantity,
        order.totalValue, order.commission, order.slippage, order.status,
        order.timeInForce, order.extendedHours, order.realizedPl,
        order.submittedAt, order.filledAt
      ];

      await this.db.query(insertQuery, values);

      // Update account cash
      const newCash = orderData.side === 'buy'
        ? account.currentCash - totalCost
        : account.currentCash + totalCost;

      await this.db.query(
        'UPDATE paper_trading_accounts SET current_cash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newCash, accountId]
      );

      // Update or create position
      await this.updatePosition(accountId, order, currentPrice);

      this.logger.info('Paper trade executed', { orderId, accountId, symbol: order.symbol });
      this.emit('order:filled', order);

      return order;
    } catch (error) {
      this.logger.error('Failed to submit paper trade', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} - Order data
   */
  async getOrder(orderId) {
    try {
      const query = 'SELECT * FROM paper_trading_orders WHERE id = ?';
      const [rows] = await this.db.query(query, [orderId]);

      if (rows.length === 0) {
        throw new Error('Order not found');
      }

      return this.formatOrder(rows[0]);
    } catch (error) {
      this.logger.error('Failed to get order', { error: error.message, orderId });
      throw error;
    }
  }

  /**
   * Get orders for an account
   * @param {string} accountId - Account ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - List of orders
   */
  async getAccountOrders(accountId, filters = {}) {
    try {
      let query = 'SELECT * FROM paper_trading_orders WHERE account_id = ?';
      const values = [accountId];

      if (filters.status) {
        query += ' AND status = ?';
        values.push(filters.status);
      }
      if (filters.symbol) {
        query += ' AND symbol = ?';
        values.push(filters.symbol.toUpperCase());
      }
      if (filters.side) {
        query += ' AND side = ?';
        values.push(filters.side);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        values.push(parseInt(filters.limit));
      }

      const [rows] = await this.db.query(query, values);
      return rows.map(row => this.formatOrder(row));
    } catch (error) {
      this.logger.error('Failed to get account orders', { error: error.message, accountId });
      throw error;
    }
  }

  // ==================== Position Management ====================

  /**
   * Update position after order execution
   * @param {string} accountId - Account ID
   * @param {Object} order - Order data
   * @param {number} currentPrice - Current market price
   * @returns {Promise<Object>} - Updated position
   */
  async updatePosition(accountId, order, currentPrice) {
    try {
      // Get existing position
      const query = 'SELECT * FROM paper_trading_positions WHERE account_id = ? AND symbol = ?';
      const [rows] = await this.db.query(query, [accountId, order.symbol]);

      if (rows.length === 0 && order.side === 'buy') {
        // Create new position
        return await this.createPosition(accountId, order, currentPrice);
      } else if (rows.length > 0) {
        // Update existing position
        return await this.modifyPosition(rows[0], order, currentPrice);
      } else {
        throw new Error('Cannot sell position that does not exist');
      }
    } catch (error) {
      this.logger.error('Failed to update position', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Create new position
   * @param {string} accountId - Account ID
   * @param {Object} order - Order data
   * @param {number} currentPrice - Current market price
   * @returns {Promise<Object>} - Created position
   */
  async createPosition(accountId, order, currentPrice) {
    const positionId = uuidv4();
    const account = await this.getAccount(accountId);

    const position = {
      id: positionId,
      accountId,
      userId: account.userId,
      symbol: order.symbol,
      quantity: order.quantity,
      side: 'long',
      averageCost: order.executionPrice,
      totalCost: order.totalValue + order.commission,
      currentPrice,
      marketValue: order.quantity * currentPrice,
      unrealizedPl: (order.quantity * currentPrice) - (order.quantity * order.executionPrice),
      unrealizedPlPercent: ((currentPrice - order.executionPrice) / order.executionPrice) * 100,
      realizedPl: 0,
      totalPl: 0
    };

    const insertQuery = `
      INSERT INTO paper_trading_positions (
        id, account_id, user_id, symbol, quantity, side,
        average_cost, total_cost, current_price, market_value,
        unrealized_pl, unrealized_pl_percent, realized_pl, total_pl
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      position.id, position.accountId, position.userId, position.symbol,
      position.quantity, position.side, position.averageCost, position.totalCost,
      position.currentPrice, position.marketValue, position.unrealizedPl,
      position.unrealizedPlPercent, position.realizedPl, position.totalPl
    ];

    await this.db.query(insertQuery, values);
    this.emit('position:created', position);

    return position;
  }

  /**
   * Modify existing position
   * @param {Object} existingPosition - Existing position data
   * @param {Object} order - New order data
   * @param {number} currentPrice - Current market price
   * @returns {Promise<Object>} - Updated position
   */
  async modifyPosition(existingPosition, order, currentPrice) {
    let newQuantity, newAverageCost, newTotalCost, realizedPl;

    if (order.side === 'buy') {
      // Adding to position
      newQuantity = existingPosition.quantity + order.quantity;
      newTotalCost = existingPosition.total_cost + (order.totalValue + order.commission);
      newAverageCost = newTotalCost / newQuantity;
      realizedPl = existingPosition.realized_pl;
    } else {
      // Reducing position
      newQuantity = Math.max(0, existingPosition.quantity - order.quantity);

      // Calculate realized P&L
      const sellProceeds = order.totalValue - order.commission;
      const costBasis = order.quantity * existingPosition.average_cost;
      realizedPl = existingPosition.realized_pl + (sellProceeds - costBasis);

      if (newQuantity > 0) {
        newAverageCost = existingPosition.average_cost;
        newTotalCost = newQuantity * newAverageCost;
      } else {
        newAverageCost = 0;
        newTotalCost = 0;
      }

      // Update order with realized P&L
      await this.db.query(
        'UPDATE paper_trading_orders SET realized_pl = ? WHERE id = ?',
        [sellProceeds - costBasis, order.id]
      );
    }

    const marketValue = newQuantity * currentPrice;
    const unrealizedPl = marketValue - newTotalCost;
    const unrealizedPlPercent = newTotalCost > 0 ? (unrealizedPl / newTotalCost) * 100 : 0;
    const totalPl = realizedPl + unrealizedPl;

    if (newQuantity === 0) {
      // Close position
      await this.db.query(
        'DELETE FROM paper_trading_positions WHERE id = ?',
        [existingPosition.id]
      );
      this.emit('position:closed', { id: existingPosition.id, symbol: order.symbol, realizedPl });
      return null;
    } else {
      // Update position
      const updateQuery = `
        UPDATE paper_trading_positions
        SET quantity = ?, average_cost = ?, total_cost = ?,
            current_price = ?, market_value = ?,
            unrealized_pl = ?, unrealized_pl_percent = ?,
            realized_pl = ?, total_pl = ?,
            last_updated = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const values = [
        newQuantity, newAverageCost, newTotalCost, currentPrice, marketValue,
        unrealizedPl, unrealizedPlPercent, realizedPl, totalPl,
        existingPosition.id
      ];

      await this.db.query(updateQuery, values);

      const updatedPosition = {
        ...existingPosition,
        quantity: newQuantity,
        averageCost: newAverageCost,
        totalCost: newTotalCost,
        currentPrice,
        marketValue,
        unrealizedPl,
        unrealizedPlPercent,
        realizedPl,
        totalPl
      };

      this.emit('position:updated', updatedPosition);
      return updatedPosition;
    }
  }

  /**
   * Get all positions for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Array>} - List of positions
   */
  async getAccountPositions(accountId) {
    try {
      const query = 'SELECT * FROM paper_trading_positions WHERE account_id = ? ORDER BY market_value DESC';
      const [rows] = await this.db.query(query, [accountId]);

      return rows.map(row => this.formatPosition(row));
    } catch (error) {
      this.logger.error('Failed to get account positions', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update position prices with current market data
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async updatePositionPrices(accountId) {
    try {
      const positions = await this.getAccountPositions(accountId);

      for (const position of positions) {
        const currentPrice = await this.getCurrentPrice(position.symbol);
        const marketValue = position.quantity * currentPrice;
        const unrealizedPl = marketValue - position.totalCost;
        const unrealizedPlPercent = (unrealizedPl / position.totalCost) * 100;

        await this.db.query(
          `UPDATE paper_trading_positions
           SET current_price = ?, market_value = ?,
               unrealized_pl = ?, unrealized_pl_percent = ?,
               last_updated = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [currentPrice, marketValue, unrealizedPl, unrealizedPlPercent, position.id]
        );
      }

      this.emit('positions:updated', { accountId, count: positions.length });
    } catch (error) {
      this.logger.error('Failed to update position prices', { error: error.message, accountId });
      throw error;
    }
  }

  // ==================== Performance & Analytics ====================

  /**
   * Get account performance summary
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} - Performance summary
   */
  async getPerformanceSummary(accountId) {
    try {
      const account = await this.getAccount(accountId);
      const positions = await this.getAccountPositions(accountId);

      const positionValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
      const totalEquity = account.currentCash + positionValue;
      const unrealizedPl = positions.reduce((sum, p) => sum + p.unrealizedPl, 0);

      return {
        accountId,
        name: account.name,
        initialCapital: account.initialCapital,
        currentCash: account.currentCash,
        positionValue,
        totalEquity,
        totalReturn: ((totalEquity - account.initialCapital) / account.initialCapital) * 100,
        totalPl: account.totalPl,
        unrealizedPl,
        realizedPl: account.totalPl - unrealizedPl,
        totalTrades: account.totalTrades,
        winningTrades: account.winningTrades,
        losingTrades: account.losingTrades,
        winRate: account.winRate,
        profitFactor: account.profitFactor,
        maxDrawdown: account.maxDrawdown,
        sharpeRatio: account.sharpeRatio,
        positionCount: positions.length,
        avgWin: account.winningTrades > 0 ? account.totalPl / account.winningTrades : 0,
        avgLoss: account.losingTrades > 0 ? Math.abs(account.totalPl) / account.losingTrades : 0,
        positions: positions.map(p => ({
          symbol: p.symbol,
          quantity: p.quantity,
          currentPrice: p.currentPrice,
          marketValue: p.marketValue,
          unrealizedPl: p.unrealizedPl,
          unrealizedPlPercent: p.unrealizedPlPercent
        }))
      };
    } catch (error) {
      this.logger.error('Failed to get performance summary', { error: error.message, accountId });
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Validate order before execution
   * @param {Object} account - Account data
   * @param {Object} orderData - Order data
   * @throws {Error} - If validation fails
   */
  async validateOrder(account, orderData) {
    // Validate required fields
    if (!orderData.symbol || !orderData.side || !orderData.type || !orderData.quantity) {
      throw new Error('Missing required order fields');
    }

    // Validate quantity
    if (orderData.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    // Validate side
    if (!['buy', 'sell'].includes(orderData.side)) {
      throw new Error('Invalid order side');
    }

    // Validate type
    if (!['market', 'limit', 'stop', 'stop_limit'].includes(orderData.type)) {
      throw new Error('Invalid order type');
    }

    // Check account status
    if (account.status !== 'active') {
      throw new Error('Account is not active');
    }

    // Check position limit for buy orders
    if (orderData.side === 'buy') {
      const positions = await this.getAccountPositions(account.id);
      const existingPosition = positions.find(p => p.symbol === orderData.symbol.toUpperCase());

      if (!existingPosition && positions.length >= account.positionLimit) {
        throw new Error(`Position limit reached (${account.positionLimit})`);
      }
    }

    // Check short selling permission
    if (orderData.side === 'sell' && !account.allowShortSelling) {
      const positions = await this.getAccountPositions(account.id);
      const existingPosition = positions.find(p => p.symbol === orderData.symbol.toUpperCase());

      if (!existingPosition || existingPosition.quantity < orderData.quantity) {
        throw new Error('Short selling not allowed for this account');
      }
    }
  }

  /**
   * Calculate execution price with slippage
   * @param {number} basePrice - Base price
   * @param {string} side - Order side ('buy' or 'sell')
   * @param {Object} slippage - Slippage configuration
   * @returns {number} - Execution price
   */
  calculateExecutionPrice(basePrice, side, slippage) {
    const slippagePercent = side === 'buy' ? slippage.buy : slippage.sell;
    const slippageAmount = basePrice * slippagePercent;

    return side === 'buy'
      ? basePrice + slippageAmount
      : basePrice - slippageAmount;
  }

  /**
   * Get current market price for symbol
   * @param {string} symbol - Symbol
   * @returns {Promise<number>} - Current price
   */
  async getCurrentPrice(symbol) {
    try {
      // Check cache first
      if (this.priceCache.has(symbol)) {
        const cached = this.priceCache.get(symbol);
        if (Date.now() - cached.timestamp < 5000) { // 5 second cache
          return cached.price;
        }
      }

      // Fetch from market data if available
      if (this.marketData) {
        const quote = await this.marketData.getQuote(symbol);
        const price = quote.price || quote.last || quote.close;

        this.priceCache.set(symbol, { price, timestamp: Date.now() });
        return price;
      }

      // Fallback to mock price (for testing)
      return 100 + (Math.random() * 10);
    } catch (error) {
      this.logger.warn('Failed to get current price, using fallback', { symbol, error: error.message });
      return 100 + (Math.random() * 10);
    }
  }

  /**
   * Create default user settings
   * @param {string} userId - User ID
   * @param {string} defaultAccountId - Default account ID
   * @returns {Promise<void>}
   */
  async createUserSettings(userId, defaultAccountId) {
    try {
      const query = `
        INSERT INTO paper_trading_settings (
          user_id, paper_trading_enabled, default_account_id,
          auto_create_account, show_paper_banner, confirm_before_live
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE default_account_id = ?
      `;

      await this.db.query(query, [userId, false, defaultAccountId, true, true, true, defaultAccountId]);
    } catch (error) {
      this.logger.error('Failed to create user settings', { error: error.message, userId });
    }
  }

  /**
   * Format account data
   * @param {Object} row - Database row
   * @returns {Object} - Formatted account
   */
  formatAccount(row) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      status: row.status,
      accountType: row.account_type,
      initialCapital: parseFloat(row.initial_capital),
      currentCash: parseFloat(row.current_cash),
      buyingPower: parseFloat(row.buying_power),
      commissionRate: parseFloat(row.commission_rate),
      slippageBuy: parseFloat(row.slippage_buy),
      slippageSell: parseFloat(row.slippage_sell),
      marginRequirement: parseFloat(row.margin_requirement),
      allowShortSelling: Boolean(row.allow_short_selling),
      positionLimit: row.position_limit,
      totalTrades: row.total_trades,
      winningTrades: row.winning_trades,
      losingTrades: row.losing_trades,
      totalPl: parseFloat(row.total_pl),
      totalCommission: parseFloat(row.total_commission),
      maxDrawdown: parseFloat(row.max_drawdown),
      winRate: parseFloat(row.win_rate),
      profitFactor: parseFloat(row.profit_factor),
      totalReturn: parseFloat(row.total_return),
      sharpeRatio: parseFloat(row.sharpe_ratio),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Format order data
   * @param {Object} row - Database row
   * @returns {Object} - Formatted order
   */
  formatOrder(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      userId: row.user_id,
      symbol: row.symbol,
      side: row.side,
      type: row.type,
      quantity: row.quantity,
      limitPrice: row.limit_price ? parseFloat(row.limit_price) : null,
      stopPrice: row.stop_price ? parseFloat(row.stop_price) : null,
      executionPrice: row.execution_price ? parseFloat(row.execution_price) : null,
      averagePrice: row.average_price ? parseFloat(row.average_price) : null,
      filledQuantity: row.filled_quantity,
      remainingQuantity: row.remaining_quantity,
      totalValue: parseFloat(row.total_value),
      commission: parseFloat(row.commission),
      slippage: parseFloat(row.slippage),
      status: row.status,
      timeInForce: row.time_in_force,
      extendedHours: Boolean(row.extended_hours),
      realizedPl: parseFloat(row.realized_pl),
      plPercent: row.pl_percent ? parseFloat(row.pl_percent) : null,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      filledAt: row.filled_at,
      cancelledAt: row.cancelled_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Format position data
   * @param {Object} row - Database row
   * @returns {Object} - Formatted position
   */
  formatPosition(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      userId: row.user_id,
      symbol: row.symbol,
      quantity: row.quantity,
      side: row.side,
      averageCost: parseFloat(row.average_cost),
      totalCost: parseFloat(row.total_cost),
      currentPrice: parseFloat(row.current_price),
      marketValue: parseFloat(row.market_value),
      unrealizedPl: parseFloat(row.unrealized_pl),
      unrealizedPlPercent: parseFloat(row.unrealized_pl_percent),
      realizedPl: parseFloat(row.realized_pl),
      totalPl: parseFloat(row.total_pl),
      entryDate: row.entry_date,
      lastUpdated: row.last_updated,
      sector: row.sector,
      assetClass: row.asset_class
    };
  }
}

module.exports = PaperTradingManager;
