/**
 * AAT-RZP / Wave 7: Razorpay-backed subscription service.
 *
 * Owns the three lifecycle hooks the routes call:
 *   - startCheckout(...)         → creates Subscription + RazorpayOrder + Razorpay order, returns checkout config
 *   - processPaymentSuccess(...) → called by the frontend's success callback
 *   - processWebhook(...)        → called by the public webhook route (authoritative)
 *
 * Idempotency is critical because Razorpay retries webhooks for up to 24h.
 * We de-dup on:
 *   - X-Razorpay-Event-Id        (RazorpayWebhookEvent.razorpayEventId @unique)
 *   - razorpayPaymentId          (RazorpayOrder.razorpayPaymentId)
 *
 * Coupon integration: we re-use the existing coupon.service surface (no
 * refactor). When a checkout supplies a coupon code:
 *   1. validateCoupon(...)  — drops out if invalid (404/409 surfaced as AppError)
 *   2. redeemCoupon(...)    — atomic; bumps currentRedemptions
 *   3. metadata.discount_tiers is consulted to compute the post-discount
 *      amount based on the redemption sequence number.
 *   4. On payment success we call markConverted(redemptionId, plan).
 *
 * 100% discount choice (HEF-PUNE-2026 first 100): we still create a
 * RazorpayOrder but with `amount=0` is ILLEGAL on Razorpay. We therefore
 * SHORT-CIRCUIT to ACTIVE: no Razorpay order is created, the Subscription
 * row is flipped ACTIVE immediately, and a $0 Invoice is issued. The
 * checkout response carries `{ skippedRazorpay: true }` so the frontend
 * can skip the modal and show a confirmation directly. This matches V3's
 * intent — a "free first year" voucher should never punt the user
 * through a payment modal.
 */
import {
  prisma,
  Prisma,
  type Subscription,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type Invoice,
  type RazorpayOrder,
  type RazorpayWebhookEvent,
} from '@aurex/database';
import { AppError } from '../../middleware/error-handler.js';
import { logger } from '../../lib/logger.js';
import * as couponService from '../coupon.service.js';
import * as emailService from '../email/email.service.js';
import { renderPaymentReceiptEmail } from '../email/templates/payment-receipt.js';
import {
  PLAN_PRICING,
  INR_GST_RATE_BPS,
  applyBasisPoints,
  computeBaseAmount,
} from './plans.js';
import {
  getRazorpayClient,
  type CreateOrderInput,
  type RazorpayClient,
} from './razorpay-client.js';

// Human-friendly labels for the payment-receipt email subject + body.
// Kept here (not in plans.ts) because they're a presentation concern.
const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  MSME_INDIA: 'Aurex MSME India (Scope 1+2)',
  ENTERPRISE_INDIA: 'Aurex Enterprise India (per-site)',
  SME_INTERNATIONAL: 'Aurex SME International (Scope 1+2)',
  ENTERPRISE_INTL: 'Aurex Enterprise International (per-site)',
};

// ─── Public types ──────────────────────────────────────────────────────

export interface StartCheckoutInput {
  organizationId: string;
  /** Caller user id — used as the coupon redeemer when couponCode is given. */
  userId: string;
  /** Caller email — used as the coupon-redemption identity. */
  userEmail: string;
  plan: SubscriptionPlan;
  perSiteCount?: number;
  couponCode?: string;
  ipAddress?: string;
  geoCountry?: string;
}

export interface StartCheckoutResult {
  subscriptionId: string;
  /**
   * Razorpay order id, e.g. `order_OXKoAh...`. NULL when the coupon zeroed
   * the price and we short-circuited to ACTIVE.
   */
  orderId: string | null;
  /** Public Razorpay key id, surfaced for the frontend Checkout modal. */
  keyId: string | null;
  /** Final amount charged, integer minor units. May be 0 on full-discount. */
  amount: number;
  currency: string;
  /** Pre-discount amount before tax (subtotal) in minor units. */
  subtotalMinor: number;
  /** Discount applied, in minor units. */
  discountMinor: number;
  /** Tax (GST/VAT) applied, in minor units. */
  taxMinor: number;
  /**
   * True iff the coupon zeroed the total and we activated the subscription
   * directly without involving Razorpay. The frontend should show a
   * confirmation rather than launching the Checkout modal.
   */
  skippedRazorpay: boolean;
  status: SubscriptionStatus;
  appliedCouponCode: string | null;
}

export interface ProcessPaymentSuccessInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface ProcessPaymentSuccessResult {
  subscription: Subscription;
  invoice: Invoice;
  alreadyActive: boolean;
}

export interface RazorpayWebhookPayload {
  /** Razorpay event id, used for idempotency (also delivered as X-Razorpay-Event-Id). */
  id: string;
  event: string;
  contains?: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string | null;
        status: string;
        error_code?: string | null;
        error_description?: string | null;
        [key: string]: unknown;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        [key: string]: unknown;
      };
    };
    [key: string]: unknown;
  };
  created_at?: number;
}

export interface ProcessWebhookInput {
  rawBody: string | Buffer;
  signature: string;
  /**
   * Pre-parsed payload. Routes parse the body once for the event-id
   * extraction and pass the parsed object here so we don't re-parse.
   */
  payload: RazorpayWebhookPayload;
}

export interface ProcessWebhookResult {
  /** Always non-null — the persisted webhook event row (idempotency log). */
  event: RazorpayWebhookEvent;
  signatureValid: boolean;
  /** True iff the event id was already processed (no-op). */
  duplicate: boolean;
  /** True iff the handler took action (state change). */
  processed: boolean;
  error?: string;
}

// ─── Internal helpers ──────────────────────────────────────────────────

/**
 * Tier descriptor stored on `SignupCoupon.metadata.discount_tiers`. We
 * keep this loose because the metadata is operator-supplied JSON.
 */
interface DiscountTier {
  from_redemption: number;
  to_redemption: number | null;
  discount_percentage: number;
}

interface ResolvedDiscount {
  discountMinor: number;
  tier: DiscountTier | null;
}

/**
 * Pick the discount tier matching the redemption sequence number `seq`
 * (1-indexed — the Nth redemption to be created).
 */
export function pickDiscountTier(
  metadata: Prisma.JsonValue,
  seq: number,
): DiscountTier | null {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    Array.isArray(metadata) ||
    !('discount_tiers' in metadata)
  ) {
    return null;
  }
  const tiers = (metadata as Record<string, unknown>).discount_tiers;
  if (!Array.isArray(tiers)) return null;

  for (const raw of tiers) {
    if (typeof raw !== 'object' || raw === null) continue;
    const t = raw as Record<string, unknown>;
    const from = typeof t.from_redemption === 'number' ? t.from_redemption : null;
    const to = t.to_redemption === null
      ? null
      : typeof t.to_redemption === 'number'
        ? t.to_redemption
        : undefined;
    const pct = typeof t.discount_percentage === 'number' ? t.discount_percentage : null;
    if (from === null || pct === null || to === undefined) continue;
    if (seq >= from && (to === null || seq <= to)) {
      return { from_redemption: from, to_redemption: to, discount_percentage: pct };
    }
  }
  return null;
}

function applyDiscount(subtotalMinor: number, tier: DiscountTier | null): ResolvedDiscount {
  if (!tier) return { discountMinor: 0, tier: null };
  const pct = Math.max(0, Math.min(100, tier.discount_percentage));
  const discountMinor = Math.round((subtotalMinor * pct) / 100);
  return { discountMinor, tier };
}

function computeTax(currency: string, taxableMinor: number): number {
  // INR plans add GST. International plans handle tax per the customer's
  // jurisdiction off-platform, so taxMinor is 0 here.
  if (currency === 'INR') {
    return applyBasisPoints(taxableMinor, INR_GST_RATE_BPS);
  }
  return 0;
}

function planRegion(plan: SubscriptionPlan): 'INDIA' | 'INTERNATIONAL' {
  return PLAN_PRICING[plan].region as 'INDIA' | 'INTERNATIONAL';
}

function makeReceiptId(organizationId: string): string {
  // Razorpay max receipt length is 40 chars.
  const orgFrag = organizationId.replace(/-/g, '').slice(0, 8);
  const ts = Date.now().toString(36);
  return `aurex_${orgFrag}_${ts}`.slice(0, 40);
}

/**
 * Generate an invoice number of the form `INV-{YYYY}-{6-digit-seq}`. We
 * use a count of existing invoices for the year as the sequence — that's
 * fine for MVP (single-writer per request, no concurrent issuance race
 * matters here because the column is `@unique` and we'd retry on P2002).
 */
async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
  now: Date,
): Promise<string> {
  const year = now.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const count = await tx.invoice.count({
    where: { createdAt: { gte: yearStart, lt: yearEnd } },
  });
  const seq = (count + 1).toString().padStart(6, '0');
  return `INV-${year}-${seq}`;
}

// ─── startCheckout ─────────────────────────────────────────────────────

export async function startCheckout(
  input: StartCheckoutInput,
  client: RazorpayClient = getRazorpayClient(),
): Promise<StartCheckoutResult> {
  const pricing = PLAN_PRICING[input.plan];
  if (!pricing) {
    throw new AppError(400, 'Bad Request', `Unknown plan: ${input.plan}`);
  }

  const seats = pricing.perSiteScaling ? Math.max(1, input.perSiteCount ?? 1) : 1;
  const baseAmount = computeBaseAmount(input.plan, seats);

  // ── Coupon validation + atomic redemption (BEFORE we create the
  //    Subscription row, so we never persist a half-baked redemption).
  let appliedCouponCode: string | null = null;
  let couponRedemptionId: string | null = null;
  let discountMinor = 0;
  let pickedTier: DiscountTier | null = null;

  if (input.couponCode) {
    const validation = await couponService.validateCoupon({
      code: input.couponCode,
      email: input.userEmail,
      ipAddress: input.ipAddress,
    });

    if (!validation.valid) {
      // Map well-known reasons to HTTP status codes.
      const status =
        validation.reason === 'COUPON_NOT_FOUND'
          ? 404
          : validation.reason === 'IP_BURST_LIMIT'
            ? 429
            : 409;
      throw new AppError(
        status,
        validation.reason ?? 'Invalid Coupon',
        validation.message ?? 'Coupon validation failed',
      );
    }

    // Redeem atomically — this throws AppError on cap/dedup conflicts.
    const redemption = await couponService.redeemCoupon({
      code: input.couponCode,
      email: input.userEmail,
      ipAddress: input.ipAddress,
      geoCountry: input.geoCountry,
      userId: input.userId,
    });
    appliedCouponCode = redemption.couponCode;
    couponRedemptionId = redemption.redemptionId;

    // Re-fetch the coupon to read metadata + post-redemption count. The
    // sequence number for THIS redemption is the value of
    // currentRedemptions AFTER the increment (i.e. the redemption is the
    // Nth one, where N = currentRedemptions).
    const couponRow = await prisma.signupCoupon.findUnique({
      where: { id: redemption.couponId },
    });
    if (couponRow) {
      pickedTier = pickDiscountTier(couponRow.metadata, couponRow.currentRedemptions);
      const resolved = applyDiscount(baseAmount, pickedTier);
      discountMinor = resolved.discountMinor;
    }
  }

  const taxableMinor = Math.max(0, baseAmount - discountMinor);
  const taxMinor = computeTax(pricing.currency, taxableMinor);
  const totalAmountMinor = taxableMinor + taxMinor;

  // ── 100% discount → short-circuit (Razorpay rejects amount=0 orders).
  if (totalAmountMinor === 0) {
    const result = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          organizationId: input.organizationId,
          plan: input.plan,
          region: planRegion(input.plan),
          status: 'ACTIVE',
          currency: pricing.currency,
          amountMinor: pricing.amountMinor,
          perSiteCount: seats,
          totalAmountMinor: 0,
          startsAt: new Date(),
          endsAt: addOneYear(new Date()),
          appliedCouponCode,
          couponRedemptionId,
          metadata: {
            shortCircuited: true,
            reason: 'coupon_zeroed_amount',
            tier: pickedTier ? { ...pickedTier } : null,
          } as Prisma.InputJsonValue,
        },
      });
      await issueInvoiceTx(tx, sub.id, {
        currency: pricing.currency,
        subtotalMinor: baseAmount,
        discountMinor,
        taxMinor,
        totalMinor: 0,
        markPaid: true,
      });
      // Coupon redemption flows directly to CONVERTED — there's no
      // pending Razorpay step to wait for.
      if (couponRedemptionId) {
        try {
          await couponService.markConverted(couponRedemptionId, input.plan);
        } catch (err) {
          logger.warn(
            { err, couponRedemptionId },
            'markConverted failed during short-circuit checkout (idempotent — ignoring)',
          );
        }
      }
      return sub;
    });

    logger.info(
      {
        subscriptionId: result.id,
        organizationId: input.organizationId,
        plan: input.plan,
        appliedCouponCode,
      },
      'Subscription activated via coupon-only short-circuit (no Razorpay)',
    );

    return {
      subscriptionId: result.id,
      orderId: null,
      keyId: null,
      amount: 0,
      currency: pricing.currency,
      subtotalMinor: baseAmount,
      discountMinor,
      taxMinor,
      skippedRazorpay: true,
      status: 'ACTIVE',
      appliedCouponCode,
    };
  }

  // ── Standard path: create Subscription(PENDING) + RazorpayOrder(CREATED)
  //    in a Prisma txn, then call Razorpay. If the Razorpay call fails we
  //    surface 502 — the row is left PENDING for retry / manual cleanup.

  const { subscription, razorpayOrderRow } = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        organizationId: input.organizationId,
        plan: input.plan,
        region: planRegion(input.plan),
        status: 'PENDING',
        currency: pricing.currency,
        amountMinor: pricing.amountMinor,
        perSiteCount: seats,
        totalAmountMinor,
        appliedCouponCode,
        couponRedemptionId,
        metadata: pickedTier
          ? ({
              tier: { ...pickedTier },
              subtotalMinor: baseAmount,
              discountMinor,
              taxMinor,
            } as Prisma.InputJsonValue)
          : ({
              subtotalMinor: baseAmount,
              discountMinor,
              taxMinor,
            } as Prisma.InputJsonValue),
      },
    });

    // Placeholder razorpay order row — we patch it with the real id below.
    // We use a deterministic placeholder so the @unique constraint doesn't
    // misfire if multiple PENDING subs are created in the same millisecond.
    const placeholder = `pending_${sub.id}`;
    const order = await tx.razorpayOrder.create({
      data: {
        razorpayOrderId: placeholder,
        subscriptionId: sub.id,
        amountMinor: totalAmountMinor,
        currency: pricing.currency,
        status: 'CREATED',
      },
    });

    return { subscription: sub, razorpayOrderRow: order };
  });

  let razorpayOrder;
  try {
    const orderInput: CreateOrderInput = {
      amount: totalAmountMinor,
      currency: pricing.currency,
      receipt: makeReceiptId(input.organizationId),
      notes: {
        subscription_id: subscription.id,
        organization_id: input.organizationId,
        plan: input.plan,
      },
    };
    razorpayOrder = await client.createOrder(orderInput);
  } catch (err) {
    logger.error(
      { err, subscriptionId: subscription.id },
      'Razorpay createOrder failed — leaving Subscription PENDING for cleanup',
    );
    throw new AppError(
      502,
      'Bad Gateway',
      'Failed to create Razorpay order; please retry',
      'https://aurex.in/errors/razorpay',
    );
  }

  await prisma.razorpayOrder.update({
    where: { id: razorpayOrderRow.id },
    data: { razorpayOrderId: razorpayOrder.id },
  });

  return {
    subscriptionId: subscription.id,
    orderId: razorpayOrder.id,
    keyId: client.publicKeyId,
    amount: totalAmountMinor,
    currency: pricing.currency,
    subtotalMinor: baseAmount,
    discountMinor,
    taxMinor,
    skippedRazorpay: false,
    status: 'PENDING',
    appliedCouponCode,
  };
}

// ─── processPaymentSuccess ─────────────────────────────────────────────

export async function processPaymentSuccess(
  input: ProcessPaymentSuccessInput,
  client: RazorpayClient = getRazorpayClient(),
): Promise<ProcessPaymentSuccessResult> {
  const sigOk = client.verifyPaymentSignature({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
  });
  if (!sigOk) {
    throw new AppError(
      400,
      'Bad Request',
      'Invalid Razorpay payment signature',
      'https://aurex.in/errors/razorpay-signature',
    );
  }

  const orderRow = await prisma.razorpayOrder.findUnique({
    where: { razorpayOrderId: input.razorpayOrderId },
  });
  if (!orderRow) {
    throw new AppError(404, 'Not Found', `Razorpay order ${input.razorpayOrderId} not found`);
  }

  // Idempotency: if we've already processed this exact payment id, return
  // the existing state without double-issuing invoices.
  if (orderRow.status === 'CAPTURED' && orderRow.razorpayPaymentId === input.razorpayPaymentId) {
    const sub = await prisma.subscription.findUnique({ where: { id: orderRow.subscriptionId } });
    const invoice = await prisma.invoice.findFirst({
      where: { subscriptionId: orderRow.subscriptionId },
      orderBy: { createdAt: 'desc' },
    });
    if (sub && invoice) {
      return { subscription: sub, invoice, alreadyActive: true };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.razorpayOrder.update({
      where: { id: orderRow.id },
      data: {
        status: 'CAPTURED',
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        capturedAt: new Date(),
      },
    });

    const sub = await tx.subscription.update({
      where: { id: orderRow.subscriptionId },
      data: {
        status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: addOneYear(new Date()),
      },
    });

    const subtotal = (sub.metadata as { subtotalMinor?: number } | null)?.subtotalMinor ?? sub.totalAmountMinor;
    const discount = (sub.metadata as { discountMinor?: number } | null)?.discountMinor ?? 0;
    const tax = (sub.metadata as { taxMinor?: number } | null)?.taxMinor ?? 0;

    const invoice = await issueInvoiceTx(tx, sub.id, {
      currency: sub.currency,
      subtotalMinor: subtotal,
      discountMinor: discount,
      taxMinor: tax,
      totalMinor: sub.totalAmountMinor,
      markPaid: true,
    });

    if (sub.couponRedemptionId) {
      try {
        await couponService.markConverted(sub.couponRedemptionId, sub.plan);
      } catch (err) {
        // markConverted throws 409 on already-converted; this is safe
        // to swallow during idempotent re-runs of processPaymentSuccess.
        logger.warn(
          { err, redemptionId: sub.couponRedemptionId },
          'markConverted skipped (already converted or missing)',
        );
      }
    }

    return { subscription: sub, invoice };
  });

  logger.info(
    {
      subscriptionId: result.subscription.id,
      paymentId: input.razorpayPaymentId,
      invoiceNumber: result.invoice.invoiceNumber,
    },
    'Razorpay payment captured + subscription ACTIVE',
  );

  // AAT-EMAIL: best-effort payment-receipt email. Fired AFTER the
  // transaction commits so a failed send cannot revert the payment.
  await sendPaymentReceiptBestEffort({
    subscriptionId: result.subscription.id,
    invoiceNumber: result.invoice.invoiceNumber,
    totalMinor: result.invoice.totalMinor,
    currency: result.invoice.currency,
    plan: result.subscription.plan,
    periodStart: result.subscription.startsAt,
    periodEnd: result.subscription.endsAt,
    organizationId: result.subscription.organizationId,
  });

  return { ...result, alreadyActive: false };
}

// ─── processWebhook ────────────────────────────────────────────────────

export async function processWebhook(
  input: ProcessWebhookInput,
  client: RazorpayClient = getRazorpayClient(),
): Promise<ProcessWebhookResult> {
  const signatureValid = client.verifyWebhookSignature(input.rawBody, input.signature);

  // Idempotency on event id. Two cases:
  //   - Same event id, signature was valid before → already processed; no-op.
  //   - Same event id, signature was invalid before → still no-op (we don't
  //     re-process forged/retried events).
  const eventId = input.payload.id;
  if (!eventId || typeof eventId !== 'string') {
    // Persist a synthetic record so we don't lose the audit trail.
    const evt = await prisma.razorpayWebhookEvent.create({
      data: {
        razorpayEventId: `malformed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        eventType: typeof input.payload.event === 'string' ? input.payload.event : 'unknown',
        payload: input.payload as unknown as Prisma.InputJsonValue,
        signatureValid,
        processed: false,
        processingError: 'missing event id',
      },
    });
    return { event: evt, signatureValid, duplicate: false, processed: false, error: 'missing event id' };
  }

  const existing = await prisma.razorpayWebhookEvent.findUnique({
    where: { razorpayEventId: eventId },
  });
  if (existing) {
    return { event: existing, signatureValid, duplicate: true, processed: existing.processed };
  }

  // Persist BEFORE processing so we always have an audit trail.
  let event = await prisma.razorpayWebhookEvent.create({
    data: {
      razorpayEventId: eventId,
      eventType: input.payload.event,
      payload: input.payload as unknown as Prisma.InputJsonValue,
      signatureValid,
      processed: false,
    },
  });

  if (!signatureValid) {
    logger.warn(
      { eventId, eventType: input.payload.event },
      'Razorpay webhook signature INVALID — persisted without processing',
    );
    return { event, signatureValid: false, duplicate: false, processed: false };
  }

  try {
    await dispatchWebhookEvent(input.payload);
    event = await prisma.razorpayWebhookEvent.update({
      where: { id: event.id },
      data: { processed: true, processedAt: new Date() },
    });
    return { event, signatureValid: true, duplicate: false, processed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, eventId }, 'Razorpay webhook processing failed');
    event = await prisma.razorpayWebhookEvent.update({
      where: { id: event.id },
      data: { processingError: message },
    });
    return { event, signatureValid: true, duplicate: false, processed: false, error: message };
  }
}

async function dispatchWebhookEvent(payload: RazorpayWebhookPayload): Promise<void> {
  switch (payload.event) {
    case 'payment.captured':
      await handlePaymentCaptured(payload);
      return;
    case 'payment.failed':
      await handlePaymentFailed(payload);
      return;
    case 'refund.processed':
      await handleRefundProcessed(payload);
      return;
    default:
      logger.info({ event: payload.event }, 'Razorpay webhook event ignored (unhandled type)');
  }
}

async function handlePaymentCaptured(payload: RazorpayWebhookPayload): Promise<void> {
  const entity = payload.payload.payment?.entity;
  if (!entity || !entity.order_id) {
    throw new Error('payment.captured missing entity.order_id');
  }

  const orderRow = await prisma.razorpayOrder.findUnique({
    where: { razorpayOrderId: entity.order_id },
  });
  if (!orderRow) {
    // Order may not exist if the merchant account receives a payment for
    // an order created elsewhere. Log and ignore — this is not an error.
    logger.warn({ orderId: entity.order_id }, 'payment.captured for unknown order — skipped');
    return;
  }

  // Idempotent re-entry — same payment id already captured. Razorpay
  // retries webhooks for up to 24h, so this guard is essential to keep
  // us from sending a duplicate receipt email.
  if (orderRow.status === 'CAPTURED' && orderRow.razorpayPaymentId === entity.id) {
    return;
  }

  // We capture the freshly-issued invoice + subscription out of the
  // transaction so we can fire the receipt email AFTER commit. TS infers
  // `never` if we narrow inside the callback, so we hold them in a
  // mutable wrapper object that survives the closure.
  const captured: { invoice: Invoice | null; sub: Subscription | null } = {
    invoice: null,
    sub: null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.razorpayOrder.update({
      where: { id: orderRow.id },
      data: {
        status: 'CAPTURED',
        razorpayPaymentId: entity.id,
        capturedAt: new Date(),
        webhookPayload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    const sub = await tx.subscription.findUnique({ where: { id: orderRow.subscriptionId } });
    if (!sub) return;
    if (sub.status === 'ACTIVE') return;

    const updatedSub = await tx.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        startsAt: sub.startsAt ?? new Date(),
        endsAt: sub.endsAt ?? addOneYear(new Date()),
      },
    });
    captured.sub = updatedSub;

    // Issue invoice if none exists yet. We only fire the receipt email
    // when this branch executes — re-entrant calls find an existing
    // invoice and skip issuance + email.
    const existingInvoice = await tx.invoice.findFirst({
      where: { subscriptionId: sub.id, status: { in: ['PAID', 'ISSUED'] } },
    });
    if (!existingInvoice) {
      const subtotal = (sub.metadata as { subtotalMinor?: number } | null)?.subtotalMinor ?? sub.totalAmountMinor;
      const discount = (sub.metadata as { discountMinor?: number } | null)?.discountMinor ?? 0;
      const tax = (sub.metadata as { taxMinor?: number } | null)?.taxMinor ?? 0;
      captured.invoice = await issueInvoiceTx(tx, sub.id, {
        currency: sub.currency,
        subtotalMinor: subtotal,
        discountMinor: discount,
        taxMinor: tax,
        totalMinor: sub.totalAmountMinor,
        markPaid: true,
      });
    }

    if (sub.couponRedemptionId) {
      try {
        await couponService.markConverted(sub.couponRedemptionId, sub.plan);
      } catch (err) {
        logger.warn(
          { err, redemptionId: sub.couponRedemptionId },
          'markConverted skipped from webhook (already converted)',
        );
      }
    }
  });

  // Fire receipt email only when a NEW invoice was issued by this
  // webhook delivery — keeps it idempotent across Razorpay's retries.
  if (captured.invoice && captured.sub) {
    await sendPaymentReceiptBestEffort({
      subscriptionId: captured.sub.id,
      invoiceNumber: captured.invoice.invoiceNumber,
      totalMinor: captured.invoice.totalMinor,
      currency: captured.invoice.currency,
      plan: captured.sub.plan,
      periodStart: captured.sub.startsAt,
      periodEnd: captured.sub.endsAt,
      organizationId: captured.sub.organizationId,
    });
  }
}

async function handlePaymentFailed(payload: RazorpayWebhookPayload): Promise<void> {
  const entity = payload.payload.payment?.entity;
  if (!entity || !entity.order_id) {
    throw new Error('payment.failed missing entity.order_id');
  }

  const orderRow = await prisma.razorpayOrder.findUnique({
    where: { razorpayOrderId: entity.order_id },
  });
  if (!orderRow) return;

  await prisma.$transaction(async (tx) => {
    await tx.razorpayOrder.update({
      where: { id: orderRow.id },
      data: {
        status: 'FAILED',
        razorpayPaymentId: entity.id,
        attemptedAt: new Date(),
        webhookPayload: payload as unknown as Prisma.InputJsonValue,
        failureReason:
          entity.error_description ?? entity.error_code ?? `payment_failed_${entity.status}`,
      },
    });

    const sub = await tx.subscription.findUnique({ where: { id: orderRow.subscriptionId } });
    if (sub && sub.status === 'PENDING') {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'PAYMENT_FAILED' },
      });
    }
  });
}

async function handleRefundProcessed(payload: RazorpayWebhookPayload): Promise<void> {
  const entity = payload.payload.refund?.entity;
  if (!entity?.payment_id) {
    throw new Error('refund.processed missing entity.payment_id');
  }
  const orderRow = await prisma.razorpayOrder.findFirst({
    where: { razorpayPaymentId: entity.payment_id },
  });
  if (!orderRow) return;
  await prisma.$transaction(async (tx) => {
    await tx.razorpayOrder.update({
      where: { id: orderRow.id },
      data: {
        status: 'REFUNDED',
        webhookPayload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    const sub = await tx.subscription.findUnique({ where: { id: orderRow.subscriptionId } });
    if (sub) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }
    // Mark any PAID invoices as REFUNDED for audit clarity.
    await tx.invoice.updateMany({
      where: { subscriptionId: orderRow.subscriptionId, status: 'PAID' },
      data: { status: 'REFUNDED' },
    });
  });
}

// ─── Reads ─────────────────────────────────────────────────────────────

export async function getActiveSubscriptionForOrg(
  organizationId: string,
): Promise<Subscription | null> {
  return prisma.subscription.findFirst({
    where: {
      organizationId,
      status: { in: ['ACTIVE', 'TRIAL'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listInvoicesForOrg(organizationId: string): Promise<Invoice[]> {
  return prisma.invoice.findMany({
    where: { subscription: { organizationId } },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Invoice issuance helper ───────────────────────────────────────────

interface IssueInvoiceArgs {
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  markPaid: boolean;
}

async function issueInvoiceTx(
  tx: Prisma.TransactionClient,
  subscriptionId: string,
  args: IssueInvoiceArgs,
): Promise<Invoice> {
  const now = new Date();
  const invoiceNumber = await generateInvoiceNumber(tx, now);
  return tx.invoice.create({
    data: {
      subscriptionId,
      invoiceNumber,
      currency: args.currency,
      subtotalMinor: args.subtotalMinor,
      discountMinor: args.discountMinor,
      taxMinor: args.taxMinor,
      totalMinor: args.totalMinor,
      status: args.markPaid ? 'PAID' : 'ISSUED',
      issuedAt: now,
      paidAt: args.markPaid ? now : null,
    },
  });
}

function addOneYear(d: Date): Date {
  const out = new Date(d);
  out.setUTCFullYear(out.getUTCFullYear() + 1);
  return out;
}

// ─── Receipt email ─────────────────────────────────────────────────────

/**
 * Best-effort payment-receipt email. Fires after the Invoice row is
 * issued PAID. NEVER throws — a failed send must NOT roll back the
 * payment / subscription state. Caller logs the warning.
 *
 * Recipient resolution: pick the first ACTIVE OrgMember of the
 * subscription's organization in role precedence (OWNER → ADMIN →
 * anyone). If no eligible member exists we skip silently.
 */
export async function sendPaymentReceiptBestEffort(args: {
  subscriptionId: string;
  invoiceNumber: string;
  totalMinor: number;
  currency: string;
  plan: SubscriptionPlan;
  periodStart: Date | null;
  periodEnd: Date | null;
  organizationId: string;
}): Promise<void> {
  try {
    // We need an addressee. Pull all active members and pick the
    // highest-rank one. Roles ordered: OWNER, ADMIN, EDITOR, VIEWER.
    const members = await prisma.orgMember.findMany({
      where: { orgId: args.organizationId, isActive: true },
      include: { user: { select: { name: true, email: true } } },
    });
    if (members.length === 0) {
      logger.info(
        { subscriptionId: args.subscriptionId, organizationId: args.organizationId },
        'Payment-receipt skipped: no active org members',
      );
      return;
    }

    const ROLE_RANK: Record<string, number> = {
      OWNER: 0,
      ADMIN: 1,
      EDITOR: 2,
      AUDITOR: 3,
      VIEWER: 4,
    };
    const sorted = [...members].sort((a, b) => {
      const ra = ROLE_RANK[a.role] ?? 99;
      const rb = ROLE_RANK[b.role] ?? 99;
      return ra - rb;
    });
    const recipient = sorted[0];
    if (!recipient || !recipient.user.email) return;

    const start = args.periodStart ?? new Date();
    const end = args.periodEnd ?? addOneYear(start);

    const rendered = renderPaymentReceiptEmail({
      recipientName: recipient.user.name ?? recipient.user.email,
      planLabel: PLAN_LABELS[args.plan] ?? args.plan,
      currencyMinorAmount: args.totalMinor,
      currency: args.currency,
      invoiceNumber: args.invoiceNumber,
      periodStart: start,
      periodEnd: end,
    });

    const result = await emailService.sendEmail({
      to: recipient.user.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'payment-receipt',
    });
    if (!result.ok) {
      logger.warn(
        { subscriptionId: args.subscriptionId, error: result.error },
        'Payment-receipt email failed to send (best-effort)',
      );
    }
  } catch (err) {
    logger.warn(
      { err, subscriptionId: args.subscriptionId },
      'Payment-receipt email errored (swallowed — best-effort)',
    );
  }
}

// Forward-declare types we re-export so route handlers don't need to
// reach into @prisma/client directly.
export type { RazorpayOrder };
