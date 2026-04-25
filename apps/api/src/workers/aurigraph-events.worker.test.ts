import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * AAT-ζ / AV4-375 — Aurigraph events worker unit tests.
 *
 * Strategy:
 *   - Mock `@aurex/database` with a tiny stateful fake that supports the
 *     `aurigraphEventCursor`, `aurigraphProcessedEvent`, and `issuance`
 *     surfaces the worker actually touches.
 *   - Mock the BCR sync recorder so we can assert it was called with the
 *     right event type / resource without poking real Postgres.
 *   - Build hand-rolled stubs for the chain adapter + BCR adapter and feed
 *     them into `processTick()` directly. The lifecycle tests exercise
 *     `start/stop` via `setTimeout` with a tiny interval and `vi.useFakeTimers`.
 */

// ── Hoisted state buckets ──────────────────────────────────────────────────

const { fakeDb, recordedSyncEvents } = vi.hoisted(() => {
  type CursorRow = {
    id: string;
    lastTxHash: string | null;
    lastProcessedAt: Date | null;
  };
  type ProcessedRow = {
    txHash: string;
    eventType: 'BURN_FOR_RETIREMENT' | 'BURN_FOR_DELIST';
    issuanceId: string | null;
    retryCount: number;
    status: 'PENDING' | 'PROCESSED' | 'FAILED_PERMANENT';
    lastError: string | null;
  };
  type IssuanceRow = {
    id: string;
    status: string;
  };

  const cursors = new Map<string, CursorRow>();
  const processed = new Map<string, ProcessedRow>();
  const issuances = new Map<string, IssuanceRow>();

  const fakeDb = {
    cursors,
    processed,
    issuances,
    aurigraphEventCursor: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          cursors.get(where.id) ?? null,
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { id: string };
          create: { id: string; lastTxHash: string | null };
          update: { lastTxHash: string | null };
        }) => {
          const existing = cursors.get(where.id);
          if (existing) {
            existing.lastTxHash = update.lastTxHash;
            existing.lastProcessedAt = new Date();
          } else {
            cursors.set(where.id, {
              id: create.id,
              lastTxHash: create.lastTxHash,
              lastProcessedAt: new Date(),
            });
          }
          return cursors.get(where.id);
        },
      ),
    },
    aurigraphProcessedEvent: {
      findUnique: vi.fn(
        async ({ where }: { where: { txHash: string } }) =>
          processed.get(where.txHash) ?? null,
      ),
      create: vi.fn(
        async ({ data }: { data: ProcessedRow }) => {
          processed.set(data.txHash, { ...data });
          return processed.get(data.txHash);
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { txHash: string };
          data: Partial<ProcessedRow>;
        }) => {
          const row = processed.get(where.txHash);
          if (!row) throw new Error(`no row for ${where.txHash}`);
          Object.assign(row, data);
          return row;
        },
      ),
    },
    issuance: {
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { status: string };
        }) => {
          const row = issuances.get(where.id);
          if (!row) throw new Error(`no issuance ${where.id}`);
          row.status = data.status;
          return row;
        },
      ),
    },
  };

  const recordedSyncEvents: Array<Record<string, unknown>> = [];

  return { fakeDb, recordedSyncEvents };
});

vi.mock('@aurex/database', () => ({ prisma: fakeDb }));

vi.mock('../services/registries/bcr/sync-recorder.js', () => ({
  recordBcrSyncEvent: vi.fn(async (params: Record<string, unknown>) => {
    recordedSyncEvents.push(params);
  }),
}));

// Don't accidentally hit getAurigraphAdapter / getBcrAdapter — we always
// inject mocks via opts, so these are never called. But lazy-imported deps
// shouldn't blow up if the module is loaded.
vi.mock('../services/chains/aurigraph-dlt-adapter.js', () => ({
  getAurigraphAdapter: vi.fn(() => {
    throw new Error('getAurigraphAdapter() should not be called in tests');
  }),
}));
vi.mock('../services/registries/bcr/index.js', () => ({
  getBcrAdapter: vi.fn(() => {
    throw new Error('getBcrAdapter() should not be called in tests');
  }),
}));

// ── Imports AFTER mocks ────────────────────────────────────────────────────

import {
  processTick,
  extractBurnEvents,
  startAurigraphEventsWorker,
  stopAurigraphEventsWorker,
  __isWorkerActive,
} from './aurigraph-events.worker.js';
import type {
  BcrRegistryAdapter,
  RetireVccResult,
  UnlockVccResult,
} from '../services/registries/bcr/index.js';

// ── Test fixture builders ──────────────────────────────────────────────────

function resetState(): void {
  fakeDb.cursors.clear();
  fakeDb.processed.clear();
  fakeDb.issuances.clear();
  recordedSyncEvents.length = 0;
  vi.clearAllMocks();
  // Re-prime spy implementations because `clearAllMocks` wipes them.
  fakeDb.aurigraphEventCursor.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) =>
      fakeDb.cursors.get(where.id) ?? null,
  );
  fakeDb.aurigraphEventCursor.upsert.mockImplementation(
    async ({
      where,
      create,
      update,
    }: {
      where: { id: string };
      create: { id: string; lastTxHash: string | null };
      update: { lastTxHash: string | null };
    }) => {
      const existing = fakeDb.cursors.get(where.id);
      if (existing) {
        existing.lastTxHash = update.lastTxHash;
        existing.lastProcessedAt = new Date();
      } else {
        fakeDb.cursors.set(where.id, {
          id: create.id,
          lastTxHash: create.lastTxHash,
          lastProcessedAt: new Date(),
        });
      }
      return fakeDb.cursors.get(where.id);
    },
  );
  fakeDb.aurigraphProcessedEvent.findUnique.mockImplementation(
    async ({ where }: { where: { txHash: string } }) =>
      fakeDb.processed.get(where.txHash) ?? null,
  );
  fakeDb.aurigraphProcessedEvent.create.mockImplementation(
    async ({
      data,
    }: {
      data: {
        txHash: string;
        eventType: 'BURN_FOR_RETIREMENT' | 'BURN_FOR_DELIST';
        issuanceId: string | null;
        retryCount: number;
        status: 'PENDING' | 'PROCESSED' | 'FAILED_PERMANENT';
      };
    }) => {
      fakeDb.processed.set(data.txHash, { ...data, lastError: null });
      return fakeDb.processed.get(data.txHash);
    },
  );
  fakeDb.aurigraphProcessedEvent.update.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { txHash: string };
      data: Record<string, unknown>;
    }) => {
      const row = fakeDb.processed.get(where.txHash);
      if (!row) throw new Error(`no row for ${where.txHash}`);
      Object.assign(row, data);
      return row;
    },
  );
  fakeDb.issuance.update.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { status: string };
    }) => {
      const row = fakeDb.issuances.get(where.id);
      if (!row) throw new Error(`no issuance ${where.id}`);
      row.status = data.status;
      return row;
    },
  );
}

function seedIssuance(id: string, status: string = 'ISSUED'): void {
  fakeDb.issuances.set(id, { id, status });
}

function makeRetirementLedgerEntry(opts: {
  txHash: string;
  issuanceId: string;
  bcrSerialId: string;
  bcrLockId?: string;
}): Record<string, unknown> {
  return {
    txHash: opts.txHash,
    eventType: 'burn',
    metadata: {
      bcrSerialId: opts.bcrSerialId,
      bcrLockId: opts.bcrLockId ?? 'lock-1',
      aurexIssuanceId: opts.issuanceId,
      vintage: 2025,
      netUnits: 100,
      retiredFor: 'NDC-2026',
      retiredBy: 'AcmeCorp',
      retirementPurpose: 'NDC',
      beneficiaryCountry: 'IN',
    },
  };
}

function makeDelistLedgerEntry(opts: {
  txHash: string;
  issuanceId: string;
  bcrSerialId: string;
  bcrLockId: string;
}): Record<string, unknown> {
  return {
    txHash: opts.txHash,
    eventType: 'burn',
    metadata: {
      bcrSerialId: opts.bcrSerialId,
      bcrLockId: opts.bcrLockId,
      aurexIssuanceId: opts.issuanceId,
      vintage: 2025,
      netUnits: 100,
      // No retiredFor / retiredBy → classifier should call this DELIST.
    },
  };
}

interface MockAurigraphAdapter {
  getPublicLedger: ReturnType<typeof vi.fn>;
}

function makeAurigraphAdapter(
  entries: Array<Record<string, unknown>>,
): MockAurigraphAdapter {
  return {
    getPublicLedger: vi.fn(async () => ({ entries })),
  };
}

interface MockBcrAdapter extends BcrRegistryAdapter {
  retireVCC: ReturnType<typeof vi.fn>;
  unlockVCC: ReturnType<typeof vi.fn>;
}

function makeBcrAdapter(opts?: {
  retireResult?: RetireVccResult;
  unlockResult?: UnlockVccResult;
}): MockBcrAdapter {
  const retireResult: RetireVccResult = opts?.retireResult ?? {
    ok: true,
    externalRef: 'retire-1',
    data: { retirementStatementUrl: 'https://bcr/retire/1' },
  };
  const unlockResult: UnlockVccResult = opts?.unlockResult ?? {
    ok: true,
    externalRef: 'unlock-1',
    data: { bcrSerialId: 'bcr-serial-1' },
  };

  return {
    adapterName: 'mock-bcr',
    isActive: true,
    retireVCC: vi.fn(async () => retireResult),
    unlockVCC: vi.fn(async () => unlockResult),
    lockVCC: vi.fn(),
    confirmLock: vi.fn(),
    notifyMint: vi.fn(),
    notifyTransfer: vi.fn(),
    notifyBurn: vi.fn(),
    getStatus: vi.fn(),
  } as unknown as MockBcrAdapter;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('extractBurnEvents — payload parsing', () => {
  beforeEach(() => resetState());

  it('returns all events when cursor is null', () => {
    const ledger = {
      entries: [
        makeRetirementLedgerEntry({
          txHash: '0xa',
          issuanceId: 'iss-1',
          bcrSerialId: 'bcr-a',
        }),
        makeDelistLedgerEntry({
          txHash: '0xb',
          issuanceId: 'iss-2',
          bcrSerialId: 'bcr-b',
          bcrLockId: 'lock-b',
        }),
      ],
    };
    const out = extractBurnEvents(ledger, null);
    expect(out).toHaveLength(2);
    expect(out[0]!.kind).toBe('BURN_FOR_RETIREMENT');
    expect(out[1]!.kind).toBe('BURN_FOR_DELIST');
  });

  it('drops entries up to AND including lastTxHash', () => {
    const ledger = {
      entries: [
        makeRetirementLedgerEntry({
          txHash: '0xa',
          issuanceId: 'iss-1',
          bcrSerialId: 'bcr-a',
        }),
        makeRetirementLedgerEntry({
          txHash: '0xb',
          issuanceId: 'iss-2',
          bcrSerialId: 'bcr-b',
        }),
        makeRetirementLedgerEntry({
          txHash: '0xc',
          issuanceId: 'iss-3',
          bcrSerialId: 'bcr-c',
        }),
      ],
    };
    const out = extractBurnEvents(ledger, '0xa');
    expect(out.map((e) => e.txHash)).toEqual(['0xb', '0xc']);
  });

  it('skips entries lacking required metadata', () => {
    const ledger = {
      entries: [
        { txHash: '0xa', eventType: 'burn' }, // no metadata
        { txHash: '0xb', eventType: 'burn', metadata: {} }, // no issuance
        makeRetirementLedgerEntry({
          txHash: '0xc',
          issuanceId: 'iss-3',
          bcrSerialId: 'bcr-c',
        }),
      ],
    };
    const out = extractBurnEvents(ledger, null);
    expect(out).toHaveLength(1);
    expect(out[0]!.txHash).toBe('0xc');
  });
});

describe('processTick — happy paths', () => {
  beforeEach(() => resetState());

  it('processes a BURN_FOR_RETIREMENT end-to-end', async () => {
    seedIssuance('iss-1', 'ISSUED');
    const aurigraph = makeAurigraphAdapter([
      makeRetirementLedgerEntry({
        txHash: '0xretire',
        issuanceId: 'iss-1',
        bcrSerialId: 'bcr-1',
      }),
    ]);
    const bcr = makeBcrAdapter();

    const res = await processTick({
      pollIntervalMs: 1,
      maxRetries: 5,
      aurigraph,
      bcr,
    });

    expect(res.fetched).toBe(1);
    expect(res.processed).toBe(1);
    expect(bcr.retireVCC).toHaveBeenCalledTimes(1);
    expect(bcr.unlockVCC).not.toHaveBeenCalled();

    const retireCall = bcr.retireVCC.mock.calls[0]![0]!;
    expect(retireCall.bcrSerialId).toBe('bcr-1');
    expect(retireCall.units).toBe(100);
    expect(retireCall.beneficiary.name).toBe('AcmeCorp');

    expect(fakeDb.issuances.get('iss-1')!.status).toBe('RETIRED');
    expect(fakeDb.processed.get('0xretire')!.status).toBe('PROCESSED');
    expect(fakeDb.cursors.get('default')!.lastTxHash).toBe('0xretire');
    expect(recordedSyncEvents).toHaveLength(1);
    expect(recordedSyncEvents[0]!.eventType).toBe('RETIRE_VCC');
  });

  it('processes a BURN_FOR_DELIST end-to-end', async () => {
    seedIssuance('iss-2', 'RETIRED'); // start anywhere — worker forces ISSUED
    const aurigraph = makeAurigraphAdapter([
      makeDelistLedgerEntry({
        txHash: '0xdelist',
        issuanceId: 'iss-2',
        bcrSerialId: 'bcr-2',
        bcrLockId: 'lock-2',
      }),
    ]);
    const bcr = makeBcrAdapter();

    const res = await processTick({
      pollIntervalMs: 1,
      maxRetries: 5,
      aurigraph,
      bcr,
    });

    expect(res.processed).toBe(1);
    expect(bcr.unlockVCC).toHaveBeenCalledTimes(1);
    expect(bcr.retireVCC).not.toHaveBeenCalled();
    expect(bcr.unlockVCC.mock.calls[0]![0]!.bcrLockId).toBe('lock-2');

    expect(fakeDb.issuances.get('iss-2')!.status).toBe('ISSUED');
    expect(fakeDb.processed.get('0xdelist')!.status).toBe('PROCESSED');
    expect(recordedSyncEvents[0]!.eventType).toBe('UNLOCK_VCC');
  });

  it('cursor advances by the number of events processed in one tick', async () => {
    seedIssuance('iss-1');
    seedIssuance('iss-2');
    seedIssuance('iss-3');
    const aurigraph = makeAurigraphAdapter([
      makeRetirementLedgerEntry({
        txHash: '0x1',
        issuanceId: 'iss-1',
        bcrSerialId: 'bcr-1',
      }),
      makeRetirementLedgerEntry({
        txHash: '0x2',
        issuanceId: 'iss-2',
        bcrSerialId: 'bcr-2',
      }),
      makeDelistLedgerEntry({
        txHash: '0x3',
        issuanceId: 'iss-3',
        bcrSerialId: 'bcr-3',
        bcrLockId: 'lock-3',
      }),
    ]);
    const bcr = makeBcrAdapter();

    const res = await processTick({
      pollIntervalMs: 1,
      maxRetries: 5,
      aurigraph,
      bcr,
    });

    expect(res.processed).toBe(3);
    expect(fakeDb.cursors.get('default')!.lastTxHash).toBe('0x3');
    expect(fakeDb.processed.size).toBe(3);
  });
});

describe('processTick — idempotency', () => {
  beforeEach(() => resetState());

  it('does not re-call BCR for an already-PROCESSED txHash', async () => {
    seedIssuance('iss-1');
    const entry = makeRetirementLedgerEntry({
      txHash: '0xdupe',
      issuanceId: 'iss-1',
      bcrSerialId: 'bcr-1',
    });
    const aurigraph = makeAurigraphAdapter([entry]);
    const bcr = makeBcrAdapter();

    const res1 = await processTick({
      pollIntervalMs: 1,
      maxRetries: 5,
      aurigraph,
      bcr,
    });
    expect(res1.processed).toBe(1);

    // Simulate the SDK still returning the same entry on a later tick (some
    // public-ledger envelopes are not strictly cursor-paginated). The cursor
    // has advanced to 0xdupe, so extractBurnEvents will filter it out before
    // it ever reaches the adapter.
    const aurigraph2 = makeAurigraphAdapter([entry]);
    const res2 = await processTick({
      pollIntervalMs: 1,
      maxRetries: 5,
      aurigraph: aurigraph2,
      bcr,
    });

    expect(res2.fetched).toBe(0);
    expect(bcr.retireVCC).toHaveBeenCalledTimes(1); // unchanged from tick 1
  });

  it('skips a row already PROCESSED even if cursor lost track', async () => {
    seedIssuance('iss-1');
    // Pre-seed a PROCESSED row but no cursor — simulates a partial state
    // recovery scenario.
    fakeDb.processed.set('0xseen', {
      txHash: '0xseen',
      eventType: 'BURN_FOR_RETIREMENT',
      issuanceId: 'iss-1',
      retryCount: 0,
      status: 'PROCESSED',
      lastError: null,
    });
    const aurigraph = makeAurigraphAdapter([
      makeRetirementLedgerEntry({
        txHash: '0xseen',
        issuanceId: 'iss-1',
        bcrSerialId: 'bcr-1',
      }),
    ]);
    const bcr = makeBcrAdapter();

    const res = await processTick({
      pollIntervalMs: 1,
      maxRetries: 5,
      aurigraph,
      bcr,
    });

    expect(res.skipped).toBe(1);
    expect(res.processed).toBe(0);
    expect(bcr.retireVCC).not.toHaveBeenCalled();
    // Cursor still advances past the skipped event.
    expect(fakeDb.cursors.get('default')!.lastTxHash).toBe('0xseen');
  });
});

describe('processTick — at-least-once on BCR failure', () => {
  beforeEach(() => resetState());

  it('does NOT advance cursor past a retryable BCR failure', async () => {
    seedIssuance('iss-1');
    seedIssuance('iss-2');
    const aurigraph = makeAurigraphAdapter([
      makeRetirementLedgerEntry({
        txHash: '0xok',
        issuanceId: 'iss-1',
        bcrSerialId: 'bcr-1',
      }),
      makeRetirementLedgerEntry({
        txHash: '0xfail',
        issuanceId: 'iss-2',
        bcrSerialId: 'bcr-2',
      }),
    ]);
    const bcr = makeBcrAdapter();
    // First call (0xok) succeeds, second call (0xfail) returns ok:false.
    bcr.retireVCC
      .mockResolvedValueOnce({
        ok: true,
        externalRef: 'r-1',
        data: { retirementStatementUrl: 'https://x' },
      })
      .mockResolvedValueOnce({
        ok: false,
        externalRef: null,
        reason: 'BCR upstream 503',
      });

    const res = await processTick({
      pollIntervalMs: 1,
      maxRetries: 5,
      aurigraph,
      bcr,
    });

    expect(res.processed).toBe(1); // 0xok
    expect(res.retried).toBe(1); // 0xfail
    // Cursor advanced to the LAST PROCESSED event (0xok) — NOT past 0xfail.
    expect(fakeDb.cursors.get('default')!.lastTxHash).toBe('0xok');
    expect(fakeDb.processed.get('0xfail')!.status).toBe('PENDING');
    expect(fakeDb.processed.get('0xfail')!.retryCount).toBe(1);
    expect(fakeDb.processed.get('0xfail')!.lastError).toContain('BCR upstream 503');
    // Issuance for the failed event is NOT updated.
    expect(fakeDb.issuances.get('iss-2')!.status).toBe('ISSUED');
  });

  it('marks event FAILED_PERMANENT after exceeding maxRetries and advances cursor', async () => {
    seedIssuance('iss-1');
    const entry = makeRetirementLedgerEntry({
      txHash: '0xbad',
      issuanceId: 'iss-1',
      bcrSerialId: 'bcr-1',
    });
    const bcr = makeBcrAdapter();
    bcr.retireVCC.mockResolvedValue({
      ok: false,
      externalRef: null,
      reason: 'persistent failure',
    });

    // Drive 6 ticks with maxRetries=5 — 5th still PENDING (retryCount=5),
    // 6th flips to FAILED_PERMANENT.
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      await processTick({
        pollIntervalMs: 1,
        maxRetries,
        aurigraph: makeAurigraphAdapter([entry]),
        bcr,
      });
    }
    expect(fakeDb.processed.get('0xbad')!.retryCount).toBe(maxRetries);
    expect(fakeDb.processed.get('0xbad')!.status).toBe('PENDING');
    // Cursor still NOT advanced past 0xbad.
    expect(fakeDb.cursors.get('default')?.lastTxHash ?? null).toBe(null);

    // 6th tick — retryCount becomes 6 > maxRetries → FAILED_PERMANENT.
    const finalRes = await processTick({
      pollIntervalMs: 1,
      maxRetries,
      aurigraph: makeAurigraphAdapter([entry]),
      bcr,
    });

    expect(finalRes.failedPermanent).toBe(1);
    expect(fakeDb.processed.get('0xbad')!.status).toBe('FAILED_PERMANENT');
    expect(fakeDb.processed.get('0xbad')!.retryCount).toBe(maxRetries + 1);
    // Cursor advances now that the event is parked.
    expect(fakeDb.cursors.get('default')!.lastTxHash).toBe('0xbad');
    // Issuance was NOT flipped — it stays ISSUED for human review.
    expect(fakeDb.issuances.get('iss-1')!.status).toBe('ISSUED');
  });
});

describe('worker lifecycle', () => {
  beforeEach(async () => {
    resetState();
    await stopAurigraphEventsWorker();
  });

  it('start schedules a tick; stop cancels the next tick and awaits in-flight', async () => {
    vi.useFakeTimers();
    seedIssuance('iss-life-1');

    const adapterEntries: Array<Record<string, unknown>> = [
      makeRetirementLedgerEntry({
        txHash: '0xlife',
        issuanceId: 'iss-life-1',
        bcrSerialId: 'bcr-life',
      }),
    ];
    const aurigraph = makeAurigraphAdapter(adapterEntries);
    const bcr = makeBcrAdapter();

    await startAurigraphEventsWorker({
      pollIntervalMs: 50,
      maxRetries: 5,
      aurigraphAdapter: aurigraph,
      bcrAdapter: bcr,
    });
    expect(__isWorkerActive()).toBe(true);

    // Advance past the first scheduled timeout.
    await vi.advanceTimersByTimeAsync(60);
    // Allow the in-flight tick promise + scheduleNextTick microtasks to drain.
    await vi.runAllTicks();
    // Yield to real microtasks one more time.
    await Promise.resolve();
    await Promise.resolve();

    expect(aurigraph.getPublicLedger).toHaveBeenCalled();

    // Stop and verify no further calls happen.
    vi.useRealTimers();
    await stopAurigraphEventsWorker();
    expect(__isWorkerActive()).toBe(false);

    const callsAtStop = aurigraph.getPublicLedger.mock.calls.length;
    // Wait a real 60ms — no new tick should fire because the timer is dead.
    await new Promise((r) => setTimeout(r, 60));
    expect(aurigraph.getPublicLedger.mock.calls.length).toBe(callsAtStop);
  });

  it('start is idempotent — second call is a no-op', async () => {
    const aurigraph = makeAurigraphAdapter([]);
    const bcr = makeBcrAdapter();
    await startAurigraphEventsWorker({
      pollIntervalMs: 1_000_000, // never fires during the test
      maxRetries: 5,
      aurigraphAdapter: aurigraph,
      bcrAdapter: bcr,
    });
    await startAurigraphEventsWorker({
      pollIntervalMs: 1_000_000,
      maxRetries: 5,
      aurigraphAdapter: aurigraph,
      bcrAdapter: bcr,
    });
    expect(__isWorkerActive()).toBe(true);
    await stopAurigraphEventsWorker();
  });
});
