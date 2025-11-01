/**
 * Attribution Analysis Module - Analyze performance drivers and execution quality
 *
 * @module analytics-dashboard/attributionAnalysis
 * @version 1.0.0
 */

import {AttributionMetrics, TradeRecord} from './types';
import * as Logger from 'winston';

/**
 * AttributionAnalysisCalculator - Analyzes performance attribution
 */
export class AttributionAnalysisCalculator {
  private logger: Logger.Logger;

  constructor(logger: Logger.Logger) {
    this.logger = logger;
  }

  /**
   * Calculate attribution metrics
   *
   * @param strategyId - Strategy identifier
   * @param trades - Array of trade records
   * @returns Attribution metrics
   */
  async calculateAttributionMetrics(strategyId: string, trades: TradeRecord[]): Promise<AttributionMetrics> {
    try {
      if (trades.length === 0) {
        return this.getEmptyAttributionMetrics(strategyId);
      }

      // Calculate strategy contribution
      const strategyContribution = this.calculateStrategyContribution(trades);

      // Calculate execution metrics
      const executionMetrics = this.calculateExecutionMetrics(trades);

      // Calculate price improvements
      const priceMetrics = this.calculatePriceMetrics(trades);

      // Calculate timing metrics
      const timingMetrics = this.calculateTimingMetrics(trades);

      const metrics: AttributionMetrics = {
        timestamp: new Date(),
        strategyId,

        // Contribution analysis
        strategyContribution,
        assetClassContribution: {}, // Would need asset class mapping
        factorContribution: {},

        // Execution analysis
        totalSlippage: executionMetrics.totalSlippage,
        averageSlippage: executionMetrics.averageSlippage,
        commissions: executionMetrics.commissions,
        fees: executionMetrics.fees,
        taxImpact: executionMetrics.taxImpact,
        marketImpact: executionMetrics.marketImpact,
        opportunityCost: executionMetrics.opportunityCost,

        // Trade analysis
        averageWinPrice: priceMetrics.averageWinPrice,
        averageLossPrice: priceMetrics.averageLossPrice,
        averageEntryPrice: priceMetrics.averageEntryPrice,
        averageExitPrice: priceMetrics.averageExitPrice,
        priceImprovement: priceMetrics.priceImprovement,

        // Timing analysis
        entryTiming: timingMetrics.entryTiming,
        exitTiming: timingMetrics.exitTiming,
        positionSizing: timingMetrics.positionSizing,
      };

      this.logger.debug(`Calculated attribution metrics for ${strategyId}`, {
        totalSlippage: metrics.totalSlippage,
        priceImprovement: metrics.priceImprovement,
        entryTiming: metrics.entryTiming,
      });

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to calculate attribution metrics for ${strategyId}`, error);
      throw new Error(`Failed to calculate attribution metrics: ${error.message}`);
    }
  }

  /**
   * Calculate strategy contribution to returns
   * @private
   */
  private calculateStrategyContribution(trades: TradeRecord[]): {[strategyId: string]: number} {
    const contribution: {[strategyId: string]: number} = {};

    // Group trades by strategy (strategyId from metadata)
    const strategyIds = new Set(trades.map((t) => t.strategyId));

    for (const strategyId of strategyIds) {
      const strategyTrades = trades.filter((t) => t.strategyId === strategyId);
      const totalProfit = strategyTrades.reduce((sum, t) => sum + t.profit, 0);
      contribution[strategyId] = totalProfit;
    }

    return contribution;
  }

  /**
   * Calculate execution metrics
   * @private
   */
  private calculateExecutionMetrics(trades: TradeRecord[]): {
    totalSlippage: number;
    averageSlippage: number;
    commissions: number;
    fees: number;
    taxImpact: number;
    marketImpact: number;
    opportunityCost: number;
  } {
    const slippages = trades.map((t) => t.slippage || 0);
    const totalSlippage = slippages.reduce((sum, s) => sum + s, 0);
    const averageSlippage = slippages.length > 0 ? totalSlippage / slippages.length : 0;

    const commissions = trades.reduce((sum, t) => sum + (t.commission || 0), 0);

    // Estimate taxes (typically 15-20% of gains)
    const totalProfit = trades.filter((t) => t.profit > 0).reduce((sum, t) => sum + t.profit, 0);
    const taxImpact = totalProfit * 0.15; // Conservative 15% estimate

    // Market impact estimate (larger trades have more impact)
    const marketImpact = trades.filter((t) => t.quantity > 1000).reduce((sum) => sum + 0.001, 0);

    // Opportunity cost (cost of capital)
    const averageHoldTime = trades.reduce((sum, t) => sum + t.duration, 0) / trades.length / (1000 * 60 * 60 * 24); // in days
    const opportunityCost = averageHoldTime * 0.0001; // 0.01% per day cost

    return {
      totalSlippage,
      averageSlippage,
      commissions,
      fees: 0, // Would need fee schedule
      taxImpact,
      marketImpact,
      opportunityCost,
    };
  }

  /**
   * Calculate price metrics
   * @private
   */
  private calculatePriceMetrics(trades: TradeRecord[]): {
    averageWinPrice: number;
    averageLossPrice: number;
    averageEntryPrice: number;
    averageExitPrice: number;
    priceImprovement: number;
  } {
    const winningTrades = trades.filter((t) => t.profit > 0);
    const losingTrades = trades.filter((t) => t.profit <= 0);

    const averageWinPrice = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.exitPrice, 0) / winningTrades.length : 0;

    const averageLossPrice = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.exitPrice, 0) / losingTrades.length : 0;

    const averageEntryPrice = trades.length > 0 ? trades.reduce((sum, t) => sum + t.entryPrice, 0) / trades.length : 0;

    const averageExitPrice = trades.length > 0 ? trades.reduce((sum, t) => sum + t.exitPrice, 0) / trades.length : 0;

    // Price improvement: how much better than entry price
    const priceImprovements = trades.map((t) => {
      if (t.side === 'buy') {
        return t.entryPrice - t.exitPrice; // Positive if sold higher
      } else {
        return t.exitPrice - t.entryPrice; // Positive if bought lower
      }
    });

    const priceImprovement = priceImprovements.length > 0 ? priceImprovements.reduce((sum, p) => sum + p, 0) / priceImprovements.length : 0;

    return {
      averageWinPrice,
      averageLossPrice,
      averageEntryPrice,
      averageExitPrice,
      priceImprovement,
    };
  }

  /**
   * Calculate timing metrics
   * @private
   */
  private calculateTimingMetrics(trades: TradeRecord[]): {entryTiming: number; exitTiming: number; positionSizing: number} {
    // Entry timing: did we enter at local lows?
    // This would require market data comparison
    const entryTiming = this.calculateEntryTiming(trades);

    // Exit timing: did we exit at local highs?
    const exitTiming = this.calculateExitTiming(trades);

    // Position sizing: were positions sized proportionally to confidence?
    const positionSizing = this.calculatePositionSizing(trades);

    return {entryTiming, exitTiming, positionSizing};
  }

  /**
   * Calculate entry timing quality
   * @private
   */
  private calculateEntryTiming(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;

    // Simplified: if we profit, timing was good
    const profitableEntries = trades.filter((t) => t.profit > 0).length;
    return (profitableEntries / trades.length) * 2 - 1; // Scale from -1 to 1
  }

  /**
   * Calculate exit timing quality
   * @private
   */
  private calculateExitTiming(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;

    // Check if we exited near local highs (for long) or lows (for short)
    let goodExits = 0;

    for (const trade of trades) {
      if (trade.side === 'buy' && trade.exitPrice >= trade.entryPrice * 1.02) {
        goodExits++;
      } else if (trade.side === 'sell' && trade.exitPrice <= trade.entryPrice * 0.98) {
        goodExits++;
      }
    }

    return (goodExits / trades.length) * 2 - 1; // Scale from -1 to 1
  }

  /**
   * Calculate position sizing quality
   * @private
   */
  private calculatePositionSizing(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;

    // Larger positions should have higher win rate
    const largePositions = trades.filter((t) => t.quantity > 100);
    const smallPositions = trades.filter((t) => t.quantity <= 100);

    if (largePositions.length === 0 || smallPositions.length === 0) return 0;

    const largeWinRate = largePositions.filter((t) => t.profit > 0).length / largePositions.length;
    const smallWinRate = smallPositions.filter((t) => t.profit > 0).length / smallPositions.length;

    // Good sizing = larger positions have better win rate
    return Math.min(1, Math.max(-1, largeWinRate - smallWinRate));
  }

  /**
   * Get empty attribution metrics
   * @private
   */
  private getEmptyAttributionMetrics(strategyId: string): AttributionMetrics {
    return {
      timestamp: new Date(),
      strategyId,
      strategyContribution: {},
      assetClassContribution: {},
      factorContribution: {},
      totalSlippage: 0,
      averageSlippage: 0,
      commissions: 0,
      fees: 0,
      taxImpact: 0,
      marketImpact: 0,
      opportunityCost: 0,
      averageWinPrice: 0,
      averageLossPrice: 0,
      averageEntryPrice: 0,
      averageExitPrice: 0,
      priceImprovement: 0,
      entryTiming: 0,
      exitTiming: 0,
      positionSizing: 0,
    };
  }
}

export default AttributionAnalysisCalculator;
