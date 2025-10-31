/**
 * Analytics Module
 * Comprehensive analytics system for trading strategies
 * @version 1.0.0
 */

// Types
export {
  PerformanceMetrics,
  PerformanceSummary,
  PortfolioAnalytics,
  AssetAllocation,
  DiversificationMetrics,
  RiskMetrics,
  RiskLevel,
  StressTestResult,
  HistoricalDrawdown,
  TradeAnalytics,
  TradeType,
  TradeStatus,
  TradeStatistics,
  DailySnapshot,
  AnalyticsAlert,
  AlertType,
  AlertLevel,
  AnalyticsConfig,
  AggregatedAnalytics,
  AnalyticsPeriod,
  AnalyticsComparison,
  AnalyticsQuery,
  AnalyticsResponse,
  ChartDataPoint,
  ChartData,
  DashboardWidget,
  AnalyticsDashboard
} from './types';

// Analyzers
export { PerformanceAnalyzer } from './performanceAnalyzer';
export { RiskAnalyzer } from './riskAnalyzer';
export { PortfolioAnalyzer } from './portfolioAnalyzer';

// Engine
export { AnalyticsEngine } from './analyticsEngine';

// Utilities
export const AnalyticsUtils = {
  /**
   * Format number as percentage
   */
  formatPercentage: (value: number, decimals: number = 2): string => {
    return (value * 100).toFixed(decimals) + '%';
  },

  /**
   * Format currency
   */
  formatCurrency: (value: number, currency: string = 'USD'): string => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    });
    return formatter.format(value);
  },

  /**
   * Format large numbers
   */
  formatNumber: (value: number, decimals: number = 2): string => {
    if (Math.abs(value) >= 1e6) {
      return (value / 1e6).toFixed(decimals) + 'M';
    } else if (Math.abs(value) >= 1e3) {
      return (value / 1e3).toFixed(decimals) + 'K';
    }
    return value.toFixed(decimals);
  },

  /**
   * Get risk level color
   */
  getRiskLevelColor: (riskLevel: string): string => {
    switch (riskLevel) {
      case 'LOW':
        return '#10B981'; // green
      case 'MEDIUM':
        return '#F59E0B'; // amber
      case 'HIGH':
        return '#EF4444'; // red
      case 'CRITICAL':
        return '#7C2D12'; // dark red
      default:
        return '#6B7280'; // gray
    }
  },

  /**
   * Get alert level icon
   */
  getAlertLevelIcon: (alertLevel: string): string => {
    switch (alertLevel) {
      case 'INFO':
        return 'ℹ️';
      case 'WARNING':
        return '⚠️';
      case 'CRITICAL':
        return '🚨';
      default:
        return '📌';
    }
  },

  /**
   * Compare two metrics
   */
  compareMetrics: (
    current: number,
    previous: number
  ): {
    change: number;
    percentChange: number;
    trend: 'up' | 'down' | 'neutral';
  } => {
    const change = current - previous;
    const percentChange = previous !== 0 ? change / previous : 0;
    const trend =
      change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';

    return { change, percentChange, trend };
  },

  /**
   * Calculate time period label
   */
  getTimePeriodLabel: (startDate: Date, endDate: Date): string => {
    const days = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (days === 1) return 'Daily';
    if (days <= 7) return 'Weekly';
    if (days <= 30) return 'Monthly';
    if (days <= 90) return 'Quarterly';
    if (days <= 365) return 'Yearly';
    return `${Math.floor(days / 365)} Years`;
  },

  /**
   * Validate metric value
   */
  isValidMetric: (value: number | undefined): boolean => {
    return value !== undefined && !isNaN(value) && isFinite(value);
  }
};

/**
 * Create a new Analytics Engine instance
 * @param userId - User ID
 * @param config - Optional analytics configuration
 */
export function createAnalyticsEngine(
  userId: string,
  config?: Partial<AnalyticsConfig>
): AnalyticsEngine {
  return new AnalyticsEngine(userId, config);
}

/**
 * Get all available analyzers
 */
export const Analyzers = {
  Performance: PerformanceAnalyzer,
  Risk: RiskAnalyzer,
  Portfolio: PortfolioAnalyzer
};

// Default export
export default {
  AnalyticsEngine,
  Analyzers,
  AnalyticsUtils,
  createAnalyticsEngine
};
