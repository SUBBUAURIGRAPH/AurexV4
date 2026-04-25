/**
 * AAT-RZP / Wave 7: Subscription plan pricing constants.
 *
 * Single source of truth for plan-to-price mapping. The pricing matrix
 * mirrors `docs/PRICING.md` (Scope 1+2 only — Scope 3 is contact-us and
 * therefore not represented here).
 *
 * Money is integer minor units everywhere:
 *   - INR → paise. ₹4,999 = 499900 paise.
 *   - USD → cents. $999   = 99900 cents.
 *
 * NEVER store / pass float currency values around the billing pipeline.
 */
import type { SubscriptionPlan, SubscriptionRegion } from '@aurex/database';

export type PlanCurrency = 'INR' | 'USD';

export interface PlanPricing {
  currency: PlanCurrency;
  /** Price for ONE site, expressed in subunit (paise / cents). */
  amountMinor: number;
  region: SubscriptionRegion;
  /**
   * If true, the plan is sold per-site and `perSiteCount` is multiplied
   * into the total. Single-seat plans (MSME, SME) ignore `perSiteCount`.
   */
  perSiteScaling: boolean;
}

export const PLAN_PRICING: Record<SubscriptionPlan, PlanPricing> = {
  MSME_INDIA: {
    currency: 'INR',
    amountMinor: 499900, // ₹4,999.00
    region: 'INDIA',
    perSiteScaling: false,
  },
  ENTERPRISE_INDIA: {
    currency: 'INR',
    amountMinor: 999900, // ₹9,999.00 / site
    region: 'INDIA',
    perSiteScaling: true,
  },
  SME_INTERNATIONAL: {
    currency: 'USD',
    amountMinor: 99900, // $999.00
    region: 'INTERNATIONAL',
    perSiteScaling: false,
  },
  ENTERPRISE_INTL: {
    currency: 'USD',
    amountMinor: 199900, // $1,999.00 / site
    region: 'INTERNATIONAL',
    perSiteScaling: true,
  },
};

/**
 * GST rate for INR plans, surfaced for invoice calculation. International
 * plans handle tax per the customer's invoicing jurisdiction (the order
 * still settles in USD with no platform-side tax computation).
 */
export const INR_GST_RATE_BPS = 1800; // 18.00% in basis points (1 bp = 0.01%)

/** Multiply minor amount by basis-point rate, round HALF-UP to nearest int. */
export function applyBasisPoints(amountMinor: number, rateBps: number): number {
  // Math.round on positive numbers behaves as half-up — billing amounts are
  // always positive so this is fine.
  return Math.round((amountMinor * rateBps) / 10000);
}

export function computeBaseAmount(plan: SubscriptionPlan, perSiteCount: number): number {
  const pricing = PLAN_PRICING[plan];
  if (!pricing) {
    throw new Error(`Unknown subscription plan: ${plan}`);
  }
  const seats = pricing.perSiteScaling ? Math.max(1, perSiteCount) : 1;
  return pricing.amountMinor * seats;
}
