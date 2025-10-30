/**
 * Analytics Dashboard Types - Complete type system for metrics, analysis, and dashboards
 *
 * @module analytics-dashboard/types
 * @version 1.0.0
 */

/**
 * Time period types for analysis
 */
export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

/**
 * Performance metrics for trading strategies
 */
export interface PerformanceMetrics {
  timestamp: Date;
  strategyId: string;
  period: TimePeriod;

  // Return metrics
  totalReturn: number;
  annualizedReturn: number;
  monthlyReturns: number[];
  dailyReturns: number[];

  // Risk-adjusted return metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calphaRatio: number;
  informationRatio: number;

  // Drawdown metrics
  maxDrawdown: number;
  currentDrawdown: number;
  drawdownDuration: number;
  recoveryTime: number;

  // Win metrics
  winRate: number;
  profitFactor: number;
  expectancy: number;
  payoffRatio: number;

  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;

  // Consecutive metrics
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;

  // Time metrics
  averageTradeTime: number; // milliseconds
  shortestTradeTime: number;
  longestTradeTime: number;
}

/**
 * Risk analysis metrics
 */
export interface RiskMetrics {
  timestamp: Date;
  strategyId: string;

  // Value at Risk
  var95: number;      // 95% confidence level
  var99: number;      // 99% confidence level
  expectedShortfall95: number;
  expectedShortfall99: number;

  // Risk measures
  volatility: number;
  standardDeviation: number;
  beta: number;
  alpha: number;

  // Concentration risk
  largestPosition: number;
  largestPositionSize: number;
  concentrationRatio: number;

  // Correlation
  assetCorrelations: {[assetId: string]: number};
  strategyCorrelations: {[strategyId: string]: number};

  // Stress testing
  stressTestResults: {
    scenario: string;
    maxLoss: number;
    probability: number;
  }[];

  // Risk exposure
  marketRisk: number;
  operationalRisk: number;
  liquidityRisk: number;
  counterpartyRisk: number;
}

/**
 * Attribution analysis for performance breakdown
 */
export interface AttributionMetrics {
  timestamp: Date;
  strategyId: string;

  // Contribution by component
  strategyContribution: {[strategyId: string]: number};
  assetClassContribution: {[assetClass: string]: number};
  factorContribution: {[factor: string]: number};

  // Execution analysis
  totalSlippage: number;
  averageSlippage: number;
  commissions: number;
  fees: number;
  taxImpact: number;
  marketImpact: number;
  opportunityCost: number;

  // Trade analysis
  averageWinPrice: number;
  averageLossPrice: number;
  averageEntryPrice: number;
  averageExitPrice: number;
  priceImprovement: number;

  // Timing analysis
  entryTiming: number;  // -1 to 1, positive = good timing
  exitTiming: number;   // -1 to 1, positive = good timing
  positionSizing: number; // -1 to 1, positive = good sizing
}

/**
 * Time series analysis
 */
export interface TimeSeriesMetrics {
  timestamp: Date;
  strategyId: string;

  // Autocorrelation
  acf: number[];        // Autocorrelation function
  pacf: number[];       // Partial autocorrelation function
  acfLags: number;

  // Decomposition
  trend: number[];      // Trend component
  seasonality: number[]; // Seasonal component
  residuals: number[];  // Residual component

  // Stationarity test
  adfStatistic: number;
  adfPValue: number;
  isStationary: boolean;

  // Forecasting
  forecast: number[];
  forecastConfidenceUpper: number[];
  forecastConfidenceLower: number[];
  forecastPeriods: number;

  // Volatility clustering
  garchCoefficients: {alpha: number; beta: number};
  conditionalVolatility: number[];
}

/**
 * Portfolio analysis metrics
 */
export interface PortfolioMetrics {
  timestamp: Date;

  // Allocation
  allocation: {[assetId: string]: number};
  sectorAllocation: {[sector: string]: number};
  strategyAllocation: {[strategyId: string]: number};

  // Overall metrics
  totalValue: number;
  netReturn: number;
  portfolioSharpe: number;
  portfolioVolatility: number;

  // Diversification
  herfindahlIndex: number;
  diversificationRatio: number;
  correlationWithBenchmark: number;

  // Risk metrics
  portfolioVaR: number;
  componentVaR: {[assetId: string]: number};
  marginalVaR: {[assetId: string]: number};

  // Contribution analysis
  returnContribution: {[strategyId: string]: number};
  riskContribution: {[strategyId: string]: number};
}

/**
 * Dashboard data structure
 */
export interface DashboardData {
  id: string;
  name: string;
  type: 'overview' | 'performance' | 'risk' | 'portfolio' | 'trade-analysis';
  timestamp: Date;

  // Data
  performance?: PerformanceMetrics;
  risk?: RiskMetrics;
  attribution?: AttributionMetrics;
  portfolio?: PortfolioMetrics;
  timeSeries?: TimeSeriesMetrics;

  // Charts and visualizations
  charts: {
    title: string;
    type: 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter';
    data: any;
  }[];

  // Metadata
  refreshRate: number; // ms
  lastUpdated: Date;
  dataPoints: number;
}

/**
 * Report generation
 */
export interface Report {
  id: string;
  name: string;
  type: 'summary' | 'detailed' | 'performance' | 'risk' | 'attribution';
  format: 'pdf' | 'csv' | 'xlsx' | 'json';
  generatedAt: Date;
  period: {start: Date; end: Date};
  strategyIds: string[];
  data: {[key: string]: any};
}

/**
 * Real-time metric stream
 */
export interface MetricStreamEvent {
  timestamp: Date;
  strategyId: string;
  metric: string;
  value: number;
  change: number;
  changePercent: number;
  period: TimePeriod;
}

/**
 * Benchmark for comparison
 */
export interface Benchmark {
  id: string;
  name: string;
  type: 'index' | 'custom' | 'peer';
  returns: number[];
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
}

/**
 * Alert configuration for analytics
 */
export interface AnalyticsAlert {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  direction: 'above' | 'below';
  enabled: boolean;
  actions: {
    type: 'webhook' | 'email' | 'slack' | 'sms';
    target: string;
  }[];
}

/**
 * API request/response types
 */
export interface MetricsRequest {
  strategyId?: string;
  period: TimePeriod;
  startDate?: Date;
  endDate?: Date;
  includeMetrics: string[];
}

export interface MetricsResponse {
  data: {
    performance?: PerformanceMetrics;
    risk?: RiskMetrics;
    attribution?: AttributionMetrics;
    portfolio?: PortfolioMetrics;
    timeSeries?: TimeSeriesMetrics;
  };
  timestamp: Date;
  calculationTime: number; // ms
}

/**
 * Trade record for analysis
 */
export interface TradeRecord {
  id: string;
  strategyId: string;
  timestamp: Date;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  duration: number; // ms
  commission: number;
  slippage: number;
}

/**
 * Backtest result
 */
export interface BacktestResult {
  strategyId: string;
  performanceMetrics: PerformanceMetrics;
  riskMetrics: RiskMetrics;
  trades: TradeRecord[];
  period: {start: Date; end: Date};
  totalCapital: number;
  finalCapital: number;
  generatedAt: Date;
}

export default {
  PerformanceMetrics,
  RiskMetrics,
  AttributionMetrics,
  TimeSeriesMetrics,
  PortfolioMetrics,
  DashboardData,
  Report,
  MetricStreamEvent,
  Benchmark,
  AnalyticsAlert,
  MetricsRequest,
  MetricsResponse,
  TradeRecord,
  BacktestResult,
};
