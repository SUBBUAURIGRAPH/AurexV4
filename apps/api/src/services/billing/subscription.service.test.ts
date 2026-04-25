/**
 * AAT-RZP / Wave 7: subscription.service tests.
 *
 * Mocks @aurex/database with vi.hoisted (same pattern as coupon.service
 * tests) plus a fake RazorpayClient. We mirror only the prisma model
 * surface used by the service.
 *
 * The fake $transaction passes a tx-shaped client back to the callback,
 * wired to the same mocks, so service-level transaction semantics are
 * preserved without spinning up a real Postgres.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    subscription: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    razorpayOrder: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    invoice: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    razorpayWebhookEvent: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    signupCoupon: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    couponRedemption: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation(
    async (cb: (tx: typeof mock) => unknown) => cb(mock),
  );
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

import {
  startCheckout,
  processPaymentSuccess,
  processWebhook,
  pickDiscountTier,
} from './subscription.service.js';
import { _resetValidateBurstForTests } from '../coupon.service.js';
import type { RazorpayClient } from './razorpay-client.js';

// ─── Fake Razorpay client ──────────────────────────────────────────────

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

interface FakeClientOpts {
  createOrderImpl?: RazorpayClient['createOrder'];
  /** When set, paymentSig verification short-circuits to this value. */
  paymentSigValid?: boolean;
}

function makeFakeClient(opts: FakeClientOpts = {}): RazorpayClient {
  return {
    publicKeyId: 'rzp_test_public',
    createOrder:
      opts.createOrderImpl ??
      vi.fn(async (input) => ({
        id: `order_fake_${Math.random().toString(36).slice(2, 10)}`,
        entity: 'order' as const,
        amount: input.amount,
        amount_paid: 0,
        amount_due: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        status: 'created' as const,
        notes: input.notes ?? {},
        created_at: 1234567890,
      })),
    verifyWebhookSignature(rawBody, signature) {
      const expected = createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      return expected === signature;
    },
    verifyPaymentSignature(input) {
      if (opts.paymentSigValid !== undefined) return opts.paymentSigValid;
      const expected = createHmac('sha256', KEY_SECRET)
        .update(`${input.orderId}|${input.paymentId}`)
        .digest('hex');
      return expected === input.razorpaySignature;
    },
  };
}

// ─── Fixtures ──────────────────────────────────────────────────────────

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const USER_EMAIL = 'admin@example.com';

const HEF_DISCOUNT_TIERS = [
  {
    from_redemption: 1,
    to_redemption: 100,
    discount_percentage: 100,
    label: 'First 100 — free for first year',
  },
  {
    from_redemption: 101,
    to_redemption: null,
    discount_percentage: 50,
    label: '50% off — early bird',
  },
];

function makeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coupon-hef',
    couponCode: 'HEF-PUNE-2026',
    chapterName: 'Pune Chapter',
    organizationName: 'Hindu Economic Forum',
    trialDurationDays: 365,
    trialTier: 'PROFESSIONAL',
    maxRedemptions: 200,
    currentRedemptions: 0,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: new Date('2027-12-31T00:00:00Z'),
    isActive: true,
    metadata: { discount_tiers: HEF_DISCOUNT_TIERS },
    ...overrides,
  };
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    organizationId: ORG_ID,
    plan: 'MSME_INDIA',
    region: 'INDIA',
    status: 'PENDING',
    currency: 'INR',
    amountMinor: 499900,
    perSiteCount: 1,
    totalAmountMinor: 589882, // ₹4999 + 18% GST
    startsAt: null,
    endsAt: null,
    appliedCouponCode: null,
    couponRedemptionId: null,
    metadata: { subtotalMinor: 499900, discountMinor: 0, taxMinor: 89982 },
    ...overrides,
  };
}

function makeRazorpayOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rzpord-row-1',
    razorpayOrderId: 'order_fake_xyz',
    subscriptionId: 'sub-1',
    amountMinor: 589882,
    currency: 'INR',
    status: 'CREATED',
    razorpayPaymentId: null,
    razorpaySignature: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetValidateBurstForTests();
  mockPrisma.$transaction.mockImplementation(
    async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
  );
  // Sensible defaults: invoice count = 0, no existing webhook events.
  mockPrisma.invoice.count.mockResolvedValue(0);
  mockPrisma.invoice.create.mockImplementation(async (args) => ({
    id: 'inv-1',
    invoiceNumber: 'INV-2026-000001',
    ...args.data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  mockPrisma.invoice.findFirst.mockResolvedValue(null);
  mockPrisma.razorpayWebhookEvent.findUnique.mockResolvedValue(null);
});

// ─── pickDiscountTier ──────────────────────────────────────────────────

describe('pickDiscountTier', () => {
  it('picks the first-tier free band for redemptions 1..100', () => {
    expect(pickDiscountTier({ discount_tiers: HEF_DISCOUNT_TIERS }, 1)?.discount_percentage).toBe(100);
    expect(pickDiscountTier({ discount_tiers: HEF_DISCOUNT_TIERS }, 100)?.discount_percentage).toBe(100);
  });

  it('picks the 50%-off band for redemptions 101+', () => {
    expect(pickDiscountTier({ discount_tiers: HEF_DISCOUNT_TIERS }, 101)?.discount_percentage).toBe(50);
    expect(pickDiscountTier({ discount_tiers: HEF_DISCOUNT_TIERS }, 5000)?.discount_percentage).toBe(50);
  });

  it('returns null for metadata without discount_tiers', () => {
    expect(pickDiscountTier({ branding: 'aurex' }, 1)).toBeNull();
    expect(pickDiscountTier(null, 1)).toBeNull();
    expect(pickDiscountTier([], 1)).toBeNull();
  });
});

// ─── startCheckout ─────────────────────────────────────────────────────

describe('startCheckout', () => {
  it('happy path: MSME_INDIA → creates Subscription PENDING + RazorpayOrder + calls Razorpay', async () => {
    mockPrisma.subscription.create.mockResolvedValue(makeSubscription());
    mockPrisma.razorpayOrder.create.mockResolvedValue(makeRazorpayOrder());
    mockPrisma.razorpayOrder.update.mockResolvedValue(makeRazorpayOrder());

    const client = makeFakeClient();
    const result = await startCheckout(
      {
        organizationId: ORG_ID,
        userId: USER_ID,
        userEmail: USER_EMAIL,
        plan: 'MSME_INDIA',
      },
      client,
    );

    // Prisma side-effects.
    expect(mockPrisma.subscription.create).toHaveBeenCalledTimes(1);
    const subData = mockPrisma.subscription.create.mock.calls[0]![0].data;
    expect(subData.status).toBe('PENDING');
    expect(subData.currency).toBe('INR');
    expect(subData.amountMinor).toBe(499900);
    expect(subData.totalAmountMinor).toBe(499900 + 89982); // ₹4999 + 18% GST = ₹5898.82

    // Razorpay side-effect.
    expect(client.createOrder).toHaveBeenCalledTimes(1);
    const orderInput = (client.createOrder as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(orderInput.amount).toBe(499900 + 89982);
    expect(orderInput.currency).toBe('INR');

    // Result.
    expect(result.skippedRazorpay).toBe(false);
    expect(result.status).toBe('PENDING');
    expect(result.orderId).toMatch(/^order_fake_/);
    expect(result.keyId).toBe('rzp_test_public');
    expect(result.subtotalMinor).toBe(499900);
    expect(result.taxMinor).toBe(89982);
    expect(result.discountMinor).toBe(0);
  });

  it('SME_INTERNATIONAL: USD plan, no GST', async () => {
    mockPrisma.subscription.create.mockResolvedValue(
      makeSubscription({ plan: 'SME_INTERNATIONAL', region: 'INTERNATIONAL', currency: 'USD', amountMinor: 99900, totalAmountMinor: 99900 }),
    );
    mockPrisma.razorpayOrder.create.mockResolvedValue(
      makeRazorpayOrder({ amountMinor: 99900, currency: 'USD' }),
    );
    mockPrisma.razorpayOrder.update.mockResolvedValue({});

    const client = makeFakeClient();
    const result = await startCheckout(
      {
        organizationId: ORG_ID,
        userId: USER_ID,
        userEmail: USER_EMAIL,
        plan: 'SME_INTERNATIONAL',
      },
      client,
    );

    expect(result.amount).toBe(99900);
    expect(result.taxMinor).toBe(0);
    expect(result.currency).toBe('USD');
  });

  it('per-site enterprise: ENTERPRISE_INDIA × 3 sites → totals scale', async () => {
    mockPrisma.subscription.create.mockResolvedValue(
      makeSubscription({ plan: 'ENTERPRISE_INDIA', perSiteCount: 3 }),
    );
    mockPrisma.razorpayOrder.create.mockResolvedValue(makeRazorpayOrder());
    mockPrisma.razorpayOrder.update.mockResolvedValue({});

    const client = makeFakeClient();
    const result = await startCheckout(
      {
        organizationId: ORG_ID,
        userId: USER_ID,
        userEmail: USER_EMAIL,
        plan: 'ENTERPRISE_INDIA',
        perSiteCount: 3,
      },
      client,
    );

    // ₹9999 × 3 = ₹29997 = 2999700 paise. + 18% GST = 539946. Total 3539646.
    expect(result.subtotalMinor).toBe(2999700);
    expect(result.taxMinor).toBe(539946);
    expect(result.amount).toBe(2999700 + 539946);
  });

  it('coupon HEF-PUNE-2026, 1st redemption → 100% discount → SHORT-CIRCUITS to ACTIVE, no Razorpay', async () => {
    // Validate: returns valid + coupon. Redeem: success. Coupon refetch:
    // currentRedemptions=1 (post-increment).
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());
    mockPrisma.couponRedemption.findUnique.mockResolvedValue(null);
    mockPrisma.signupCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.couponRedemption.create.mockResolvedValue({ id: 'red-1' });
    mockPrisma.signupCoupon.findUnique.mockResolvedValue(
      makeCoupon({ currentRedemptions: 1 }),
    );
    mockPrisma.subscription.create.mockResolvedValue(
      makeSubscription({ status: 'ACTIVE', totalAmountMinor: 0, appliedCouponCode: 'HEF-PUNE-2026', couponRedemptionId: 'red-1' }),
    );
    mockPrisma.couponRedemption.findUnique.mockResolvedValueOnce(null); // for redeem dedup
    mockPrisma.couponRedemption.update.mockResolvedValue({ id: 'red-1', converted: true });

    const client = makeFakeClient();
    const result = await startCheckout(
      {
        organizationId: ORG_ID,
        userId: USER_ID,
        userEmail: USER_EMAIL,
        plan: 'MSME_INDIA',
        couponCode: 'HEF-PUNE-2026',
      },
      client,
    );

    expect(result.skippedRazorpay).toBe(true);
    expect(result.amount).toBe(0);
    expect(result.status).toBe('ACTIVE');
    expect(result.appliedCouponCode).toBe('HEF-PUNE-2026');
    expect(result.discountMinor).toBe(499900); // full subtotal discounted
    expect(client.createOrder).not.toHaveBeenCalled();
    expect(mockPrisma.razorpayOrder.create).not.toHaveBeenCalled();
    // Invoice was issued (status=PAID).
    expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(1);
  });

  it('coupon HEF-PUNE-2026, 101st redemption → 50% discount + GST applied → still goes to Razorpay', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon({ currentRedemptions: 100 }));
    mockPrisma.couponRedemption.findUnique.mockResolvedValueOnce(null); // redeem dedup
    mockPrisma.signupCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.couponRedemption.create.mockResolvedValue({ id: 'red-101' });
    mockPrisma.signupCoupon.findUnique.mockResolvedValue(
      makeCoupon({ currentRedemptions: 101 }),
    );
    mockPrisma.subscription.create.mockResolvedValue(makeSubscription());
    mockPrisma.razorpayOrder.create.mockResolvedValue(makeRazorpayOrder());
    mockPrisma.razorpayOrder.update.mockResolvedValue({});

    const client = makeFakeClient();
    const result = await startCheckout(
      {
        organizationId: ORG_ID,
        userId: USER_ID,
        userEmail: USER_EMAIL,
        plan: 'MSME_INDIA',
        couponCode: 'HEF-PUNE-2026',
      },
      client,
    );

    // Subtotal 499900, 50% discount = 249950, taxable 249950, GST 18% = 44991. Total 294941.
    expect(result.subtotalMinor).toBe(499900);
    expect(result.discountMinor).toBe(249950);
    expect(result.taxMinor).toBe(44991);
    expect(result.amount).toBe(294941);
    expect(result.skippedRazorpay).toBe(false);
    expect(client.createOrder).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid coupon BEFORE creating any rows', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(null); // not found

    const client = makeFakeClient();
    await expect(
      startCheckout(
        {
          organizationId: ORG_ID,
          userId: USER_ID,
          userEmail: USER_EMAIL,
          plan: 'MSME_INDIA',
          couponCode: 'BOGUS-CODE',
        },
        client,
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(client.createOrder).not.toHaveBeenCalled();
  });

  it('surfaces 502 if Razorpay createOrder throws (Subscription left PENDING)', async () => {
    mockPrisma.subscription.create.mockResolvedValue(makeSubscription());
    mockPrisma.razorpayOrder.create.mockResolvedValue(makeRazorpayOrder());

    const failingClient = makeFakeClient({
      createOrderImpl: vi.fn(async () => {
        throw new Error('upstream timeout');
      }),
    });

    await expect(
      startCheckout(
        {
          organizationId: ORG_ID,
          userId: USER_ID,
          userEmail: USER_EMAIL,
          plan: 'MSME_INDIA',
        },
        failingClient,
      ),
    ).rejects.toMatchObject({ status: 502 });

    expect(mockPrisma.subscription.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.razorpayOrder.update).not.toHaveBeenCalled();
  });

  it('rejects unknown plan keys (defence-in-depth past zod)', async () => {
    const client = makeFakeClient();
    await expect(
      startCheckout(
        {
          organizationId: ORG_ID,
          userId: USER_ID,
          userEmail: USER_EMAIL,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          plan: 'BOGUS_PLAN' as any,
        },
        client,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ─── processPaymentSuccess ─────────────────────────────────────────────

describe('processPaymentSuccess', () => {
  it('valid signature → CAPTURED + ACTIVE + invoice issued + coupon converted', async () => {
    const ORDER_ID = 'order_real_123';
    const PAYMENT_ID = 'pay_real_456';
    const sig = createHmac('sha256', KEY_SECRET).update(`${ORDER_ID}|${PAYMENT_ID}`).digest('hex');

    mockPrisma.razorpayOrder.findUnique.mockResolvedValue(
      makeRazorpayOrder({ razorpayOrderId: ORDER_ID }),
    );
    mockPrisma.razorpayOrder.update.mockResolvedValue({});
    mockPrisma.subscription.update.mockResolvedValue(
      makeSubscription({ status: 'ACTIVE', couponRedemptionId: 'red-1', plan: 'MSME_INDIA' }),
    );
    mockPrisma.couponRedemption.findUnique.mockResolvedValue({
      id: 'red-1',
      converted: false,
    });
    mockPrisma.couponRedemption.update.mockResolvedValue({ id: 'red-1', converted: true });

    const client = makeFakeClient();
    const result = await processPaymentSuccess(
      { razorpayOrderId: ORDER_ID, razorpayPaymentId: PAYMENT_ID, razorpaySignature: sig },
      client,
    );

    expect(result.alreadyActive).toBe(false);
    expect(result.subscription.status).toBe('ACTIVE');
    expect(mockPrisma.razorpayOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CAPTURED', razorpayPaymentId: PAYMENT_ID }),
      }),
    );
    expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.couponRedemption.update).toHaveBeenCalledTimes(1);
  });

  it('invalid signature → 400 + no state change', async () => {
    const client = makeFakeClient();
    await expect(
      processPaymentSuccess(
        {
          razorpayOrderId: 'order_real_123',
          razorpayPaymentId: 'pay_real_456',
          razorpaySignature: 'forged_signature_value',
        },
        client,
      ),
    ).rejects.toMatchObject({ status: 400 });

    expect(mockPrisma.razorpayOrder.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.razorpayOrder.update).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('idempotent re-call → returns alreadyActive without double-issuing', async () => {
    const ORDER_ID = 'order_real_123';
    const PAYMENT_ID = 'pay_real_456';
    const sig = createHmac('sha256', KEY_SECRET).update(`${ORDER_ID}|${PAYMENT_ID}`).digest('hex');

    // The order is already CAPTURED with the same payment id.
    mockPrisma.razorpayOrder.findUnique.mockResolvedValue(
      makeRazorpayOrder({
        razorpayOrderId: ORDER_ID,
        status: 'CAPTURED',
        razorpayPaymentId: PAYMENT_ID,
      }),
    );
    mockPrisma.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: 'ACTIVE' }),
    );
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-existing',
      invoiceNumber: 'INV-2026-000001',
      subscriptionId: 'sub-1',
      status: 'PAID',
    });

    const client = makeFakeClient();
    const result = await processPaymentSuccess(
      { razorpayOrderId: ORDER_ID, razorpayPaymentId: PAYMENT_ID, razorpaySignature: sig },
      client,
    );

    expect(result.alreadyActive).toBe(true);
    // No new invoice issued, no double-update.
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    expect(mockPrisma.razorpayOrder.update).not.toHaveBeenCalled();
  });

  it('order not found → 404', async () => {
    const ORDER_ID = 'order_real_unknown';
    const PAYMENT_ID = 'pay_real_456';
    const sig = createHmac('sha256', KEY_SECRET).update(`${ORDER_ID}|${PAYMENT_ID}`).digest('hex');

    mockPrisma.razorpayOrder.findUnique.mockResolvedValue(null);

    const client = makeFakeClient();
    await expect(
      processPaymentSuccess(
        { razorpayOrderId: ORDER_ID, razorpayPaymentId: PAYMENT_ID, razorpaySignature: sig },
        client,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ─── processWebhook ────────────────────────────────────────────────────

function makeWebhookEnvelope(eventId: string, event: string, payment: Record<string, unknown>) {
  return {
    id: eventId,
    event,
    payload: { payment: { entity: payment } },
  };
}

function signWebhook(rawBody: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

describe('processWebhook', () => {
  it('payment.captured → marks order CAPTURED + subscription ACTIVE + persists event', async () => {
    const envelope = makeWebhookEnvelope('evt_1', 'payment.captured', {
      id: 'pay_xyz',
      order_id: 'order_xyz',
      status: 'captured',
    });
    const rawBody = JSON.stringify(envelope);
    const signature = signWebhook(rawBody);

    mockPrisma.razorpayWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.razorpayWebhookEvent.create.mockResolvedValue({
      id: 'evtrow-1',
      razorpayEventId: 'evt_1',
      eventType: 'payment.captured',
      payload: envelope,
      signatureValid: true,
      processed: false,
      receivedAt: new Date(),
      processedAt: null,
    });
    mockPrisma.razorpayWebhookEvent.update.mockResolvedValue({
      id: 'evtrow-1',
      razorpayEventId: 'evt_1',
      processed: true,
    });
    mockPrisma.razorpayOrder.findUnique.mockResolvedValue(
      makeRazorpayOrder({ razorpayOrderId: 'order_xyz' }),
    );
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription());
    mockPrisma.subscription.update.mockResolvedValue(makeSubscription({ status: 'ACTIVE' }));
    mockPrisma.razorpayOrder.update.mockResolvedValue({});

    const client = makeFakeClient();
    const result = await processWebhook(
      { rawBody, signature, payload: envelope as Parameters<typeof processWebhook>[0]['payload'] },
      client,
    );

    expect(result.signatureValid).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.processed).toBe(true);
    expect(mockPrisma.razorpayWebhookEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.razorpayOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CAPTURED' }),
      }),
    );
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('payment.failed → marks PAYMENT_FAILED on the subscription', async () => {
    const envelope = makeWebhookEnvelope('evt_2', 'payment.failed', {
      id: 'pay_failed',
      order_id: 'order_failed',
      status: 'failed',
      error_description: 'card declined',
    });
    const rawBody = JSON.stringify(envelope);
    const signature = signWebhook(rawBody);

    mockPrisma.razorpayWebhookEvent.create.mockResolvedValue({
      id: 'evtrow-2',
      razorpayEventId: 'evt_2',
      eventType: 'payment.failed',
      signatureValid: true,
      processed: false,
    });
    mockPrisma.razorpayWebhookEvent.update.mockResolvedValue({
      id: 'evtrow-2',
      processed: true,
    });
    mockPrisma.razorpayOrder.findUnique.mockResolvedValue(
      makeRazorpayOrder({ razorpayOrderId: 'order_failed', status: 'CREATED' }),
    );
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ status: 'PENDING' }));
    mockPrisma.subscription.update.mockResolvedValue(makeSubscription({ status: 'PAYMENT_FAILED' }));

    const client = makeFakeClient();
    const result = await processWebhook(
      { rawBody, signature, payload: envelope as Parameters<typeof processWebhook>[0]['payload'] },
      client,
    );

    expect(result.processed).toBe(true);
    expect(mockPrisma.razorpayOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAYMENT_FAILED' }),
      }),
    );
  });

  it('duplicate event id → returns duplicate=true, does NOT re-process', async () => {
    const envelope = makeWebhookEnvelope('evt_dup', 'payment.captured', {
      id: 'pay_dup',
      order_id: 'order_dup',
      status: 'captured',
    });
    const rawBody = JSON.stringify(envelope);
    const signature = signWebhook(rawBody);

    mockPrisma.razorpayWebhookEvent.findUnique.mockResolvedValue({
      id: 'existing-evt',
      razorpayEventId: 'evt_dup',
      processed: true,
      eventType: 'payment.captured',
    });

    const client = makeFakeClient();
    const result = await processWebhook(
      { rawBody, signature, payload: envelope as Parameters<typeof processWebhook>[0]['payload'] },
      client,
    );

    expect(result.duplicate).toBe(true);
    expect(result.processed).toBe(true);
    expect(mockPrisma.razorpayWebhookEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.razorpayOrder.update).not.toHaveBeenCalled();
  });

  it('invalid signature → persists with signatureValid=false, does NOT process', async () => {
    const envelope = makeWebhookEnvelope('evt_forged', 'payment.captured', {
      id: 'pay_forged',
      order_id: 'order_forged',
      status: 'captured',
    });
    const rawBody = JSON.stringify(envelope);

    mockPrisma.razorpayWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.razorpayWebhookEvent.create.mockResolvedValue({
      id: 'evtrow-forged',
      razorpayEventId: 'evt_forged',
      signatureValid: false,
      processed: false,
    });

    const client = makeFakeClient();
    const result = await processWebhook(
      { rawBody, signature: 'forged_sig_xxx', payload: envelope as Parameters<typeof processWebhook>[0]['payload'] },
      client,
    );

    expect(result.signatureValid).toBe(false);
    expect(result.processed).toBe(false);
    expect(mockPrisma.razorpayWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signatureValid: false }),
      }),
    );
    // Critical: NO state changes on the order/subscription.
    expect(mockPrisma.razorpayOrder.update).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('payment.captured for unknown order → no-op, still 200-equivalent (processed=true, no state change)', async () => {
    const envelope = makeWebhookEnvelope('evt_orphan', 'payment.captured', {
      id: 'pay_orphan',
      order_id: 'order_orphan',
      status: 'captured',
    });
    const rawBody = JSON.stringify(envelope);
    const signature = signWebhook(rawBody);

    mockPrisma.razorpayWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.razorpayWebhookEvent.create.mockResolvedValue({
      id: 'evtrow-orphan',
      razorpayEventId: 'evt_orphan',
      signatureValid: true,
      processed: false,
    });
    mockPrisma.razorpayWebhookEvent.update.mockResolvedValue({ id: 'evtrow-orphan', processed: true });
    mockPrisma.razorpayOrder.findUnique.mockResolvedValue(null);

    const client = makeFakeClient();
    const result = await processWebhook(
      { rawBody, signature, payload: envelope as Parameters<typeof processWebhook>[0]['payload'] },
      client,
    );

    expect(result.processed).toBe(true);
    expect(mockPrisma.razorpayOrder.update).not.toHaveBeenCalled();
  });
});
