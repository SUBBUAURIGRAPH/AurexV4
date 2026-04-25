/**
 * Wallet namespace — Balance queries, transfers, and transaction history.
 *
 * Wraps:
 *   - GET  /api/v11/wallet/balance/{address}
 *   - POST /api/v11/wallet/transfer
 *   - GET  /api/v11/wallet/history/{address}
 */

import type {
  WalletBalance,
  TransferRequest,
  TransferReceipt,
  Transaction,
} from '../types.js';

export interface WalletTransport {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  unwrapList<T>(p: Promise<unknown>, key: string): Promise<T[]>;
}

export class WalletApi {
  constructor(private readonly transport: WalletTransport) {}

  /** Get wallet balance for an address. */
  async getBalance(address: string): Promise<WalletBalance> {
    return this.transport.get<WalletBalance>(
      `/wallet/balance/${encodeURIComponent(address)}`,
    );
  }

  /** Transfer funds between wallets. */
  async transfer(req: TransferRequest): Promise<TransferReceipt> {
    return this.transport.post<TransferReceipt>('/wallet/transfer', req);
  }

  /** Get transaction history for an address. */
  async getHistory(
    address: string,
    limit = 50,
  ): Promise<Transaction[]> {
    return this.transport.unwrapList<Transaction>(
      this.transport.get<unknown>(
        `/wallet/history/${encodeURIComponent(address)}`,
        { limit },
      ),
      'transactions',
    );
  }
}
