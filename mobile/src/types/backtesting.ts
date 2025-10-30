/**
 * Backtesting TypeScript Types
 * Complete type definitions for backtesting system
 */

// ============================================================================
// BACKTEST EXECUTION & CONFIGURATION
// ============================================================================

export interface BacktestRequest {
  symbol: string;
  startDate: Date | string;
  endDate: Date | string;
  strategyCode: string;
  initialCapital: number;
  commission?: number;
  slippage?: number;
  shortingAllowed?: boolean;
  maxPositionSize?: number;
}

export interface BacktestStatus {
  id: string;
  symbol: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface BacktestConfig {
  initialCapital: number;
  commission: number;
  slippage: number;
  shortingAllowed: boolean;
  maxPositionSize: number;
}

// ============================================================================
// BACKTEST RESULTS & METRICS
// ============================================================================

export interface BacktestResult {
  id: string;
  symbol: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startDate: Date;
  endDate: Date;
  duration: number; // in days
  initialCapital: number;
  finalEquity: number;
  netProfit: number;
  trades: BacktestTrade[];
  equityCurve: EquityCurvePoint[];
  metrics: BacktestMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface BacktestMetrics {
  // Performance
  totalReturn: number; // percentage
  annualizedReturn: number; // percentage
  netProfit: number;

  // Risk-Adjusted Returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio: number;

  // Volatility & Risk
  volatility: number; // annualized
  dailyVolatility: number;
  maxDrawdown: number; // percentage
  averageDrawdown: number; // percentage
  beta: number;

  // Value at Risk
  var95: number; // percentage
  var99: number; // percentage
  cvar95: number; // percentage
  cvar99: number; // percentage

  // Distribution
  skewness: number;
  kurtosis: number;
  jarqueBeraTest?: {
    statistic: number;
    isNormal: boolean;
    pValue: number;
  };

  // Trade Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // percentage
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgWinLossRatio: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  avgHoldingDays: number;

  // Efficiency
  expectancy: number; // avg profit per trade
  recoveryFactor: number;
}

// ============================================================================
// TRADES & POSITIONS
// ============================================================================

export interface BacktestTrade {
  id: string;
  tradeNumber: number;
  symbol: string;

  // Entry
  entryDate: Date;
  entryTime?: string;
  entryPrice: number;
  entryReason?: string;

  // Exit
  exitDate?: Date;
  exitTime?: string;
  exitPrice?: number;
  exitReason?: string;

  // Quantity & Type
  quantity: number;
  side: 'BUY' | 'SELL';
  positionType: 'long' | 'short';

  // Costs
  entryCommission?: number;
  exitCommission?: number;
  totalCommission: number;
  entrySlippage?: number;
  exitSlippage?: number;

  // P&L
  grossPnL: number;
  netPnL: number;
  pnlPercent: number;

  // Analysis
  holdingPeriod?: number; // days
  barsHeld?: number;
  maxProfit?: number;
  maxLoss?: number;
  riskRewardRatio?: number;

  // Status
  status: 'open' | 'closed';
}

export interface EquityCurvePoint {
  date: Date;
  equity: number;
  cash: number;
  positionsValue: number;
  cumulativePnL: number;
  cumulativeReturn: number;
  drawdown: number; // percentage
  maxDrawdown: number; // percentage
}

export interface BacktestPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  entryDate: Date;
  status: 'open' | 'closed';
  unrealizedPnL: number;
  unrealizedPercent: number;
}

// ============================================================================
// DATA MANAGEMENT
// ============================================================================

export interface HistoricalDataRequest {
  symbol: string;
  startDate: Date | string;
  endDate: Date | string;
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1mo';
}

export interface OHLCV {
  date: Date | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface DataAvailability {
  symbol: string;
  available: boolean;
  startDate?: Date;
  endDate?: Date;
  recordCount?: number;
}

export interface DataValidationResult {
  symbol: string;
  valid: boolean;
  recordCount: number;
  startDate?: Date;
  endDate?: Date;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// COMPARISON
// ============================================================================

export interface PaperComparison {
  backtestReturn: number;
  paperReturn: number;
  returnDifference: number;
  correlation: number;

  backtestSharpe: number;
  paperSharpe: number;
  backtestDrawdown: number;
  paperDrawdown: number;

  backtestWinRate: number;
  paperWinRate: number;
  tradesMatching: number;
  tradesDiverging: number;

  insights: string;
  consistencyScore: number; // 0-100
}

export interface LiveComparison {
  backtestReturn: number;
  liveReturn: number;
  returnDifference: number;
  correlation: number;

  backtestSharpe: number;
  liveSharpe: number;

  backtestSlippage: number;
  liveActualSlippage: number;
  slippageVariance: number;

  backtestWinRate: number;
  liveWinRate: number;

  insights: string;
  executionQualityScore: number; // 0-100
}

// ============================================================================
// OPTIMIZATION
// ============================================================================

export interface OptimizationRequest {
  symbol: string;
  strategyName: string;
  parameterGrid: Record<string, any>;
  objectiveMetric: 'sharpe' | 'return' | 'profit_factor' | 'calmar';
  objectiveDirection?: 'maximize' | 'minimize';
}

export interface OptimizationResult {
  id: string;
  optimizationName: string;
  strategyName: string;
  symbol: string;

  optimationType: 'grid' | 'random' | 'genetic' | 'bayesian';
  parameterGrid: Record<string, any>;
  objectiveMetric: string;

  totalCombinations: number;
  completedCombinations: number;
  progress: number; // 0-100

  bestParameters: Record<string, any>;
  bestMetricValue: number;
  bestBacktestId?: string;

  avgMetricValue: number;
  medianMetricValue: number;
  stdDevMetric: number;

  status: 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

export interface OptimizationTrial {
  trialNumber: number;
  parameters: Record<string, any>;
  metricValue: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  status: 'completed' | 'failed';
  duration: number; // seconds
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  data: T[];
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  service: string;
  version: string;
  timestamp: Date;
  components: {
    database: boolean;
    historicalDataManager: boolean;
    analyticsEngine: boolean;
  };
}

// ============================================================================
// REDUX STATE
// ============================================================================

export interface BacktestingState {
  // Backtest Status
  activeBacktestId?: string;
  backtests: Record<string, BacktestStatus>;
  results: Record<string, BacktestResult>;

  // Data
  availableSymbols: string[];
  dataAvailability: Record<string, DataAvailability>;
  historicalData: Record<string, OHLCV[]>;

  // Comparisons
  paperComparisons: Record<string, PaperComparison>;
  liveComparisons: Record<string, LiveComparison>;

  // Optimization
  optimizations: Record<string, OptimizationResult>;
  optimizationTrials: Record<string, OptimizationTrial[]>;

  // UI State
  selectedBacktestId?: string;
  selectedTradeId?: string;
  showDetailedMetrics: boolean;
  chartTimeframe: '1d' | '1w' | '1mo';

  // Loading & Errors
  loading: boolean;
  error?: string;
  syncProgress: number; // 0-100
}

export interface BacktestUIState {
  // Screen Navigation
  activeScreen: 'setup' | 'results' | 'optimization' | 'history';

  // Form State
  setupForm: {
    symbol: string;
    startDate: Date | string;
    endDate: Date | string;
    initialCapital: number;
    commission: number;
    slippage: number;
  };

  // Results View
  selectedMetric: keyof BacktestMetrics;
  chartType: 'equity' | 'drawdown' | 'returns' | 'trades';
  timeframeFilter: string[];

  // Sorting & Filtering
  sortBy: 'sharpe' | 'return' | 'profit_factor' | 'date' | 'trades';
  sortOrder: 'asc' | 'desc';
  filterStatus: ('completed' | 'running' | 'failed')[];
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type BacktestMetricKey = keyof BacktestMetrics;

export interface MetricDefinition {
  key: BacktestMetricKey;
  label: string;
  description: string;
  unit: '%' | 'ratio' | 'days' | 'count' | '$' | 'none';
  minGood?: number; // Lower is better
  maxGood?: number; // Higher is better
  category: 'performance' | 'risk' | 'trade' | 'efficiency';
}

export interface BacktestChartData {
  dates: Date[];
  values: number[];
  title: string;
  yAxisLabel: string;
  xAxisLabel: string;
  color?: string;
}

export interface TradeFilterOptions {
  minPnL?: number;
  maxPnL?: number;
  minDuration?: number;
  maxDuration?: number;
  winningOnly?: boolean;
  losingOnly?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const BACKTESTING_METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  sharpeRatio: {
    key: 'sharpeRatio',
    label: 'Sharpe Ratio',
    description: 'Risk-adjusted return metric',
    unit: 'ratio',
    minGood: 1.0,
    category: 'risk'
  },
  maxDrawdown: {
    key: 'maxDrawdown',
    label: 'Max Drawdown',
    description: 'Maximum peak-to-trough decline',
    unit: '%',
    maxGood: -5,
    category: 'risk'
  },
  totalReturn: {
    key: 'totalReturn',
    label: 'Total Return',
    description: 'Overall profit/loss percentage',
    unit: '%',
    minGood: 0,
    category: 'performance'
  },
  winRate: {
    key: 'winRate',
    label: 'Win Rate',
    description: 'Percentage of winning trades',
    unit: '%',
    minGood: 50,
    category: 'trade'
  },
  profitFactor: {
    key: 'profitFactor',
    label: 'Profit Factor',
    description: 'Gross profit / Gross loss',
    unit: 'ratio',
    minGood: 1.5,
    category: 'efficiency'
  }
};

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  initialCapital: 100000,
  commission: 0.001, // 0.1%
  slippage: 0.0005,  // 0.05%
  shortingAllowed: true,
  maxPositionSize: 1.0
};

// ============================================================================
// UTILITY TYPE GUARDS
// ============================================================================

export function isBacktestResult(obj: any): obj is BacktestResult {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.symbol === 'string' &&
    Array.isArray(obj.trades) &&
    obj.metrics &&
    typeof obj.metrics.totalReturn === 'number'
  );
}

export function isBacktestTrade(obj: any): obj is BacktestTrade {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.entryPrice === 'number' &&
    typeof obj.netPnL === 'number'
  );
}

export function isBacktestMetrics(obj: any): obj is BacktestMetrics {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.sharpeRatio === 'number' &&
    typeof obj.maxDrawdown === 'number' &&
    typeof obj.totalTrades === 'number'
  );
}
