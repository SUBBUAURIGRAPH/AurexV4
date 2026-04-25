/**
 * AAT-RENEWAL / Wave 8c — Subscription renewal scheduler.
 *
 * Daily worker that scans for ACTIVE subscriptions approaching `endsAt`, and
 * for each one creates a Razorpay renewal order + emails the customer a
 * payment link. Mirrors the self-scheduling pattern of
 * `aurigraph-events.worker.ts` (in-process `setTimeout` loop, env-gated boot,
 * graceful stop) — NOT a real cron lib.
 *
 * Why setTimeout instead of BullMQ? The renewal cadence is naturally
 * idempotent at the row level — the
 * `RenewalAttempt @@unique([subscriptionId, periodStart])` constraint means a
 * second tick within the same window is a no-op. We don't need queue
 * semantics; one Aurex API node per environment + a 24h cadence makes
 * in-process scheduling sufficient. If we ever scale horizontally, the right
 * fix is a `pg_advisory_lock` on a worker-state row, not a queue.
 *
 * Tick logic
 * ----------
 *   1. SELECT all Subscription rows where:
 *        status = ACTIVE
 *        AND endsAt < now() + RENEWAL_WINDOW_DAYS (default 30)
 *        AND NOT EXISTS a RenewalAttempt with the same subscriptionId AND
 *            (status IN PENDING/EMAIL_SENT/PAID) for periodStart = endsAt.
 *   2. For each, call subscription.service.startRenewalCheckout(id).
 *      `RenewalInFlightError` is silently absorbed (defensive — the
 *      subselect should already filter these out).
 *   3. Best-effort email send via `emailService.sendRenewalPaymentLink`.
 *      Wave 8b is still in flight; we tolerate missing exports by guarding
 *      the import + try/catch around every send.
 *   4. Mark the RenewalAttempt as EMAIL_SENT.
 *   5. Separately scan for FAILED RenewalAttempts past the grace window and
 *      flip the parent Subscription to EXPIRED via
 *      `subscription.service.expireRenewalAttempt`.
 *
 * Idempotency
 * -----------
 *   - The DB unique constraint `(subscriptionId, periodStart)` is the
 *     ultimate guard.
 *   - The pre-fetch SELECT excludes subs that already have an in-flight
 *     RenewalAttempt for the next period. This avoids hitting Razorpay just
 *     to be told to throw `RenewalInFlightError`.
 *   - `RenewalInFlightError` IS still possible under race conditions
 *     (two ticks racing across worker restarts); we catch + log + continue.
 *
 * Lifecycle
 * ---------
 *   - `startRenewalScheduler()` schedules the first tick with `setTimeout`
 *     so callers can `await` start without blocking.
 *   - `stopRenewalScheduler()` clears the timer + awaits any in-flight tick.
 *
 * Gating
 * ------
 *   - `SUBSCRIPTION_RENEWAL_WORKER_ENABLED=1` to opt in (default off).
 *   - `NODE_ENV=test` does not auto-boot the worker.
 *   - `SUBSCRIPTION_RENEWAL_INTERVAL_MS` overrides the 24h default — tests
 *     pass small values directly via the start opts.
 *   - `SUBSCRIPTION_RENEWAL_LOOKAHEAD_DAYS` overrides the 30-day window.
 *   - `RENEWAL_GRACE_DAYS` overrides the 7-day post-expiry grace.
 */
import { prisma, type Subscription } from '@aurex/database';
import { logger } from '../lib/logger.js';
import {
  startRenewalCheckout,
  markRenewalEmailSent,
  expireRenewalAttempt,
  RenewalInFlightError,
  CannotRenewCancelledError,
} from '../services/billing/subscription.service.js';
import type { RazorpayClient } from '../services/billing/razorpay-client.js';

// ── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_LOOKAHEAD_DAYS = 30;
const DEFAULT_GRACE_DAYS = 7;

function readIntervalMs(): number {
  const raw = process.env.SUBSCRIPTION_RENEWAL_INTERVAL_MS;
  if (!raw) return DEFAULT_INTERVAL_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INTERVAL_MS;
}

function readLookaheadDays(): number {
  const raw = process.env.SUBSCRIPTION_RENEWAL_LOOKAHEAD_DAYS;
  if (!raw) return DEFAULT_LOOKAHEAD_DAYS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOOKAHEAD_DAYS;
}

function readGraceDays(): number {
  const raw = process.env.RENEWAL_GRACE_DAYS;
  if (!raw) return DEFAULT_GRACE_DAYS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_GRACE_DAYS;
}

// ── Public types ───────────────────────────────────────────────────────────

/**
 * Email service shape. Wave 8b ships the real implementation; we keep the
 * worker decoupled by accepting any function with this signature. Default:
 * a no-op stub that logs at debug level.
 */
export interface RenewalEmailSender {
  sendRenewalPaymentLink(input: {
    subscriptionId: string;
    organizationId: string;
    renewalAttemptId: string;
    paymentUrl: string;
    amountMinor: number;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void>;

  sendSubscriptionLapsedNotice(input: {
    subscriptionId: string;
    organizationId: string;
    renewalAttemptId: string;
  }): Promise<void>;
}

const noopEmailSender: RenewalEmailSender = {
  async sendRenewalPaymentLink(input) {
    logger.debug(
      { subscriptionId: input.subscriptionId, renewalAttemptId: input.renewalAttemptId },
      'noop renewal-email sender — payment link suppressed (Wave 8b not wired)',
    );
  },
  async sendSubscriptionLapsedNotice(input) {
    logger.debug(
      { subscriptionId: input.subscriptionId, renewalAttemptId: input.renewalAttemptId },
      'noop renewal-email sender — lapsed notice suppressed (Wave 8b not wired)',
    );
  },
};

export interface RenewalTickResult {
  scanned: number;
  /** Renewal orders successfully created in this tick. */
  ordersCreated: number;
  /** Emails sent (best-effort) in this tick. */
  emailsSent: number;
  /** Renewals skipped because an in-flight attempt already exists. */
  skipped: number;
  /** Errors during order creation (Razorpay or DB). */
  errors: number;
  /** Subscriptions flipped to EXPIRED because grace ran out. */
  expired: number;
}

// ── Worker state ───────────────────────────────────────────────────────────

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<RenewalTickResult> | null = null;
let stopRequested = false;

interface ResolvedDeps {
  intervalMs: number;
  lookaheadDays: number;
  graceDays: number;
  emailSender: RenewalEmailSender;
  /** Optional Razorpay client override — primarily for tests. */
  razorpayClient?: RazorpayClient;
}

let activeDeps: ResolvedDeps | null = null;

export interface StartRenewalSchedulerOptions {
  /** Override the polling cadence (ms). Tests pass a small value. */
  intervalMs?: number;
  /** Override the renewal lookahead window (days). */
  lookaheadDays?: number;
  /** Override the post-expiry grace window (days). */
  graceDays?: number;
  /** Override the email sender — primarily for tests + Wave 8b wiring. */
  emailSender?: RenewalEmailSender;
  /** Override the Razorpay client — primarily for tests. */
  razorpayClient?: RazorpayClient;
}

function resolveDeps(opts: StartRenewalSchedulerOptions): ResolvedDeps {
  return {
    intervalMs: opts.intervalMs ?? readIntervalMs(),
    lookaheadDays: opts.lookaheadDays ?? readLookaheadDays(),
    graceDays: opts.graceDays ?? readGraceDays(),
    emailSender: opts.emailSender ?? noopEmailSender,
    razorpayClient: opts.razorpayClient,
  };
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

/**
 * Bootstrap the renewal-scan loop. Idempotent — second call is a no-op.
 * The first tick is scheduled but NOT awaited so the API boot path isn't
 * blocked on a slow DB read.
 */
export async function startRenewalScheduler(
  opts: StartRenewalSchedulerOptions = {},
): Promise<void> {
  if (timer || activeDeps) {
    logger.warn('Subscription renewal scheduler already started — skipping');
    return;
  }
  stopRequested = false;
  activeDeps = resolveDeps(opts);

  logger.info(
    {
      intervalMs: activeDeps.intervalMs,
      lookaheadDays: activeDeps.lookaheadDays,
      graceDays: activeDeps.graceDays,
    },
    'Subscription renewal scheduler started',
  );

  scheduleNextTick();
}

/**
 * Graceful shutdown. Cancels the next scheduled tick and awaits any
 * currently-running tick before resolving.
 */
export async function stopRenewalScheduler(): Promise<void> {
  stopRequested = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (inFlight) {
    try {
      await inFlight;
    } catch {
      // tick errors are already logged inside processRenewalTick
    }
  }
  activeDeps = null;
}

function scheduleNextTick(): void {
  if (stopRequested || !activeDeps) return;
  const deps = activeDeps;
  timer = setTimeout(() => {
    if (stopRequested) return;
    inFlight = processRenewalTick(deps).catch((err) => {
      logger.error({ err }, 'Subscription renewal tick crashed');
      return {
        scanned: 0,
        ordersCreated: 0,
        emailsSent: 0,
        skipped: 0,
        errors: 0,
        expired: 0,
      };
    });
    inFlight.finally(() => {
      inFlight = null;
      scheduleNextTick();
    });
  }, deps.intervalMs);
}

// ── Tick: scan → create renewal orders → email → expire grace-busts ───────

/**
 * One pass of the renewal-scan loop. Exported for direct testing and for
 * manual one-shot runs (ops tooling). Returns a per-tick summary.
 */
export async function processRenewalTick(
  deps: ResolvedDeps,
): Promise<RenewalTickResult> {
  const result: RenewalTickResult = {
    scanned: 0,
    ordersCreated: 0,
    emailsSent: 0,
    skipped: 0,
    errors: 0,
    expired: 0,
  };

  const now = new Date();
  const lookaheadMs = deps.lookaheadDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() + lookaheadMs);

  // ── Pass 1: subs needing a renewal order this tick.
  //
  // We pull a small page (200) of candidates per tick — that's plenty for
  // the realistic "thousands of subs renewing in any 30d window" tier and
  // keeps the worker bounded so a runaway DB doesn't hold the loop hostage.
  const candidates = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endsAt: { lt: cutoff },
    },
    take: 200,
    orderBy: { endsAt: 'asc' },
  });

  for (const sub of candidates) {
    result.scanned += 1;
    const decision = await decideRenewalAction(sub);
    if (decision === 'skip') {
      result.skipped += 1;
      continue;
    }

    try {
      const renewal = deps.razorpayClient
        ? await startRenewalCheckout(sub.id, deps.razorpayClient)
        : await startRenewalCheckout(sub.id);
      result.ordersCreated += 1;

      // Best-effort email send. Wave 8b not yet live → noop sender just
      // logs; the try/catch here is the durable guard.
      try {
        await deps.emailSender.sendRenewalPaymentLink({
          subscriptionId: sub.id,
          organizationId: sub.organizationId,
          renewalAttemptId: renewal.renewalAttemptId,
          paymentUrl: renewal.paymentUrl,
          amountMinor: renewal.amount,
          currency: renewal.currency,
          periodStart: renewal.periodStart,
          periodEnd: renewal.periodEnd,
        });
        await markRenewalEmailSent(renewal.renewalAttemptId, new Date());
        result.emailsSent += 1;
      } catch (err) {
        logger.warn(
          { err, subscriptionId: sub.id, renewalAttemptId: renewal.renewalAttemptId },
          'Renewal email send failed — RenewalAttempt left at PENDING for next tick',
        );
      }
    } catch (err) {
      // RenewalInFlightError can still happen under tight races (two
      // workers, or a tick interrupted during DB work). We treat it as a
      // skip — the row already exists and another path is handling it.
      if (err instanceof RenewalInFlightError) {
        result.skipped += 1;
        logger.debug(
          { subscriptionId: sub.id },
          'Renewal already in flight (race) — skipping',
        );
        continue;
      }
      if (err instanceof CannotRenewCancelledError) {
        // Should be filtered by the SELECT, but defensive.
        result.skipped += 1;
        continue;
      }
      result.errors += 1;
      logger.error(
        { err, subscriptionId: sub.id },
        'Renewal order creation failed — leaving subscription for next tick',
      );
    }
  }

  // ── Pass 2: subs whose renewal grace has expired → flip to EXPIRED.
  //
  // We look for ANY non-PAID RenewalAttempt whose periodStart is older
  // than now() − graceDays AND whose parent sub is still ACTIVE. The
  // service helper handles the actual flip + idempotency.
  const graceCutoff = new Date(now.getTime() - deps.graceDays * 24 * 60 * 60 * 1000);
  const expired = await prisma.renewalAttempt.findMany({
    where: {
      status: { in: ['PENDING', 'EMAIL_SENT', 'FAILED'] },
      periodStart: { lt: graceCutoff },
      subscription: {
        status: 'ACTIVE',
      },
    },
    take: 200,
  });

  for (const attempt of expired) {
    try {
      const out = await expireRenewalAttempt(attempt.id, 'grace_window_expired_without_payment');
      if (out.expired) {
        result.expired += 1;
        // Best-effort lapsed-notice email.
        try {
          await deps.emailSender.sendSubscriptionLapsedNotice({
            subscriptionId: attempt.subscriptionId,
            organizationId: '', // worker doesn't carry org id; sender resolves from sub if needed
            renewalAttemptId: attempt.id,
          });
        } catch (err) {
          logger.warn(
            { err, subscriptionId: attempt.subscriptionId },
            'Lapsed-notice email failed — non-fatal',
          );
        }
      }
    } catch (err) {
      result.errors += 1;
      logger.error(
        { err, renewalAttemptId: attempt.id },
        'expireRenewalAttempt threw — non-fatal, will retry next tick',
      );
    }
  }

  if (result.scanned > 0 || result.expired > 0) {
    logger.info(result, 'Subscription renewal scheduler tick complete');
  }

  return result;
}

/**
 * Per-subscription decision: do we attempt a renewal this tick?
 *
 * Returns `'attempt'` only when there is no in-flight RenewalAttempt for
 * this subscription's NEXT period (periodStart = sub.endsAt). The second
 * line of defence is the DB unique constraint on (subscriptionId,
 * periodStart) — that's why we still try-catch `RenewalInFlightError` in
 * the caller.
 */
async function decideRenewalAction(sub: Subscription): Promise<'attempt' | 'skip'> {
  // Defensive: ACTIVE subs without endsAt are anomalous. Skip — operator
  // should fix the row out-of-band rather than have us guess at periodStart.
  if (!sub.endsAt) return 'skip';

  const inFlight = await prisma.renewalAttempt.findFirst({
    where: {
      subscriptionId: sub.id,
      periodStart: sub.endsAt,
      status: { in: ['PENDING', 'EMAIL_SENT', 'PAID'] },
    },
  });
  if (inFlight) return 'skip';
  return 'attempt';
}

// ── Test-only helpers ──────────────────────────────────────────────────────

/** Test helper — exposes the worker's internal state for assertion. */
export function __isRenewalSchedulerActive(): boolean {
  return activeDeps !== null;
}

/**
 * Test helper — drive a single tick of the worker WITHOUT starting the
 * polling loop. Tests use this to deterministically exercise the
 * scan → create → email → expire path.
 */
export async function processOnce(opts: {
  emailSender?: RenewalEmailSender;
  razorpayClient?: RazorpayClient;
  lookaheadDays?: number;
  graceDays?: number;
}): Promise<RenewalTickResult> {
  return processRenewalTick({
    intervalMs: 0,
    lookaheadDays: opts.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS,
    graceDays: opts.graceDays ?? DEFAULT_GRACE_DAYS,
    emailSender: opts.emailSender ?? noopEmailSender,
    razorpayClient: opts.razorpayClient,
  });
}
