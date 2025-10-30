/**
 * Exchange Connector - Type Definitions
 * Comprehensive types for all exchange connector functionality
 * Version: 1.0.0
 */

export interface ExchangeConfig {
  name: string;
  enabled?: boolean;
  priority?: number;
  region?: string;
  rateLimit?: number;
  timeout?: number;
  retryPolicy?: 'exponential' | 'linear';
  maxRetries?: number;
  fallbackExchanges?: string[];
  apiTier?: string;
}

export interface CredentialConfig {
  apiKey: string;
  apiSecret: string;
  apiPassphrase?: string;
  sandbox?: boolean;
}

export interface StoredCredential {
  exchangeName: string;
  encrypted: {
    apiKey: string;
    apiSecret: string;
    apiPassphrase?: string;
  };
  createdAt: Date;
  rotatedAt?: Date;
  expiresAt?: Date;
}

export interface ExchangeHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  connected: boolean;
  lastCheck: Date;
  latency: number;
  uptime?: number;
  errorMessage?: string;
  errorCode?: string;
  consecutiveErrors?: number;
}

export interface HealthCheckResult {
  exchange: string;
  latencies: number[];
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  stdDevLatency: number;
  status: 'healthy' | 'degraded' | 'slow' | 'failed';
  timestamp: Date;
}

export interface RateLimitInfo {
  exchange: string;
  limit: number;
  remaining: number;
  reset: Date;
  resetIn: number;
  percentageUsed: number;
}

export interface Balance {
  exchange: string;
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue?: number;
}

export interface ConsolidatedBalance {
  assets: Record<string, Balance[]>;
  totals: Record<string, number>;
  totalUsdValue: number;
  timestamp: Date;
}

export interface MarketData {
  exchange: string;
  pair: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  change24h?: number;
  changePercent24h?: number;
  high24h?: number;
  low24h?: number;
  timestamp: Date;
}

export interface TradingPair {
  exchange: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  active?: boolean;
  minOrderSize?: number;
  maxOrderSize?: number;
  precision?: {
    base: number;
    quote: number;
    amount: number;
    price: number;
  };
}

export interface ConnectionPool {
  exchange: string;
  connections: Map<string, any>;
  availableCount: number;
  totalCount: number;
  activeCount: number;
}

export interface SkillResponse<T = any> {
  success: boolean;
  skillName: string;
  executionTime: string;
  result?: T;
  error?: string;
  errorType?: string;
  statusCode?: number;
  suggestions?: string[];
  metadata?: {
    timestamp: Date;
    requestId: string;
    cached?: boolean;
  };
}

export interface DiagnosticReport {
  generatedAt: Date;
  summary: {
    totalExchanges: number;
    connected: number;
    degraded: number;
    failed: number;
    overallHealth: number;
  };
  exchanges: ExchangeHealth[];
  rateLimits?: RateLimitInfo[];
  recentErrors?: Array<{
    exchange: string;
    error: string;
    timestamp: Date;
    count: number;
  }>;
}

export interface ConnectionConfig {
  poolSize?: number;
  maxPoolSize?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface RateLimiterConfig {
  globalQPS?: number;
  perExchangeQPS?: number;
  burstMultiplier?: number;
  backoffStrategy?: 'exponential' | 'linear';
  throttleUnder?: number;
}

export interface HealthMonitorConfig {
  checkInterval?: number;
  metricsExport?: boolean;
  metricsPort?: number;
  alertOnLatency?: number;
  alertOnErrorRate?: number;
}

export interface SecurityConfig {
  credentialEncryption?: string;
  vault?: string;
  ipWhitelisting?: boolean;
  rotationPolicy?: string;
  auditLogging?: boolean;
}

export interface OperationResult {
  operation: string;
  exchange?: string;
  status: 'success' | 'partial' | 'failed';
  executionTime: number;
  data?: any;
  errors?: Array<{
    exchange?: string;
    message: string;
    code?: string;
  }>;
}

export interface ExchangeError {
  message: string;
  code: string;
  type: 'INVALID_PARAMS' | 'INVALID_CREDS' | 'RATE_LIMIT' | 'EXCHANGE_DOWN' | 'NETWORK_ERROR' | 'UNKNOWN';
  statusCode: number;
  retryable: boolean;
  suggestion: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface AuditLogEntry {
  timestamp: Date;
  operation: string;
  exchange?: string;
  user?: string;
  status: 'success' | 'failure';
  requestId: string;
  duration: number;
  details?: Record<string, any>;
  error?: ExchangeError;
}
