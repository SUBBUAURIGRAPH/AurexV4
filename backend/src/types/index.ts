/**
 * Backend Type Definitions
 * @version 1.0.0
 */

/**
 * User Types
 */
export type UserRole = 'BASIC' | 'PREMIUM' | 'VIP';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  authToken?: string;
  memberType: UserRole;
  joinedDate: Date;
  lastLogin?: Date;
  isActive: boolean;
  preferences?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Portfolio Types
 */
export type MarketStatus = 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS';

export interface Portfolio {
  id: string;
  userId: string;
  totalValue: number;
  availableBalance: number;
  cash: number;
  todayReturn: number;
  ytdReturn: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  marketStatus: MarketStatus;
  aiRiskScore: number; // 1-10
  currency: string; // ISO 4217 code
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Position Types
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Position {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  totalValue: number;
  gainLoss: number;
  gainLossPercent: number;
  sector?: string;
  riskLevel: RiskLevel;
  lastPriceUpdate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Trade Types
 */
export type TradeType = 'BUY' | 'SELL';
export type TradeStatus = 'FILLED' | 'PENDING' | 'CANCELLED';
export type SignalType = 'AI' | 'MANUAL' | 'SIGNAL';

export interface Trade {
  id: string;
  portfolioId: string;
  symbol: string;
  type: TradeType;
  status: TradeStatus;
  quantity: number;
  price: number;
  total: number;
  signalType: SignalType;
  commission?: number;
  notes?: string;
  tradeDate: Date;
  executedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AssetAllocation Types
 */
export interface AssetAllocation {
  assetClass: string;
  percentage: number;
  value: number;
}

/**
 * PerformanceData Types
 */
export interface PerformanceData {
  date: string;
  value: number;
  return?: number;
  returnPercent?: number;
}

/**
 * API Response Types
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Authentication Types
 */
export interface AuthPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface TokenResponse {
  token: string;
  expiresIn: number;
  user: Omit<User, 'passwordHash'>;
}

/**
 * Error Types
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const ErrorCodes = {
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL'
} as const;
