/**
 * P&L Calculator
 * Calculates realized and unrealized profit/loss
 * @version 1.0.0
 */

/**
 * PLCalculator
 * @class
 * @description Calculates P&L metrics for trading positions
 */
class PLCalculator {
  /**
   * Initialize P&L Calculator
   * @param {Object} config - Configuration
   * @param {Object} config.broker - Broker instance
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.broker = config.broker;
    this.logger = config.logger || console;

    // Trade history for calculating realized P&L
    this.trades = [];
    this.orders = new Map(); // Order ID -> Order details
  }

  /**
   * Calculate unrealized P&L for positions
   * @param {Array} positions - Array of position objects
   * @returns {Object} Unrealized P&L summary
   */
  calculateUnrealizedPL(positions) {
    if (!Array.isArray(positions)) {
      throw new Error('Positions must be an array');
    }

    const details = positions.map(position => ({
      symbol: position.symbol,
      quantity: position.quantity || 0,
      costBasis: position.costBasis || 0,
      marketValue: position.marketValue || 0,
      unrealizedPL: position.unrealizedPL || 0,
      unrealizedPLPercent: position.unrealizedPLPercent || 0,
      avgCost: position.costBasis / Math.max(position.quantity || 1, 1)
    }));

    const summary = {
      totalUnrealizedPL: 0,
      totalMarketValue: 0,
      totalCostBasis: 0,
      gainers: [],
      losers: [],
      neutral: [],
      details
    };

    for (const position of details) {
      summary.totalUnrealizedPL += position.unrealizedPL;
      summary.totalMarketValue += position.marketValue;
      summary.totalCostBasis += position.costBasis;

      if (position.unrealizedPL > 0.01) {
        summary.gainers.push(position);
      } else if (position.unrealizedPL < -0.01) {
        summary.losers.push(position);
      } else {
        summary.neutral.push(position);
      }
    }

    summary.totalUnrealizedPLPercent = summary.totalCostBasis > 0
      ? (summary.totalUnrealizedPL / summary.totalCostBasis) * 100
      : 0;

    summary.gainers.sort((a, b) => b.unrealizedPLPercent - a.unrealizedPLPercent);
    summary.losers.sort((a, b) => a.unrealizedPLPercent - b.unrealizedPLPercent);

    return summary;
  }

  /**
   * Calculate realized P&L from closed positions/trades
   * @param {Array} closedTrades - Array of closed trade/position objects
   * @returns {Object} Realized P&L summary
   */
  calculateRealizedPL(closedTrades) {
    if (!Array.isArray(closedTrades)) {
      throw new Error('Closed trades must be an array');
    }

    const details = closedTrades.map(trade => ({
      symbol: trade.symbol,
      entryPrice: trade.entryPrice || trade.avgFillPrice || 0,
      exitPrice: trade.exitPrice || trade.closingPrice || 0,
      quantity: trade.quantity || 1,
      side: trade.side || 'buy',
      entryDate: new Date(trade.entryDate || trade.filledAt || Date.now()),
      exitDate: new Date(trade.exitDate || trade.closedAt || Date.now()),
      commission: trade.commission || 0,
      fees: trade.fees || 0
    })).map(trade => {
      const priceDiff = trade.side === 'buy'
        ? trade.exitPrice - trade.entryPrice
        : trade.entryPrice - trade.exitPrice;

      const grossPL = priceDiff * trade.quantity;
      const netPL = grossPL - (trade.commission + trade.fees);
      const returnPercent = trade.entryPrice > 0
        ? (netPL / (trade.entryPrice * trade.quantity)) * 100
        : 0;

      return {
        ...trade,
        priceDiff,
        grossPL,
        netPL,
        returnPercent,
        holdingPeriod: Math.floor((trade.exitDate - trade.entryDate) / (1000 * 60 * 60 * 24)) // Days
      };
    });

    const summary = {
      totalRealizedPL: 0,
      totalGrossProfit: 0,
      totalFees: 0,
      winningTrades: [],
      losingTrades: [],
      breakEvenTrades: [],
      details
    };

    for (const trade of details) {
      summary.totalRealizedPL += trade.netPL;
      summary.totalGrossProfit += trade.grossPL;
      summary.totalFees += trade.commission + trade.fees;

      if (trade.netPL > 0.01) {
        summary.winningTrades.push(trade);
      } else if (trade.netPL < -0.01) {
        summary.losingTrades.push(trade);
      } else {
        summary.breakEvenTrades.push(trade);
      }
    }

    // Calculate win rate
    const totalTrades = summary.winningTrades.length + summary.losingTrades.length;
    summary.winRate = totalTrades > 0 ? (summary.winningTrades.length / totalTrades) * 100 : 0;
    summary.winLossRatio = summary.losingTrades.length > 0
      ? (summary.winningTrades.reduce((sum, t) => sum + t.netPL, 0)) /
        Math.abs(summary.losingTrades.reduce((sum, t) => sum + t.netPL, 0))
      : 0;

    // Calculate average trade values
    summary.averageWin = summary.winningTrades.length > 0
      ? summary.winningTrades.reduce((sum, t) => sum + t.netPL, 0) / summary.winningTrades.length
      : 0;

    summary.averageLoss = summary.losingTrades.length > 0
      ? summary.losingTrades.reduce((sum, t) => sum + t.netPL, 0) / summary.losingTrades.length
      : 0;

    return summary;
  }

  /**
   * Calculate total P&L (realized + unrealized)
   * @param {Array} positions - Current positions
   * @param {Array} closedTrades - Closed trades
   * @returns {Object} Total P&L summary
   */
  calculateTotalPL(positions, closedTrades = []) {
    const unrealizedPL = this.calculateUnrealizedPL(positions);
    const realizedPL = closedTrades.length > 0 ? this.calculateRealizedPL(closedTrades) : {
      totalRealizedPL: 0,
      totalGrossProfit: 0,
      totalFees: 0,
      winningTrades: [],
      losingTrades: [],
      breakEvenTrades: []
    };

    return {
      unrealizedPL,
      realizedPL,
      summary: {
        totalUnrealizedPL: unrealizedPL.totalUnrealizedPL,
        totalRealizedPL: realizedPL.totalRealizedPL,
        totalNetPL: unrealizedPL.totalUnrealizedPL + realizedPL.totalRealizedPL,
        totalGrossProfit: realizedPL.totalGrossProfit,
        totalFees: realizedPL.totalFees,
        totalValue: unrealizedPL.totalMarketValue
      }
    };
  }

  /**
   * Calculate drawdown metrics
   * @param {Array} accountHistory - Array of {date, equity, value} snapshots
   * @returns {Object} Drawdown metrics
   */
  calculateDrawdown(accountHistory) {
    if (!Array.isArray(accountHistory) || accountHistory.length === 0) {
      return {
        currentDrawdown: 0,
        maxDrawdown: 0,
        drawdownDuration: 0,
        drawdownStartDate: null,
        drawdownEndDate: null
      };
    }

    let maxValue = accountHistory[0].equity || accountHistory[0].value || 0;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let drawdownStartIndex = 0;
    let maxDrawdownStartIndex = 0;
    let maxDrawdownEndIndex = 0;

    for (let i = 0; i < accountHistory.length; i++) {
      const currentValue = accountHistory[i].equity || accountHistory[i].value || 0;

      if (currentValue > maxValue) {
        maxValue = currentValue;
        // Check if previous drawdown was max
        const drawdownPercent = maxValue > 0 ? ((maxValue - currentValue) / maxValue) * 100 : 0;
        if (drawdownPercent > maxDrawdown) {
          maxDrawdown = drawdownPercent;
          maxDrawdownStartIndex = drawdownStartIndex;
          maxDrawdownEndIndex = i;
        }
      }

      const drawdown = maxValue > 0 ? ((maxValue - currentValue) / maxValue) * 100 : 0;
      currentDrawdown = Math.max(currentDrawdown, drawdown);

      if (drawdown > currentDrawdown) {
        drawdownStartIndex = i;
      }
    }

    return {
      currentDrawdown: ((maxValue - (accountHistory[accountHistory.length - 1].equity || accountHistory[accountHistory.length - 1].value || 0)) / maxValue) * 100,
      maxDrawdown: (maxDrawdown / 100),
      maxDrawdownPercent: maxDrawdown,
      drawdownDuration: maxDrawdownEndIndex - maxDrawdownStartIndex,
      drawdownStartDate: accountHistory[maxDrawdownStartIndex]?.date,
      drawdownEndDate: accountHistory[maxDrawdownEndIndex]?.date,
      startValue: accountHistory[0]?.equity || accountHistory[0]?.value || 0,
      endValue: accountHistory[accountHistory.length - 1]?.equity || accountHistory[accountHistory.length - 1]?.value || 0,
      totalReturn: accountHistory.length > 0
        ? ((accountHistory[accountHistory.length - 1].equity || accountHistory[accountHistory.length - 1].value || 0) -
          (accountHistory[0].equity || accountHistory[0].value || 0)) /
          (accountHistory[0].equity || accountHistory[0].value || 1) * 100
        : 0
    };
  }

  /**
   * Calculate return metrics
   * @param {Array} accountHistory - Array of {date, equity, value} snapshots
   * @returns {Object} Return metrics
   */
  calculateReturns(accountHistory) {
    if (!Array.isArray(accountHistory) || accountHistory.length === 0) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        monthlyReturns: [],
        dailyReturns: []
      };
    }

    const startValue = accountHistory[0]?.equity || accountHistory[0]?.value || 1;
    const endValue = accountHistory[accountHistory.length - 1]?.equity || accountHistory[accountHistory.length - 1]?.value || 0;

    const totalReturn = ((endValue - startValue) / startValue) * 100;

    // Calculate days since start
    const days = accountHistory.length > 1
      ? (new Date(accountHistory[accountHistory.length - 1].date) - new Date(accountHistory[0].date)) / (1000 * 60 * 60 * 24)
      : 1;

    const annualizedReturn = Math.pow(1 + (totalReturn / 100), 365 / Math.max(days, 1)) - 1;

    // Calculate daily returns
    const dailyReturns = [];
    for (let i = 1; i < accountHistory.length; i++) {
      const prevValue = accountHistory[i - 1]?.equity || accountHistory[i - 1]?.value || 1;
      const currentValue = accountHistory[i]?.equity || accountHistory[i]?.value || 0;
      const dailyReturn = ((currentValue - prevValue) / prevValue) * 100;
      dailyReturns.push({
        date: accountHistory[i].date,
        return: dailyReturn
      });
    }

    // Calculate monthly returns (if more than 30 days of data)
    const monthlyReturns = [];
    if (accountHistory.length > 30) {
      let monthStart = 0;
      for (let i = 1; i < accountHistory.length; i++) {
        const daysDiff = (new Date(accountHistory[i].date) - new Date(accountHistory[monthStart].date)) / (1000 * 60 * 60 * 24);

        if (daysDiff >= 30 || i === accountHistory.length - 1) {
          const monthValue = accountHistory[i]?.equity || accountHistory[i]?.value || 0;
          const monthStartValue = accountHistory[monthStart]?.equity || accountHistory[monthStart]?.value || 1;
          const monthReturn = ((monthValue - monthStartValue) / monthStartValue) * 100;

          monthlyReturns.push({
            date: accountHistory[i].date,
            return: monthReturn
          });

          monthStart = i;
        }
      }
    }

    return {
      totalReturn,
      totalReturnPercent: (totalReturn / 100),
      annualizedReturn: annualizedReturn * 100,
      annualizedReturnPercent: annualizedReturn,
      startValue,
      endValue,
      totalGain: endValue - startValue,
      dailyReturns,
      monthlyReturns,
      averageDailyReturn: dailyReturns.length > 0
        ? dailyReturns.reduce((sum, r) => sum + r.return, 0) / dailyReturns.length
        : 0,
      volatility: this._calculateVolatility(dailyReturns)
    };
  }

  /**
   * Calculate Sharpe ratio
   * @param {Array} dailyReturns - Array of daily return percentages
   * @param {number} riskFreeRate - Annual risk-free rate (default: 2%)
   * @returns {number} Sharpe ratio
   */
  calculateSharpeRatio(dailyReturns, riskFreeRate = 0.02) {
    if (!Array.isArray(dailyReturns) || dailyReturns.length < 2) {
      return 0;
    }

    const returns = dailyReturns.map(r => typeof r === 'object' ? r.return : r);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this._calculateVolatility(returns);

    if (volatility === 0) {
      return 0;
    }

    // Annualize daily metrics
    const annualizedReturn = avgReturn * 252; // 252 trading days per year
    const annualizedVolatility = volatility * Math.sqrt(252);

    return (annualizedReturn - (riskFreeRate * 100)) / annualizedVolatility;
  }

  /**
   * Calculate Sortino ratio (downside volatility)
   * @param {Array} dailyReturns - Array of daily return percentages
   * @param {number} riskFreeRate - Annual risk-free rate (default: 2%)
   * @returns {number} Sortino ratio
   */
  calculateSortinoRatio(dailyReturns, riskFreeRate = 0.02) {
    if (!Array.isArray(dailyReturns) || dailyReturns.length < 2) {
      return 0;
    }

    const returns = dailyReturns.map(r => typeof r === 'object' ? r.return : r);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate downside deviation (only negative returns)
    const downReturns = returns.filter(r => r < 0);
    if (downReturns.length === 0) {
      return Number.POSITIVE_INFINITY;
    }

    const downsideVariance = downReturns.reduce((sum, r) => sum + Math.pow(r - Math.min(0, avgReturn), 2), 0) / downReturns.length;
    const downVol = Math.sqrt(downsideVariance);

    if (downVol === 0) {
      return 0;
    }

    const annualizedReturn = avgReturn * 252;
    const annualizedDownVol = downVol * Math.sqrt(252);

    return (annualizedReturn - (riskFreeRate * 100)) / annualizedDownVol;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Calculate volatility from returns
   * @private
   */
  _calculateVolatility(returns) {
    if (!Array.isArray(returns) || returns.length < 2) {
      return 0;
    }

    const data = returns.map(r => typeof r === 'object' ? r.return : r);
    const avg = data.reduce((sum, r) => sum + r, 0) / data.length;
    const variance = data.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / data.length;

    return Math.sqrt(variance);
  }
}

module.exports = { PLCalculator };
