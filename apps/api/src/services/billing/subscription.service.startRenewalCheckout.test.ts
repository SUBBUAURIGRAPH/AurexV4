/**
 * AAT-RENEWAL / Wave 8c — startRenewalCheckout unit tests.
 *
 * Mirrors the mocking strategy in subscription.service.test.ts:
 *   - vi.hoisted prisma fake.
 *   - Hand-rolled fake RazorpayClient.
 *
 * We exercise the renewal-specific branches:
 *   - Happy path → creates Razorpay order + RenewalAttempt + returns paymentUrl.
 *   - Already-in-flight (PENDING / EMAIL_SENT row exists) → RenewalInFlightError.
 *   - Cancelled subscription → CannotRenewCancelledError.
 *   - Already-PAID row exists for same window → RenewalInFlightError.
 *   - FAILED row in same window can be re-tried (re-uses the existing row).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    subscription: {
      findUnique: vi.fn(),
    },
    renewalAttempt: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    razorpayOrder: {
      create: vi.fn(),
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
  startRenewalCheckout,
  RenewalInFlightError,
  CannotRenewCancelledError,
} from './subscription.service.js';
import type { RazorpayClient } from './razorpay-client.js';

// ─── Fake Razorpay client ──────────────────────────────────────────────

function makeFakeClient(opts: {
  createOrderImpl?: RazorpayClient['createOrder'];
} = {}): RazorpayClient {
  return {
    publicKeyId: 'rzp_test_renewal',
    createOrder:
      opts.createOrderImpl ??
      vi.fn(async (input) => ({
        id: `order_renewal_${Math.random().toString(36).slice(2, 10)}`,
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
    verifyWebhookSignature: () => true,
    verifyPaymentSignature: () => true,
  };
}

// ─── Fixtures ──────────────────────────────────────────────────────────

const SUB_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';

function makeActiveSub(overrides: Record<string, unknown> = {}) {
  return {
    id: SUB_ID,
    organizationId: ORG_ID,
    plan: 'MSME_INDIA' as const,
    region: 'INDIA' as const,
    status: 'ACTIVE' as const,
    currency: 'INR',
    amountMinor: 499900,
    perSiteCount: 1,
    totalAmountMinor: 589882,
    startsAt: new Date('2025-04-01T00:00:00Z'),
    endsAt: new Date('2026-04-01T00:00:00Z'),
    cancelAt: null,
    cancelledAt: null,
    trialEndsAt: null,
    appliedCouponCode: null,
    couponRedemptionId: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(
    async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
  );
  mockPrisma.razorpayOrder.create.mockResolvedValue({});
});

// ─── Tests ─────────────────────────────────────────────────────────────

describe('startRenewalCheckout', () => {
  it('happy path: ACTIVE sub, no in-flight renewal → creates Razorpay order + RenewalAttempt', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeActiveSub());
    mockPrisma.renewalAttempt.findUnique.mockResolvedValue(null);
    mockPrisma.renewalAttempt.create.mockImplementation(async ({ data }) => ({
      id: 'ra-new-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      emailSentAt: null,
      paidAt: null,
      failedAt: null,
      failureReason: null,
    }));

    const client = makeFakeClient();
    const result = await startRenewalCheckout(SUB_ID, client);

    expect(result.renewalAttemptId).toBe('ra-new-1');
    expect(result.razorpayOrderId).toMatch(/^order_renewal_/);
    expect(result.paymentUrl).toBe('https://aurex.in/billing/renew/ra-new-1');
    expect(result.amount).toBe(499900 + 89982); // ₹4999 + 18% GST
    expect(result.currency).toBe('INR');
    expect(result.periodStart).toEqual(new Date('2026-04-01T00:00:00Z'));
    expect(result.periodEnd).toEqual(new Date('2027-04-01T00:00:00Z'));

    // Razorpay order built correctly with renewal markers.
    expect(client.createOrder).toHaveBeenCalledTimes(1);
    const orderInput = (client.createOrder as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(orderInput.amount).toBe(499900 + 89982);
    expect(orderInput.notes.renewal).toBe('true');
    expect(orderInput.notes.subscription_id).toBe(SUB_ID);
    expect(orderInput.notes.period_start).toBe('2026-04-01T00:00:00.000Z');

    // RenewalAttempt persisted with PENDING status.
    expect(mockPrisma.renewalAttempt.create).toHaveBeenCalledTimes(1);
    const renewalData = mockPrisma.renewalAttempt.create.mock.calls[0]![0].data;
    expect(renewalData.status).toBe('PENDING');
    expect(renewalData.subscriptionId).toBe(SUB_ID);
    expect(renewalData.amountMinor).toBe(499900 + 89982);

    // Pivot RazorpayOrder row created with renewal=true marker.
    expect(mockPrisma.razorpayOrder.create).toHaveBeenCalledTimes(1);
    const rzpOrderData = mockPrisma.razorpayOrder.create.mock.calls[0]![0].data;
    expect(rzpOrderData.webhookPayload.renewal).toBe(true);
    expect(rzpOrderData.webhookPayload.renewalAttemptId).toBe('ra-new-1');
  });

  it('throws RenewalInFlightError when a PENDING attempt already exists for the next period', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeActiveSub());
    mockPrisma.renewalAttempt.findUnique.mockResolvedValue({
      id: 'ra-existing',
      subscriptionId: SUB_ID,
      periodStart: new Date('2026-04-01T00:00:00Z'),
      status: 'PENDING',
    });

    const client = makeFakeClient();
    await expect(startRenewalCheckout(SUB_ID, client)).rejects.toBeInstanceOf(
      RenewalInFlightError,
    );
    expect(client.createOrder).not.toHaveBeenCalled();
    expect(mockPrisma.renewalAttempt.create).not.toHaveBeenCalled();
  });

  it('throws RenewalInFlightError when an EMAIL_SENT attempt exists', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeActiveSub());
    mockPrisma.renewalAttempt.findUnique.mockResolvedValue({
      id: 'ra-emailed',
      subscriptionId: SUB_ID,
      periodStart: new Date('2026-04-01T00:00:00Z'),
      status: 'EMAIL_SENT',
    });

    const client = makeFakeClient();
    await expect(startRenewalCheckout(SUB_ID, client)).rejects.toBeInstanceOf(
      RenewalInFlightError,
    );
  });

  it('throws RenewalInFlightError when a PAID attempt exists (renewal already done)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeActiveSub());
    mockPrisma.renewalAttempt.findUnique.mockResolvedValue({
      id: 'ra-paid',
      subscriptionId: SUB_ID,
      periodStart: new Date('2026-04-01T00:00:00Z'),
      status: 'PAID',
    });

    const client = makeFakeClient();
    await expect(startRenewalCheckout(SUB_ID, client)).rejects.toBeInstanceOf(
      RenewalInFlightError,
    );
  });

  it('throws CannotRenewCancelledError for CANCELLED subscriptions', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      makeActiveSub({ status: 'CANCELLED' }),
    );

    const client = makeFakeClient();
    await expect(startRenewalCheckout(SUB_ID, client)).rejects.toBeInstanceOf(
      CannotRenewCancelledError,
    );
    expect(client.createOrder).not.toHaveBeenCalled();
  });

  it('throws 404 for a non-existent subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const client = makeFakeClient();
    await expect(startRenewalCheckout('missing-id', client)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects PENDING (initial-checkout-in-flight) subscriptions with a 409', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      makeActiveSub({ status: 'PENDING' }),
    );
    const client = makeFakeClient();
    await expect(startRenewalCheckout(SUB_ID, client)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('re-tries a FAILED row in the same window (bumps retryCount, reuses periodStart)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeActiveSub());
    // Existing FAILED row in the same window — service should reuse it.
    mockPrisma.renewalAttempt.findUnique.mockResolvedValue({
      id: 'ra-failed',
      subscriptionId: SUB_ID,
      periodStart: new Date('2026-04-01T00:00:00Z'),
      status: 'FAILED',
      retryCount: 1,
    });
    mockPrisma.renewalAttempt.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));

    const client = makeFakeClient();
    const result = await startRenewalCheckout(SUB_ID, client);

    expect(result.renewalAttemptId).toBe('ra-failed');
    expect(mockPrisma.renewalAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ra-failed' },
        data: expect.objectContaining({
          status: 'PENDING',
          retryCount: 2,
          failedAt: null,
        }),
      }),
    );
    // Fresh row was NOT created.
    expect(mockPrisma.renewalAttempt.create).not.toHaveBeenCalled();
  });

  it('uses metadata.renewalPriceMinor when set (operator override)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      makeActiveSub({ metadata: { renewalPriceMinor: 100000 } }),
    );
    mockPrisma.renewalAttempt.findUnique.mockResolvedValue(null);
    mockPrisma.renewalAttempt.create.mockResolvedValue({
      id: 'ra-override',
      subscriptionId: SUB_ID,
      periodStart: new Date('2026-04-01T00:00:00Z'),
    });

    const client = makeFakeClient();
    const result = await startRenewalCheckout(SUB_ID, client);

    expect(result.amount).toBe(100000); // override total, no GST applied on top
    expect(client.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100000 }),
    );
  });

  it('surfaces 502 when Razorpay createOrder fails — no DB rows created', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeActiveSub());
    mockPrisma.renewalAttempt.findUnique.mockResolvedValue(null);

    const failingClient = makeFakeClient({
      createOrderImpl: vi.fn(async () => {
        throw new Error('Razorpay upstream timeout');
      }),
    });

    await expect(startRenewalCheckout(SUB_ID, failingClient)).rejects.toMatchObject({
      status: 502,
    });

    expect(mockPrisma.renewalAttempt.create).not.toHaveBeenCalled();
    expect(mockPrisma.razorpayOrder.create).not.toHaveBeenCalled();
  });
});
