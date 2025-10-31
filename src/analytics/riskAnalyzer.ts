/**
 * Risk Analytics Analyzer
 * Calculates comprehensive risk metrics and stress testing
 * @version 1.0.0
 */

import {
  RiskMetrics,
  RiskLevel,
  HistoricalDrawdown,
  StressTestResult,
  PerformanceMetrics,
  TradeAnalytics
} from './types';

export class RiskAnalyzer {
  /**
   * Calculate comprehensive risk metrics
   */
  static calculateRiskMetrics(
    portfolioValue: number,
    historicalData: PerformanceMetrics[],
    trades: TradeAnalytics[],
    confidenceLevel: number = 0.95
  ): Partial<RiskMetrics> {
    const returns = this.getReturns(historicalData);
    const drawdowns = this.calculateDrawdownHistory(historicalData);
    const var95 = this.calculateValueAtRisk(returns, 0.95);
    const var99 = this.calculateValueAtRisk(returns, 0.99);
    const cvar95 = this.calculateConditionalVaR(returns, 0.95);
    const cvar99 = this.calculateConditionalVaR(returns, 0.99);

    const maxDrawdown = this.calculateMaxDrawdown(historicalData);
    const currentDrawdown = this.calculateCurrentDrawdown(historicalData);
    const volatility = this.calculateAnnualVolatility(returns);
    const downsideVolatility = this.calculateDownsideVolatility(returns);

    const stressTests = this.performStressTests(historicalData, trades);
    const riskScore = this.calculateRiskScore(
      volatility,
      maxDrawdown,
      var95,
      returns[returns.length - 1] || 0
    );

    return {
      var95: portfolioValue * var95,
      var99: portfolioValue * var99,
      cvar95: portfolioValue * cvar95,
      cvar99: portfolioValue * cvar99,
      maxDrawdownPercent: maxDrawdown,
      currentDrawdownPercent: currentDrawdown,
      recoveryDays: this.calculateRecoveryDays(drawdowns),
      consecutiveLosingDays: this.getConsecutiveLosingDays(historicalData),
      consecutiveLosingTrades: this.getConsecutiveLosingTrades(trades),
      annualVolatility: volatility,
      downsideVolatility: downsideVolatility,
      upsideVolatility: this.calculateUpsideVolatility(returns),
      volatilityRatio: downsideVolatility > 0 ? volatility / downsideVolatility : 0,
      worstDayLoss: this.getWorstDayLoss(historicalData),
      worstWeekLoss: this.getWorstPeriodLoss(historicalData, 7),
      worstMonthLoss: this.getWorstPeriodLoss(historicalData, 30),
      bestDayGain: this.getBestDayGain(historicalData),
      bestWeekGain: this.getBestPeriodGain(historicalData, 7),
      bestMonthGain: this.getBestPeriodGain(historicalData, 30),
      riskScore: riskScore.score,
      riskLevel: riskScore.level
    };
  }

  /**
   * Calculate returns from performance metrics
   */
  static getReturns(data: PerformanceMetrics[]): number[] {
    if (data.length < 2) return [];

    return data.slice(1).map((d, i) => {
      const prev = data[i];
      if (prev.portfolioValue === 0) return 0;
      return (d.portfolioValue - prev.portfolioValue) / prev.portfolioValue;
    });
  }

  /**
   * Calculate Value at Risk (VaR)
   * Historical method: find the percentile loss
   */
  static calculateValueAtRisk(
    returns: number[],
    confidenceLevel: number = 0.95
  ): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor(sortedReturns.length * (1 - confidenceLevel));

    return Math.abs(sortedReturns[Math.max(0, index)]);
  }

  /**
   * Calculate Conditional Value at Risk (Expected Shortfall)
   * Average of returns worse than VaR
   */
  static calculateConditionalVaR(
    returns: number[],
    confidenceLevel: number = 0.95
  ): number {
    if (returns.length === 0) return 0;

    const var_ = this.calculateValueAtRisk(returns, confidenceLevel);
    const worseThanVar = returns.filter(r => r < -var_);

    if (worseThanVar.length === 0) return var_;

    const avgWorstCase =
      worseThanVar.reduce((a, b) => a + b, 0) / worseThanVar.length;

    return Math.abs(avgWorstCase);
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
   * Calculate current drawdown from peak
   */
  static calculateCurrentDrawdown(data: PerformanceMetrics[]): number {
    if (data.length === 0) return 0;

    const current = data[data.length - 1].portfolioValue;
    let peakValue = 0;

    for (const point of data) {
      peakValue = Math.max(peakValue, point.portfolioValue);
    }

    if (peakValue === 0) return 0;
    return (current - peakValue) / peakValue;
  }

  /**
   * Calculate historical drawdowns with recovery information
   */
  static calculateDrawdownHistory(data: PerformanceMetrics[]): HistoricalDrawdown[] {
    if (data.length === 0) return [];

    const drawdowns: HistoricalDrawdown[] = [];
    let peakValue = data[0].portfolioValue;
    let peakDate = data[0].timestamp;
    let inDrawdown = false;
    let drawdownStart: HistoricalDrawdown | null = null;

    for (let i = 1; i < data.length; i++) {
      const current = data[i];

      if (current.portfolioValue > peakValue) {
        peakValue = current.portfolioValue;
        peakDate = current.timestamp;

        if (inDrawdown && drawdownStart) {
          drawdownStart.recoveryDate = current.timestamp;
          drawdownStart.recoveryDays = Math.floor(
            (current.timestamp.getTime() - peakDate.getTime()) / (24 * 60 * 60 * 1000)
          );
          inDrawdown = false;
        }
      } else {
        const drawdown =
          (current.portfolioValue - peakValue) / peakValue;

        if (!inDrawdown) {
          drawdownStart = {
            date: current.timestamp,
            drawdown: drawdown
          };
          drawdowns.push(drawdownStart);
          inDrawdown = true;
        } else if (drawdownStart && drawdown < drawdownStart.drawdown) {
          drawdownStart.drawdown = drawdown;
        }
      }
    }

    return drawdowns;
  }

  /**
   * Calculate recovery days from maximum drawdown
   */
  static calculateRecoveryDays(drawdowns: HistoricalDrawdown[]): number {
    if (drawdowns.length === 0) return 0;

    const maxDrawdown = drawdowns.reduce((max, d) =>
      d.drawdown < max.drawdown ? d : max
    );

    return maxDrawdown.recoveryDays || 0;
  }

  /**
   * Calculate annual volatility
   */
  static calculateAnnualVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;

    return Math.sqrt(variance) * Math.sqrt(252); // 252 trading days
  }

  /**
   * Calculate downside volatility (only negative returns)
   */
  static calculateDownsideVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return 0;

    const mean = negativeReturns.reduce((a, b) => a + b, 0) / negativeReturns.length;
    const variance =
      negativeReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      negativeReturns.length;

    return Math.sqrt(variance) * Math.sqrt(252);
  }

  /**
   * Calculate upside volatility (only positive returns)
   */
  static calculateUpsideVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const positiveReturns = returns.filter(r => r > 0);
    if (positiveReturns.length === 0) return 0;

    const mean = positiveReturns.reduce((a, b) => a + b, 0) / positiveReturns.length;
    const variance =
      positiveReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      positiveReturns.length;

    return Math.sqrt(variance) * Math.sqrt(252);
  }

  /**
   * Get worst day loss
   */
  static getWorstDayLoss(data: PerformanceMetrics[]): number {
    if (data.length === 0) return 0;

    let worstLoss = 0;
    for (let i = 1; i < data.length; i++) {
      const loss = data[i].priceChange;
      if (loss < worstLoss) {
        worstLoss = loss;
      }
    }

    return worstLoss;
  }

  /**
   * Get best day gain
   */
  static getBestDayGain(data: PerformanceMetrics[]): number {
    if (data.length === 0) return 0;

    let bestGain = 0;
    for (let i = 1; i < data.length; i++) {
      const gain = data[i].priceChange;
      if (gain > bestGain) {
        bestGain = gain;
      }
    }

    return bestGain;
  }

  /**
   * Get worst period loss
   */
  static getWorstPeriodLoss(data: PerformanceMetrics[], days: number): number {
    if (data.length < days) return 0;

    let worstLoss = 0;
    for (let i = days; i < data.length; i++) {
      const start = data[i - days].portfolioValue;
      const end = data[i].portfolioValue;
      const loss = end - start;
      if (loss < worstLoss) {
        worstLoss = loss;
      }
    }

    return worstLoss;
  }

  /**
   * Get best period gain
   */
  static getBestPeriodGain(data: PerformanceMetrics[], days: number): number {
    if (data.length < days) return 0;

    let bestGain = 0;
    for (let i = days; i < data.length; i++) {
      const start = data[i - days].portfolioValue;
      const end = data[i].portfolioValue;
      const gain = end - start;
      if (gain > bestGain) {
        bestGain = gain;
      }
    }

    return bestGain;
  }

  /**
   * Get consecutive losing days
   */
  static getConsecutiveLosingDays(data: PerformanceMetrics[]): number {
    if (data.length < 2) return 0;

    let maxLosing = 0;
    let currentLosing = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i].dailyReturn < 0) {
        currentLosing++;
        maxLosing = Math.max(maxLosing, currentLosing);
      } else {
        currentLosing = 0;
      }
    }

    return maxLosing;
  }

  /**
   * Get consecutive losing trades
   */
  static getConsecutiveLosingTrades(trades: TradeAnalytics[]): number {
    let maxLosing = 0;
    let currentLosing = 0;

    for (const trade of trades) {
      if (trade.netProfit! <= 0) {
        currentLosing++;
        maxLosing = Math.max(maxLosing, currentLosing);
      } else {
        currentLosing = 0;
      }
    }

    return maxLosing;
  }

  /**
   * Perform stress testing scenarios
   */
  static performStressTests(
    historicalData: PerformanceMetrics[],
    trades: TradeAnalytics[]
  ): StressTestResult[] {
    const scenarios: StressTestResult[] = [];

    // Scenario 1: 2008 Crisis (50% drawdown)
    scenarios.push({
      scenario: '2008 Financial Crisis (50% loss)',
      worstCaseLoss: -0.50,
      probability: 0.001,
      expectedShortfall: -0.50
    });

    // Scenario 2: Flash Crash (20% drop)
    scenarios.push({
      scenario: 'Flash Crash (20% loss)',
      worstCaseLoss: -0.20,
      probability: 0.01,
      expectedShortfall: -0.20
    });

    // Scenario 3: Normal correction (10% drop)
    scenarios.push({
      scenario: 'Normal Correction (10% loss)',
      worstCaseLoss: -0.10,
      probability: 0.05,
      expectedShortfall: -0.10
    });

    // Scenario 4: Volatility spike
    const returns = historicalData
      .slice(1)
      .map((d, i) => (d.portfolioValue - historicalData[i].portfolioValue) / historicalData[i].portfolioValue);
    const maxReturn = Math.max(...returns);
    const minReturn = Math.min(...returns);

    scenarios.push({
      scenario: 'Volatility Spike (Repeat worst day)',
      worstCaseLoss: minReturn,
      probability: 0.02,
      expectedShortfall: minReturn
    });

    return scenarios;
  }

  /**
   * Calculate overall risk score (0-100)
   */
  static calculateRiskScore(
    volatility: number,
    maxDrawdown: number,
    var95: number,
    return_: number
  ): { score: number; level: RiskLevel } {
    let score = 50; // Base score

    // Volatility component (max 30 points)
    score += Math.min(volatility * 100, 30);

    // Drawdown component (max 40 points)
    score += Math.min(Math.abs(maxDrawdown) * 100, 40);

    // VaR component (max 20 points)
    score += Math.min(var95 * 100, 20);

    // Return adjustment (reward for positive returns)
    if (return_ > 0) {
      score -= Math.min(return_ * 20, 10);
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    let level: RiskLevel;
    if (score < 25) level = RiskLevel.LOW;
    else if (score < 50) level = RiskLevel.MEDIUM;
    else if (score < 75) level = RiskLevel.HIGH;
    else level = RiskLevel.CRITICAL;

    return { score, level };
  }
}
