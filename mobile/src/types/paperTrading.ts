/**
 * Paper Trading Type Definitions
 * TypeScript interfaces for paper trading feature
 */

export interface PaperTradingAccount {
  id: string;
  userId: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  accountType: 'standard' | 'competition' | 'demo';

  // Capital
  initialCapital: number;
  currentCash: number;
  buyingPower: number;

  // Configuration
  commissionRate: number;
  slippageBuy: number;
  slippageSell: number;
  marginRequirement: number;
  allowShortSelling: boolean;
  positionLimit: number;

  // Performance
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPl: number;
  totalCommission: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalReturn: number;
  sharpeRatio: number;

  // Risk management
  maxPositionSize?: number;
  maxDailyLoss?: number;
  maxTotalLoss?: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface PaperTradingOrder {
  id: string;
  accountId: string;
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;

  // Pricing
  limitPrice?: number;
  stopPrice?: number;
  entryPrice?: number;
  executionPrice?: number;
  averagePrice?: number;

  // Execution
  filledQuantity: number;
  remainingQuantity: number;
  totalValue: number;
  commission: number;
  slippage: number;

  // Status
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  extendedHours: boolean;

  // P&L
  realizedPl: number;
  plPercent?: number;

  // Timestamps
  createdAt: Date;
  submittedAt?: Date;
  filledAt?: Date;
  cancelledAt?: Date;
  updatedAt: Date;

  // Metadata
  metadata?: any;
  rejectionReason?: string;
}

export interface PaperTradingPosition {
  id: string;
  accountId: string;
  userId: string;
  symbol: string;
  quantity: number;
  side: 'long' | 'short';

  // Cost basis
  averageCost: number;
  totalCost: number;

  // Current valuation
  currentPrice: number;
  marketValue: number;

  // P&L
  unrealizedPl: number;
  unrealizedPlPercent: number;
  realizedPl: number;
  totalPl: number;

  // Metadata
  entryDate: Date;
  lastUpdated: Date;
  sector?: string;
  assetClass: 'equity' | 'crypto' | 'forex' | 'option';
}

export interface PaperTradingPerformance {
  accountId: string;
  name: string;

  // Capital metrics
  initialCapital: number;
  currentCash: number;
  positionValue: number;
  totalEquity: number;

  // Return metrics
  totalReturn: number;
  totalPl: number;
  unrealizedPl: number;
  realizedPl: number;

  // Trade metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;

  // Risk metrics
  maxDrawdown: number;
  sharpeRatio: number;

  // Average metrics
  avgWin: number;
  avgLoss: number;

  // Current positions
  positionCount: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPl: number;
    unrealizedPlPercent: number;
  }>;
}

export interface PaperTradingSettings {
  userId: string;
  paperTradingEnabled: boolean;
  defaultAccountId?: string;
  autoCreateAccount: boolean;
  showPaperBanner: boolean;
  confirmBeforeLive: boolean;
  notifyOnFill: boolean;
  notifyOnMilestone: boolean;
  dailySummaryEnabled: boolean;
  allowOptionsTrading: boolean;
  allowCryptoTrading: boolean;
  allowForexTrading: boolean;
}

export interface EquityHistoryPoint {
  timestamp: Date;
  totalEquity: number;
  cash: number;
  positionValue: number;
  unrealizedPl: number;
  realizedPl: number;
  totalPl: number;
  dailyReturn?: number;
  totalReturn?: number;
  positionCount: number;
}

export interface PaperVsLiveComparison {
  userId: string;
  paperAccountId: string;
  comparisonDate: Date;

  // Paper trading metrics
  paperTotalReturn: number;
  paperSharpeRatio: number;
  paperWinRate: number;
  paperTotalTrades: number;
  paperTotalPl: number;

  // Live trading metrics (if available)
  liveTotalReturn?: number;
  liveSharpeRatio?: number;
  liveWinRate?: number;
  liveTotalTrades?: number;
  liveTotalPl?: number;

  // Comparison metrics
  returnDifference?: number;
  sharpeDifference?: number;

  // Readiness
  readinessScore: number; // 0-100
  recommendation: string;
}

export interface CreateAccountRequest {
  name?: string;
  initialCapital?: number;
  commissionRate?: number;
  slippageBuy?: number;
  slippageSell?: number;
  allowShortSelling?: boolean;
  maxPositions?: number;
}

export interface SubmitOrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
  extendedHours?: boolean;
}

export interface PaperTradingState {
  // Accounts
  accounts: PaperTradingAccount[];
  activeAccountId: string | null;
  activeAccount: PaperTradingAccount | null;

  // Orders
  orders: PaperTradingOrder[];
  selectedOrder: PaperTradingOrder | null;

  // Positions
  positions: PaperTradingPosition[];
  selectedPosition: PaperTradingPosition | null;

  // Performance
  performance: PaperTradingPerformance | null;
  equityHistory: EquityHistoryPoint[];

  // Settings
  settings: PaperTradingSettings | null;

  // UI state
  isPaperMode: boolean;
  showComparison: boolean;

  // Loading & errors
  isLoading: boolean;
  error: string | null;
  lastSync: number;
}
