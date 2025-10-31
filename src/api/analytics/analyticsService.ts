/**
 * Analytics API Service
 * Handles all analytics-related business logic and database operations
 * @version 1.0.0
 */

import {
  AnalyticsEngine,
  PerformanceMetrics,
  PortfolioAnalytics,
  RiskMetrics,
  AnalyticsAlert,
  DailySnapshot,
  AnalyticsConfig,
  AggregatedAnalytics,
  AlertType,
  AlertLevel,
  AnalyticsUtils
} from '../../analytics';

export interface AnalyticsServiceConfig {
  database?: any; // Database connection
  cache?: any;    // Cache implementation
  maxRetentionDays?: number;
}

export class AnalyticsService {
  private engines: Map<string, AnalyticsEngine> = new Map();
  private config: AnalyticsServiceConfig;

  constructor(config: AnalyticsServiceConfig = {}) {
    this.config = {
      maxRetentionDays: 730,
      ...config
    };
  }

  /**
   * Get or create analytics engine for user
   */
  getEngine(userId: string, engineConfig?: any): AnalyticsEngine {
    if (!this.engines.has(userId)) {
      const engine = new AnalyticsEngine(userId, engineConfig);
      this.engines.set(userId, engine);
    }
    return this.engines.get(userId)!;
  }

  /**
   * Calculate analytics for a strategy
   */
  async calculateAnalytics(
    userId: string,
    strategyId: string,
    historicalData: PerformanceMetrics[],
    trades: any[],
    positions: any[],
    cashBalance: number
  ): Promise<AggregatedAnalytics> {
    const engine = this.getEngine(userId);

    try {
      const analytics = await engine.calculateAnalytics(
        strategyId,
        historicalData,
        trades,
        positions,
        cashBalance
      );

      // Cache the result
      await this.cacheAnalytics(userId, strategyId, analytics);

      return analytics;
    } catch (error) {
      throw new Error(`Failed to calculate analytics: ${error}`);
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    userId: string,
    strategyId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PerformanceMetrics[]> {
    try {
      const data = await this.queryMetrics(
        'performance',
        userId,
        strategyId,
        startDate,
        endDate
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch performance metrics: ${error}`);
    }
  }

  /**
   * Get portfolio analytics
   */
  async getPortfolioAnalytics(
    userId: string,
    date?: Date
  ): Promise<PortfolioAnalytics> {
    try {
      const query = {
        userId,
        timestamp: date || new Date()
      };

      const data = await this.queryDatabase('analytics_portfolio', query);
      return data[0] || this.createEmptyPortfolio(userId);
    } catch (error) {
      throw new Error(`Failed to fetch portfolio analytics: ${error}`);
    }
  }

  /**
   * Get risk metrics
   */
  async getRiskMetrics(
    userId: string,
    strategyId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<RiskMetrics[]> {
    try {
      const data = await this.queryMetrics(
        'risk',
        userId,
        strategyId,
        startDate,
        endDate
      );
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch risk metrics: ${error}`);
    }
  }

  /**
   * Get alerts for user
   */
  async getAlerts(
    userId: string,
    filters?: {
      strategyId?: string;
      alertType?: AlertType;
      alertLevel?: AlertLevel;
      acknowledged?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ alerts: AnalyticsAlert[]; total: number }> {
    try {
      const query: any = { userId };

      if (filters?.strategyId) {
        query.strategyId = filters.strategyId;
      }
      if (filters?.alertType) {
        query.alertType = filters.alertType;
      }
      if (filters?.alertLevel) {
        query.alertLevel = filters.alertLevel;
      }
      if (filters?.acknowledged !== undefined) {
        query.isAcknowledged = filters.acknowledged;
      }

      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;

      const alerts = await this.queryDatabase('analytics_alerts', query, {
        limit,
        offset,
        orderBy: 'createdAt DESC'
      });

      const total = await this.countDatabase('analytics_alerts', query);

      return { alerts, total };
    } catch (error) {
      throw new Error(`Failed to fetch alerts: ${error}`);
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(
    userId: string,
    alertId: number
  ): Promise<AnalyticsAlert> {
    try {
      const alert = await this.updateDatabase('analytics_alerts', alertId, {
        isAcknowledged: true,
        acknowledgedAt: new Date()
      });

      return alert;
    } catch (error) {
      throw new Error(`Failed to acknowledge alert: ${error}`);
    }
  }

  /**
   * Get daily snapshots
   */
  async getDailySnapshots(
    userId: string,
    strategyId?: string,
    days: number = 30
  ): Promise<DailySnapshot[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const query: any = {
        userId,
        snapshotDate: { $gte: startDate }
      };

      if (strategyId) {
        query.strategyId = strategyId;
      }

      const snapshots = await this.queryDatabase('analytics_daily_snapshot', query, {
        orderBy: 'snapshotDate DESC'
      });

      return snapshots;
    } catch (error) {
      throw new Error(`Failed to fetch daily snapshots: ${error}`);
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(
    userId: string,
    strategyId?: string
  ): Promise<any> {
    try {
      const engine = this.getEngine(userId);

      // Get latest metrics
      const performance = await this.getPerformanceMetrics(
        userId,
        strategyId || 'all',
        undefined,
        undefined
      );

      const risk = await this.getRiskMetrics(
        userId,
        strategyId || 'all'
      );

      const portfolio = await this.getPortfolioAnalytics(userId);

      const alerts = await this.getAlerts(userId, {
        strategyId,
        acknowledged: false
      });

      if (performance.length === 0) {
        return { error: 'No analytics data available' };
      }

      const latestPerformance = performance[performance.length - 1];
      const latestRisk = risk[risk.length - 1];

      return {
        summary: {
          totalValue: latestPerformance.portfolioValue,
          return: AnalyticsUtils.formatPercentage(
            latestPerformance.cumulativeReturn
          ),
          sharpeRatio: latestPerformance.sharpeRatio?.toFixed(2) || 'N/A',
          maxDrawdown: AnalyticsUtils.formatPercentage(
            latestRisk.maxDrawdownPercent || 0
          ),
          winRate: AnalyticsUtils.formatPercentage(
            latestPerformance.winRate || 0
          ),
          riskLevel: latestRisk.riskLevel || 'N/A',
          riskScore: latestRisk.riskScore?.toFixed(1) || 'N/A'
        },
        portfolio: {
          totalValue: portfolio.totalValue,
          cashBalance: portfolio.cashBalance,
          investedValue: portfolio.investedValue,
          numberOfPositions: portfolio.numberOfPositions,
          diversificationRatio: portfolio.diversificationRatio?.toFixed(2) || 'N/A'
        },
        recentAlerts: alerts.alerts.slice(0, 5),
        totalUnacknowledgedAlerts: alerts.total
      };
    } catch (error) {
      throw new Error(`Failed to generate analytics summary: ${error}`);
    }
  }

  /**
   * Get comparative analysis
   */
  async getComparativeAnalysis(
    userId: string,
    strategyId?: string,
    periodDays: number = 30
  ): Promise<any> {
    try {
      const now = new Date();
      const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const periodEnd = new Date(periodStart.getTime() - 1000);
      const previousStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

      const currentMetrics = await this.getPerformanceMetrics(
        userId,
        strategyId || 'all',
        periodStart,
        now
      );

      const previousMetrics = await this.getPerformanceMetrics(
        userId,
        strategyId || 'all',
        previousStart,
        periodEnd
      );

      if (currentMetrics.length === 0 || previousMetrics.length === 0) {
        return { error: 'Insufficient data for comparison' };
      }

      const current = currentMetrics[currentMetrics.length - 1];
      const previous = previousMetrics[previousMetrics.length - 1];

      return {
        period: `Last ${periodDays} days`,
        comparison: {
          return: {
            current: AnalyticsUtils.formatPercentage(current.cumulativeReturn),
            previous: AnalyticsUtils.formatPercentage(previous.cumulativeReturn),
            change: AnalyticsUtils.formatPercentage(
              current.cumulativeReturn - previous.cumulativeReturn
            )
          },
          sharpeRatio: {
            current: current.sharpeRatio?.toFixed(2) || 'N/A',
            previous: previous.sharpeRatio?.toFixed(2) || 'N/A'
          },
          volatility: {
            current: AnalyticsUtils.formatPercentage(current.dailyVolatility || 0),
            previous: AnalyticsUtils.formatPercentage(previous.dailyVolatility || 0)
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate comparative analysis: ${error}`);
    }
  }

  /**
   * Update analytics configuration
   */
  async updateConfig(
    userId: string,
    newConfig: Partial<AnalyticsConfig>
  ): Promise<AnalyticsConfig> {
    try {
      const engine = this.getEngine(userId);
      engine.updateConfig(newConfig);

      // Save to database
      await this.updateDatabase('analytics_config', userId, newConfig);

      return engine.getConfig();
    } catch (error) {
      throw new Error(`Failed to update config: ${error}`);
    }
  }

  /**
   * Get configuration
   */
  async getConfig(userId: string): Promise<AnalyticsConfig> {
    try {
      const engine = this.getEngine(userId);
      return engine.getConfig();
    } catch (error) {
      throw new Error(`Failed to fetch config: ${error}`);
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    userId: string,
    format: 'json' | 'csv' | 'pdf',
    startDate?: Date,
    endDate?: Date
  ): Promise<Buffer | string> {
    try {
      const performance = await this.getPerformanceMetrics(
        userId,
        'all',
        startDate,
        endDate
      );

      const portfolio = await this.getPortfolioAnalytics(userId);
      const risk = await this.getRiskMetrics(userId, 'all', startDate, endDate);

      if (format === 'json') {
        return JSON.stringify(
          {
            performance,
            portfolio,
            risk,
            exportDate: new Date()
          },
          null,
          2
        );
      } else if (format === 'csv') {
        return this.convertToCSV({ performance, portfolio, risk });
      } else if (format === 'pdf') {
        // PDF export would require a library like pdfkit
        throw new Error('PDF export not yet implemented');
      }

      throw new Error('Invalid format');
    } catch (error) {
      throw new Error(`Failed to export analytics: ${error}`);
    }
  }

  // Private helper methods

  private async cacheAnalytics(
    userId: string,
    strategyId: string,
    analytics: AggregatedAnalytics
  ): Promise<void> {
    if (!this.config.cache) return;

    const key = `analytics:${userId}:${strategyId}`;
    await this.config.cache.set(key, analytics, 300); // 5 minutes
  }

  private async queryMetrics(
    table: string,
    userId: string,
    strategyId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const query: any = { userId };

    if (strategyId && strategyId !== 'all') {
      query.strategyId = strategyId;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    return this.queryDatabase(table, query, {
      orderBy: 'timestamp DESC'
    });
  }

  private async queryDatabase(
    table: string,
    query: any,
    options?: any
  ): Promise<any[]> {
    // In production, would query actual database
    // For now, return empty array
    return [];
  }

  private async countDatabase(table: string, query: any): Promise<number> {
    // In production, would count from database
    return 0;
  }

  private async updateDatabase(
    table: string,
    id: any,
    updates: any
  ): Promise<any> {
    // In production, would update database
    return { id, ...updates };
  }

  private createEmptyPortfolio(userId: string): PortfolioAnalytics {
    return {
      id: 0,
      userId,
      timestamp: new Date(),
      totalValue: 0,
      cashBalance: 0,
      investedValue: 0,
      allocation: [],
      numberOfPositions: 0
    };
  }

  private convertToCSV(data: any): string {
    // Convert performance metrics to CSV
    let csv = 'Timestamp,Portfolio Value,Daily Return,Cumulative Return,Sharpe Ratio\n';

    if (data.performance && Array.isArray(data.performance)) {
      for (const metric of data.performance) {
        csv += `${metric.timestamp},${metric.portfolioValue},${metric.dailyReturn},${metric.cumulativeReturn},${metric.sharpeRatio}\n`;
      }
    }

    return csv;
  }
}

export function createAnalyticsService(
  config?: AnalyticsServiceConfig
): AnalyticsService {
  return new AnalyticsService(config);
}
