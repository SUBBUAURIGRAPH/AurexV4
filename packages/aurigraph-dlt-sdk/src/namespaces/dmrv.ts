/**
 * DMRV namespace — Digital Measurement, Reporting & Verification.
 *
 * Wraps the V12 endpoints used for sensor / meter / device event ingestion:
 *   - POST /api/v11/dmrv/events              (single event)
 *   - POST /api/v11/dmrv/events/batch        (batched up to 50)
 *   - GET  /api/v11/dmrv/audit-trail         (query with filters)
 *   - POST /api/v11/active-contracts/{id}/trigger-mint
 */

import type {
  AuditFilter,
  BatchReceipt,
  DmrvEvent,
  DmrvReceipt,
  MintReceipt,
} from '../types.js';

/** Max events per batch request. V12 back-end enforces 50; SDK splits above. */
export const DMRV_BATCH_CHUNK_SIZE = 50;

/** Minimal UUID v4/v1 shape validator (dash-separated, hex, correct lengths). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return typeof s === 'string' && UUID_RE.test(s);
}

export interface DmrvTransport {
  post<T>(path: string, body: unknown): Promise<T>;
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  unwrapList<T>(p: Promise<unknown>, key: string): Promise<T[]>;
}

export class DmrvApi {
  constructor(private readonly transport: DmrvTransport) {}

  /** Submit a single DMRV measurement. */
  async recordEvent(event: DmrvEvent): Promise<DmrvReceipt> {
    return this.transport.post<DmrvReceipt>('/dmrv/events', event);
  }

  /**
   * Query the DMRV audit trail. Returns the raw array; V12 is expected to
   * return `{ events: [...] }` or a bare array.
   */
  async getAuditTrail(filter: AuditFilter = {}): Promise<DmrvEvent[]> {
    const q: Record<string, string | number | undefined> = {
      contractId: filter.contractId,
      deviceId: filter.deviceId,
      eventType: filter.eventType,
      fromTimestamp: filter.fromTimestamp,
      toTimestamp: filter.toTimestamp,
      limit: filter.limit,
    };
    return this.transport.unwrapList<DmrvEvent>(
      this.transport.get<unknown>('/dmrv/audit-trail', q),
      'events',
    );
  }

  /**
   * Record many events. The SDK splits into chunks of 50 (the server limit)
   * and merges receipts. Rejected counts and per-event errors are aggregated.
   */
  async batchRecord(events: DmrvEvent[]): Promise<BatchReceipt> {
    const merged: BatchReceipt = { accepted: 0, rejected: 0, receipts: [], errors: [] };
    if (events.length === 0) return merged;

    for (let i = 0; i < events.length; i += DMRV_BATCH_CHUNK_SIZE) {
      const chunk = events.slice(i, i + DMRV_BATCH_CHUNK_SIZE);
      const r = await this.transport.post<BatchReceipt>('/dmrv/events/batch', { events: chunk });
      merged.accepted += r?.accepted ?? 0;
      merged.rejected += r?.rejected ?? 0;
      if (Array.isArray(r?.receipts)) merged.receipts.push(...r.receipts);
      if (Array.isArray(r?.errors)) {
        for (const e of r.errors) {
          merged.errors!.push({ ...e, index: e.index + i });
        }
      }
    }
    return merged;
  }

  /**
   * Trigger a mint on an active Ricardian contract. Validates the contract id
   * is a UUID client-side so we fail fast without a network round-trip.
   */
  async triggerMint(
    contractId: string,
    eventType: string,
    quantity: number,
  ): Promise<MintReceipt> {
    if (!isUuid(contractId)) {
      const err = new Error(
        `DmrvApi.triggerMint: contractId must be a UUID, got '${contractId}'`,
      );
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const err = new Error(`DmrvApi.triggerMint: quantity must be positive, got ${quantity}`);
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
    return this.transport.post<MintReceipt>(
      `/active-contracts/${encodeURIComponent(contractId)}/trigger-mint`,
      { eventType, quantity },
    );
  }
}
