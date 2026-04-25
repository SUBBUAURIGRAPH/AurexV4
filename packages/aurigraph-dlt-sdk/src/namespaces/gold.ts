/**
 * Gold namespace — Gold RWAT public ledger, orders, and trading stats.
 *
 * Wraps:
 *   - GET /api/v11/rwa/gold/public/ledger
 *   - GET /api/v11/rwa/gold/orders
 *   - GET /api/v11/rwa/gold/trading/stats
 */

import type {
  GoldLedger,
  GoldOrder,
  GoldTradingStats,
} from '../types.js';

export interface GoldTransport {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  unwrapList<T>(p: Promise<unknown>, key: string): Promise<T[]>;
}

export class GoldApi {
  constructor(private readonly transport: GoldTransport) {}

  /** Get the gold RWAT public ledger (assets, orders, stats). */
  async getPublicLedger(): Promise<GoldLedger> {
    return this.transport.get<GoldLedger>('/rwa/gold/public/ledger');
  }

  /** List gold orders. */
  async getOrders(): Promise<GoldOrder[]> {
    return this.transport.unwrapList<GoldOrder>(
      this.transport.get<unknown>('/rwa/gold/orders'),
      'orders',
    );
  }

  /** Get aggregated gold trading statistics. */
  async getTradingStats(): Promise<GoldTradingStats> {
    return this.transport.get<GoldTradingStats>('/rwa/gold/trading/stats');
  }
}
