/**
 * Trading Performance Analyzer
 * Calculates comprehensive trading performance metrics
 * @version 1.0.0
 */

import {
  PerformanceMetrics,
  PerformanceSummary,
  TradeAnalytics,
  TradeStatus,
  TradeStatistics
} from './types';

export class PerformanceAnalyzer {
  /**
   * Calculate complete performance metrics
   */
  static calculateMetrics(
    portfolioValue: number,
    previousValue: number,
    cumulativeReturn: number,
    trades: TradeAnalytics[],
    lookbackData: PerformanceMetrics[],
    riskFreeRate: number = 0.02
  ): Partial<PerformanceMetrics> {
    const dailyReturn = this.calculateDailyReturn(portfolioValue, previousValue);
    const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);
    const volatility = this.calculateVolatility(lookbackData);

    return {
      portfolioValue,
      dailyReturn,
      cumulativeReturn,
      priceChange: portfolioValue - previousValue,
      dailyVolatility: volatility,
      sharpeRatio: this.calculateSharpeRatio(
        dailyReturn,
        volatility,
        riskFreeRate
      ),
      sortinoRatio: this.calculateSortinoRatio(
        dailyReturn,
        lookbackData,
        riskFreeRate
      ),
      calmarRatio: this.calculateCalmarRatio(
        cumulativeReturn,
        this.calculateMaxDrawdown(lookbackData)
      ),
      maxDrawdown: this.calculateMaxDrawdown(lookbackData),
      winRate: this.calculateWinRate(closedTrades),
      profitFactor: this.calculateProfitFactor(closedTrades),
      totalTrades: closedTrades.length,
      winningTrades: closedTrades.filter(t => t.netProfit! > 0).length,
      losingTrades: closedTrades.filter(t => t.netProfit! <= 0).length,
      avgWin: this.calculateAverageWin(closedTrades),
      avgLoss: this.calculateAverageLoss(closedTrades),
      largestWin: this.calculateLargestWin(closedTrades),
      largestLoss: this.calculateLargestLoss(closedTrades),
      recoveryFactor: this.calculateRecoveryFactor(
        closedTrades,
        this.calculateMaxDrawdown(lookbackData)
      ),
      expectancy: this.calculateExpectancy(closedTrades),
      payoffRatio: this.calculatePayoffRatio(closedTrades),
      profitLoss: closedTrades.reduce((sum, t) => sum + (t.netProfit || 0), 0)
    };
  }

  /**
   * Calculate daily return percentage
   */
  static calculateDailyReturn(current: number, previous: number): number {
    if (previous === 0) return 0;
    return (current - previous) / previous;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  static calculateVolatility(data: PerformanceMetrics[], periods = 20): number {
    if (data.length < 2) return 0;

    const recentData = data.slice(-periods);
    const returns = recentData.map((d, i) => {
      if (i === 0) return 0;
      return this.calculateDailyReturn(
        d.portfolioValue,
        recentData[i - 1].portfolioValue
      );
    });

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate Sharpe Ratio
   * (Return - Risk-Free Rate) / Volatility
   */
  static calculateSharpeRatio(
    return_: number,
    volatility: number,
    riskFreeRate: number = 0.02
  ): number {
    if (volatility === 0) return 0;
    const annualizedReturn = return_ * 252; // 252 trading days
    const annualizedVolatility = volatility * Math.sqrt(252);
    return (annualizedReturn - riskFreeRate) / annualizedVolatility;
  }

  /**
   * Calculate Sortino Ratio
   * Only penalizes downside volatility
   */
  static calculateSortinoRatio(
    return_: number,
    data: PerformanceMetrics[],
    riskFreeRate: number = 0.02
  ): number {
    if (data.length < 2) return 0;

    const returns = data.map((d, i) => {
      if (i === 0) return 0;
      return this.calculateDailyReturn(d.portfolioValue, data[i - 1].portfolioValue);
    });

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Only calculate downside volatility
    const downsideVariance = returns.reduce((sum, r) => {
      const downside = Math.min(r - mean, 0);
      return sum + Math.pow(downside, 2);
    }, 0) / returns.length;

    const downsideVolatility = Math.sqrt(downsideVariance);

    if (downsideVolatility === 0) return 0;
    const annualizedReturn = return_ * 252;
    return (annualizedReturn - riskFreeRate) / downsideVolatility;
  }

  /**
   * Calculate Calmar Ratio
   * Return / Max Drawdown
   */
  static calculateCalmarRatio(return_: number, maxDrawdown: number): number {
    if (maxDrawdown === 0) return 0;
    return return_ / Math.abs(maxDrawdown);
  }

  /**
   * Calculate maximum drawdown
   */
  static calculateMaxDrawdown(data: PerformanceMetrics[]): number {
    if (data.length === 0) return 0;

    let maxValue = data[0].portfolioValue;
    let maxDrawdown = 0;

    for (const point of data) {
      if (point.portfolioValue > maxValue) {
        maxValue = point.portfolioValue;
      }
      const drawdown = (point.portfolioValue - maxValue) / maxValue;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate win rate (% of winning trades)
   */
  static calculateWinRate(trades: TradeAnalytics[]): number {
    if (trades.length === 0) return 0;
    const winningTrades = trades.filter(t => t.netProfit! > 0).length;
    return winningTrades / trades.length;
  }

  /**
   * Calculate profit factor (gross wins / gross losses)
   */
  static calculateProfitFactor(trades: TradeAnalytics[]): number {
    const wins = trades
      .filter(t => t.netProfit! > 0)
      .reduce((sum, t) => sum + t.netProfit!, 0);

    const losses = Math.abs(
      trades
        .filter(t => t.netProfit! <= 0)
        .reduce((sum, t) => sum + t.netProfit!, 0)
    );

    if (losses === 0) return wins > 0 ? 999 : 0;
    return wins / losses;
  }

  /**
   * Calculate average winning trade
   */
  static calculateAverageWin(trades: TradeAnalytics[]): number {
    const winningTrades = trades.filter(t => t.netProfit! > 0);
    if (winningTrades.length === 0) return 0;
    const totalWins = winningTrades.reduce((sum, t) => sum + t.netProfit!, 0);
    return totalWins / winningTrades.length;
  }

  /**
   * Calculate average losing trade
   */
  static calculateAverageLoss(trades: TradeAnalytics[]): number {
    const losingTrades = trades.filter(t => t.netProfit! <= 0);
    if (losingTrades.length === 0) return 0;
    const totalLosses = losingTrades.reduce((sum, t) => sum + t.netProfit!, 0);
    return totalLosses / losingTrades.length;
  }

  /**
   * Calculate largest winning trade
   */
  static calculateLargestWin(trades: TradeAnalytics[]): number {
    const wins = trades
      .filter(t => t.netProfit! > 0)
      .map(t => t.netProfit!);
    return wins.length > 0 ? Math.max(...wins) : 0;
  }

  /**
   * Calculate largest losing trade
   */
  static calculateLargestLoss(trades: TradeAnalytics[]): number {
    const losses = trades
      .filter(t => t.netProfit! <= 0)
      .map(t => Math.abs(t.netProfit!));
    return losses.length > 0 ? Math.max(...losses) : 0;
  }

  /**
   * Calculate recovery factor
   * Total Profit / Max Drawdown
   */
  static calculateRecoveryFactor(
    trades: TradeAnalytics[],
    maxDrawdown: number
  ): number {
    const totalProfit = trades.reduce((sum, t) => sum + (t.netProfit || 0), 0);
    if (maxDrawdown === 0) return 0;
    return totalProfit / Math.abs(maxDrawdown);
  }

  /**
   * Calculate expectancy
   * Average profit per trade
   */
  static calculateExpectancy(trades: TradeAnalytics[]): number {
    if (trades.length === 0) return 0;
    const totalProfit = trades.reduce((sum, t) => sum + (t.netProfit || 0), 0);
    return totalProfit / trades.length;
  }

  /**
   * Calculate payoff ratio
   * Average Win / Average Loss
   */
  static calculatePayoffRatio(trades: TradeAnalytics[]): number {
    const avgWin = this.calculateAverageWin(trades);
    const avgLoss = this.calculateAverageLoss(trades);

    if (avgLoss === 0) return avgWin > 0 ? 999 : 0;
    return avgWin / Math.abs(avgLoss);
  }

  /**
   * Get performance summary over different periods
   */
  static getPerformanceSummary(
    data: PerformanceMetrics[],
    trades: TradeAnalytics[]
  ): Partial<PerformanceSummary> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyData = data.filter(d => d.timestamp > new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const weeklyData = data.filter(d => d.timestamp > oneWeekAgo);
    const monthlyData = data.filter(d => d.timestamp > oneMonthAgo);

    return {
      current: data[data.length - 1],
      daily: dailyData,
      weekly: weeklyData,
      monthly: monthlyData
    };
  }

  /**
   * Identify consecutive wins/losses
   */
  static getConsecutiveStats(trades: TradeAnalytics[]): {
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    currentStreak: number;
    currentStreakType: 'wins' | 'losses' | 'none';
  } {
    let maxWins = 0,
      maxLosses = 0;
    let currentWins = 0,
      currentLosses = 0;
    let currentStreak = 0,
      currentStreakType = 'none' as 'wins' | 'losses' | 'none';

    for (const trade of trades) {
      if (trade.netProfit! > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
        currentStreak = currentWins;
        currentStreakType = 'wins';
      } else {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
        currentStreak = currentLosses;
        currentStreakType = 'losses';
      }
    }

    return {
      maxConsecutiveWins: maxWins,
      maxConsecutiveLosses: maxLosses,
      currentStreak,
      currentStreakType:
        trades.length === 0
          ? 'none'
          : currentStreakType as 'wins' | 'losses' | 'none'
    };
  }
}
