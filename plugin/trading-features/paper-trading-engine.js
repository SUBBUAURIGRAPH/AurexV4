/**
 * Paper Trading Engine
 * Simulates trades without executing real orders
 * Perfect for learning, backtesting, and strategy validation
 *
 * Features:
 * - Virtual portfolio management
 * - Real-time market data integration
 * - Trade simulation with realistic fills
 * - Performance tracking and analytics
 * - Strategy comparison tools
 */

const EventEmitter = require('events');
const uuid = require('uuid');

class PaperTradeEngine extends EventEmitter {
  constructor(initialCapital = 100000, options = {}) {
    super();

    this.virtualAccounts = new Map();
    this.paperTrades = new Map();
    this.paperPositions = new Map();
    this.priceHistory = new Map();

    this.defaultConfig = {
      initialCapital,
      commissionRate: 0.001, // 0.1%
      slippage: {
        buy: 0.001, // 0.1% slippage on buys
        sell: 0.001 // 0.1% slippage on sells
      },
      marginRequirement: 0.25, // 25% for day trading
      shortEnabled: true,
      dividendSimulation: false,
      ...options
    };
  }

  /**
   * Create a new paper trading account
   */
  createPaperAccount(userId, name = 'Paper Trading Account', config = {}) {
    const accountId = uuid.v4();
    const mergedConfig = { ...this.defaultConfig, ...config };

    const account = {
      id: accountId,
      userId,
      name,
      createdAt: new Date(),
      status: 'active',
      config: mergedConfig,
      // Portfolio metrics
      cash: mergedConfig.initialCapital,
      initialCapital: mergedConfig.initialCapital,
      positions: new Map(),
      trades: [],
      statistics: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPL: 0,
        totalCommission: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0,
        totalReturn: 0
      },
      equity: new Map(), // Time series of equity values
      benchmarkComparison: null
    };

    this.virtualAccounts.set(accountId, account);
    this.emit('account:created', account);
    return account;
  }

  /**
   * Get paper trading account
   */
  getPaperAccount(accountId) {
    return this.virtualAccounts.get(accountId);
  }

  /**
   * Submit a paper trade
   */
  submitPaperTrade(accountId, orderData) {
    const account = this.getPaperAccount(accountId);
    if (!account) throw new Error('Account not found');

    const { symbol, side, type, quantity, price, stopPrice, limitPrice } = orderData;

    // Validate trade
    this.validateTrade(account, { symbol, side, quantity, price });

    // Calculate execution price with slippage
    const executionPrice = this.calculateExecutionPrice(
      price || 0,
      side,
      account.config.slippage
    );

    // Calculate commission
    const commission = quantity * executionPrice * account.config.commissionRate;

    // Calculate cost
    const totalCost = quantity * executionPrice + commission;

    // Check buying power
    if (side === 'buy' && totalCost > account.cash) {
      throw new Error('Insufficient buying power for this trade');
    }

    // Create trade record
    const trade = {
      id: uuid.v4(),
      accountId,
      symbol,
      side,
      type,
      quantity,
      entryPrice: executionPrice,
      commission,
      status: 'filled',
      createdAt: new Date(),
      // For limit/stop orders
      limitPrice,
      stopPrice,
      // Execution details
      filledQuantity: quantity,
      averagePrice: executionPrice,
      totalValue: quantity * executionPrice,
      pl: 0 // Will be calculated when closed
    };

    // Update account
    account.cash -= totalCost;
    account.trades.push(trade);
    account.statistics.totalTrades += 1;

    // Update position
    const position = account.positions.get(symbol) || {
      symbol,
      quantity: 0,
      averageCost: 0,
      totalCost: 0,
      trades: []
    };

    if (side === 'buy') {
      const newQuantity = position.quantity + quantity;
      position.totalCost = position.totalCost + totalCost;
      position.averageCost = position.totalCost / newQuantity;
      position.quantity = newQuantity;
    } else {
      // Sell side
      position.quantity = Math.max(0, position.quantity - quantity);
      // Realize P&L
      const pl = (executionPrice - trade.entryPrice) * quantity - commission;
      trade.pl = pl;
      account.statistics.totalPL += pl;

      if (pl > 0) {
        account.statistics.winningTrades += 1;
      } else if (pl < 0) {
        account.statistics.losingTrades += 1;
      }
    }

    position.trades.push(trade);
    account.positions.set(symbol, position);

    // Update statistics
    this.updateAccountStatistics(account);

    this.emit('trade:executed', trade);
    return trade;
  }

  /**
   * Close a paper trading position
   */
  closePaperPosition(accountId, symbol, quantity = null) {
    const account = this.getPaperAccount(accountId);
    if (!account) throw new Error('Account not found');

    const position = account.positions.get(symbol);
    if (!position || position.quantity === 0) {
      throw new Error('No open position for this symbol');
    }

    const closeQuantity = quantity || position.quantity;

    const trade = this.submitPaperTrade(accountId, {
      symbol,
      side: 'sell',
      type: 'market',
      quantity: closeQuantity,
      price: this.getCurrentPrice(symbol) // Would use market price in production
    });

    return trade;
  }

  /**
   * Validate paper trade
   */
  validateTrade(account, { symbol, side, quantity, price }) {
    // Validate symbol
    if (!symbol || symbol.length === 0) {
      throw new Error('Invalid symbol');
    }

    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    // Validate price
    if (price < 0) {
      throw new Error('Price cannot be negative');
    }

    // Check position limits
    const position = account.positions.get(symbol);
    if (side === 'sell' && position && position.quantity < quantity) {
      if (!account.config.shortEnabled) {
        throw new Error('Short selling not enabled for this account');
      }
    }
  }

  /**
   * Calculate execution price with slippage
   */
  calculateExecutionPrice(basePrice, side, slippageConfig) {
    const slippagePercent = slippageConfig[side.toLowerCase()] || 0;
    const slippageAmount = basePrice * slippagePercent;

    if (side.toLowerCase() === 'buy') {
      return basePrice + slippageAmount;
    } else {
      return basePrice - slippageAmount;
    }
  }

  /**
   * Get current price (mock implementation)
   */
  getCurrentPrice(symbol) {
    // In production, this would fetch from real market data
    const history = this.priceHistory.get(symbol) || [];
    return history.length > 0 ? history[history.length - 1] : 100;
  }

  /**
   * Update paper trading with market prices
   */
  updateMarketPrices(priceData) {
    Object.entries(priceData).forEach(([symbol, price]) => {
      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, []);
      }
      this.priceHistory.get(symbol).push(price);
    });

    // Update all account equity
    for (const account of this.virtualAccounts.values()) {
      this.updateAccountEquity(account, priceData);
    }

    this.emit('prices:updated', priceData);
  }

  /**
   * Update account equity based on current prices
   */
  updateAccountEquity(account, priceData) {
    let positionValue = 0;

    for (const [symbol, position] of account.positions.entries()) {
      const currentPrice = priceData[symbol] || this.getCurrentPrice(symbol);
      const value = position.quantity * currentPrice;
      positionValue += value;
    }

    const totalEquity = account.cash + positionValue;

    // Track equity history
    if (!account.equity) {
      account.equity = new Map();
    }
    account.equity.set(new Date().toISOString(), totalEquity);

    return totalEquity;
  }

  /**
   * Calculate unrealized P&L
   */
  calculateUnrealizedPL(account, priceData) {
    let unrealizedPL = 0;

    for (const [symbol, position] of account.positions.entries()) {
      if (position.quantity === 0) continue;

      const currentPrice = priceData[symbol] || this.getCurrentPrice(symbol);
      const positionValue = position.quantity * currentPrice;
      const cost = position.quantity * position.averageCost;
      const pl = positionValue - cost;

      unrealizedPL += pl;
    }

    return unrealizedPL;
  }

  /**
   * Update account statistics
   */
  updateAccountStatistics(account) {
    const { trades, statistics } = account;

    if (trades.length === 0) return;

    // Win rate
    const totalTrades = statistics.winningTrades + statistics.losingTrades;
    statistics.winRate = totalTrades > 0 ? (statistics.winningTrades / totalTrades) * 100 : 0;

    // Total return
    const totalGain = statistics.totalPL;
    statistics.totalReturn = (totalGain / account.initialCapital) * 100;

    // Profit factor
    const wins = trades
      .filter(t => t.pl > 0)
      .reduce((sum, t) => sum + t.pl, 0);

    const losses = Math.abs(
      trades
        .filter(t => t.pl < 0)
        .reduce((sum, t) => sum + t.pl, 0)
    );

    statistics.profitFactor = losses > 0 ? wins / losses : losses > 0 ? 0 : Infinity;

    // Drawdown (simplified)
    this.calculateDrawdown(account);
  }

  /**
   * Calculate maximum drawdown
   */
  calculateDrawdown(account) {
    if (!account.equity || account.equity.size === 0) return;

    const equityValues = Array.from(account.equity.values());
    let peak = equityValues[0];
    let maxDD = 0;

    for (const value of equityValues) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      maxDD = Math.max(maxDD, drawdown);
    }

    account.statistics.maxDrawdown = maxDD * 100; // As percentage
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(accountId) {
    const account = this.getPaperAccount(accountId);
    if (!account) throw new Error('Account not found');

    return {
      accountId,
      name: account.name,
      createdAt: account.createdAt,
      // Capital metrics
      initialCapital: account.initialCapital,
      currentCash: account.cash,
      positionValue: this.calculatePositionValue(account),
      totalEquity: account.cash + this.calculatePositionValue(account),
      // Return metrics
      totalReturn: account.statistics.totalReturn,
      totalPL: account.statistics.totalPL,
      // Trade metrics
      totalTrades: account.statistics.totalTrades,
      winningTrades: account.statistics.winningTrades,
      losingTrades: account.statistics.losingTrades,
      winRate: account.statistics.winRate,
      profitFactor: account.statistics.profitFactor,
      // Risk metrics
      maxDrawdown: account.statistics.maxDrawdown,
      averageWin: this.calculateAverageWin(account),
      averageLoss: this.calculateAverageLoss(account),
      // Positions
      positions: Array.from(account.positions.values())
    };
  }

  /**
   * Calculate position value
   */
  calculatePositionValue(account) {
    let value = 0;
    for (const position of account.positions.values()) {
      const price = this.getCurrentPrice(position.symbol);
      value += position.quantity * price;
    }
    return value;
  }

  /**
   * Calculate average winning trade
   */
  calculateAverageWin(account) {
    const wins = account.trades.filter(t => t.pl > 0);
    return wins.length > 0 ? wins.reduce((sum, t) => sum + t.pl, 0) / wins.length : 0;
  }

  /**
   * Calculate average losing trade
   */
  calculateAverageLoss(account) {
    const losses = account.trades.filter(t => t.pl < 0);
    return losses.length > 0 ? losses.reduce((sum, t) => sum + t.pl, 0) / losses.length : 0;
  }

  /**
   * Delete paper trading account
   */
  deletePaperAccount(accountId) {
    this.virtualAccounts.delete(accountId);
    this.emit('account:deleted', accountId);
  }

  /**
   * List all paper accounts for a user
   */
  getUserPaperAccounts(userId) {
    const accounts = [];
    for (const account of this.virtualAccounts.values()) {
      if (account.userId === userId) {
        accounts.push(account);
      }
    }
    return accounts;
  }

  /**
   * Export account data for analysis
   */
  exportAccountData(accountId) {
    const account = this.getPaperAccount(accountId);
    if (!account) throw new Error('Account not found');

    return {
      account: {
        id: account.id,
        name: account.name,
        userId: account.userId,
        createdAt: account.createdAt,
        config: account.config
      },
      summary: this.getPerformanceSummary(accountId),
      trades: account.trades,
      positions: Array.from(account.positions.values()),
      equityHistory: Array.from(account.equity.entries())
    };
  }
}

module.exports = PaperTradeEngine;
