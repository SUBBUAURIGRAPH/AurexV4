/**
 * Data Aggregation Layer - Collect and aggregate data from multiple sources
 *
 * @module analytics-dashboard/dataAggregation
 * @version 1.0.0
 */

import {TradeRecord, PerformanceMetrics, PortfolioMetrics} from './types';
import * as Logger from 'winston';

/**
 * DataAggregator - Collects and aggregates analytics data
 */
export class DataAggregator {
  private logger: Logger.Logger;
  private trades: TradeRecord[] = [];
  private portfolioData: Map<string, any> = new Map();
  private metricsCache: Map<string, {data: any; timestamp: number}> = new Map();
  private cacheTimeout: number = 300000; // 5 minutes
  private updateInterval: number = 60000; // 1 minute

  constructor(logger: Logger.Logger) {
    this.logger = logger;
  }

  /**
   * Initialize data aggregator
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing data aggregator');
      // Would connect to databases, message queues, etc.
      return;
    } catch (error) {
      this.logger.error('Failed to initialize data aggregator', error);
      throw error;
    }
  }

  /**
   * Add trade records from exchange
   *
   * @param trades - Array of trade records
   */
  async addTrades(trades: TradeRecord[]): Promise<void> {
    try {
      this.trades = [...this.trades, ...trades];

      // Keep only last 10000 trades in memory for performance
      if (this.trades.length > 10000) {
        this.trades = this.trades.slice(-10000);
      }

      this.invalidateCache();
      this.logger.debug(`Added ${trades.length} trades, total: ${this.trades.length}`);
    } catch (error) {
      this.logger.error('Failed to add trades', error);
      throw error;
    }
  }

  /**
   * Update portfolio data
   *
   * @param portfolioId - Portfolio identifier
   * @param data - Portfolio data
   */
  async updatePortfolioData(portfolioId: string, data: any): Promise<void> {
    try {
      this.portfolioData.set(portfolioId, {
        ...data,
        lastUpdated: new Date(),
      });

      this.invalidateCache();
      this.logger.debug(`Updated portfolio data for ${portfolioId}`);
    } catch (error) {
      this.logger.error(`Failed to update portfolio data for ${portfolioId}`, error);
      throw error;
    }
  }

  /**
   * Get aggregated trades for strategy
   *
   * @param strategyId - Strategy identifier
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @returns Filtered trade records
   */
  getTrades(strategyId: string, startDate: Date, endDate: Date): TradeRecord[] {
    return this.trades.filter((t) => t.strategyId === strategyId && t.timestamp >= startDate && t.timestamp <= endDate);
  }

  /**
   * Get all trades
   */
  getAllTrades(): TradeRecord[] {
    return this.trades;
  }

  /**
   * Get trades by symbol
   */
  getTradesBySymbol(symbol: string): TradeRecord[] {
    return this.trades.filter((t) => t.symbol === symbol);
  }

  /**
   * Get trades by date range
   */
  getTradesByDateRange(startDate: Date, endDate: Date): TradeRecord[] {
    return this.trades.filter((t) => t.timestamp >= startDate && t.timestamp <= endDate);
  }

  /**
   * Calculate rolling metrics
   *
   * @param strategyId - Strategy identifier
   * @param window - Rolling window size (in trades)
   * @returns Array of rolling metrics
   */
  calculateRollingMetrics(strategyId: string, window: number = 20): Array<{index: number; return: number; sharpe: number}> {
    const trades = this.trades.filter((t) => t.strategyId === strategyId);
    const results: Array<{index: number; return: number; sharpe: number}> = [];

    for (let i = window; i < trades.length; i++) {
      const windowTrades = trades.slice(i - window, i);
      const totalReturn = windowTrades.reduce((sum, t) => sum + t.profit, 0);
      const returns = windowTrades.map((t) => t.profitPercent / 100);

      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);

      const sharpe = stdDev !== 0 ? (mean * 252) / (stdDev * Math.sqrt(252)) : 0;

      results.push({index: i, return: totalReturn, sharpe});
    }

    return results;
  }

  /**
   * Get daily aggregate returns
   *
   * @returns Map of dates to daily returns
   */
  getDailyAggregateReturns(): Map<string, number> {
    const dailyReturns = new Map<string, number>();

    this.trades.forEach((trade) => {
      const dateStr = trade.timestamp.toISOString().split('T')[0];
      const current = dailyReturns.get(dateStr) || 0;
      dailyReturns.set(dateStr, current + trade.profitPercent / 100);
    });

    return dailyReturns;
  }

  /**
   * Get hourly aggregate returns
   *
   * @returns Map of hours to returns
   */
  getHourlyAggregateReturns(): Map<string, number> {
    const hourlyReturns = new Map<string, number>();

    this.trades.forEach((trade) => {
      const hourStr = trade.timestamp.toISOString().split(':')[0];
      const current = hourlyReturns.get(hourStr) || 0;
      hourlyReturns.set(hourStr, current + trade.profitPercent / 100);
    });

    return hourlyReturns;
  }

  /**
   * Get portfolio allocation
   *
   * @returns Allocation by asset/strategy
   */
  getPortfolioAllocation(): {assets: {[key: string]: number}; strategies: {[key: string]: number}} {
    const assetAllocation: {[key: string]: number} = {};
    const strategyAllocation: {[key: string]: number} = {};

    this.trades.forEach((trade) => {
      // Asset allocation
      const assetKey = trade.symbol;
      assetAllocation[assetKey] = (assetAllocation[assetKey] || 0) + trade.quantity * trade.entryPrice;

      // Strategy allocation
      const strategyKey = trade.strategyId;
      strategyAllocation[strategyKey] = (strategyAllocation[strategyKey] || 0) + trade.profit;
    });

    return {assets: assetAllocation, strategies: strategyAllocation};
  }

  /**
   * Calculate correlation matrix
   *
   * @returns Correlation matrix for assets
   */
  calculateCorrelationMatrix(): {assets: string[]; matrix: number[][]} {
    const symbols = Array.from(new Set(this.trades.map((t) => t.symbol)));

    const returnsMap = new Map<string, number[]>();
    symbols.forEach((symbol) => {
      const symbolTrades = this.trades.filter((t) => t.symbol === symbol);
      const returns = symbolTrades.map((t) => t.profitPercent / 100);
      returnsMap.set(symbol, returns);
    });

    const matrix: number[][] = [];

    for (let i = 0; i < symbols.length; i++) {
      const row: number[] = [];
      const returns1 = returnsMap.get(symbols[i]) || [];

      for (let j = 0; j < symbols.length; j++) {
        if (i === j) {
          row.push(1.0);
        } else {
          const returns2 = returnsMap.get(symbols[j]) || [];
          const correlation = this.calculateCorrelation(returns1, returns2);
          row.push(correlation);
        }
      }
      matrix.push(row);
    }

    return {assets: symbols, matrix};
  }

  /**
   * Get portfolio metrics aggregate
   *
   * @returns Aggregated portfolio metrics
   */
  getPortfolioMetricsAggregate(): PortfolioMetrics {
    const allocation = this.getPortfolioAllocation();
    const correlation = this.calculateCorrelationMatrix();

    const totalValue = Object.values(allocation.assets).reduce((sum, val) => sum + val, 0);
    const netReturn = Object.values(allocation.strategies).reduce((sum, val) => sum + val, 0);

    // Calculate diversification ratio
    const allocationArray = Object.values(allocation.assets);
    const weights = allocationArray.map((v) => v / totalValue || 0);
    const herfindahlIndex = weights.reduce((sum, w) => sum + w * w, 0);

    return {
      timestamp: new Date(),
      allocation: allocation.assets,
      sectorAllocation: {},
      strategyAllocation: allocation.strategies,
      totalValue,
      netReturn,
      portfolioSharpe: 0, // Would calculate properly
      portfolioVolatility: 0,
      herfindahlIndex,
      diversificationRatio: 1 / Math.sqrt(herfindahlIndex),
      correlationWithBenchmark: 0.85,
      portfolioVaR: 0,
      componentVaR: {},
      marginalVaR: {},
      returnContribution: {},
      riskContribution: {},
    };
  }

  /**
   * Get recent trades
   *
   * @param limit - Number of trades to return
   * @returns Recent trade records
   */
  getRecentTrades(limit: number = 50): TradeRecord[] {
    return this.trades.slice(-limit);
  }

  /**
   * Get trade statistics
   *
   * @returns Summary statistics for trades
   */
  getTradeStatistics(): {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageWin: number;
    averageLoss: number;
    totalProfit: number;
    profitFactor: number;
    winRate: number;
  } {
    const winningTrades = this.trades.filter((t) => t.profit > 0);
    const losingTrades = this.trades.filter((t) => t.profit <= 0);

    const totalProfit = this.trades.reduce((sum, t) => sum + t.profit, 0);
    const averageWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length : 0;

    const totalWins = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = totalLosses !== 0 ? totalWins / totalLosses : 0;

    return {
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      averageWin,
      averageLoss,
      totalProfit,
      profitFactor,
      winRate: this.trades.length > 0 ? winningTrades.length / this.trades.length : 0,
    };
  }

  /**
   * Calculate correlation between two return series
   * @private
   */
  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    const minLen = Math.min(returns1.length, returns2.length);
    if (minLen < 2) return 0;

    const r1 = returns1.slice(0, minLen);
    const r2 = returns2.slice(0, minLen);

    const mean1 = r1.reduce((sum, r) => sum + r, 0) / minLen;
    const mean2 = r2.reduce((sum, r) => sum + r, 0) / minLen;

    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < minLen; i++) {
      const d1 = r1[i] - mean1;
      const d2 = r2[i] - mean2;
      covariance += d1 * d2;
      variance1 += d1 * d1;
      variance2 += d2 * d2;
    }

    const stdDev1 = Math.sqrt(variance1 / minLen);
    const stdDev2 = Math.sqrt(variance2 / minLen);

    if (stdDev1 === 0 || stdDev2 === 0) return 0;

    return (covariance / minLen) / (stdDev1 * stdDev2);
  }

  /**
   * Invalidate cache
   * @private
   */
  private invalidateCache(): void {
    this.metricsCache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.metricsCache.size;
  }

  /**
   * Get data status
   */
  getStatus(): {trades: number; portfolios: number; cacheSize: number; timestamp: Date} {
    return {
      trades: this.trades.length,
      portfolios: this.portfolioData.size,
      cacheSize: this.metricsCache.size,
      timestamp: new Date(),
    };
  }

  /**
   * Clear old data
   */
  clearOldData(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const originalLength = this.trades.length;
    this.trades = this.trades.filter((t) => t.timestamp > cutoffDate);
    const removedCount = originalLength - this.trades.length;

    this.logger.info(`Cleared ${removedCount} old trades`);
    return removedCount;
  }
}

export default DataAggregator;
