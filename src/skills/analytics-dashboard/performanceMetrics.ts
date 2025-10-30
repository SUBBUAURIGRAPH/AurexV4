/**
 * Performance Metrics Module - Calculate comprehensive performance metrics
 *
 * @module analytics-dashboard/performanceMetrics
 * @version 1.0.0
 */

import {PerformanceMetrics, TimePeriod, TradeRecord} from './types';
import * as Logger from 'winston';

/**
 * PerformanceMetricsCalculator - Calculates 20+ performance metrics
 */
export class PerformanceMetricsCalculator {
  private logger: Logger.Logger;

  constructor(logger: Logger.Logger) {
    this.logger = logger;
  }

  /**
   * Calculate comprehensive performance metrics
   *
   * @param strategyId - Strategy identifier
   * @param trades - Array of trade records
   * @param startDate - Analysis start date
   * @param endDate - Analysis end date
   * @param period - Time period type
   * @returns Complete performance metrics
   */
  async calculateMetrics(
    strategyId: string,
    trades: TradeRecord[],
    startDate: Date,
    endDate: Date,
    period: TimePeriod
  ): Promise<PerformanceMetrics> {
    try {
      if (trades.length === 0) {
        return this.getEmptyMetrics(strategyId, period);
      }

      // Filter trades within date range
      const filteredTrades = trades.filter((t) => t.timestamp >= startDate && t.timestamp <= endDate);

      if (filteredTrades.length === 0) {
        return this.getEmptyMetrics(strategyId, period);
      }

      // Calculate returns
      const totalProfit = filteredTrades.reduce((sum, t) => sum + t.profit, 0);
      const returns = this.calculateReturns(filteredTrades, startDate, endDate);

      // Calculate win metrics
      const winningTrades = filteredTrades.filter((t) => t.profit > 0);
      const losingTrades = filteredTrades.filter((t) => t.profit <= 0);

      const winRate = filteredTrades.length > 0 ? winningTrades.length / filteredTrades.length : 0;
      const averageWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length : 0;
      const averageLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length : 0;

      // Calculate Sharpe ratio
      const sharpeRatio = this.calculateSharpe(returns.dailyReturns);

      // Calculate Sortino ratio
      const sortinoRatio = this.calculateSortino(returns.dailyReturns);

      // Calculate Calmar ratio
      const drawdownInfo = this.calculateDrawdown(filteredTrades);
      const calphaRatio = drawdownInfo.maxDrawdown !== 0 ? returns.annualizedReturn / Math.abs(drawdownInfo.maxDrawdown) : 0;

      // Calculate trade statistics
      const avgTradeTime = this.calculateAverageTradeTime(filteredTrades);
      const durations = filteredTrades.map((t) => t.duration).sort((a, b) => a - b);

      // Calculate consecutive metrics
      const consecutiveWins = this.calculateConsecutiveWins(filteredTrades);
      const consecutiveLosses = this.calculateConsecutiveLosses(filteredTrades);

      // Profit factor
      const totalWins = winningTrades.reduce((sum, t) => sum + t.profit, 0);
      const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
      const profitFactor = totalLosses !== 0 ? totalWins / totalLosses : 0;

      // Expectancy
      const expectancy = (winRate * averageWin) + ((1 - winRate) * averageLoss);

      // Payoff ratio
      const payoffRatio = averageLoss !== 0 ? Math.abs(averageWin / averageLoss) : 0;

      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        strategyId,
        period,

        // Return metrics
        totalReturn: returns.totalReturn,
        annualizedReturn: returns.annualizedReturn,
        monthlyReturns: returns.monthlyReturns,
        dailyReturns: returns.dailyReturns,

        // Risk-adjusted metrics
        sharpeRatio,
        sortinoRatio,
        calphaRatio,
        informationRatio: 0, // Would need benchmark

        // Drawdown metrics
        maxDrawdown: drawdownInfo.maxDrawdown,
        currentDrawdown: drawdownInfo.currentDrawdown,
        drawdownDuration: drawdownInfo.duration,
        recoveryTime: drawdownInfo.recoveryTime,

        // Win metrics
        winRate,
        profitFactor,
        expectancy,
        payoffRatio,

        // Trade statistics
        totalTrades: filteredTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        averageWin,
        averageLoss,
        largestWin: Math.max(...filteredTrades.map((t) => t.profit)),
        largestLoss: Math.min(...filteredTrades.map((t) => t.profit)),

        // Consecutive metrics
        maxConsecutiveWins: consecutiveWins,
        maxConsecutiveLosses: consecutiveLosses,

        // Time metrics
        averageTradeTime: avgTradeTime,
        shortestTradeTime: durations[0] || 0,
        longestTradeTime: durations[durations.length - 1] || 0,
      };

      this.logger.debug(`Calculated performance metrics for ${strategyId}`, {
        totalReturn: metrics.totalReturn,
        sharpeRatio: metrics.sharpeRatio,
        trades: metrics.totalTrades,
      });

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to calculate performance metrics for ${strategyId}`, error);
      throw new Error(`Failed to calculate metrics: ${error.message}`);
    }
  }

  /**
   * Calculate Sharpe ratio
   * @private
   */
  private calculateSharpe(dailyReturns: number[], riskFreeRate: number = 0): number {
    if (dailyReturns.length < 2) return 0;

    const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualize (252 trading days)
    const annualizedReturn = mean * 252;
    const annualizedVolatility = stdDev * Math.sqrt(252);

    return (annualizedReturn - riskFreeRate) / annualizedVolatility;
  }

  /**
   * Calculate Sortino ratio (penalizes only downside)
   * @private
   */
  private calculateSortino(dailyReturns: number[], riskFreeRate: number = 0): number {
    if (dailyReturns.length < 2) return 0;

    const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

    // Only negative returns for downside deviation
    const negativeReturns = dailyReturns.filter((r) => r < 0);
    if (negativeReturns.length === 0) return 0;

    const variance = negativeReturns.reduce((sum, r) => sum + Math.pow(r - 0, 2), 0) / dailyReturns.length;
    const downDeviation = Math.sqrt(variance);

    if (downDeviation === 0) return 0;

    const annualizedReturn = mean * 252;
    const annualizedDownDeviation = downDeviation * Math.sqrt(252);

    return (annualizedReturn - riskFreeRate) / annualizedDownDeviation;
  }

  /**
   * Calculate returns
   * @private
   */
  private calculateReturns(
    trades: TradeRecord[],
    startDate: Date,
    endDate: Date
  ): {totalReturn: number; annualizedReturn: number; monthlyReturns: number[]; dailyReturns: number[]} {
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
    const totalCapital = 10000; // Default starting capital
    const totalReturn = totalProfit / totalCapital;

    // Annualize
    const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const years = days / 365;
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;

    // Calculate daily returns
    const dailyMap = new Map<string, number>();
    trades.forEach((t) => {
      const dateStr = t.timestamp.toISOString().split('T')[0];
      const current = dailyMap.get(dateStr) || 0;
      dailyMap.set(dateStr, current + t.profitPercent / 100);
    });

    const dailyReturns = Array.from(dailyMap.values());

    // Calculate monthly returns
    const monthlyMap = new Map<string, number>();
    trades.forEach((t) => {
      const monthStr = t.timestamp.toISOString().slice(0, 7);
      const current = monthlyMap.get(monthStr) || 0;
      monthlyMap.set(monthStr, current + t.profitPercent / 100);
    });

    const monthlyReturns = Array.from(monthlyMap.values());

    return {totalReturn, annualizedReturn, monthlyReturns, dailyReturns};
  }

  /**
   * Calculate drawdown metrics
   * @private
   */
  private calculateDrawdown(trades: TradeRecord[]): {maxDrawdown: number; currentDrawdown: number; duration: number; recoveryTime: number} {
    let runningProfit = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let maxDrawdownDuration = 0;
    let drawdownStart = 0;
    let maxRecoveryTime = 0;

    trades.forEach((trade, index) => {
      runningProfit += trade.profit;

      if (runningProfit > peak) {
        peak = runningProfit;
        if (drawdownStart > 0) {
          maxRecoveryTime = Math.max(maxRecoveryTime, index - drawdownStart);
        }
        drawdownStart = 0;
      } else if (runningProfit < peak) {
        if (drawdownStart === 0) {
          drawdownStart = index;
        }
        const dd = (peak - runningProfit) / peak;
        if (dd > maxDrawdown) {
          maxDrawdown = dd;
          maxDrawdownDuration = index - drawdownStart;
        }
        currentDrawdown = dd;
      }
    });

    return {maxDrawdown, currentDrawdown, duration: maxDrawdownDuration, recoveryTime: maxRecoveryTime};
  }

  /**
   * Calculate consecutive wins
   * @private
   */
  private calculateConsecutiveWins(trades: TradeRecord[]): number {
    let maxConsecutive = 0;
    let current = 0;

    trades.forEach((t) => {
      if (t.profit > 0) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    });

    return maxConsecutive;
  }

  /**
   * Calculate consecutive losses
   * @private
   */
  private calculateConsecutiveLosses(trades: TradeRecord[]): number {
    let maxConsecutive = 0;
    let current = 0;

    trades.forEach((t) => {
      if (t.profit <= 0) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    });

    return maxConsecutive;
  }

  /**
   * Calculate average trade time
   * @private
   */
  private calculateAverageTradeTime(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;
    return trades.reduce((sum, t) => sum + t.duration, 0) / trades.length;
  }

  /**
   * Get empty metrics (for no trades)
   * @private
   */
  private getEmptyMetrics(strategyId: string, period: TimePeriod): PerformanceMetrics {
    return {
      timestamp: new Date(),
      strategyId,
      period,
      totalReturn: 0,
      annualizedReturn: 0,
      monthlyReturns: [],
      dailyReturns: [],
      sharpeRatio: 0,
      sortinoRatio: 0,
      calphaRatio: 0,
      informationRatio: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      drawdownDuration: 0,
      recoveryTime: 0,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      payoffRatio: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      averageTradeTime: 0,
      shortestTradeTime: 0,
      longestTradeTime: 0,
    };
  }
}

export default PerformanceMetricsCalculator;
