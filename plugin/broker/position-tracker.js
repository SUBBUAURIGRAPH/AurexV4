/**
 * Position Tracker
 * Manages real-time position tracking and syncing
 * @version 1.0.0
 */

/**
 * PositionTracker
 * @class
 * @description Fetches, syncs, and manages trading positions
 */
class PositionTracker {
  /**
   * Initialize Position Tracker
   * @param {Object} config - Configuration
   * @param {Object} config.broker - Broker instance
   * @param {Object} config.logger - Logger instance
   * @param {number} config.syncInterval - Auto-sync interval in ms (default: 60000 = 1 min)
   * @param {Object} config.websocketManager - WebSocket manager for real-time updates (optional)
   */
  constructor(config = {}) {
    this.broker = config.broker;
    this.logger = config.logger || console;
    this.syncInterval = config.syncInterval || 60000;
    this.websocketManager = config.websocketManager;

    // Position storage
    this.positions = new Map(); // Symbol -> Position details
    this.lastSync = null;
    this.syncIntervalId = null;

    // Position history for analysis
    this.positionHistory = []; // Array of historical position snapshots

    // Binding for WebSocket events
    if (this.websocketManager) {
      this.websocketManager.on('positionUpdate', this._handlePositionUpdate.bind(this));
      this.websocketManager.on('accountUpdate', this._handleAccountUpdate.bind(this));
    }
  }

  /**
   * Start automatic position syncing
   * @returns {Promise<void>}
   */
  async start() {
    try {
      // Initial sync
      await this.syncPositions();

      // Start periodic syncing
      this.syncIntervalId = setInterval(async () => {
        try {
          await this.syncPositions();
        } catch (error) {
          this.logger.error('Periodic sync failed', { error: error.message });
        }
      }, this.syncInterval);

      this.logger.info('Position tracker started');
    } catch (error) {
      this.logger.error('Failed to start position tracker', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop automatic position syncing
   */
  stop() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }

    this.logger.info('Position tracker stopped');
  }

  /**
   * Sync positions from broker
   * @returns {Promise<Array>} Array of current positions
   */
  async syncPositions() {
    try {
      const brokerPositions = await this.broker.getPositions();

      // Update position map
      this.positions.clear();
      for (const pos of brokerPositions) {
        const position = this._parsePosition(pos);
        this.positions.set(position.symbol, position);
      }

      this.lastSync = new Date();

      // Record snapshot for history
      this._recordPositionSnapshot();

      this.logger.info(`Synced ${this.positions.size} positions`);
      return Array.from(this.positions.values());
    } catch (error) {
      this.logger.error('Failed to sync positions', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all current positions
   * @returns {Array} Array of position objects
   */
  getPositions() {
    return Array.from(this.positions.values());
  }

  /**
   * Get position by symbol
   * @param {string} symbol - Stock symbol
   * @returns {Object} Position details or null
   */
  getPosition(symbol) {
    return this.positions.get(symbol.toUpperCase()) || null;
  }

  /**
   * Get portfolio metrics
   * @returns {Object} Portfolio-wide metrics
   */
  getPortfolioMetrics() {
    const positions = this.getPositions();

    const totalValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
    const totalCost = positions.reduce((sum, p) => sum + (p.costBasis || 0), 0);
    const totalUnrealizedPL = positions.reduce((sum, p) => sum + (p.unrealizedPL || 0), 0);
    const totalUnrealizedPLPercent = totalCost > 0 ? (totalUnrealizedPL / totalCost) * 100 : 0;

    // Calculate sector allocation
    const sectorAllocation = {};
    positions.forEach(p => {
      const sector = p.sector || 'Unknown';
      if (!sectorAllocation[sector]) {
        sectorAllocation[sector] = 0;
      }
      sectorAllocation[sector] += p.marketValue || 0;
    });

    // Find best and worst performers
    const byReturn = [...positions].sort((a, b) => (b.unrealizedPLPercent || 0) - (a.unrealizedPLPercent || 0));
    const bestPerformers = byReturn.slice(0, 5);
    const worstPerformers = byReturn.slice(-5).reverse();

    return {
      totalValue,
      totalCost,
      totalUnrealizedPL,
      totalUnrealizedPLPercent,
      positionCount: positions.length,
      sectorAllocation,
      bestPerformers,
      worstPerformers,
      lastSyncTime: this.lastSync
    };
  }

  /**
   * Get position changes since last sync
   * @returns {Object} Changes summary
   */
  getPositionChanges() {
    if (this.positionHistory.length < 2) {
      return {
        newPositions: [],
        closedPositions: [],
        changedPositions: []
      };
    }

    const current = new Map(this.positions);
    const previous = this.positionHistory[this.positionHistory.length - 2]?.positions || new Map();

    const newPositions = [];
    const closedPositions = [];
    const changedPositions = [];

    // Find new and changed positions
    for (const [symbol, position] of current) {
      if (!previous.has(symbol)) {
        newPositions.push(position);
      } else {
        const prevPos = previous.get(symbol);
        if (prevPos.quantity !== position.quantity || prevPos.currentPrice !== position.currentPrice) {
          changedPositions.push({
            symbol,
            quantityChange: position.quantity - (prevPos.quantity || 0),
            priceChange: position.currentPrice - (prevPos.currentPrice || 0),
            oldValue: prevPos.marketValue,
            newValue: position.marketValue
          });
        }
      }
    }

    // Find closed positions
    for (const [symbol, prevPos] of previous) {
      if (!current.has(symbol)) {
        closedPositions.push({
          symbol,
          quantity: prevPos.quantity,
          lastPrice: prevPos.currentPrice,
          lastValue: prevPos.marketValue
        });
      }
    }

    return {
      newPositions,
      closedPositions,
      changedPositions
    };
  }

  /**
   * Calculate position concentration
   * @returns {Array} Array of {symbol, percentage} sorted by weight
   */
  calculateConcentration() {
    const positions = this.getPositions();
    const totalValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);

    if (totalValue === 0) {
      return [];
    }

    return positions
      .map(p => ({
        symbol: p.symbol,
        percentage: ((p.marketValue || 0) / totalValue) * 100,
        marketValue: p.marketValue
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Get position history snapshots
   * @param {number} limit - Max number of snapshots
   * @returns {Array} Historical position snapshots
   */
  getPositionHistory(limit = 100) {
    return this.positionHistory.slice(-limit);
  }

  /**
   * Get position delta since specific timestamp
   * @param {Date} since - Start date
   * @returns {Object} Delta summary
   */
  getPositionDelta(since) {
    if (!(since instanceof Date)) {
      since = new Date(since);
    }

    const snapshots = this.positionHistory.filter(s => s.timestamp >= since);

    if (snapshots.length === 0) {
      return {
        startValue: 0,
        endValue: 0,
        delta: 0,
        deltaPercent: 0,
        snapshots: []
      };
    }

    const start = snapshots[0];
    const end = snapshots[snapshots.length - 1];

    const startValue = Array.from(start.positions.values()).reduce((sum, p) => sum + (p.marketValue || 0), 0);
    const endValue = Array.from(end.positions.values()).reduce((sum, p) => sum + (p.marketValue || 0), 0);

    return {
      startValue,
      endValue,
      delta: endValue - startValue,
      deltaPercent: startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0,
      snapshots
    };
  }

  /**
   * Export positions
   * @param {string} format - Format (json, csv)
   * @returns {string} Exported data
   */
  export(format = 'json') {
    const positions = this.getPositions();

    if (format === 'json') {
      return JSON.stringify({
        exportDate: new Date().toISOString(),
        lastSync: this.lastSync?.toISOString(),
        positions,
        metrics: this.getPortfolioMetrics()
      }, null, 2);
    }

    if (format === 'csv') {
      const headers = 'Symbol,Quantity,CurrentPrice,CostBasis,MarketValue,UnrealizedPL,UnrealizedPLPercent';
      const rows = positions.map(p =>
        `${p.symbol},${p.quantity},${p.currentPrice},${p.costBasis},${p.marketValue},${p.unrealizedPL},${p.unrealizedPLPercent}`
      );
      return [headers, ...rows].join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  // ===== PRIVATE METHODS =====

  /**
   * Parse broker position to internal format
   * @private
   */
  _parsePosition(brokerPos) {
    return {
      symbol: brokerPos.symbol || brokerPos.asset_id,
      quantity: brokerPos.qty || brokerPos.quantity || 0,
      currentPrice: brokerPos.current_price || brokerPos.lastPrice || 0,
      costBasis: brokerPos.cost_basis || 0,
      marketValue: (brokerPos.market_value || 0),
      unrealizedPL: (brokerPos.unrealized_pl || 0),
      unrealizedPLPercent: ((brokerPos.unrealized_plpc || 0) * 100),
      sector: brokerPos.sector || null,
      avgCost: brokerPos.avg_fill_price || (brokerPos.cost_basis / Math.max(brokerPos.qty || 1, 1)),
      assetClass: brokerPos.asset_class || 'equity',
      side: brokerPos.side || 'long'
    };
  }

  /**
   * Record position snapshot for history
   * @private
   */
  _recordPositionSnapshot() {
    const snapshot = {
      timestamp: new Date(),
      positions: new Map(this.positions)
    };

    this.positionHistory.push(snapshot);

    // Keep only last 1000 snapshots
    if (this.positionHistory.length > 1000) {
      this.positionHistory.shift();
    }
  }

  /**
   * Handle position update from WebSocket
   * @private
   */
  _handlePositionUpdate(update) {
    if (update.symbol) {
      const position = this.positions.get(update.symbol);

      if (position) {
        // Update fields from WebSocket update
        Object.assign(position, {
          quantity: update.quantity || position.quantity,
          currentPrice: update.currentPrice || position.currentPrice,
          marketValue: update.marketValue || position.marketValue,
          unrealizedPL: update.unrealizedPL || position.unrealizedPL,
          unrealizedPLPercent: update.unrealizedPLPercent || position.unrealizedPLPercent
        });

        this.logger.debug(`Position updated: ${update.symbol}`, position);
      }
    }
  }

  /**
   * Handle account update from WebSocket
   * @private
   */
  _handleAccountUpdate(update) {
    // This may trigger position updates in real accounts
    // In most cases, positions are updated via positionUpdate events
    this.logger.debug('Account update received', update);
  }
}

module.exports = { PositionTracker };
