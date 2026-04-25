/**
 * AAT-RENEWAL / Wave 8c — subscription-renewal.worker tests.
 *
 * Strategy mirrors aurigraph-events.worker.test.ts:
 *   - Mock @aurex/database with a tiny stateful fake limited to the surface
 *     the worker + the renewal service touch (subscription, renewalAttempt).
 *   - Mock the subscription service helpers (startRenewalCheckout,
 *     markRenewalEmailSent, expireRenewalAttempt) — those have their own
 *     dedicated test file.
 *   - Drive `processOnce()` directly for the per-tick assertions; use
 *     `start/stopRenewalScheduler` + fake timers for lifecycle assertions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted state buckets ──────────────────────────────────────────────────

const { fakeDb } = vi.hoisted(() => {
  type SubscriptionRow = {
    id: string;
    organizationId: string;
    plan: string;
    region: string;
    status: 'ACTIVE' | 'PENDING' | 'TRIAL' | 'PAYMENT_FAILED' | 'CANCELLED' | 'EXPIRED';
    currency: string;
    perSiteCount: number;
    endsAt: Date | null;
    metadata: Record<string, unknown> | null;
  };
  type RenewalRow = {
    id: string;
    subscriptionId: string;
    periodStart: Date;
    periodEnd: Date;
    amountMinor: number;
    currency: string;
    razorpayOrderId: string | null;
    status: 'PENDING' | 'EMAIL_SENT' | 'PAID' | 'FAILED' | 'CANCELLED';
    emailSentAt: Date | null;
    paidAt: Date | null;
    failedAt: Date | null;
    failureReason: string | null;
    retryCount: number;
    createdAt: Date;
  };

  const subscriptions = new Map<string, SubscriptionRow>();
  const renewals = new Map<string, RenewalRow>();

  const fakeDb = {
    subscriptions,
    renewals,
    subscription: {
      findMany: vi.fn(
        async ({
          where,
          take,
        }: {
          where: { status: string; endsAt?: { lt?: Date } };
          take?: number;
        }) => {
          const all = Array.from(subscriptions.values()).filter((s) => {
            if (s.status !== where.status) return false;
            if (where.endsAt?.lt && (!s.endsAt || s.endsAt >= where.endsAt.lt)) return false;
            return true;
          });
          all.sort((a, b) => (a.endsAt?.getTime() ?? 0) - (b.endsAt?.getTime() ?? 0));
          return take ? all.slice(0, take) : all;
        },
      ),
    },
    renewalAttempt: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            subscriptionId?: string;
            periodStart?: Date;
            status?: { in?: string[] };
          };
        }) => {
          for (const r of renewals.values()) {
            if (where.subscriptionId && r.subscriptionId !== where.subscriptionId) continue;
            if (where.periodStart && r.periodStart.getTime() !== where.periodStart.getTime())
              continue;
            if (where.status?.in && !where.status.in.includes(r.status)) continue;
            return r;
          }
          return null;
        },
      ),
      findMany: vi.fn(
        async ({
          where,
          take,
        }: {
          where: {
            status?: { in?: string[] };
            periodStart?: { lt?: Date };
            subscription?: { status?: string };
          };
          take?: number;
        }) => {
          const all = Array.from(renewals.values()).filter((r) => {
            if (where.status?.in && !where.status.in.includes(r.status)) return false;
            if (where.periodStart?.lt && r.periodStart >= where.periodStart.lt) return false;
            if (where.subscription?.status) {
              const sub = subscriptions.get(r.subscriptionId);
              if (!sub || sub.status !== where.subscription.status) return false;
            }
            return true;
          });
          return take ? all.slice(0, take) : all;
        },
      ),
    },
  };

  return { fakeDb };
});

vi.mock('@aurex/database', () => ({ prisma: fakeDb }));

// Mock the subscription service surface the worker invokes. We DO NOT mock
// the whole module — RenewalInFlightError + CannotRenewCancelledError are
// real classes and the worker uses `instanceof` to branch.
vi.mock('../services/billing/subscription.service.js', async () => {
  const actual = await vi.importActual<
    typeof import('../services/billing/subscription.service.js')
  >('../services/billing/subscription.service.js');
  return {
    ...actual,
    startRenewalCheckout: vi.fn(),
    markRenewalEmailSent: vi.fn(),
    expireRenewalAttempt: vi.fn(),
  };
});

// ── Imports AFTER mocks ────────────────────────────────────────────────────

import {
  processRenewalTick,
  processOnce,
  startRenewalScheduler,
  stopRenewalScheduler,
  __isRenewalSchedulerActive,
  type RenewalEmailSender,
} from './subscription-renewal.worker.js';
import {
  startRenewalCheckout as startRenewalCheckoutMock,
  markRenewalEmailSent as markRenewalEmailSentMock,
  expireRenewalAttempt as expireRenewalAttemptMock,
  RenewalInFlightError,
} from '../services/billing/subscription.service.js';

// ── Test fixture builders ──────────────────────────────────────────────────

function resetState(): void {
  fakeDb.subscriptions.clear();
  fakeDb.renewals.clear();
  vi.clearAllMocks();
}

function seedSub(overrides: Partial<{
  id: string;
  organizationId: string;
  status: 'ACTIVE' | 'PENDING' | 'TRIAL' | 'PAYMENT_FAILED' | 'CANCELLED' | 'EXPIRED';
  endsAt: Date | null;
  plan: string;
  perSiteCount: number;
}> = {}): string {
  const id = overrides.id ?? `sub-${fakeDb.subscriptions.size + 1}`;
  fakeDb.subscriptions.set(id, {
    id,
    organizationId: overrides.organizationId ?? `org-${id}`,
    plan: overrides.plan ?? 'MSME_INDIA',
    region: 'INDIA',
    status: overrides.status ?? 'ACTIVE',
    currency: 'INR',
    perSiteCount: overrides.perSiteCount ?? 1,
    endsAt: overrides.endsAt ?? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10d
    metadata: null,
  });
  return id;
}

function seedRenewal(opts: {
  id?: string;
  subscriptionId: string;
  periodStart: Date;
  status: 'PENDING' | 'EMAIL_SENT' | 'PAID' | 'FAILED' | 'CANCELLED';
}): string {
  const id = opts.id ?? `ra-${fakeDb.renewals.size + 1}`;
  fakeDb.renewals.set(id, {
    id,
    subscriptionId: opts.subscriptionId,
    periodStart: opts.periodStart,
    periodEnd: new Date(opts.periodStart.getTime() + 365 * 24 * 60 * 60 * 1000),
    amountMinor: 589882,
    currency: 'INR',
    razorpayOrderId: 'order_renewal_test',
    status: opts.status,
    emailSentAt: null,
    paidAt: null,
    failedAt: null,
    failureReason: null,
    retryCount: 0,
    createdAt: new Date(),
  });
  return id;
}

function makeEmailSender(): RenewalEmailSender & {
  sendRenewalPaymentLink: ReturnType<typeof vi.fn>;
  sendSubscriptionLapsedNotice: ReturnType<typeof vi.fn>;
} {
  return {
    sendRenewalPaymentLink: vi.fn(async () => {}),
    sendSubscriptionLapsedNotice: vi.fn(async () => {}),
  };
}

function primeStartRenewalCheckoutHappy(): void {
  vi.mocked(startRenewalCheckoutMock).mockImplementation(async (subscriptionId: string) => {
    const sub = fakeDb.subscriptions.get(subscriptionId);
    if (!sub) throw new Error(`fake: sub ${subscriptionId} missing`);
    const periodStart = sub.endsAt ?? new Date();
    const renewalId = `ra-from-${subscriptionId}`;
    fakeDb.renewals.set(renewalId, {
      id: renewalId,
      subscriptionId,
      periodStart,
      periodEnd: new Date(periodStart.getTime() + 365 * 24 * 60 * 60 * 1000),
      amountMinor: 589882,
      currency: 'INR',
      razorpayOrderId: `order_${renewalId}`,
      status: 'PENDING',
      emailSentAt: null,
      paidAt: null,
      failedAt: null,
      failureReason: null,
      retryCount: 0,
      createdAt: new Date(),
    });
    return {
      renewalAttemptId: renewalId,
      razorpayOrderId: `order_${renewalId}`,
      paymentUrl: `https://aurex.in/billing/renew/${renewalId}`,
      amount: 589882,
      currency: 'INR',
      periodStart,
      periodEnd: new Date(periodStart.getTime() + 365 * 24 * 60 * 60 * 1000),
    };
  });
  vi.mocked(markRenewalEmailSentMock).mockImplementation(async (id: string) => {
    const r = fakeDb.renewals.get(id);
    if (r && r.status === 'PENDING') {
      r.status = 'EMAIL_SENT';
      r.emailSentAt = new Date();
    }
  });
  vi.mocked(expireRenewalAttemptMock).mockImplementation(async (id: string) => {
    const r = fakeDb.renewals.get(id);
    if (!r) return { subscriptionId: '', expired: false };
    if (r.status === 'PAID' || r.status === 'CANCELLED') {
      return { subscriptionId: r.subscriptionId, expired: false };
    }
    r.status = 'FAILED';
    r.failedAt = new Date();
    const sub = fakeDb.subscriptions.get(r.subscriptionId);
    if (sub && sub.status === 'ACTIVE') {
      sub.status = 'EXPIRED';
      return { subscriptionId: sub.id, expired: true };
    }
    return { subscriptionId: r.subscriptionId, expired: false };
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('processRenewalTick — scan + renewal-order creation', () => {
  beforeEach(() => {
    resetState();
    primeStartRenewalCheckoutHappy();
  });

  it('finds ACTIVE subs with endsAt < now+30d and creates a RenewalAttempt for each', async () => {
    seedSub({ id: 'sub-A', endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
    seedSub({ id: 'sub-B', endsAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000) });
    // Outside the 30-day lookahead — should NOT be picked up.
    seedSub({ id: 'sub-far', endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) });

    const sender = makeEmailSender();
    const result = await processOnce({ emailSender: sender, lookaheadDays: 30, graceDays: 7 });

    expect(result.scanned).toBe(2);
    expect(result.ordersCreated).toBe(2);
    expect(result.emailsSent).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);

    expect(startRenewalCheckoutMock).toHaveBeenCalledTimes(2);
    expect(sender.sendRenewalPaymentLink).toHaveBeenCalledTimes(2);
    // The two new RenewalAttempt rows are persisted by the mocked service.
    expect(fakeDb.renewals.size).toBe(2);
    for (const r of fakeDb.renewals.values()) {
      expect(r.status).toBe('EMAIL_SENT');
    }
  });

  it('skips subs with an existing in-flight RenewalAttempt (PENDING / EMAIL_SENT)', async () => {
    const subId = seedSub({
      id: 'sub-inflight',
      endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    const sub = fakeDb.subscriptions.get(subId)!;
    seedRenewal({ subscriptionId: subId, periodStart: sub.endsAt!, status: 'PENDING' });

    const sender = makeEmailSender();
    const result = await processOnce({ emailSender: sender, lookaheadDays: 30 });

    expect(result.scanned).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.ordersCreated).toBe(0);
    expect(startRenewalCheckoutMock).not.toHaveBeenCalled();
    expect(sender.sendRenewalPaymentLink).not.toHaveBeenCalled();
  });

  it('processes a batch of 3 subs and persists 3 RenewalAttempts', async () => {
    seedSub({ id: 'sub-1', endsAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) });
    seedSub({ id: 'sub-2', endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) });
    seedSub({ id: 'sub-3', endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) });

    const sender = makeEmailSender();
    const result = await processOnce({ emailSender: sender });

    expect(result.scanned).toBe(3);
    expect(result.ordersCreated).toBe(3);
    expect(fakeDb.renewals.size).toBe(3);
    expect(startRenewalCheckoutMock).toHaveBeenCalledTimes(3);
  });

  it('absorbs RenewalInFlightError as skip (race-condition path)', async () => {
    seedSub({ id: 'sub-race', endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
    vi.mocked(startRenewalCheckoutMock).mockRejectedValueOnce(
      new RenewalInFlightError('sub-race'),
    );

    const sender = makeEmailSender();
    const result = await processOnce({ emailSender: sender });

    expect(result.scanned).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.ordersCreated).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('idempotency — second tick over the same subs yields zero new orders', async () => {
    seedSub({ id: 'sub-idem', endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });

    const sender = makeEmailSender();
    const r1 = await processOnce({ emailSender: sender });
    expect(r1.ordersCreated).toBe(1);
    expect(fakeDb.renewals.size).toBe(1);

    const r2 = await processOnce({ emailSender: sender });
    // Tick 2: pre-existing PENDING/EMAIL_SENT row → skip path.
    expect(r2.scanned).toBe(1);
    expect(r2.skipped).toBe(1);
    expect(r2.ordersCreated).toBe(0);
    expect(fakeDb.renewals.size).toBe(1);
  });

  it('email send failure leaves RenewalAttempt at PENDING (not EMAIL_SENT)', async () => {
    seedSub({ id: 'sub-emailfail', endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });

    const sender = makeEmailSender();
    sender.sendRenewalPaymentLink.mockRejectedValueOnce(new Error('SMTP down'));

    const result = await processOnce({ emailSender: sender });

    expect(result.ordersCreated).toBe(1);
    expect(result.emailsSent).toBe(0); // email send rejected → not counted
    // The renewal row was still persisted by startRenewalCheckout.
    expect(fakeDb.renewals.size).toBe(1);
    const row = Array.from(fakeDb.renewals.values())[0]!;
    // Crucially, status is still PENDING — markRenewalEmailSent never ran.
    expect(row.status).toBe('PENDING');
    expect(markRenewalEmailSentMock).not.toHaveBeenCalled();
  });

  it('expires renewals past grace + flips Subscription to EXPIRED', async () => {
    // Sub whose grace has expired — endsAt was 10 days ago, periodStart was
    // also 10 days ago, grace is 7 days → cutoff is 7d back, periodStart is
    // older than cutoff → eligible for expiry.
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const subId = seedSub({
      id: 'sub-grace',
      endsAt: tenDaysAgo,
      // Out of the lookahead select (it's NOT < now + 30d in the strict
      // sense — but we want it ACTIVE so the expire-pass picks it up).
      // We set endsAt to "10 days ago" which IS less than (now + 30d), so
      // the scan picks it up too. The PENDING renewal already exists →
      // pass 1 will skip; pass 2 will expire it.
    });
    seedRenewal({
      id: 'ra-grace',
      subscriptionId: subId,
      periodStart: tenDaysAgo,
      status: 'PENDING',
    });

    const sender = makeEmailSender();
    const result = await processOnce({ emailSender: sender, graceDays: 7 });

    expect(result.expired).toBe(1);
    expect(fakeDb.subscriptions.get(subId)!.status).toBe('EXPIRED');
    expect(fakeDb.renewals.get('ra-grace')!.status).toBe('FAILED');
    expect(sender.sendSubscriptionLapsedNotice).toHaveBeenCalledTimes(1);
  });
});

describe('renewal scheduler lifecycle', () => {
  beforeEach(async () => {
    resetState();
    await stopRenewalScheduler();
    primeStartRenewalCheckoutHappy();
  });

  it('start schedules a tick; stop cancels future ticks and awaits in-flight', async () => {
    vi.useFakeTimers();
    seedSub({ id: 'sub-life', endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });

    const sender = makeEmailSender();
    await startRenewalScheduler({
      intervalMs: 50,
      lookaheadDays: 30,
      graceDays: 7,
      emailSender: sender,
    });
    expect(__isRenewalSchedulerActive()).toBe(true);

    // Drive past the first scheduled timeout.
    await vi.advanceTimersByTimeAsync(60);
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();

    expect(fakeDb.subscription.findMany).toHaveBeenCalled();

    vi.useRealTimers();
    await stopRenewalScheduler();
    expect(__isRenewalSchedulerActive()).toBe(false);

    const callsAtStop = (fakeDb.subscription.findMany as ReturnType<typeof vi.fn>).mock.calls
      .length;
    // Wait a real 60ms — no new tick should fire because the timer is dead.
    await new Promise((r) => setTimeout(r, 60));
    expect(
      (fakeDb.subscription.findMany as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(callsAtStop);
  });

  it('start is idempotent — second call is a no-op', async () => {
    const sender = makeEmailSender();
    await startRenewalScheduler({
      intervalMs: 1_000_000, // never fires during the test
      emailSender: sender,
    });
    await startRenewalScheduler({
      intervalMs: 1_000_000,
      emailSender: sender,
    });
    expect(__isRenewalSchedulerActive()).toBe(true);
    await stopRenewalScheduler();
  });
});

describe('processRenewalTick — direct invocation', () => {
  beforeEach(() => {
    resetState();
    primeStartRenewalCheckoutHappy();
  });

  it('returns zero counts when no candidates exist', async () => {
    const sender = makeEmailSender();
    const result = await processRenewalTick({
      intervalMs: 0,
      lookaheadDays: 30,
      graceDays: 7,
      emailSender: sender,
    });
    expect(result).toEqual({
      scanned: 0,
      ordersCreated: 0,
      emailsSent: 0,
      skipped: 0,
      errors: 0,
      expired: 0,
    });
    expect(startRenewalCheckoutMock).not.toHaveBeenCalled();
  });

  it('counts errors when startRenewalCheckout throws non-RenewalInFlight', async () => {
    seedSub({ id: 'sub-err', endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
    vi.mocked(startRenewalCheckoutMock).mockRejectedValueOnce(new Error('Razorpay 502'));

    const sender = makeEmailSender();
    const result = await processOnce({ emailSender: sender });

    expect(result.errors).toBe(1);
    expect(result.ordersCreated).toBe(0);
    expect(sender.sendRenewalPaymentLink).not.toHaveBeenCalled();
  });
});
