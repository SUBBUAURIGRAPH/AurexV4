/**
 * BaseExchangeAdapter - Abstract Base Class for Exchange Implementations
 *
 * Defines the interface that all exchange adapters must implement
 */

export interface AdapterConfig {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  sandbox?: boolean;
}

export interface TradeRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
}

export interface TradeResponse {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  timestamp: Date;
}

export interface BalanceResponse {
  [asset: string]: {
    free: number;
    used: number;
    total: number;
  };
}

export interface MarketData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: Date;
}

export abstract class BaseExchangeAdapter {
  protected apiKey: string = '';
  protected apiSecret: string = '';
  protected passphrase?: string;
  protected sandbox: boolean = false;
  protected isInitialized: boolean = false;

  /**
   * Get exchange name
   */
  abstract getName(): string;

  /**
   * Get rate limit for this exchange
   */
  abstract getRateLimit(): number;

  /**
   * Initialize adapter with credentials
   */
  abstract initialize(config: AdapterConfig): Promise<void>;

  /**
   * Test connection to exchange
   */
  abstract testConnection(): Promise<{ success: boolean; error?: string }>;

  /**
   * Get account balance
   */
  abstract getBalance(): Promise<BalanceResponse>;

  /**
   * Place a trade
   */
  abstract placeTrade(request: TradeRequest): Promise<TradeResponse>;

  /**
   * Get market data
   */
  abstract getMarketData(symbols: string[]): Promise<MarketData[]>;

  /**
   * Disconnect from exchange
   */
  abstract disconnect(): Promise<void>;
}

export default BaseExchangeAdapter;
