/**
 * Hermes Trading Platform Mobile App - Type Definitions
 * Comprehensive TypeScript types for all application features
 */

// ==================== Authentication ====================

export enum BiometricType {
  FACE_ID = 'faceId',
  TOUCH_ID = 'touchId',
  FINGERPRINT = 'fingerprint',
  IRIS = 'iris'
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface BiometricAuthData {
  userId: string;
  deviceId: string;
  biometricType: BiometricType;
  isEnabled: boolean;
  hashedFingerprint?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountNumber: string;
  accountType: 'individual' | 'joint' | 'ira' | 'business';
  status: 'active' | 'suspended' | 'closed';
  createdAt: string;
  updatedAt: string;
  kyc: {
    status: 'pending' | 'verified' | 'rejected';
    submittedAt?: string;
    verifiedAt?: string;
  };
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
}

export interface JWTToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  tokenType: string;
}

export interface AuthState {
  user: AuthUser | null;
  tokens: JWTToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBiometricEnabled: boolean;
  biometricType: BiometricType | null;
  error: string | null;
  lastLoginTime: number | null;
  sessionTimeout: number; // milliseconds
}

// ==================== Trading ====================

export type OrderType = 'market' | 'limit' | 'stop' | 'stop-limit' | 'trailing-stop';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'confirmed' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';

export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
  limitPrice?: number;
  status: OrderStatus;
  timeInForce: TimeInForce;
  createdAt: string;
  updatedAt: string;
  filledQuantity: number;
  averageFillPrice: number;
  totalCost: number;
  commission: number;
  estimatedValue?: number;
  expiresAt?: string;
  notes?: string;
  userId: string;
}

export interface OrderConfirmation {
  token: string;
  orderId: string;
  expiresAt: string;
  details: Order;
}

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  totalValue: number;
  percentOfPortfolio: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  sector?: string;
  industry?: string;
  marketCap?: string;
  peRatio?: number;
  eps?: number;
  dividendYield?: number;
  lastUpdated: string;
}

export interface Portfolio {
  accountNumber: string;
  totalValue: number;
  totalCost: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  realizedPL: number;
  cash: number;
  buyingPower: number;
  positions: Position[];
  lastUpdated: string;
}

export interface OHLCV {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicator {
  timestamp: string;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema12?: number;
  ema26?: number;
  rsi14?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHistogram?: number;
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export interface ChartData {
  symbol: string;
  interval: string;
  data: OHLCV[];
  indicators: TechnicalIndicator[];
  lastUpdated: string;
}

export interface TradingState {
  orders: Order[];
  positions: Position[];
  portfolio: Portfolio | null;
  selectedPosition: Position | null;
  selectedOrder: Order | null;
  pendingConfirmation: OrderConfirmation | null;
  isLoading: boolean;
  error: string | null;
  lastSync: number;
  syncInterval: number; // milliseconds
}

// ==================== Charts & Analytics ====================

export interface PortfolioChart {
  type: 'allocation' | 'performance' | 'sector' | 'gainLoss' | 'riskReturn' | 'cumulative' | 'drawdown' | 'correlation';
  data: ChartDataPoint[];
  metadata: Record<string, any>;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, any>;
}

export interface AnalyticsMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  periodChange: number;
  lastUpdated: string;
}

export interface ChartsState {
  chartData: Record<string, ChartData>;
  portfolioCharts: Record<string, PortfolioChart>;
  analytics: AnalyticsMetric[];
  selectedSymbol: string | null;
  chartTimeframe: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
}

// ==================== Notifications ====================

export enum NotificationType {
  ORDER_FILLED = 'order_filled',
  ORDER_CANCELLED = 'order_cancelled',
  PRICE_ALERT = 'price_alert',
  POSITION_UPDATE = 'position_update',
  PORTFOLIO_MILESTONE = 'portfolio_milestone',
  ACCOUNT_ALERT = 'account_alert',
  SYSTEM_ALERT = 'system_alert'
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  dismissible: boolean;
}

export interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  settings: {
    orderNotifications: boolean;
    priceAlerts: boolean;
    positionUpdates: boolean;
    portfolioAlerts: boolean;
    systemAlerts: boolean;
    pushEnabled: boolean;
  };
}

// ==================== WebSocket ====================

export interface WebSocketMessage {
  type: string;
  payload: Record<string, any>;
  timestamp: string;
}

export enum WebSocketEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
  ORDER_UPDATE = 'order_update',
  TRADE_UPDATE = 'trade_update',
  POSITION_UPDATE = 'position_update',
  ACCOUNT_UPDATE = 'account_update',
  PRICE_UPDATE = 'price_update'
}

export interface WebSocketState {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastMessageTime: number;
  subscriptions: string[];
  error: string | null;
}

// ==================== UI & Settings ====================

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto'
}

export interface UISettings {
  theme: Theme;
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  dateFormat: string;
  currency: string;
  decimalPlaces: number;
  showPercentages: boolean;
  animationsEnabled: boolean;
}

export interface AppSettings {
  ui: UISettings;
  notifications: NotificationsState['settings'];
  security: {
    sessionTimeout: number;
    requireBiometricForTransactions: boolean;
    requirePINConfirmation: boolean;
    autoLockTime: number;
  };
  data: {
    autoSyncInterval: number;
    cacheExpiry: number;
    offlineMode: boolean;
    historicalDataDays: number;
  };
}

export interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
}

// ==================== Offline Sync ====================

export enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  FAILED = 'failed'
}

export interface OfflineSyncItem {
  id: string;
  type: 'order' | 'position' | 'chart';
  action: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  status: SyncStatus;
  retries: number;
  lastAttempt: string;
  error?: string;
}

export interface OfflineSyncState {
  items: OfflineSyncItem[];
  isSyncing: boolean;
  lastSyncTime: number;
  pendingCount: number;
}

// ==================== Application Root State ====================

export interface AppState {
  auth: AuthState;
  trading: TradingState;
  charts: ChartsState;
  notifications: NotificationsState;
  settings: SettingsState;
  websocket: WebSocketState;
  offlineSync: OfflineSyncState;
  app: {
    isAppReady: boolean;
    isOffline: boolean;
    appVersion: string;
    lastUpdated: number;
  };
}
