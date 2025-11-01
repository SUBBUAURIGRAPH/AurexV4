/**
 * Analytics System Types
 * Comprehensive type definitions for all analytics features
 * @version 1.0.0
 */

// =====================================================
// PERFORMANCE METRICS TYPES
// =====================================================

export interface PerformanceMetrics {
  id: number;
  userId: string;
  strategyId: string;
  timestamp: Date;

  // Price & Returns
  portfolioValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
  priceChange: number;

  // Risk Metrics
  dailyVolatility?: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  maxDrawdown?: number;

  // Trade Metrics
  winRate?: number;
  profitFactor?: number;
  totalTrades?: number;
  winningTrades?: number;
  losingTrades?: number;
  avgWin?: number;
  avgLoss?: number;
  largestWin?: number;
  largestLoss?: number;

  // Advanced Metrics
  recoveryFactor?: number;
  expectancy?: number;
  payoffRatio?: number;
  profitLoss?: number;
}

export interface PerformanceSummary {
  current: PerformanceMetrics;
  daily: PerformanceMetrics[];
  weekly: PerformanceMetrics[];
  monthly: PerformanceMetrics[];
}

// =====================================================
// PORTFOLIO ANALYTICS TYPES
// =====================================================

export interface AssetAllocation {
  symbol: string;
  value: number;
  percentage: number;
  quantity: number;
}

export interface PortfolioAnalytics {
  id: number;
  userId: string;
  timestamp: Date;

  // Portfolio Value
  totalValue: number;
  cashBalance: number;
  investedValue: number;

  // Asset Allocation
  allocation: AssetAllocation[];

  // Portfolio Metrics
  portfolioReturn?: number;
  portfolioVolatility?: number;
  portfolioSharpeRatio?: number;
  portfolioBeta?: number;
  portfolioAlpha?: number;

  // Diversification
  concentrationIndex?: number;
  numberOfPositions: number;
  largestPositionPct?: number;

  // Correlation Metrics
  avgCorrelation?: number;
  diversificationRatio?: number;
}

export interface DiversificationMetrics {
  concentrationIndex: number;
  herfindahlIndex: number;
  diversificationRatio: number;
  numberOfPositions: number;
  largestPosition: number;
  topThreeConcentration: number;
}

// =====================================================
// RISK ANALYTICS TYPES
// =====================================================

export interface RiskMetrics {
  id: number;
  userId: string;
  strategyId?: string;
  timestamp: Date;

  // Value at Risk
  var95?: number;
  var99?: number;
  cvar95?: number;
  cvar99?: number;

  // Drawdown Metrics
  maxDrawdownPercent?: number;
  currentDrawdownPercent?: number;
  recoveryDays?: number;
  consecutiveLosingDays?: number;
  consecutiveLosingTrades?: number;

  // Volatility Metrics
  annualVolatility?: number;
  downsideVolatility?: number;
  upsideVolatility?: number;
  volatilityRatio?: number;

  // Stress Testing
  worstDayLoss?: number;
  worstWeekLoss?: number;
  worstMonthLoss?: number;
  bestDayGain?: number;
  bestWeekGain?: number;
  bestMonthGain?: number;

  // Risk Rating
  riskScore?: number; // 0-100
  riskLevel?: RiskLevel;
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface StressTestResult {
  scenario: string;
  worstCaseLoss: number;
  probability: number;
  expectedShortfall: number;
}

export interface HistoricalDrawdown {
  date: Date;
  drawdown: number;
  recoveryDate?: Date;
  recoveryDays?: number;
}

// =====================================================
// TRADE-LEVEL ANALYTICS TYPES
// =====================================================

export interface TradeAnalytics {
  id: number;
  userId: string;
  strategyId: string;
  tradeId: string;

  symbol: string;
  entryTime: Date;
  exitTime?: Date;

  // Trade Details
  entryPrice: number;
  exitPrice?: number;
  quantity: number;

  // P&L
  entryCost: number;
  exitValue?: number;
  grossProfit?: number;
  netProfit?: number;
  profitPercent?: number;

  // Risk
  stopLossPrice?: number;
  takeProfitPrice?: number;
  maxProfitReached?: number;
  maxLossReached?: number;

  // Trade Metrics
  holdingTimeMinutes?: number;
  consecutiveWinning?: boolean;
  tradeType: TradeType;
  status: TradeStatus;
}

export enum TradeType {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export enum TradeStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export interface TradeStatistics {
  userId: string;
  strategyId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  winRate: number;
  totalProfit: number;
  avgHoldingMinutes: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

// =====================================================
// DAILY SNAPSHOT TYPES
// =====================================================

export interface DailySnapshot {
  id: number;
  userId: string;
  strategyId?: string;
  snapshotDate: Date;

  // Opening/Closing Values
  openingValue?: number;
  closingValue?: number;
  dailyChange?: number;
  dailyReturnPct?: number;

  // Daily Metrics
  dailyHigh?: number;
  dailyLow?: number;
  dailyVolume?: number;

  // Trade Summary
  tradesCount: number;
  winningTrades: number;
  losingTrades: number;
  winningPct?: number;
  dailyProfit?: number;

  // Risk
  maxDailyDrawdown?: number;
  dailyVolatility?: number;
}

// =====================================================
// ALERTS & NOTIFICATIONS TYPES
// =====================================================

export interface AnalyticsAlert {
  id: number;
  userId: string;
  strategyId?: string;

  alertType: AlertType;
  alertLevel: AlertLevel;

  title: string;
  description: string;

  metricName?: string;
  metricValue?: number;
  thresholdValue?: number;

  isAcknowledged: boolean;
  acknowledgedAt?: Date;

  metadata?: Record<string, any>;
  createdAt: Date;
}

export enum AlertType {
  DRAWDOWN = 'DRAWDOWN',
  VOLATILITY = 'VOLATILITY',
  LOSS_STREAK = 'LOSS_STREAK',
  PROFIT_TARGET = 'PROFIT_TARGET',
  RISK_WARNING = 'RISK_WARNING',
  POSITION_LIMIT = 'POSITION_LIMIT',
  CORRELATION_SPIKE = 'CORRELATION_SPIKE',
  DIVERSIFICATION_LOW = 'DIVERSIFICATION_LOW'
}

export enum AlertLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

// =====================================================
// ANALYTICS CONFIGURATION TYPES
// =====================================================

export interface AnalyticsConfig {
  id: number;
  userId: string;

  // Metrics to track
  trackPerformance: boolean;
  trackPortfolio: boolean;
  trackRisk: boolean;
  trackTrades: boolean;

  // Alert Thresholds
  maxDrawdownAlert: number; // percentage
  volatilityAlert: number; // percentage
  lossStreakAlert: number; // consecutive losses

  // Calculation Settings
  sharpeRatioRf: number; // risk-free rate
  lookbackDays: number; // for volatility calculation

  // Retention Policy
  retentionDays: number;
  autoCleanup: boolean;
}

// =====================================================
// AGGREGATED ANALYTICS TYPES
// =====================================================

export interface AggregatedAnalytics {
  performance: PerformanceMetrics;
  portfolio: PortfolioAnalytics;
  risk: RiskMetrics;
  trades: TradeStatistics;
  dailySnapshot: DailySnapshot;
  alerts: AnalyticsAlert[];
}

export interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
}

export interface AnalyticsComparison {
  current: AggregatedAnalytics;
  previous: AggregatedAnalytics;
  changes: {
    [key: string]: {
      value: number;
      percentChange: number;
      trend: 'up' | 'down' | 'neutral';
    };
  };
}

// =====================================================
// ANALYTICS REQUEST/RESPONSE TYPES
// =====================================================

export interface AnalyticsQuery {
  userId: string;
  strategyId?: string;
  startDate?: Date;
  endDate?: Date;
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month';
  limit?: number;
}

export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  timestamp: Date;
  duration: number; // milliseconds
  error?: string;
}

// =====================================================
// CHART/VISUALIZATION DATA TYPES
// =====================================================

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  secondary?: number;
}

export interface ChartData {
  label: string;
  data: ChartDataPoint[];
  unit?: string;
  min?: number;
  max?: number;
  average?: number;
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'chart' | 'metric' | 'table' | 'gauge';
  data: any;
  lastUpdated: Date;
  refreshInterval?: number; // seconds
}

export interface AnalyticsDashboard {
  userId: string;
  name: string;
  widgets: DashboardWidget[];
  layout?: string; // grid configuration
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
