/**
 * Analytics Engine
 * Main orchestrator for all analytics operations
 * Coordinates performance, portfolio, and risk analysis
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import {
  PerformanceMetrics,
  PortfolioAnalytics,
  RiskMetrics,
  AnalyticsAlert,
  AlertType,
  AlertLevel,
  AggregatedAnalytics,
  AnalyticsQuery,
  AnalyticsResponse,
  AnalyticsConfig,
  DailySnapshot,
  TradeAnalytics,
  TradeStatus
} from './types';
import { PerformanceAnalyzer } from './performanceAnalyzer';
import { RiskAnalyzer } from './riskAnalyzer';
import { PortfolioAnalyzer } from './portfolioAnalyzer';

export class AnalyticsEngine extends EventEmitter {
  private userId: string;
  private config: AnalyticsConfig;
  private metricsCache: Map<string, PerformanceMetrics[]> = new Map();
  private alertsCache: Map<string, AnalyticsAlert[]> = new Map();

  constructor(userId: string, config?: Partial<AnalyticsConfig>) {
    super();
    this.userId = userId;
    this.config = {
      id: 0,
      userId,
      trackPerformance: true,
      trackPortfolio: true,
      trackRisk: true,
      trackTrades: true,
      maxDrawdownAlert: 0.20,
      volatilityAlert: 0.30,
      lossStreakAlert: 5,
      sharpeRatioRf: 0.02,
      lookbackDays: 252,
      retentionDays: 730,
      autoCleanup: true,
      ...config
    };
  }

  /**
   * Calculate comprehensive analytics for a strategy
   */
  async calculateAnalytics(
    strategyId: string,
    historicalData: PerformanceMetrics[],
    trades: TradeAnalytics[],
    positions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    cashBalance: number
  ): Promise<AggregatedAnalytics> {
    try {
      const now = new Date();

      // Calculate performance metrics
      let performance: PerformanceMetrics | undefined;
      if (this.config.trackPerformance && historicalData.length > 0) {
        const latest = historicalData[historicalData.length - 1];
        const previous = historicalData.length > 1 ? historicalData[historicalData.length - 2] : latest;

        performance = {
          ...latest,
          ...PerformanceAnalyzer.calculateMetrics(
            latest.portfolioValue,
            previous.portfolioValue,
            latest.cumulativeReturn,
            trades,
            historicalData,
            this.config.sharpeRatioRf
          )
        } as PerformanceMetrics;
      }

      // Calculate portfolio analytics
      let portfolio: PortfolioAnalytics | undefined;
      if (this.config.trackPortfolio) {
        portfolio = {
          id: 0,
          userId: this.userId,
          timestamp: now,
          ...PortfolioAnalyzer.calculatePortfolioAnalytics(
            this.userId,
            positions,
            cashBalance,
            historicalData.map(d => ({
              date: d.timestamp,
              value: d.portfolioValue
            }))
          )
        } as PortfolioAnalytics;
      }

      // Calculate risk metrics
      let risk: RiskMetrics | undefined;
      if (this.config.trackRisk && historicalData.length > 0) {
        risk = {
          id: 0,
          userId: this.userId,
          strategyId,
          timestamp: now,
          ...RiskAnalyzer.calculateRiskMetrics(
            historicalData[historicalData.length - 1].portfolioValue,
            historicalData,
            trades,
            0.95
          )
        } as RiskMetrics;
      }

      // Calculate trade statistics
      const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);
      const consecutiveStats = PerformanceAnalyzer.getConsecutiveStats(closedTrades);

      // Generate alerts based on thresholds
      const alerts = this.generateAlerts(
        strategyId,
        performance,
        risk,
        consecutiveStats.currentStreakType === 'losses'
          ? consecutiveStats.currentStreak
          : 0
      );

      // Create daily snapshot if requested
      const dailySnapshot = this.createDailySnapshot(strategyId, performance, closedTrades);

      return {
        performance: performance!,
        portfolio: portfolio!,
        risk: risk!,
        trades: {
          userId: this.userId,
          strategyId,
          totalTrades: closedTrades.length,
          winningTrades: closedTrades.filter(t => t.netProfit! > 0).length,
          losingTrades: closedTrades.filter(t => t.netProfit! <= 0).length,
          avgWin: PerformanceAnalyzer.calculateAverageWin(closedTrades),
          avgLoss: PerformanceAnalyzer.calculateAverageLoss(closedTrades),
          winRate: PerformanceAnalyzer.calculateWinRate(closedTrades),
          totalProfit: closedTrades.reduce((sum, t) => sum + (t.netProfit || 0), 0),
          avgHoldingMinutes: closedTrades.length > 0
            ? closedTrades.reduce((sum, t) => sum + (t.holdingTimeMinutes || 0), 0) /
              closedTrades.length
            : 0,
          consecutiveWins: consecutiveStats.maxConsecutiveWins,
          consecutiveLosses: consecutiveStats.maxConsecutiveLosses
        },
        dailySnapshot: dailySnapshot!,
        alerts
      };
    } catch (error) {
      this.emit('error', {
        source: 'calculateAnalytics',
        error,
        strategyId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Generate alerts based on thresholds
   */
  private generateAlerts(
    strategyId: string,
    performance?: PerformanceMetrics,
    risk?: RiskMetrics,
    consecutiveLosses: number = 0
  ): AnalyticsAlert[] {
    const alerts: AnalyticsAlert[] = [];
    const now = new Date();

    if (!performance || !risk) {
      return alerts;
    }

    // Drawdown alert
    if (
      risk.maxDrawdownPercent &&
      risk.maxDrawdownPercent < -this.config.maxDrawdownAlert
    ) {
      alerts.push({
        id: 0,
        userId: this.userId,
        strategyId,
        alertType: AlertType.DRAWDOWN,
        alertLevel: Math.abs(risk.maxDrawdownPercent) > 0.4
          ? AlertLevel.CRITICAL
          : AlertLevel.WARNING,
        title: 'Significant Drawdown',
        description: `Portfolio drawdown of ${(
          Math.abs(risk.maxDrawdownPercent) * 100
        ).toFixed(2)}% detected`,
        metricName: 'Max Drawdown',
        metricValue: risk.maxDrawdownPercent,
        thresholdValue: -this.config.maxDrawdownAlert,
        isAcknowledged: false,
        createdAt: now
      });
    }

    // Volatility alert
    if (
      risk.annualVolatility &&
      risk.annualVolatility > this.config.volatilityAlert
    ) {
      alerts.push({
        id: 0,
        userId: this.userId,
        strategyId,
        alertType: AlertType.VOLATILITY,
        alertLevel:
          risk.annualVolatility > 0.5
            ? AlertLevel.CRITICAL
            : AlertLevel.WARNING,
        title: 'High Volatility',
        description: `Annual volatility of ${(
          risk.annualVolatility * 100
        ).toFixed(2)}% exceeds threshold`,
        metricName: 'Annual Volatility',
        metricValue: risk.annualVolatility,
        thresholdValue: this.config.volatilityAlert,
        isAcknowledged: false,
        createdAt: now
      });
    }

    // Consecutive losses alert
    if (consecutiveLosses >= this.config.lossStreakAlert) {
      alerts.push({
        id: 0,
        userId: this.userId,
        strategyId,
        alertType: AlertType.LOSS_STREAK,
        alertLevel:
          consecutiveLosses >= 10
            ? AlertLevel.CRITICAL
            : AlertLevel.WARNING,
        title: 'Consecutive Losses',
        description: `Strategy has ${consecutiveLosses} consecutive losing trades`,
        metricName: 'Consecutive Losses',
        metricValue: consecutiveLosses,
        thresholdValue: this.config.lossStreakAlert,
        isAcknowledged: false,
        createdAt: now
      });
    }

    // Risk score alert
    if (risk.riskScore && risk.riskScore > 75) {
      alerts.push({
        id: 0,
        userId: this.userId,
        strategyId,
        alertType: AlertType.RISK_WARNING,
        alertLevel: risk.riskScore > 90 ? AlertLevel.CRITICAL : AlertLevel.WARNING,
        title: 'High Risk Score',
        description: `Risk score of ${risk.riskScore.toFixed(1)}/100 indicates elevated risk`,
        metricName: 'Risk Score',
        metricValue: risk.riskScore,
        thresholdValue: 75,
        isAcknowledged: false,
        createdAt: now
      });
    }

    // Diversification alert
    if (
      performance.profitFactor &&
      performance.profitFactor < 1.5 &&
      performance.totalTrades! > 10
    ) {
      alerts.push({
        id: 0,
        userId: this.userId,
        strategyId,
        alertType: AlertType.DIVERSIFICATION_LOW,
        alertLevel: AlertLevel.INFO,
        title: 'Low Profit Factor',
        description: `Profit factor of ${performance.profitFactor.toFixed(
          2
        )} indicates weak edge`,
        metricName: 'Profit Factor',
        metricValue: performance.profitFactor,
        thresholdValue: 1.5,
        isAcknowledged: false,
        createdAt: now
      });
    }

    // Emit alert events
    alerts.forEach(alert => {
      this.emit('alert', alert);
    });

    return alerts;
  }

  /**
   * Create daily snapshot
   */
  private createDailySnapshot(
    strategyId: string,
    performance?: PerformanceMetrics,
    trades?: TradeAnalytics[]
  ): Partial<DailySnapshot> {
    if (!performance || !trades) {
      return {};
    }

    const winningTrades = trades.filter(t => t.netProfit! > 0).length;

    return {
      userId: this.userId,
      strategyId,
      snapshotDate: new Date(),
      closingValue: performance.portfolioValue,
      dailyReturnPct: performance.dailyReturn,
      tradesCount: trades.length,
      winningTrades: winningTrades,
      losingTrades: trades.length - winningTrades,
      winningPct:
        trades.length > 0 ? winningTrades / trades.length : 0,
      dailyProfit: trades.reduce((sum, t) => sum + (t.netProfit || 0), 0),
      dailyVolatility: performance.dailyVolatility,
      maxDailyDrawdown: performance.maxDrawdown
    };
  }

  /**
   * Query analytics data with filters
   */
  async queryAnalytics(query: AnalyticsQuery): Promise<AnalyticsResponse<AggregatedAnalytics>> {
    const startTime = Date.now();

    try {
      const startDate = query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate || new Date();

      // In real implementation, would query from database
      // For now, returning empty response structure
      const data: AggregatedAnalytics = {
        performance: {} as any,
        portfolio: {} as any,
        risk: {} as any,
        trades: {} as any,
        dailySnapshot: {} as any,
        alerts: []
      };

      const duration = Date.now() - startTime;

      return {
        success: true,
        data,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        data: {} as any,
        timestamp: new Date(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get analytics summary
   */
  getSummary(analytics: AggregatedAnalytics): {
    [key: string]: string | number;
  } {
    return {
      totalValue: analytics.performance.portfolioValue,
      return: (analytics.performance.cumulativeReturn * 100).toFixed(2) + '%',
      sharpeRatio: analytics.performance.sharpeRatio?.toFixed(2) || 'N/A',
      maxDrawdown: (analytics.risk.maxDrawdownPercent! * 100).toFixed(2) + '%',
      winRate:
        (analytics.trades.winRate * 100).toFixed(2) + '%',
      profitFactor:
        analytics.performance.profitFactor?.toFixed(2) || 'N/A',
      totalTrades: analytics.trades.totalTrades,
      riskScore: analytics.risk.riskScore?.toFixed(1) || 'N/A',
      riskLevel: analytics.risk.riskLevel || 'N/A'
    };
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: number): void {
    // In real implementation, would update database
    this.emit('alert:acknowledged', {
      alertId,
      acknowledgedAt: new Date()
    });
  }

  /**
   * Get configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config:updated', this.config);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.metricsCache.clear();
    this.alertsCache.clear();
    this.emit('cache:cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): {
    metricsCount: number;
    alertsCount: number;
    totalEntries: number;
  } {
    const metricsCount = Array.from(this.metricsCache.values()).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    const alertsCount = Array.from(this.alertsCache.values()).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    return {
      metricsCount,
      alertsCount,
      totalEntries: metricsCount + alertsCount
    };
  }
}
