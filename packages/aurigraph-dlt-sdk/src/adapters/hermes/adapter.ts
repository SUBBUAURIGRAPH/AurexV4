/**
 * HermesAdapter — wraps `AurigraphClient` for the Hermes (HMS) trading
 * platform. Records trades, batches and settlement events as DMRV events
 * tagged with `metadata.framework = 'GHG_PROTOCOL'`.
 *
 * Integrates with the existing `DLTService.ts` scaffolding in `hms-explore/`:
 * the HMS service layer should instantiate this adapter and forward every
 * trade / batch / settlement through it.
 *
 * The generic `DmrvApi.batchRecord` already splits payloads at 50 entries
 * per request and aggregates a single `BatchReceipt`. This adapter reuses
 * that behaviour and re-shapes the result into a single `DmrvReceipt` so
 * callers can track the full batch lifecycle.
 */

import { AurigraphClient } from '../../client.js';
import { ValidationError } from '../../errors.js';
import type {
  AuditFilter,
  BatchReceipt,
  DmrvEvent,
  DmrvReceipt,
} from '../../types.js';
import { DMRV_BATCH_CHUNK_SIZE } from '../../namespaces/dmrv.js';
import {
  DmrvFramework,
  chunk,
  isEthAddress,
} from '../common.js';
import {
  HermesBatchEvent,
  HermesTradeEvent,
  HermesVerificationEvent,
} from './types.js';

const FRAMEWORK: DmrvFramework = 'GHG_PROTOCOL';

export class HermesAdapter {
  constructor(private readonly client: AurigraphClient) {}

  /** Record a single trade as a GHG_PROTOCOL DMRV event. */
  async recordTrade(event: HermesTradeEvent): Promise<DmrvReceipt> {
    this.validateTrade(event);
    return this.client.dmrv.recordEvent(this.tradeToDmrv(event));
  }

  /**
   * Record a batch of trades. `DmrvApi.batchRecord` already splits at
   * {@link DMRV_BATCH_CHUNK_SIZE} (50) entries per request — we pre-chunk
   * locally too so the adapter behaviour is deterministic even if the
   * upstream constant changes, then collapse the aggregated `BatchReceipt`
   * into a single `DmrvReceipt` for the caller.
   */
  async recordBatch(event: HermesBatchEvent): Promise<DmrvReceipt> {
    this.validateBatch(event);

    const chunks = chunk(event.trades, DMRV_BATCH_CHUNK_SIZE);
    let accepted = 0;
    let rejected = 0;
    let firstReceipt: DmrvReceipt | undefined;

    for (const slice of chunks) {
      const events: DmrvEvent[] = slice.map((t) => this.tradeToDmrv(t));
      const batch: BatchReceipt = await this.client.dmrv.batchRecord(events);
      accepted += batch.accepted ?? 0;
      rejected += batch.rejected ?? 0;
      if (!firstReceipt && Array.isArray(batch.receipts) && batch.receipts.length > 0) {
        firstReceipt = batch.receipts[0];
      }
    }

    return {
      eventId: event.batchId,
      status: rejected === 0 && accepted > 0 ? 'ACCEPTED' : accepted > 0 ? 'PENDING' : 'REJECTED',
      txHash: firstReceipt?.txHash,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verify that a trade's on-chain hash matches `expectedHash`. Consults
   * the DMRV audit trail for the trade id and checks whether any recorded
   * event carries the expected hash in its metadata.
   */
  async verifyTrade(tradeId: string, expectedHash: string): Promise<boolean> {
    if (!tradeId) throw new ValidationError('tradeId is required', 'tradeId');
    if (!expectedHash) {
      throw new ValidationError('expectedHash is required', 'expectedHash');
    }
    const events = await this.client.dmrv.getAuditTrail({ deviceId: tradeId });
    return events.some((e) => (e.metadata ?? {})['tradeHash'] === expectedHash);
  }

  /**
   * Return the trade audit trail for a trader. Optionally filter to trades
   * that occurred on or after `fromTimestamp` (ISO-8601).
   */
  async getTradeAuditTrail(
    traderAddress: string,
    fromTimestamp?: string,
  ): Promise<HermesTradeEvent[]> {
    if (!isEthAddress(traderAddress)) {
      throw new ValidationError(
        `traderAddress must be a 0x-prefixed 20-byte hex (got "${traderAddress}")`,
        'traderAddress',
      );
    }
    const filter: AuditFilter = { eventType: 'Trade', fromTimestamp };
    const events = await this.client.dmrv.getAuditTrail(filter);
    return events
      .map((e) => this.toTradeEvent(e))
      .filter((t) => t.traderAddress === traderAddress);
  }

  /** Record a settlement / verification event for a trade. */
  async recordSettlement(event: HermesVerificationEvent): Promise<DmrvReceipt> {
    this.validateVerification(event);
    const dmrvEvent: DmrvEvent = {
      deviceId: event.tradeId,
      eventType: 'TradeSettlement',
      quantity: 1,
      unit: 'event',
      timestamp: event.timestamp,
      metadata: {
        framework: FRAMEWORK,
        domain: 'hermes',
        tradeHash: event.tradeHash,
        blockNumber: event.blockNumber,
        status: event.status,
      },
    };
    return this.client.dmrv.recordEvent(dmrvEvent);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private tradeToDmrv(event: HermesTradeEvent): DmrvEvent {
    const quantity = Number(event.quantity);
    return {
      deviceId: event.tradeId,
      eventType: 'Trade',
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unit: event.symbol,
      timestamp: event.timestamp,
      metadata: {
        framework: FRAMEWORK,
        domain: 'hermes',
        symbol: event.symbol,
        side: event.side,
        quantity: event.quantity,
        price: event.price,
        traderAddress: event.traderAddress,
        strategyId: event.strategyId,
      },
    };
  }

  private toTradeEvent(e: DmrvEvent): HermesTradeEvent {
    const meta = e.metadata ?? {};
    return {
      tradeId: e.deviceId,
      symbol: String(meta['symbol'] ?? ''),
      side: (meta['side'] as HermesTradeEvent['side']) ?? 'BUY',
      quantity: String(meta['quantity'] ?? '0'),
      price: String(meta['price'] ?? '0'),
      traderAddress: String(meta['traderAddress'] ?? ''),
      timestamp: e.timestamp ?? new Date(0).toISOString(),
      strategyId: meta['strategyId'] as string | undefined,
    };
  }

  private validateTrade(event: HermesTradeEvent): void {
    if (!event) throw new ValidationError('event is required');
    if (!event.tradeId) throw new ValidationError('tradeId is required', 'tradeId');
    if (!event.symbol) throw new ValidationError('symbol is required', 'symbol');
    if (!event.side) throw new ValidationError('side is required', 'side');
    if (!event.quantity) throw new ValidationError('quantity is required', 'quantity');
    if (!event.price) throw new ValidationError('price is required', 'price');
    if (!event.timestamp) throw new ValidationError('timestamp is required', 'timestamp');
    if (!isEthAddress(event.traderAddress)) {
      throw new ValidationError(
        `traderAddress must be a 0x-prefixed 20-byte hex (got "${event.traderAddress}")`,
        'traderAddress',
      );
    }
  }

  private validateBatch(event: HermesBatchEvent): void {
    if (!event) throw new ValidationError('event is required');
    if (!event.batchId) throw new ValidationError('batchId is required', 'batchId');
    if (!Array.isArray(event.trades) || event.trades.length === 0) {
      throw new ValidationError('trades must be a non-empty array', 'trades');
    }
    event.trades.forEach((t, i) => {
      try {
        this.validateTrade(t);
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new ValidationError(
            `trades[${i}] invalid: ${err.message}`,
            err.field ? `trades[${i}].${err.field}` : `trades[${i}]`,
          );
        }
        throw err;
      }
    });
  }

  private validateVerification(event: HermesVerificationEvent): void {
    if (!event) throw new ValidationError('event is required');
    if (!event.tradeId) throw new ValidationError('tradeId is required', 'tradeId');
    if (!event.tradeHash) throw new ValidationError('tradeHash is required', 'tradeHash');
    if (typeof event.blockNumber !== 'number' || event.blockNumber < 0) {
      throw new ValidationError('blockNumber must be a non-negative number', 'blockNumber');
    }
    if (!event.status) throw new ValidationError('status is required', 'status');
  }
}
