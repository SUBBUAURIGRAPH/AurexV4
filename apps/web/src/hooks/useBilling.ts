/**
 * AAT-CHECKOUT / Wave 8a: Razorpay billing hooks.
 *
 * Wraps the three lifecycle endpoints shipped in Wave 7
 * (`apps/api/src/routes/billing.ts` + `subscription.service.ts`):
 *
 *   POST /api/v1/billing/checkout          — startCheckout, returns
 *                                            { orderId, keyId, amount, ... }
 *                                            or { skippedRazorpay: true } on
 *                                            full-discount short-circuit
 *   POST /api/v1/billing/checkout/success  — finaliseCheckout, signs off the
 *                                            payment after the Checkout modal
 *                                            returns
 *   GET  /api/v1/billing/subscriptions/me  — caller-org's active subscription
 *
 * Single `/api/v1` prefix — `1f81759` fixed the double-prefix bug; the api
 * wrapper auto-prefixes, so we pass plain `/billing/...` paths here.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ============================================
   Types — match the AAT-RZP backend contract
   ============================================ */

export type SubscriptionPlan =
  | 'MSME_INDIA'
  | 'ENTERPRISE_INDIA'
  | 'SME_INTERNATIONAL'
  | 'ENTERPRISE_INTL';

export type SubscriptionRegion = 'INDIA' | 'INTERNATIONAL';

export type SubscriptionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'TRIAL'
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface StartCheckoutInput {
  plan: SubscriptionPlan;
  perSiteCount?: number;
  couponCode?: string;
}

/**
 * Result of POST /billing/checkout. When `skippedRazorpay` is true, the
 * coupon zeroed the bill and the subscription is already ACTIVE — the
 * caller should NOT launch the Razorpay Checkout modal.
 */
export interface CheckoutInitResponse {
  subscriptionId: string;
  orderId: string | null;
  keyId: string | null;
  amount: number;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  skippedRazorpay: boolean;
  status: SubscriptionStatus;
  appliedCouponCode: string | null;
}

export interface FinaliseCheckoutInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface FinaliseCheckoutResponse {
  subscriptionId: string;
  status: SubscriptionStatus;
  startsAt: string | null;
  endsAt: string | null;
  invoiceNumber: string;
  alreadyActive: boolean;
}

/**
 * Subset of the Subscription row returned by GET /billing/subscriptions/me.
 * The full Prisma type lives in @aurex/database; we only model the fields
 * the web UI consumes.
 */
export interface MySubscription {
  id: string;
  organizationId: string;
  plan: SubscriptionPlan;
  region: SubscriptionRegion;
  status: SubscriptionStatus;
  currency: string;
  amountMinor: number;
  perSiteCount: number;
  totalAmountMinor: number;
  startsAt: string | null;
  endsAt: string | null;
  appliedCouponCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ============================================
   Hooks
   ============================================ */

export function useStartCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartCheckoutInput) =>
      api
        .post<{ data: CheckoutInitResponse }>('/billing/checkout', input)
        .then((r) => r.data),
    onSuccess: () => {
      // If we short-circuited (skippedRazorpay) the caller's active
      // subscription is now ACTIVE — refresh the cached read.
      qc.invalidateQueries({ queryKey: ['billing', 'subscriptions', 'me'] });
    },
  });
}

export function useFinaliseCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FinaliseCheckoutInput) =>
      api
        .post<{ data: FinaliseCheckoutResponse }>('/billing/checkout/success', input)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing', 'subscriptions', 'me'] });
    },
  });
}

export function useMySubscription() {
  return useQuery({
    queryKey: ['billing', 'subscriptions', 'me'],
    queryFn: () =>
      api.get<{ data: MySubscription | null }>('/billing/subscriptions/me'),
    staleTime: 60_000,
  });
}
