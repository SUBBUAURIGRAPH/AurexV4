/**
 * Strategy Builder - Type Definitions
 * Sprint 2 Week 1-3: Type system for strategy DSL and execution
 * Version: 1.0.0
 */

// ============================================================================
// CORE STRATEGY TYPES
// ============================================================================

/**
 * Supported data types in conditions
 */
export type DataType = 'number' | 'string' | 'boolean' | 'array' | 'object';

/**
 * Trading signals (primary output of strategies)
 */
export type TradingSignal = 'BUY' | 'SELL' | 'HOLD' | 'CLOSE' | 'STOP_LOSS' | 'TAKE_PROFIT';

/**
 * Market data types
 */
export type MarketDataType = 'PRICE' | 'VOLUME' | 'RSI' | 'MACD' | 'BOLLINGER' | 'MA' | 'EMA' | 'ATR' | 'STOCHASTIC';

/**
 * Strategy execution status
 */
export type StrategyStatus = 'IDLE' | 'ACTIVE' | 'WAITING' | 'TRIGGERED' | 'ERROR' | 'PAUSED';

/**
 * Condition operators
 */
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'contains' | 'not_contains' | 'between' | 'crosses_above' | 'crosses_below';

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR' | 'NOT' | 'XOR';

// ============================================================================
// CONDITION SYSTEM
// ============================================================================

/**
 * Single condition in a strategy
 */
export interface Condition {
  id: string;
  type: 'price' | 'volume' | 'indicator' | 'custom' | 'time' | 'portfolio';
  operator: ConditionOperator;
  value: number | string | boolean | number[];
  indicator?: string; // e.g., 'RSI', 'MACD'
  period?: number; // for indicators
  threshold?: number; // comparison threshold
}

/**
 * Logical condition group (AND/OR combined conditions)
 */
export interface ConditionGroup {
  operator: LogicalOperator;
  conditions: (Condition | ConditionGroup)[];
}

/**
 * Entry condition for strategy
 */
export interface EntryCondition extends ConditionGroup {
  id: string;
  name: string;
  description: string;
}

/**
 * Exit condition for strategy (stop loss, take profit)
 */
export interface ExitCondition {
  id: string;
  type: 'stop_loss' | 'take_profit' | 'time_based' | 'condition_based';
  trigger: Condition | ConditionGroup | 'manual';
  value?: number; // percentage or fixed amount
}

// ============================================================================
// ACTION SYSTEM
// ============================================================================

/**
 * Trading action (buy, sell, close position)
 */
export interface Action {
  id: string;
  type: 'buy' | 'sell' | 'close' | 'partial_close' | 'stop_loss' | 'take_profit' | 'alert' | 'notification';
  size?: number; // quantity or percentage
  price?: 'market' | 'limit' | number; // execution price
  timeInForce?: 'IOC' | 'FOK' | 'GTC' | 'DAY'; // time in force
  metadata?: Record<string, any>;
}

/**
 * Strategy action execution plan
 */
export interface ActionPlan {
  entryActions: Action[];
  exitActions: Action[];
  monitoringActions: Action[];
}

// ============================================================================
// PARAMETER SYSTEM
// ============================================================================

/**
 * Strategy parameter with constraints
 */
export interface Parameter {
  name: string;
  description: string;
  type: DataType;
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<string | number>;
  unit?: string; // e.g., '%', 'USD', 'period'
  optimizable?: boolean;
}

/**
 * Optimized parameter set
 */
export interface ParameterSet {
  parameters: Record<string, number | string | boolean>;
  performanceScore: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

// ============================================================================
// STRATEGY DEFINITION
// ============================================================================

/**
 * Complete strategy definition
 */
export interface Strategy {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  category: StrategyCategory;
  tags: string[];

  // Trading configuration
  tradingPair: string; // e.g., 'BTC/USD'
  exchange: string;
  timeframe: string; // '1m', '5m', '15m', '1h', '4h', '1d'

  // Strategy logic
  entryCondition: EntryCondition;
  exitConditions: ExitCondition[];
  actions: ActionPlan;

  // Parameters
  parameters: Parameter[];
  defaultParameters: Record<string, number | string | boolean>;

  // Risk management
  maxPositionSize?: number; // percentage of portfolio
  maxDailyLoss?: number; // percentage
  maxDrawdown?: number; // percentage
  correlationThreshold?: number;

  // Metadata
  complexity: 'simple' | 'moderate' | 'complex';
  riskLevel: 'low' | 'medium' | 'high';
  minCapital?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Strategy category
 */
export type StrategyCategory =
  | 'trend_following'
  | 'mean_reversion'
  | 'momentum'
  | 'arbitrage'
  | 'options'
  | 'machine_learning'
  | 'hybrid'
  | 'custom';

// ============================================================================
// DSL REPRESENTATION
// ============================================================================

/**
 * Strategy in DSL format (YAML/JSON)
 */
export interface StrategyDSL {
  strategy:
    | {
        name: string;
        description: string;
        category: StrategyCategory;
        trading_pair: string;
        exchange: string;
        timeframe: string;

        parameters?: {
          [key: string]: {
            type: DataType;
            default: any;
            min?: number;
            max?: number;
          };
        };

        entry_condition: {
          name: string;
          logic: string; // e.g., "RSI < 30 AND PRICE > MA(50)"
        };

        exit_conditions: Array<{
          type: string;
          condition: string;
        }>;

        actions: {
          entry: string[];
          exit: string[];
        };

        risk_management?: {
          max_position_size?: number;
          max_daily_loss?: number;
          max_drawdown?: number;
        };
      }
    | string; // YAML string
}

// ============================================================================
// EXECUTION & STATE
// ============================================================================

/**
 * Runtime execution state
 */
export interface StrategyState {
  strategyId: string;
  status: StrategyStatus;
  currentSignal: TradingSignal;
  lastSignalTime: Date | null;
  position: Position | null;
  entryPrice?: number;
  exitPrice?: number;
  openedAt?: Date;
  closedAt?: Date;
  metadata: Record<string, any>;
}

/**
 * Open position
 */
export interface Position {
  id: string;
  strategyId: string;
  entryPrice: number;
  quantity: number;
  entryTime: Date;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  exitPrice?: number;
  exitTime?: Date;
  realizedPnL?: number;
}

/**
 * Strategy execution metrics
 */
export interface StrategyMetrics {
  strategyId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // percentage
  averageWin: number;
  averageLoss: number;
  profitFactor: number; // gross profit / gross loss
  totalReturnPercentage: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

/**
 * Strategy template with pre-configured parameters
 */
export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: StrategyCategory;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  strategy: Strategy;
  recommendedFor: string[]; // market conditions
  disclaimer?: string;
}

// ============================================================================
// OPTIMIZATION TYPES
// ============================================================================

/**
 * Optimization request
 */
export interface OptimizationRequest {
  strategyId: string;
  parameters: Parameter[];
  historicalData: MarketData[];
  optimizationAlgorithm: 'grid' | 'genetic' | 'bayesian';
  constraints: {
    maxRunTime?: number; // milliseconds
    maxIterations?: number;
    performanceTarget?: number; // min sharpe ratio, for example
  };
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  originalParameterSet: ParameterSet;
  optimizedParameterSet: ParameterSet;
  improvementPercentage: number;
  suggestedStrategy: Strategy;
  confidence: number; // 0-1
  backtestResults: BacktestResult;
}

// ============================================================================
// BACKTEST TYPES
// ============================================================================

/**
 * Market data for backtesting
 */
export interface MarketData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  indicators?: Record<string, number>;
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  strategyId: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  slippage?: number; // percentage
  commissionPercentage?: number;
  maxDrawdown?: number;
}

/**
 * Backtest results
 */
export interface BacktestResult {
  totalReturn: number;
  totalReturnPercentage: number;
  trades: TradeResult[];
  metrics: StrategyMetrics;
  drawdownAnalysis: DrawdownAnalysis;
  monthlyReturns: Record<string, number>;
  equityCurve: EquityPoint[];
}

/**
 * Single trade result from backtest
 */
export interface TradeResult {
  entryTime: Date;
  entryPrice: number;
  exitTime: Date;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercentage: number;
  duration: number; // milliseconds
}

/**
 * Drawdown analysis
 */
export interface DrawdownAnalysis {
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  drawdownDuration: number; // days
  recoveryDuration: number; // days
  drawdownPeriods: Array<{
    startTime: Date;
    endTime: Date;
    depth: number;
    recovery: Date;
  }>;
}

/**
 * Equity curve point for visualization
 */
export interface EquityPoint {
  timestamp: Date;
  equity: number;
  cumulativeReturn: number;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Strategy validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion: string;
}
