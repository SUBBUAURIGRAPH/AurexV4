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
  cancelledAt?: string | null;
  appliedCouponCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * AAT-10B / Wave 10b: invoice row shape returned by GET /billing/invoices.
 * Mirrors the Prisma `Invoice` model — totals are integer minor units.
 */
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'REFUNDED' | 'CANCELLED';

export interface Invoice {
  id: string;
  subscriptionId: string;
  invoiceNumber: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  status: InvoiceStatus;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * AAT-10B / Wave 10b: renewal-attempt row + parent subscription.
 * The renewal payment landing page reads this via GET /billing/renewal-attempts/:id.
 */
export type RenewalAttemptStatus =
  | 'PENDING'
  | 'EMAIL_SENT'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export interface RenewalAttempt {
  id: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  razorpayOrderId: string | null;
  status: RenewalAttemptStatus;
  emailSentAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  subscription: MySubscription;
}

/**
 * Result of POST /billing/renewal-attempts/:id/checkout. Same shape as the
 * regular checkout init response, plus a `reused` flag indicating whether
 * we returned an existing in-flight Razorpay order rather than minting a
 * fresh one (saves the customer from racing concurrent windows).
 */
export interface RenewalCheckoutInitResponse {
  renewalAttemptId: string;
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  reused: boolean;
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

/* ============================================
   AAT-10B / Wave 10b: manage / invoices / renewal hooks
   ============================================ */

/**
 * Lists the caller-org's invoices. We surface the raw Invoice[] (not paged)
 * because the existing /invoices endpoint returns the full list — when the
 * backend grows pagination this hook will accept (page, pageSize) and read
 * `data.items` + `data.total`.
 */
export function useInvoices() {
  return useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: () => api.get<{ data: Invoice[] }>('/billing/invoices'),
    staleTime: 60_000,
  });
}

export function useInvoice(id: string | null | undefined) {
  return useQuery({
    queryKey: ['billing', 'invoices', id],
    queryFn: () => api.get<{ data: Invoice }>(`/billing/invoices/${id}`),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

/**
 * Cancel the caller-org's active subscription. The backend is idempotent —
 * a second call against an already-CANCELLED sub returns the same row. On
 * success we invalidate the cached active-subscription read so the manage
 * page rerenders with the new status badge.
 */
export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api
        .post<{ data: MySubscription }>('/billing/subscriptions/me/cancel')
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing', 'subscriptions', 'me'] });
    },
  });
}

export function useRenewalAttempt(id: string | null | undefined) {
  return useQuery({
    queryKey: ['billing', 'renewal-attempts', id],
    queryFn: () =>
      api.get<{ data: RenewalAttempt }>(`/billing/renewal-attempts/${id}`),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/**
 * Re-mints (or re-uses) the Razorpay order for an existing renewal attempt.
 * The component opens the Razorpay modal against the returned orderId, then
 * routes the success callback through `useFinaliseCheckout` (the existing
 * /checkout/success endpoint dispatches to the renewal-capture path
 * automatically when the order has a matching RenewalAttempt row).
 */
export function useStartRenewalCheckout() {
  return useMutation({
    mutationFn: (renewalAttemptId: string) =>
      api
        .post<{ data: RenewalCheckoutInitResponse }>(
          `/billing/renewal-attempts/${renewalAttemptId}/checkout`,
        )
        .then((r) => r.data),
  });
}

/**
 * Wraps `useStartCheckout` with a clearer call-site name for the
 * "change plan" flow on /billing/manage. The body is identical to the
 * onboarding-wizard checkout — the caller picks one of the four plan
 * codes and the backend creates a fresh Subscription + Razorpay order.
 * The pre-existing subscription is left in place; the operator's
 * convention is "current period continues until endsAt; new plan takes
 * over after that".
 */
export function useChangePlan() {
  return useStartCheckout();
}
