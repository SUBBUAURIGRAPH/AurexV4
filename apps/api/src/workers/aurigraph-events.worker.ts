/**
 * AAT-ζ / AV4-375 — Aurigraph events worker.
 *
 * Asynchronous side of the lock-then-mint loop. When a UC_CARBON token is
 * burned on the Aurigraph chain (either as a retirement or as a delist back
 * to ISSUED), this worker:
 *
 *   1. Updates Aurex's own `Issuance` row (status flips to RETIRED on a
 *      retirement burn, reverts to ISSUED on a delist burn).
 *   2. Calls the BCR adapter (`retireVCC` or `unlockVCC`) so the BCR-side
 *      VCC state matches the chain side. This is the round-trip that closes
 *      binding requirement B17 / B18 of
 *      `docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`.
 *   3. Records a `BcrRegistrySyncEvent` row for every BCR adapter call.
 *
 * Polling vs. subscription
 * ------------------------
 *
 * The 1.2.0 SDK (`packages/aurigraph-dlt-sdk/src/namespaces/`) does NOT
 * expose a push-based event subscription surface — `assets.getPublicLedger`
 * is the only read that returns the burn / retire stream. So we POLL.
 *
 * Polling cadence: every `AURIGRAPH_EVENTS_POLL_INTERVAL_MS` (default
 * 30 000 ms = 30 s). On each tick we ask for the UC_CARBON public ledger,
 * filter to entries newer than `AurigraphEventCursor.lastTxHash`, and feed
 * them through the classifier.
 *
 * BullMQ vs. setInterval
 * ----------------------
 *
 * We deliberately use a plain `setInterval` + in-process locking rather
 * than BullMQ. Two reasons:
 *
 *   - The poll loop is naturally idempotent — `AurigraphProcessedEvent`
 *     keys on `txHash`, so retries just upsert. We don't need BullMQ's
 *     queue semantics for that.
 *   - One Aurex API node per environment ⇒ in-process locking is sufficient.
 *     If we ever scale horizontally, swap the in-process lock for a
 *     `pg_advisory_lock` on the `AurigraphEventCursor` row; nothing else
 *     in the worker needs to change.
 *
 * Idempotency
 * -----------
 *
 *   - `txHash` is the natural primary key on `AurigraphProcessedEvent`.
 *     Re-processing the same event upserts a no-op.
 *   - The cursor (`AurigraphEventCursor`) advances ONLY for events that
 *     were either successfully processed OR exceeded `MAX_RETRIES` and
 *     have been parked as `FAILED_PERMANENT`.
 *
 * At-least-once semantics
 * -----------------------
 *
 *   - If the BCR adapter call returns `ok: false` (retryable failure), we
 *     leave the event row at `PENDING`, increment `retryCount`, and DO NOT
 *     advance the cursor past it. The next tick re-tries the same event.
 *   - After `AURIGRAPH_EVENTS_MAX_RETRIES` failures (default 5), we mark
 *     the row `FAILED_PERMANENT`, emit an alert log entry, and advance the
 *     cursor so the rest of the queue isn't blocked by one bad event.
 *
 * Lifecycle
 * ---------
 *
 *   - `startAurigraphEventsWorker()` schedules the first tick (via setTimeout
 *     so callers can `await` start without blocking on the first poll) and
 *     reschedules on each completion.
 *   - `stopAurigraphEventsWorker()` clears the timer and waits for any
 *     in-flight tick to finish before resolving — graceful shutdown is
 *     observable from `index.ts`.
 *
 * The worker is gated behind `AURIGRAPH_EVENTS_WORKER_ENABLED=1` and skipped
 * entirely in NODE_ENV=test. Operators must set the gate explicitly so test
 * / CI / dev environments don't accidentally hammer Aurigraph.
 */

import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';
import {
  getAurigraphAdapter,
  type AurigraphDltAdapter,
} from '../services/chains/aurigraph-dlt-adapter.js';
import {
  getBcrAdapter,
  type BcrRegistryAdapter,
  type BcrBeneficiary,
} from '../services/registries/bcr/index.js';
import { recordBcrSyncEvent } from '../services/registries/bcr/sync-recorder.js';

// ── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_MAX_RETRIES = 5;
const CURSOR_ID = 'default';
const UC_CARBON = 'UC_CARBON';

function readPollIntervalMs(): number {
  const raw = process.env.AURIGRAPH_EVENTS_POLL_INTERVAL_MS;
  if (!raw) return DEFAULT_POLL_INTERVAL_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_POLL_INTERVAL_MS;
}

function readMaxRetries(): number {
  const raw = process.env.AURIGRAPH_EVENTS_MAX_RETRIES;
  if (!raw) return DEFAULT_MAX_RETRIES;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_RETRIES;
}

// ── Public types ───────────────────────────────────────────────────────────

export type AurigraphEventKind = 'BURN_FOR_RETIREMENT' | 'BURN_FOR_DELIST';

/**
 * Normalised burn event extracted from the Aurigraph public ledger. The raw
 * SDK payload is loosely typed (`Record<string, unknown>`); this is what we
 * commit to internally after `parseLedgerEntry()` finishes type-narrowing.
 */
export interface AurigraphBurnEvent {
  txHash: string;
  kind: AurigraphEventKind;
  /** The Aurex Issuance UUID extracted from the burned token's metadata. */
  issuanceId: string;
  /** Opaque BCR serial id mirrored on the chain via AAT-γ. */
  bcrSerialId: string;
  /** BCR lock id captured at mint time — required for unlockVCC. */
  bcrLockId: string | null;
  vintage: number;
  units: number;
  /** Beneficiary block — only populated on retirement events. */
  retirement: {
    beneficiary: BcrBeneficiary;
    purpose: string;
  } | null;
}

export interface ProcessTickResult {
  fetched: number;
  processed: number;
  skipped: number;
  retried: number;
  failedPermanent: number;
}

// ── Worker state ───────────────────────────────────────────────────────────

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<ProcessTickResult> | null = null;
let stopRequested = false;

// ── Lifecycle ──────────────────────────────────────────────────────────────

export interface StartWorkerOptions {
  /** Override the polling cadence (ms). Tests pass a small value. */
  pollIntervalMs?: number;
  /** Override the chain adapter — primarily for tests. */
  aurigraphAdapter?: Pick<AurigraphDltAdapter, 'getPublicLedger'>;
  /** Override the BCR adapter — primarily for tests. */
  bcrAdapter?: BcrRegistryAdapter;
  /** Override max retries. */
  maxRetries?: number;
}

interface ResolvedDeps {
  pollIntervalMs: number;
  maxRetries: number;
  aurigraph: Pick<AurigraphDltAdapter, 'getPublicLedger'>;
  bcr: BcrRegistryAdapter;
}

let activeDeps: ResolvedDeps | null = null;

function resolveDeps(opts: StartWorkerOptions): ResolvedDeps {
  return {
    pollIntervalMs: opts.pollIntervalMs ?? readPollIntervalMs(),
    maxRetries: opts.maxRetries ?? readMaxRetries(),
    aurigraph: opts.aurigraphAdapter ?? getAurigraphAdapter(),
    bcr: opts.bcrAdapter ?? getBcrAdapter(),
  };
}

/**
 * Bootstrap the polling loop. Idempotent — calling twice is a no-op (warns).
 * The first tick is scheduled but NOT awaited so the API boot path isn't
 * blocked on a slow chain read.
 */
export async function startAurigraphEventsWorker(
  opts: StartWorkerOptions = {},
): Promise<void> {
  if (timer || activeDeps) {
    logger.warn('Aurigraph events worker already started — skipping');
    return;
  }
  stopRequested = false;
  activeDeps = resolveDeps(opts);

  logger.info(
    {
      pollIntervalMs: activeDeps.pollIntervalMs,
      maxRetries: activeDeps.maxRetries,
    },
    'Aurigraph events worker started',
  );

  scheduleNextTick();
}

/**
 * Graceful shutdown. Cancels the next scheduled tick and awaits any
 * currently-running tick before resolving so callers (index.ts shutdown
 * hook, tests) can be sure no further DB writes happen after this returns.
 */
export async function stopAurigraphEventsWorker(): Promise<void> {
  stopRequested = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (inFlight) {
    try {
      await inFlight;
    } catch {
      // tick errors are already logged inside processTick
    }
  }
  activeDeps = null;
}

function scheduleNextTick(): void {
  if (stopRequested || !activeDeps) return;
  const deps = activeDeps;
  timer = setTimeout(() => {
    if (stopRequested) return;
    inFlight = processTick(deps).catch((err) => {
      logger.error({ err }, 'Aurigraph events tick crashed');
      return {
        fetched: 0,
        processed: 0,
        skipped: 0,
        retried: 0,
        failedPermanent: 0,
      };
    });
    inFlight.finally(() => {
      inFlight = null;
      scheduleNextTick();
    });
  }, deps.pollIntervalMs);
}

// ── Tick: poll → classify → process → advance cursor ───────────────────────

/**
 * One pass of the worker loop. Exported for direct testing. Pulls the
 * cursor, fetches new ledger entries, classifies + processes each, then
 * advances the cursor to the last `processed` (or `failed-permanent`)
 * txHash. Stops advancing the moment a retryable failure is hit.
 */
export async function processTick(
  deps: ResolvedDeps,
): Promise<ProcessTickResult> {
  const cursor = await readCursor();
  const ledger = await deps.aurigraph.getPublicLedger(UC_CARBON);
  const events = extractBurnEvents(ledger, cursor.lastTxHash);

  const result: ProcessTickResult = {
    fetched: events.length,
    processed: 0,
    skipped: 0,
    retried: 0,
    failedPermanent: 0,
  };

  let lastAdvanced: string | null = cursor.lastTxHash;

  for (const event of events) {
    const outcome = await processSingleEvent(event, deps);
    switch (outcome) {
      case 'processed':
        result.processed += 1;
        lastAdvanced = event.txHash;
        break;
      case 'skipped':
        // Already PROCESSED or FAILED_PERMANENT in a previous tick — safe
        // to advance past it.
        result.skipped += 1;
        lastAdvanced = event.txHash;
        break;
      case 'retry':
        // BCR call failed but we still have retry budget. Halt cursor
        // advance so the next tick re-tries the SAME event.
        result.retried += 1;
        // Persist progress so far (lastAdvanced) and bail.
        if (lastAdvanced && lastAdvanced !== cursor.lastTxHash) {
          await persistCursor(lastAdvanced);
        }
        return result;
      case 'failed-permanent':
        result.failedPermanent += 1;
        lastAdvanced = event.txHash;
        break;
    }
  }

  if (lastAdvanced && lastAdvanced !== cursor.lastTxHash) {
    await persistCursor(lastAdvanced);
  }

  return result;
}

// ── Cursor I/O ─────────────────────────────────────────────────────────────

interface CursorRow {
  lastTxHash: string | null;
}

async function readCursor(): Promise<CursorRow> {
  const row = await prisma.aurigraphEventCursor.findUnique({
    where: { id: CURSOR_ID },
  });
  return { lastTxHash: row?.lastTxHash ?? null };
}

async function persistCursor(txHash: string): Promise<void> {
  await prisma.aurigraphEventCursor.upsert({
    where: { id: CURSOR_ID },
    create: { id: CURSOR_ID, lastTxHash: txHash, lastProcessedAt: new Date() },
    update: { lastTxHash: txHash, lastProcessedAt: new Date() },
  });
}

// ── Per-event processing ───────────────────────────────────────────────────

type SingleEventOutcome = 'processed' | 'skipped' | 'retry' | 'failed-permanent';

async function processSingleEvent(
  event: AurigraphBurnEvent,
  deps: ResolvedDeps,
): Promise<SingleEventOutcome> {
  // 1. Reservation: upsert the per-event row first. If a previous tick
  //    already processed this txHash, we short-circuit — that's the
  //    idempotency guard.
  const existing = await prisma.aurigraphProcessedEvent.findUnique({
    where: { txHash: event.txHash },
  });

  if (existing && existing.status === 'PROCESSED') {
    return 'skipped';
  }
  if (existing && existing.status === 'FAILED_PERMANENT') {
    return 'skipped';
  }

  if (!existing) {
    await prisma.aurigraphProcessedEvent.create({
      data: {
        txHash: event.txHash,
        eventType: event.kind,
        issuanceId: event.issuanceId,
        retryCount: 0,
        status: 'PENDING',
      },
    });
  }

  const currentRetry = existing?.retryCount ?? 0;

  // 2. Forward to BCR. Adapter NEVER throws — it returns `ok:false` instead.
  let bcrOk: boolean;
  let bcrReason: string | null = null;
  try {
    if (event.kind === 'BURN_FOR_RETIREMENT') {
      if (!event.retirement) {
        // Defensive: classifier already enforces this; double-guard.
        bcrOk = false;
        bcrReason = 'Retirement event missing beneficiary metadata';
      } else {
        const res = await deps.bcr.retireVCC({
          bcrSerialId: event.bcrSerialId,
          beneficiary: event.retirement.beneficiary,
          purpose: event.retirement.purpose,
          units: event.units,
        });
        bcrOk = res.ok;
        bcrReason = res.reason ?? null;
        await recordBcrSyncEvent({
          eventType: 'RETIRE_VCC',
          resourceKind: 'issuance',
          resourceId: event.issuanceId,
          adapterName: deps.bcr.adapterName,
          bcrSerialId: event.bcrSerialId,
          bcrLockId: event.bcrLockId,
          result: res,
          requestPayload: {
            bcrSerialId: event.bcrSerialId,
            beneficiary: event.retirement.beneficiary,
            purpose: event.retirement.purpose,
            units: event.units,
            txHash: event.txHash,
          },
        });
      }
    } else {
      if (!event.bcrLockId) {
        bcrOk = false;
        bcrReason = 'Delist event missing bcrLockId';
      } else {
        const res = await deps.bcr.unlockVCC({
          bcrLockId: event.bcrLockId,
          reason: 'DELIST',
        });
        bcrOk = res.ok;
        bcrReason = res.reason ?? null;
        await recordBcrSyncEvent({
          eventType: 'UNLOCK_VCC',
          resourceKind: 'issuance',
          resourceId: event.issuanceId,
          adapterName: deps.bcr.adapterName,
          bcrSerialId: event.bcrSerialId,
          bcrLockId: event.bcrLockId,
          result: res,
          requestPayload: {
            bcrLockId: event.bcrLockId,
            reason: 'DELIST',
            txHash: event.txHash,
          },
        });

        // AAT-κ / AV4-357 — flip the matching DelistRequest row to
        // BCR_UNLOCKED so the marketplace-side initiator knows the BCR
        // round-trip closed. If no row exists (direct chain delist via SDK
        // bypassing the Aurex initiator), warn but proceed — we don't fail
        // the worker tick on a missing initiator row.
        if (bcrOk) {
          try {
            const updated = await prisma.delistRequest.updateMany({
              where: {
                issuanceId: event.issuanceId,
                status: { in: ['INITIATED', 'CHAIN_BURNED'] },
              },
              data: {
                status: 'BCR_UNLOCKED',
                bcrUnlockedAt: new Date(),
              },
            });
            if (updated.count === 0) {
              logger.warn(
                {
                  txHash: event.txHash,
                  issuanceId: event.issuanceId,
                  bcrSerialId: event.bcrSerialId,
                },
                'BURN_FOR_DELIST: no matching DelistRequest row to flip — chain delist proceeded without Aurex initiator',
              );
            }
          } catch (err) {
            // Don't fail the tick if the DelistRequest update errors — the
            // BCR side is already unlocked, the chain side is already burned,
            // and the worker must keep advancing. Log loudly for ops.
            logger.error(
              {
                err: err instanceof Error ? err.message : String(err),
                txHash: event.txHash,
                issuanceId: event.issuanceId,
              },
              'BURN_FOR_DELIST: DelistRequest reconciliation update threw — non-fatal',
            );
          }
        }
      }
    }
  } catch (err) {
    // BCR adapter contract says it shouldn't throw; if a buggy adapter does,
    // treat as a retryable failure rather than crashing the tick.
    bcrOk = false;
    bcrReason = err instanceof Error ? err.message : String(err);
    logger.error(
      { err, txHash: event.txHash },
      'BCR adapter threw — treating as retryable failure',
    );
  }

  // 3. Outcome handling.
  if (bcrOk) {
    await applyIssuanceStateTransition(event);
    await prisma.aurigraphProcessedEvent.update({
      where: { txHash: event.txHash },
      data: {
        status: 'PROCESSED',
        lastError: null,
      },
    });
    return 'processed';
  }

  // BCR call failed. Bump retryCount, decide retry vs. permanent failure.
  const nextRetry = currentRetry + 1;
  if (nextRetry > deps.maxRetries) {
    logger.error(
      {
        txHash: event.txHash,
        eventType: event.kind,
        issuanceId: event.issuanceId,
        retryCount: nextRetry,
        bcrReason,
      },
      'AURIGRAPH_EVENTS_ALERT: event exceeded max retries — marking FAILED_PERMANENT for human review',
    );
    await prisma.aurigraphProcessedEvent.update({
      where: { txHash: event.txHash },
      data: {
        status: 'FAILED_PERMANENT',
        retryCount: nextRetry,
        lastError: bcrReason ?? 'Unknown BCR adapter failure',
      },
    });
    return 'failed-permanent';
  }

  await prisma.aurigraphProcessedEvent.update({
    where: { txHash: event.txHash },
    data: {
      status: 'PENDING',
      retryCount: nextRetry,
      lastError: bcrReason ?? 'Unknown BCR adapter failure',
    },
  });
  logger.warn(
    {
      txHash: event.txHash,
      issuanceId: event.issuanceId,
      retryCount: nextRetry,
      bcrReason,
    },
    'BCR adapter call failed — leaving event PENDING for next tick',
  );
  return 'retry';
}

async function applyIssuanceStateTransition(
  event: AurigraphBurnEvent,
): Promise<void> {
  const newStatus =
    event.kind === 'BURN_FOR_RETIREMENT' ? 'RETIRED' : 'ISSUED';
  await prisma.issuance.update({
    where: { id: event.issuanceId },
    data: { status: newStatus },
  });
}

// ── Ledger payload parsing ─────────────────────────────────────────────────

/**
 * Extract burn-flavoured events from the loosely-typed ledger payload. The
 * SDK returns `Record<string, unknown>`; we walk it defensively, narrow each
 * candidate, classify by metadata shape, and skip anything we can't parse
 * (logged at debug — invalid entries should not block the tick).
 *
 * Cursor semantics: we only return entries STRICTLY AFTER `lastTxHash`.
 * If `lastTxHash` is in the list, items before/equal to it are dropped;
 * if it's absent, all entries are returned.
 */
export function extractBurnEvents(
  ledger: Record<string, unknown>,
  lastTxHash: string | null,
): AurigraphBurnEvent[] {
  const entries = readEntriesFromLedger(ledger);
  const burns: AurigraphBurnEvent[] = [];
  let seenCursor = lastTxHash === null; // if no cursor, everything is "new"

  for (const raw of entries) {
    if (!isRecord(raw)) continue;
    const txHash = readString(raw.txHash) ?? readString(raw.tx_hash);
    if (!txHash) continue;

    if (!seenCursor) {
      if (txHash === lastTxHash) {
        seenCursor = true;
      }
      continue;
    }

    const eventType =
      readString(raw.eventType) ?? readString(raw.event_type) ?? readString(raw.type);
    if (!eventType) continue;
    const normalisedEventType = eventType.toLowerCase();
    if (normalisedEventType !== 'burn' && normalisedEventType !== 'retire') continue;

    const event = parseBurnEntry(raw, txHash);
    if (event) burns.push(event);
  }

  return burns;
}

function readEntriesFromLedger(ledger: Record<string, unknown>): unknown[] {
  // Different envelopes the SDK may return — be permissive.
  const candidates = ['entries', 'events', 'items', 'data', 'transactions'];
  for (const k of candidates) {
    const v = ledger[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function parseBurnEntry(
  raw: Record<string, unknown>,
  txHash: string,
): AurigraphBurnEvent | null {
  const metadata = isRecord(raw.metadata)
    ? raw.metadata
    : isRecord(raw.terms)
      ? raw.terms
      : isRecord(raw.payload)
        ? raw.payload
        : null;
  if (!metadata) return null;

  const issuanceId =
    readString(metadata.aurexIssuanceId) ??
    readString(metadata.issuanceId) ??
    readString(raw.aurexIssuanceId) ??
    readString(raw.issuanceId);
  if (!issuanceId) return null;

  const bcrSerialId =
    readString(metadata.bcrSerialId) ?? readString(raw.bcrSerialId);
  if (!bcrSerialId) return null;

  const bcrLockId =
    readString(metadata.bcrLockId) ?? readString(raw.bcrLockId) ?? null;

  const vintage = readNumber(metadata.vintage) ?? readNumber(raw.vintage) ?? 0;
  const units =
    readNumber(metadata.netUnits) ??
    readNumber(metadata.units) ??
    readNumber(raw.units) ??
    readNumber(raw.amount) ??
    0;

  const retiredFor = readString(metadata.retiredFor);
  const retiredBy = readString(metadata.retiredBy);
  const purposeRaw =
    readString(metadata.retirementPurpose) ?? readString(metadata.purpose);

  const isRetirement = Boolean(retiredFor && retiredBy);

  if (isRetirement) {
    const beneficiaryName = retiredBy ?? 'unknown';
    const country = readString(metadata.beneficiaryCountry) ?? 'XX';
    const beneficiary: BcrBeneficiary = {
      name: beneficiaryName,
      country,
      reference: retiredFor,
    };
    return {
      txHash,
      kind: 'BURN_FOR_RETIREMENT',
      issuanceId,
      bcrSerialId,
      bcrLockId,
      vintage,
      units,
      retirement: {
        beneficiary,
        purpose: purposeRaw ?? retiredFor ?? 'retirement',
      },
    };
  }

  return {
    txHash,
    kind: 'BURN_FOR_DELIST',
    issuanceId,
    bcrSerialId,
    bcrLockId,
    vintage,
    units,
    retirement: null,
  };
}

// ── Type-narrowing helpers (no `any`) ──────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

// ── Test-only exports ──────────────────────────────────────────────────────

/** Test helper — exposes the worker's internal state for assertion. */
export function __isWorkerActive(): boolean {
  return activeDeps !== null;
}
