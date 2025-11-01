/**
 * CLI Type Definitions
 * Type system for CLI commands and utilities
 * @version 1.0.0
 */

export interface CLIConfig {
  apiUrl: string;
  apiKey?: string;
  userId: string;
  outputFormat: 'table' | 'json' | 'csv' | 'yaml';
  verbose: boolean;
  configPath: string;
  credentialsPath: string;
}

export interface CommandOptions {
  user?: string;
  strategy?: string;
  format?: string;
  verbose?: boolean;
  config?: string;
  [key: string]: any;
}

export interface StrategyInfo {
  id: string;
  name: string;
  description?: string;
  dsl: string;
  status: 'active' | 'inactive' | 'testing' | 'deployed';
  createdAt: Date;
  updatedAt: Date;
  lastBacktest?: Date;
  performance?: {
    sharpeRatio: number;
    totalReturn: number;
    maxDrawdown: number;
    winRate: number;
  };
}

export interface PortfolioInfo {
  userId: string;
  totalValue: number;
  cash: number;
  investedValue: number;
  dayReturn: number;
  dayReturnPercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  positions: Position[];
  allocation: AssetAllocation[];
}

export interface Position {
  symbol: string;
  quantity: number;
  currentPrice: number;
  averageCost: number;
  totalValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  percentOfPortfolio: number;
}

export interface AssetAllocation {
  assetClass: string;
  value: number;
  percentage: number;
  target?: number;
  difference?: number;
}

export interface OrderInfo {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'trailing_stop' | 'bracket';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  filledQuantity: number;
  filledPrice?: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface AnalyticsMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  profitFactor: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  dailyVolatility: number;
  cumulativeReturn: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  payoffRatio: number;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  volumeQty: number;
  dayChange: number;
  dayChangePercent: number;
  high52week: number;
  low52week: number;
  marketCap?: number;
  peRatio?: number;
  timestamp: Date;
}

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CLIError extends Error {
  code: string;
  statusCode?: number;
  suggestion?: string;
}

export interface FormatterOptions {
  headers?: string[];
  style?: 'default' | 'compact' | 'detailed';
  maxWidth?: number;
  truncate?: boolean;
}

export interface ValidatorOptions {
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'json';
  pattern?: RegExp;
  min?: number;
  max?: number;
  enum?: string[];
}

export interface AuthCredentials {
  apiKey: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface AccountInfo {
  userId: string;
  email: string;
  username: string;
  accountType: 'demo' | 'live' | 'paper';
  accountStatus: 'active' | 'suspended' | 'inactive';
  createdAt: Date;
  lastLoginAt?: Date;
  apiKeysCount: number;
  twoFactorEnabled: boolean;
}

export interface CLICommand {
  name: string;
  description: string;
  handler: (args: CommandOptions) => Promise<void>;
  options?: Record<string, any>;
  examples?: string[];
  group?: string;
}

export interface ExportFormat {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  data: any;
  filename: string;
  headers?: string[];
}

export enum OutputFormat {
  TABLE = 'table',
  JSON = 'json',
  CSV = 'csv',
  YAML = 'yaml'
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}
