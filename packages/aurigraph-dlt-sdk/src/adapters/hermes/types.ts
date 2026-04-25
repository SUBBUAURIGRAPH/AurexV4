/**
 * Hermes (HMS) adapter — trading platform event types.
 *
 * Mirrors the shapes exposed by the HMS DLTService scaffolding in
 * `~/hms-explore/`. Trades, batches and settlement events are recorded
 * on Aurigraph DLT via DMRV under the GHG_PROTOCOL framework
 * (commodity trading carbon attribution).
 */

export type HermesSide = 'BUY' | 'SELL';

export interface HermesTradeEvent {
  tradeId: string;
  /** e.g. "BTC/USD", "AAPL/USD". */
  symbol: string;
  side: HermesSide;
  /** BigDecimal-safe quantity string. */
  quantity: string;
  /** BigDecimal-safe price string. */
  price: string;
  /** Ethereum-style 0x... trader address (42 chars). */
  traderAddress: string;
  timestamp: string;
  strategyId?: string;
}

export interface HermesBatchEvent {
  batchId: string;
  trades: HermesTradeEvent[];
  /** Aggregate notional volume — BigDecimal-safe. */
  totalVolume: string;
}

export type HermesVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'DISPUTED'
  | 'SETTLED';

export interface HermesVerificationEvent {
  tradeId: string;
  tradeHash: string;
  blockNumber: number;
  status: HermesVerificationStatus;
  timestamp?: string;
}
