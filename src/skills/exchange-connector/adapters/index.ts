/**
 * Exchange Adapters - Index
 * Exports all exchange adapter implementations
 * Version: 1.0.0
 */

export { BaseExchangeAdapter, createExchangeAdapter } from './baseAdapter';
export { BinanceAdapter } from './binanceAdapter';
export { KrakenAdapter } from './krakenAdapter';
export { CoinbaseAdapter } from './coinbaseAdapter';

// Re-export types
export type {
  ExchangeConfig,
  CredentialConfig,
  Balance,
  MarketData,
  TradingPair,
  ExchangeHealth,
  HealthCheckResult,
} from '../types';
