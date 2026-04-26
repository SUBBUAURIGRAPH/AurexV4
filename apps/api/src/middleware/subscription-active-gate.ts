import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';

/**
 * AAT-11B (Wave 11b): EXPIRED-subscription write-block gate.
 *
 * Wave 8c's renewal worker can flip a Subscription.status to EXPIRED when
 * the post-`endsAt` grace window closes without a successful renewal
 * capture. Without this gate the user could still POST/PATCH/DELETE
 * billable data after the paid period lapsed. This middleware blocks
 * writes while leaving reads untouched (so the user can still export
 * their data and review history while they sort out billing).
 *
 * Behaviour:
 *   - Reads the most recent non-CANCELLED Subscription for the org.
 *     Mirrors the Wave 8c renewal worker's view of "current status":
 *     `Subscription.findFirst({ where: { organizationId, status: { not:
 *     'CANCELLED' } }, orderBy: { createdAt: 'desc' } })`.
 *   - If `status === 'EXPIRED'` OR
 *        (`status === 'PAYMENT_FAILED'` AND `endsAt < now()`)
 *     respond with 402 Payment Required + RFC 7807 body and a
 *     `nextStep: '/billing/manage'` hint the frontend interceptor uses
 *     to redirect.
 *   - If `status === 'CANCELLED'` and `endsAt > now()` (still inside
 *     the paid period after a cancellation) → next().
 *     If `status === 'CANCELLED'` and `endsAt < now()` → block. The
 *     `findFirst` above filters CANCELLED out, so this branch is only
 *     reachable when the most-recent non-CANCELLED row is missing AND
 *     a CANCELLED row exists with a past endsAt — handled by re-querying
 *     when the primary lookup yields nothing.
 *   - If no Subscription row exists at all → next() (free-tier / pre-
 *     checkout; the onboarding gate covers org-creation hygiene).
 *   - ACTIVE / TRIAL / PENDING (and PAYMENT_FAILED still inside grace)
 *     → next().
 *
 * Status code choice (402 vs 451):
 *   RFC 7231 marks 402 Payment Required as "reserved for future use",
 *   but it is the de facto choice for SaaS subscription paywalls
 *   (Stripe, GitHub, every Razorpay reference customer). 451 Unavailable
 *   For Legal Reasons is intentionally narrower (RFC 7725) — it signals
 *   a legal demand, not a billing lapse, so it would be misleading
 *   here. We pick 402.
 *
 * Must run AFTER `requireAuth` + `requireOrgScope` so `req.orgId` is set.
 * Apply ALONGSIDE (not in place of) `requireOnboardingComplete` — both
 * guards are independent and additive.
 */

export const SUBSCRIPTION_EXPIRED_TYPE =
  'https://aurex.in/errors/subscription-expired';

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.orgId) {
    // requireOrgScope should have already 403'd, but be defensive.
    res.status(403).json({
      type: 'https://aurex.in/errors/no-organization',
      title: 'Forbidden',
      status: 403,
      detail: 'Organization scope required',
      instance: req.originalUrl,
    });
    return;
  }

  try {
    const sub = await prisma.subscription.findFirst({
      where: {
        organizationId: req.orgId,
        status: { not: 'CANCELLED' },
      },
      orderBy: { createdAt: 'desc' },
      select: { status: true, endsAt: true },
    });

    // No non-CANCELLED row. Check for a CANCELLED-with-future-endsAt
    // row first (still inside paid period); otherwise let the request
    // through (free tier / pre-checkout — onboarding gate handles that
    // hygiene).
    if (!sub) {
      const cancelled = await prisma.subscription.findFirst({
        where: {
          organizationId: req.orgId,
          status: 'CANCELLED',
        },
        orderBy: { createdAt: 'desc' },
        select: { endsAt: true },
      });
      if (cancelled && cancelled.endsAt && cancelled.endsAt.getTime() <= Date.now()) {
        respondExpired(res, req.originalUrl);
        return;
      }
      next();
      return;
    }

    const now = Date.now();
    const endsAtMs = sub.endsAt ? sub.endsAt.getTime() : null;

    // Hard-expired by status.
    if (sub.status === 'EXPIRED') {
      respondExpired(res, req.originalUrl);
      return;
    }

    // PAYMENT_FAILED still inside the grace window (endsAt in the future,
    // or never set) is allowed — the renewal worker will flip the row to
    // EXPIRED once grace runs out. After endsAt has passed without a
    // capture, treat it as expired.
    if (sub.status === 'PAYMENT_FAILED' && endsAtMs !== null && endsAtMs < now) {
      respondExpired(res, req.originalUrl);
      return;
    }

    // ACTIVE / TRIAL / PENDING / PAYMENT_FAILED-in-grace — pass through.
    next();
  } catch (err) {
    logger.error(
      { err, orgId: req.orgId, url: req.originalUrl },
      'Failed to check subscription-active gate',
    );
    next(err);
  }
}

function respondExpired(res: Response, originalUrl: string): void {
  res.status(402).json({
    type: SUBSCRIPTION_EXPIRED_TYPE,
    title: 'Payment Required',
    status: 402,
    detail: 'Your subscription has expired. Renew to continue making changes.',
    instance: originalUrl,
    nextStep: '/billing/manage',
  });
}
