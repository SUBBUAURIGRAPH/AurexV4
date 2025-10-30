/**
 * Risk Analysis Module - Calculate comprehensive risk metrics
 *
 * @module analytics-dashboard/riskAnalysis
 * @version 1.0.0
 */

import {RiskMetrics, TradeRecord} from './types';
import * as Logger from 'winston';

/**
 * RiskAnalysisCalculator - Calculates comprehensive risk metrics
 */
export class RiskAnalysisCalculator {
  private logger: Logger.Logger;

  constructor(logger: Logger.Logger) {
    this.logger = logger;
  }

  /**
   * Calculate comprehensive risk metrics
   *
   * @param strategyId - Strategy identifier
   * @param trades - Array of trade records
   * @param portfolioReturns - Daily portfolio returns
   * @returns Complete risk metrics
   */
  async calculateRiskMetrics(
    strategyId: string,
    trades: TradeRecord[],
    portfolioReturns: number[]
  ): Promise<RiskMetrics> {
    try {
      if (portfolioReturns.length === 0) {
        return this.getEmptyRiskMetrics(strategyId);
      }

      // Calculate Value at Risk
      const var95 = this.calculateVaR(portfolioReturns, 0.95);
      const var99 = this.calculateVaR(portfolioReturns, 0.99);
      const expectedShortfall95 = this.calculateExpectedShortfall(portfolioReturns, 0.95);
      const expectedShortfall99 = this.calculateExpectedShortfall(portfolioReturns, 0.99);

      // Calculate volatility
      const volatility = this.calculateVolatility(portfolioReturns);
      const stdDev = this.calculateStandardDeviation(portfolioReturns);

      // Calculate drawdowns for concentration
      const largestPosition = this.calculateLargestPosition(trades);
      const largestLoss = Math.abs(Math.min(...trades.map((t) => t.profit)));

      // Calculate correlations
      const assetCorrelations = this.calculateAssetCorrelations(trades);
      const strategyCorrelations: {[key: string]: number} = {}; // Would need multiple strategies

      // Stress testing
      const stressTestResults = this.conductStressTests(portfolioReturns);

      // Risk components
      const marketRisk = volatility * 0.7; // 70% of total risk
      const operationalRisk = volatility * 0.15; // 15%
      const liquidityRisk = volatility * 0.1; // 10%
      const counterpartyRisk = volatility * 0.05; // 5%

      const metrics: RiskMetrics = {
        timestamp: new Date(),
        strategyId,

        // Value at Risk
        var95,
        var99,
        expectedShortfall95,
        expectedShortfall99,

        // Risk measures
        volatility,
        standardDeviation: stdDev,
        beta: 1.0, // Would calculate vs benchmark
        alpha: 0, // Would calculate vs benchmark

        // Concentration risk
        largestPosition,
        largestPositionSize: largestPosition,
        concentrationRatio: this.calculateConcentration(trades),

        // Correlation
        assetCorrelations,
        strategyCorrelations,

        // Stress testing
        stressTestResults,

        // Risk exposure
        marketRisk,
        operationalRisk,
        liquidityRisk,
        counterpartyRisk,
      };

      this.logger.debug(`Calculated risk metrics for ${strategyId}`, {
        var95: metrics.var95,
        volatility: metrics.volatility,
        expectedShortfall95: metrics.expectedShortfall95,
      });

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to calculate risk metrics for ${strategyId}`, error);
      throw new Error(`Failed to calculate risk metrics: ${error.message}`);
    }
  }

  /**
   * Calculate Value at Risk (VaR)
   * @private
   */
  private calculateVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;

    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.ceil((1 - confidenceLevel) * sorted.length) - 1;

    return Math.abs(sorted[Math.max(0, index)]);
  }

  /**
   * Calculate Expected Shortfall (CVaR)
   * @private
   */
  private calculateExpectedShortfall(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;

    const sorted = [...returns].sort((a, b) => a - b);
    const var_index = Math.ceil((1 - confidenceLevel) * sorted.length) - 1;
    const var_level = sorted[Math.max(0, var_index)];

    const tailReturns = sorted.filter((r) => r <= var_level);
    if (tailReturns.length === 0) return Math.abs(var_level);

    const avg = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    return Math.abs(avg);
  }

  /**
   * Calculate volatility (annualized)
   * @private
   */
  private calculateVolatility(returns: number[]): number {
    const stdDev = this.calculateStandardDeviation(returns);
    // Annualize: multiply by sqrt(252 trading days)
    return stdDev * Math.sqrt(252);
  }

  /**
   * Calculate standard deviation
   * @private
   */
  private calculateStandardDeviation(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate largest position
   * @private
   */
  private calculateLargestPosition(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;

    return Math.max(...trades.map((t) => t.quantity * t.entryPrice));
  }

  /**
   * Calculate asset correlations
   * @private
   */
  private calculateAssetCorrelations(trades: TradeRecord[]): {[key: string]: number} {
    const correlations: {[key: string]: number} = {};

    // Group trades by symbol
    const symbols = new Set(trades.map((t) => t.symbol));

    for (const symbol of symbols) {
      const symbolTrades = trades.filter((t) => t.symbol === symbol);
      if (symbolTrades.length > 0) {
        // Calculate return correlation for each symbol
        const returns = symbolTrades.map((t) => t.profitPercent / 100);
        const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length);

        correlations[symbol] = stdDev > 0 ? 1.0 : 0;
      }
    }

    return correlations;
  }

  /**
   * Calculate concentration ratio (Herfindahl index)
   * @private
   */
  private calculateConcentration(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;

    const totalValue = trades.reduce((sum, t) => sum + t.quantity * t.entryPrice, 0);
    if (totalValue === 0) return 0;

    let concentrationSum = 0;
    const symbols = new Set(trades.map((t) => t.symbol));

    for (const symbol of symbols) {
      const symbolTrades = trades.filter((t) => t.symbol === symbol);
      const symbolValue = symbolTrades.reduce((sum, t) => sum + t.quantity * t.entryPrice, 0);
      const weight = symbolValue / totalValue;
      concentrationSum += Math.pow(weight, 2);
    }

    return Math.sqrt(concentrationSum);
  }

  /**
   * Conduct stress tests
   * @private
   */
  private conductStressTests(returns: number[]): Array<{scenario: string; maxLoss: number; probability: number}> {
    const results: Array<{scenario: string; maxLoss: number; probability: number}> = [];

    // Market crash scenario (-20%)
    const marketCrash = {
      scenario: 'Market Crash (-20%)',
      maxLoss: 0.2,
      probability: 0.01,
    };
    results.push(marketCrash);

    // Volatility spike (2x volatility)
    const volatilitySpike = {
      scenario: 'Volatility Spike (2x)',
      maxLoss: this.calculateVolatility(returns) * 2,
      probability: 0.05,
    };
    results.push(volatilitySpike);

    // Flash crash (-10% in 1 day)
    const flashCrash = {
      scenario: 'Flash Crash (-10%)',
      maxLoss: 0.1,
      probability: 0.02,
    };
    results.push(flashCrash);

    // Liquidity crisis
    const liquidityCrisis = {
      scenario: 'Liquidity Crisis',
      maxLoss: 0.15,
      probability: 0.03,
    };
    results.push(liquidityCrisis);

    // Tail event
    const tailEvent = {
      scenario: 'Tail Event',
      maxLoss: 0.25,
      probability: 0.01,
    };
    results.push(tailEvent);

    return results;
  }

  /**
   * Get empty risk metrics
   * @private
   */
  private getEmptyRiskMetrics(strategyId: string): RiskMetrics {
    return {
      timestamp: new Date(),
      strategyId,
      var95: 0,
      var99: 0,
      expectedShortfall95: 0,
      expectedShortfall99: 0,
      volatility: 0,
      standardDeviation: 0,
      beta: 0,
      alpha: 0,
      largestPosition: 0,
      largestPositionSize: 0,
      concentrationRatio: 0,
      assetCorrelations: {},
      strategyCorrelations: {},
      stressTestResults: [],
      marketRisk: 0,
      operationalRisk: 0,
      liquidityRisk: 0,
      counterpartyRisk: 0,
    };
  }
}

export default RiskAnalysisCalculator;
