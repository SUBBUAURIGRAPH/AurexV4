/**
 * Strategy Builder - Core Type Definitions
 * Version: 5.0.0
 *
 * Comprehensive TypeScript type definitions for the Strategy Builder system
 */

import { Request } from 'express';
import { Document } from 'mongoose';

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export enum UserRole {
  VIEWER = 'viewer',
  TRADER = 'trader',
  SENIOR_TRADER = 'senior_trader',
  RISK_MANAGER = 'risk_manager',
  ADMIN = 'admin'
}

export interface IUser extends Document {
  _id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface AuthRequest extends Request {
  user?: IUser;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface IAPIKey extends Document {
  _id: string;
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  lastUsed?: Date;
  expiresAt?: Date;
  rateLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface APIKeyRequest extends Request {
  user?: IUser;
  apiKey?: IAPIKey;
}

// ============================================================================
// STRATEGY TYPES
// ============================================================================

export enum StrategyStatus {
  DRAFT = 'draft',
  VALIDATED = 'validated',
  BACKTESTED = 'backtested',
  OPTIMIZED = 'optimized',
  DEPLOYED = 'deployed',
  ARCHIVED = 'archived'
}

export enum StrategyMode {
  VISUAL = 'visual',
  CODE = 'code',
  HYBRID = 'hybrid'
}

export interface IndicatorConfig {
  type: string;
  params: Record<string, unknown>;
  outputs: string[];
}

export interface EntryCondition {
  type: 'AND' | 'OR';
  conditions: Array<{
    indicator: string;
    operator: 'GT' | 'LT' | 'EQ' | 'GTE' | 'LTE' | 'CROSS_ABOVE' | 'CROSS_BELOW';
    value: number | string;
  }>;
}

export interface ExitCondition {
  type: 'AND' | 'OR';
  conditions: Array<{
    indicator: string;
    operator: 'GT' | 'LT' | 'EQ' | 'GTE' | 'LTE' | 'CROSS_ABOVE' | 'CROSS_BELOW';
    value: number | string;
  }>;
}

export interface RiskManagement {
  positionSizing: 'FIXED' | 'PERCENT' | 'KELLY' | 'VOLATILITY';
  positionSize: number;
  maxPositions: number;
  stopLoss?: {
    type: 'FIXED' | 'PERCENT' | 'ATR';
    value: number;
  };
  takeProfit?: {
    type: 'FIXED' | 'PERCENT' | 'RISK_REWARD';
    value: number;
  };
  trailingStop?: {
    enabled: boolean;
    type: 'FIXED' | 'PERCENT' | 'ATR';
    value: number;
  };
}

export interface IStrategy extends Document {
  _id: string;
  name: string;
  description: string;
  userId: string;
  status: StrategyStatus;
  mode: StrategyMode;
  visualData?: {
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: Record<string, unknown>;
    }>;
    connections: Array<{
      id: string;
      source: string;
      target: string;
    }>;
  };
  codeData?: {
    language: 'javascript' | 'python';
    code: string;
  };
  indicators: IndicatorConfig[];
  entryConditions: EntryCondition;
  exitConditions: ExitCondition;
  riskManagement: RiskManagement;
  timeframes: string[];
  markets: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastValidated?: Date;
  validationErrors?: string[];
  tags: string[];
  isPublic: boolean;
  clonedFrom?: string;
}

// ============================================================================
// BACKTEST TYPES
// ============================================================================

export enum BacktestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  timeframe: string;
  markets: string[];
  commission: number;
  slippage: number;
  warmupPeriod?: number;
}

export interface Trade {
  id: string;
  entryTime: Date;
  entryPrice: number;
  exitTime?: Date;
  exitPrice?: number;
  direction: 'LONG' | 'SHORT';
  size: number;
  pnl?: number;
  pnlPercent?: number;
  commission: number;
  slippage: number;
  stopLoss?: number;
  takeProfit?: number;
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'SIGNAL' | 'EOD';
  market: string;
}

export interface BacktestMetrics {
  totalReturn: number;
  returnPercent: number;
  cagr: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownDuration: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  avgWinPercent: number;
  avgLossPercent: number;
  largestWin: number;
  largestLoss: number;
  avgTradeDuration: number;
  avgBarsInTrade: number;
  expectancy: number;
  kelly: number;
  volatility: number;
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  equityCurve: Array<{ date: Date; equity: number }>;
  drawdownCurve: Array<{ date: Date; drawdown: number }>;
  trades: Trade[];
  monthlyReturns: Array<{ month: string; return: number }>;
  logs: Array<{ timestamp: Date; level: string; message: string }>;
}

export interface IBacktest extends Document {
  _id: string;
  strategyId: string;
  userId: string;
  status: BacktestStatus;
  config: BacktestConfig;
  result?: BacktestResult;
  progress: number;
  error?: string;
  startTime: Date;
  endTime?: Date;
  executionTime?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// OPTIMIZATION TYPES
// ============================================================================

export enum OptimizationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum OptimizationAlgorithm {
  GRID_SEARCH = 'grid_search',
  GENETIC = 'genetic',
  BAYESIAN = 'bayesian'
}

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
  type: 'int' | 'float';
}

export interface OptimizationConfig {
  algorithm: OptimizationAlgorithm;
  parameters: ParameterRange[];
  objectiveMetric: keyof BacktestMetrics;
  constraints?: {
    minTrades?: number;
    minWinRate?: number;
    maxDrawdown?: number;
  };
  geneticConfig?: {
    populationSize: number;
    generations: number;
    mutationRate: number;
    crossoverRate: number;
  };
  bayesianConfig?: {
    iterations: number;
    acquisitionFunction: 'EI' | 'PI' | 'UCB';
  };
}

export interface OptimizationResult {
  bestParameters: Record<string, number>;
  bestMetrics: BacktestMetrics;
  allResults: Array<{
    parameters: Record<string, number>;
    metrics: BacktestMetrics;
  }>;
  convergencePlot?: Array<{ iteration: number; value: number }>;
}

export interface IOptimization extends Document {
  _id: string;
  strategyId: string;
  userId: string;
  status: OptimizationStatus;
  config: OptimizationConfig;
  backtestConfig: BacktestConfig;
  result?: OptimizationResult;
  progress: number;
  error?: string;
  startTime: Date;
  endTime?: Date;
  executionTime?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// DEPLOYMENT TYPES
// ============================================================================

export enum DeploymentStatus {
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RUNNING = 'running',
  STOPPED = 'stopped',
  FAILED = 'failed'
}

export enum DeploymentEnvironment {
  PAPER = 'paper',
  LIVE = 'live'
}

export interface DeploymentConfig {
  environment: DeploymentEnvironment;
  markets: string[];
  maxCapital: number;
  riskLimits: {
    maxDailyLoss: number;
    maxDrawdown: number;
    maxPositionSize: number;
  };
}

export interface IDeployment extends Document {
  _id: string;
  strategyId: string;
  userId: string;
  status: DeploymentStatus;
  config: DeploymentConfig;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  deployedAt?: Date;
  stoppedAt?: Date;
  performance?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    activeTrades: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// INDICATOR TYPES
// ============================================================================

export enum IndicatorCategory {
  TREND = 'trend',
  MOMENTUM = 'momentum',
  VOLATILITY = 'volatility',
  VOLUME = 'volume',
  OTHER = 'other'
}

export interface IndicatorDefinition {
  type: string;
  name: string;
  category: IndicatorCategory;
  description: string;
  params: Array<{
    name: string;
    type: 'int' | 'float' | 'string' | 'boolean';
    default: unknown;
    min?: number;
    max?: number;
    options?: string[];
    description: string;
  }>;
  outputs: Array<{
    name: string;
    description: string;
  }>;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// WEBSOCKET TYPES
// ============================================================================

export enum WebSocketEventType {
  STRATEGY_UPDATED = 'strategy:updated',
  BACKTEST_PROGRESS = 'backtest:progress',
  BACKTEST_COMPLETE = 'backtest:complete',
  BACKTEST_FAILED = 'backtest:failed',
  OPTIMIZATION_PROGRESS = 'optimization:progress',
  OPTIMIZATION_COMPLETE = 'optimization:complete',
  OPTIMIZATION_FAILED = 'optimization:failed',
  DEPLOYMENT_STATUS = 'deployment:status'
}

export interface WebSocketMessage {
  type: WebSocketEventType;
  payload: unknown;
  timestamp: Date;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  suggestions?: string[];
}

// ============================================================================
// EXPORT/IMPORT TYPES
// ============================================================================

export interface ExportFormat {
  type: 'json' | 'yaml' | 'pine' | 'mql';
  version: string;
}

export interface StrategyExport {
  strategy: IStrategy;
  format: ExportFormat;
  metadata: {
    exportedAt: Date;
    exportedBy: string;
    version: string;
  };
}
