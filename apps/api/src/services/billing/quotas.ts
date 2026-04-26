/**
 * AAT-378 / AV4-378 — Tier quota constants.
 *
 * Per-plan caps on key resources (emission entries, reports, activities,
 * credit unit blocks, API rate, storage, team members). The middleware
 * `requireQuota(...)` reads these and gates writes when usage hits the
 * limit. The admin dashboard at `/admin/quotas` surfaces utilisation so
 * we can see who is bumping against their tier.
 *
 * IMPORTANT — These quota numbers are illustrative MVP defaults. Tune
 * via `docs/PRICING.md` once Compliance + Sales weigh in. Sibling to
 * `plans.ts` deliberately: pricing and quota policy share a tier enum
 * but otherwise evolve independently.
 *
 * Pricing tiers (see plans.ts):
 *   - MSME_INDIA          ₹4,999/yr        Scope 1+2
 *   - ENTERPRISE_INDIA    ₹9,999/site/yr   Scope 1+2
 *   - SME_INTERNATIONAL   $999/yr          Scope 1+2
 *   - ENTERPRISE_INTL     $1,999/site/yr   Scope 1+2
 *
 * Free tier (no Subscription row at all) gets a generous trial window
 * so the public-signup → onboarding → first-emission demo path is
 * unblocked. Once a paid checkout completes, the tier-specific quotas
 * apply.
 */
import type { SubscriptionPlan } from '@aurex/database';

export interface TierQuotas {
  /** Emission entries created per calendar month (org-scoped). */
  monthlyEmissionEntries: number;
  /** Reports generated per calendar year (org-scoped). */
  reportsPerYear: number;
  /** Concurrently active (non-CLOSED, non-REJECTED) PACM activities. */
  activitiesActive: number;
  /** Credit-unit blocks held across the org's CreditAccount(s). */
  creditUnitBlocks: number;
  /** Sliding-window API request budget, requests / hour. */
  apiRequestsPerHour: number;
  /** Object/blob storage cap in megabytes. */
  storageMb: number;
  /** Distinct active OrgMember rows (i.e. seats consumed). */
  teamMembers: number;
}

/**
 * Per-plan quota matrix. MSME / SME (single-seat plans) get the
 * smaller-org caps; ENTERPRISE_* plans get an order-of-magnitude bump
 * across the board to match the per-site billing model.
 *
 * NOTE: these are *illustrative* values for the AAT-378 MVP. The
 * canonical numbers will land in docs/PRICING.md after the
 * Compliance + Sales review.
 */
export const TIER_QUOTAS: Record<SubscriptionPlan, TierQuotas> = {
  MSME_INDIA: {
    monthlyEmissionEntries: 1000,
    reportsPerYear: 12,
    activitiesActive: 5,
    creditUnitBlocks: 100,
    apiRequestsPerHour: 1000,
    storageMb: 1024,
    teamMembers: 5,
  },
  ENTERPRISE_INDIA: {
    monthlyEmissionEntries: 10000,
    reportsPerYear: 60,
    activitiesActive: 50,
    creditUnitBlocks: 1000,
    apiRequestsPerHour: 10000,
    storageMb: 10240,
    teamMembers: 25,
  },
  SME_INTERNATIONAL: {
    monthlyEmissionEntries: 1000,
    reportsPerYear: 12,
    activitiesActive: 5,
    creditUnitBlocks: 100,
    apiRequestsPerHour: 1000,
    storageMb: 1024,
    teamMembers: 5,
  },
  ENTERPRISE_INTL: {
    monthlyEmissionEntries: 10000,
    reportsPerYear: 60,
    activitiesActive: 50,
    creditUnitBlocks: 1000,
    apiRequestsPerHour: 10000,
    storageMb: 10240,
    teamMembers: 25,
  },
};

/**
 * Free-tier quota. Applied when an org has no Subscription row OR only
 * has CANCELLED / EXPIRED rows. The Wave 11b active-subscription gate
 * still blocks writes when EXPIRED, so free-tier in practice means
 * pre-checkout / trial.
 */
export const FREE_QUOTAS: TierQuotas = {
  monthlyEmissionEntries: 100,
  reportsPerYear: 3,
  activitiesActive: 1,
  creditUnitBlocks: 10,
  apiRequestsPerHour: 100,
  storageMb: 100,
  teamMembers: 2,
};

/** Stable list of resources the middleware understands. */
export const QUOTA_RESOURCE_KEYS: ReadonlyArray<keyof TierQuotas> = [
  'monthlyEmissionEntries',
  'reportsPerYear',
  'activitiesActive',
  'creditUnitBlocks',
  'apiRequestsPerHour',
  'storageMb',
  'teamMembers',
] as const;

/** Human-friendly labels surfaced in problem-detail body + UI toasts. */
export const QUOTA_RESOURCE_LABELS: Record<keyof TierQuotas, string> = {
  monthlyEmissionEntries: 'monthly emission entries',
  reportsPerYear: 'reports this year',
  activitiesActive: 'active activities',
  creditUnitBlocks: 'credit unit blocks',
  apiRequestsPerHour: 'hourly API requests',
  storageMb: 'storage (MB)',
  teamMembers: 'team members',
};
