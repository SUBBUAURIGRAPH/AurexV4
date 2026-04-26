/**
 * AAT-378 / AV4-378 — Tier quota service.
 *
 * Resolves an org's TierQuotas from its current Subscription, counts
 * live usage across the relevant Prisma models, and exposes a
 * `checkQuota(orgId, resource)` decision used by the
 * `requireQuota(...)` middleware and the admin dashboard reads.
 *
 * Counts are computed live (no caching) — that is a deliberate Wave
 * 13+ optimisation. For the MVP we accept the per-write COUNT cost in
 * exchange for zero invalidation surface.
 *
 * Subscription resolution mirrors the Wave 11b active-subscription
 * gate: most-recent non-CANCELLED row wins; falls back to FREE_QUOTAS
 * when no row exists OR when the most-recent row is EXPIRED. The
 * Wave 11b gate already 402's writes for EXPIRED, so in practice
 * we only see FREE_QUOTAS pre-checkout.
 */
import { prisma, type SubscriptionPlan } from '@aurex/database';
import {
  FREE_QUOTAS,
  QUOTA_RESOURCE_LABELS,
  TIER_QUOTAS,
  type TierQuotas,
} from './quotas.js';

/** Thrown by checkQuota when usage has hit the tier limit. */
export class QuotaExceededError extends Error {
  public readonly status = 429;
  public readonly type = 'https://aurex.in/errors/quota-exceeded';

  constructor(
    public readonly resource: keyof TierQuotas,
    public readonly used: number,
    public readonly limit: number,
  ) {
    super(
      `Quota exceeded for ${QUOTA_RESOURCE_LABELS[resource]} (${used} / ${limit})`,
    );
    this.name = 'QuotaExceededError';
  }
}

export interface QuotaCheckResult {
  resource: keyof TierQuotas;
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Returns the active TierQuotas for an org. Falls back to FREE_QUOTAS
 * when there is no Subscription, or when the most-recent non-CANCELLED
 * row is in a non-paid state (EXPIRED). PAYMENT_FAILED inside the
 * grace window keeps the tier's quotas — the Wave 11b gate handles
 * post-grace blocking.
 */
export async function getQuotaForOrg(orgId: string): Promise<TierQuotas> {
  const sub = await prisma.subscription.findFirst({
    where: { organizationId: orgId, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
    select: { plan: true, status: true },
  });

  if (!sub || sub.status === 'EXPIRED') {
    return FREE_QUOTAS;
  }

  return TIER_QUOTAS[sub.plan as SubscriptionPlan] ?? FREE_QUOTAS;
}

/**
 * Returns the SubscriptionPlan label (or 'FREE') for the org, used by
 * the admin dashboard to render the tier alongside utilisation.
 */
export async function getPlanForOrg(
  orgId: string,
): Promise<SubscriptionPlan | 'FREE'> {
  const sub = await prisma.subscription.findFirst({
    where: { organizationId: orgId, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
    select: { plan: true, status: true },
  });
  if (!sub || sub.status === 'EXPIRED') return 'FREE';
  return sub.plan;
}

/**
 * Beginning-of-current-calendar-month UTC. The monthlyEmissionEntries
 * cap rolls over at month boundaries — picking calendar month over
 * 30-day-rolling matches how org reporting cadence is described in
 * docs/PRICING.md.
 */
function startOfMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Beginning-of-current-calendar-year UTC. */
function startOfYear(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

/**
 * Counts live usage across the relevant Prisma models. Returns a full
 * TierQuotas-shaped record so the admin dashboard can compute ratios
 * uniformly.
 *
 * NB: `apiRequestsPerHour` and `storageMb` are reported as 0 today —
 * we don't yet have a request-count store nor a blob-store size index.
 * The middleware path doesn't gate on those resources (only the three
 * write routes wired in are emissions / reports / activities). When
 * those signals land they will plug into this function without route
 * changes.
 */
export async function getCurrentUsage(orgId: string): Promise<TierQuotas> {
  const monthStart = startOfMonth();
  const yearStart = startOfYear();

  const [
    emissionsThisMonth,
    reportsThisYear,
    activitiesActive,
    creditAccount,
    teamMembers,
  ] = await Promise.all([
    prisma.emissionsRecord.count({
      where: { orgId, createdAt: { gte: monthStart } },
    }),
    prisma.report.count({
      where: { orgId, createdAt: { gte: yearStart } },
    }),
    prisma.activity.count({
      where: {
        orgId,
        status: { notIn: ['CLOSED', 'REJECTED'] },
      },
    }),
    prisma.creditAccount.findFirst({
      where: { orgId, accountType: 'ACTIVITY_PARTICIPANT' },
      select: { id: true },
    }),
    prisma.orgMember.count({ where: { orgId, isActive: true } }),
  ]);

  let creditUnitBlocks = 0;
  if (creditAccount) {
    creditUnitBlocks = await prisma.creditUnitBlock.count({
      where: { holderAccountId: creditAccount.id },
    });
  }

  return {
    monthlyEmissionEntries: emissionsThisMonth,
    reportsPerYear: reportsThisYear,
    activitiesActive,
    creditUnitBlocks,
    apiRequestsPerHour: 0, // not yet measured — see fn header.
    storageMb: 0, //         not yet measured — see fn header.
    teamMembers,
  };
}

/**
 * Returns a decision record for one resource. Throws nothing; the
 * middleware checks `allowed` and converts to RFC 7807. Direct service
 * callers (e.g. the admin dashboard) read the full record.
 */
export async function checkQuota(
  orgId: string,
  resource: keyof TierQuotas,
): Promise<QuotaCheckResult> {
  const [limits, usage] = await Promise.all([
    getQuotaForOrg(orgId),
    getCurrentUsage(orgId),
  ]);
  const limit = limits[resource];
  const used = usage[resource];
  const remaining = Math.max(0, limit - used);
  return {
    resource,
    used,
    limit,
    remaining,
    allowed: used < limit,
  };
}

/**
 * Throwing variant of checkQuota — convenient for service-layer code
 * that prefers exceptional flow. The middleware uses the non-throwing
 * variant so it can stamp the RFC 7807 body directly.
 */
export async function assertQuota(
  orgId: string,
  resource: keyof TierQuotas,
): Promise<QuotaCheckResult> {
  const result = await checkQuota(orgId, resource);
  if (!result.allowed) {
    throw new QuotaExceededError(resource, result.used, result.limit);
  }
  return result;
}

/** Snapshot used by `/quotas/me` and `/admin/quotas/:orgId`. */
export interface OrgQuotaSnapshot {
  orgId: string;
  plan: SubscriptionPlan | 'FREE';
  limits: TierQuotas;
  usage: TierQuotas;
  remaining: TierQuotas;
  /** used / limit — clamped to [0, ∞). 1.0 means at limit, > 1 means over. */
  ratios: Record<keyof TierQuotas, number>;
}

export async function getOrgQuotaSnapshot(orgId: string): Promise<OrgQuotaSnapshot> {
  const [plan, limits, usage] = await Promise.all([
    getPlanForOrg(orgId),
    getQuotaForOrg(orgId),
    getCurrentUsage(orgId),
  ]);

  const remaining = {} as TierQuotas;
  const ratios = {} as Record<keyof TierQuotas, number>;
  (Object.keys(limits) as Array<keyof TierQuotas>).forEach((k) => {
    const lim = limits[k];
    const used = usage[k];
    remaining[k] = Math.max(0, lim - used);
    ratios[k] = lim === 0 ? 0 : used / lim;
  });

  return { orgId, plan, limits, usage, remaining, ratios };
}
