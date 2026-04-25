/**
 * AAT-RZP / Wave 7: route tests for /api/v1/billing.
 *
 * Drives the express router directly with a synthetic req/res — same
 * pattern as coupons.test.ts and biocarbon-public.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    subscription: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
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

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { billingRouter } from './billing.js';
import { errorHandler } from '../middleware/error-handler.js';
import { _setRazorpayClientForTests } from '../services/billing/razorpay-client.js';
import type { RazorpayClient } from '../services/billing/razorpay-client.js';

// ─── Fake client ───────────────────────────────────────────────────────

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

function makeFakeClient(): RazorpayClient {
  return {
    publicKeyId: 'rzp_test_route',
    createOrder: vi.fn(async (input) => ({
      id: 'order_route_xyz',
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
      const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
      return expected === signature;
    },
    verifyPaymentSignature(input) {
      const expected = createHmac('sha256', KEY_SECRET)
        .update(`${input.orderId}|${input.paymentId}`)
        .digest('hex');
      return expected === input.razorpaySignature;
    },
  };
}

// ─── Test app + helpers ────────────────────────────────────────────────

function buildApp(): Express {
  const app = express();
  // Mount json AFTER the webhook subroute would normally override it. The
  // webhook endpoint registers its own express.raw inside billingRouter,
  // and that takes precedence for that path because billingRouter is
  // mounted as a sub-router.
  app.use(express.json());
  app.use('/api/v1/billing', billingRouter);
  app.use(errorHandler);
  return app;
}

// jwt convention: lib/jwt.ts uses process.env.JWT_SECRET ?? 'dev-access-secret-change-me'.
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret-change-me';

function makeAuthHeader(role: string, opts: { orgId?: string | null; sub?: string } = {}): string {
  const payload: Record<string, unknown> = {
    sub: opts.sub ?? '22222222-2222-2222-2222-222222222222',
    email: 'admin@example.com',
    role,
  };
  if (opts.orgId !== null) {
    payload.orgId = opts.orgId ?? '11111111-1111-1111-1111-111111111111';
  }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: 60 });
  return `Bearer ${token}`;
}

interface FakeResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

interface RequestOpts {
  method?: 'GET' | 'POST';
  url: string;
  body?: unknown;
  /** Buffer body — used for the webhook raw-body path. */
  rawBody?: Buffer;
  headers?: Record<string, string>;
  authHeader?: string;
}

async function call(opts: RequestOpts): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const respHeaders: Record<string, string> = {};

    const reqHeaders: Record<string, string> = {
      'content-type': 'application/json',
      ...(opts.headers ?? {}),
    };
    if (opts.authHeader) reqHeaders['authorization'] = opts.authHeader;

    const req: Partial<Request> = {
      method: opts.method ?? 'POST',
      url: opts.url,
      originalUrl: opts.url,
      path: opts.url,
      headers: reqHeaders,
      body: opts.rawBody ?? opts.body,
      ip: '198.51.100.99',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket: { remoteAddress: '198.51.100.99' } as any,
      header(name: string) {
        return reqHeaders[String(name).toLowerCase()];
      },
    };

    const res: Partial<Response> = {
      status(code: number) {
        status = code;
        return this as Response;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload, headers: respHeaders });
        return this as Response;
      },
      end(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload, headers: respHeaders });
        return this as Response;
      },
      setHeader(name: string, value: string) {
        respHeaders[String(name).toLowerCase()] = String(value);
        return res as Response;
      },
      getHeader: () => undefined,
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (app as any).handle(req as Request, res as Response, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-r-1',
    organizationId: '11111111-1111-1111-1111-111111111111',
    plan: 'MSME_INDIA',
    region: 'INDIA',
    status: 'PENDING',
    currency: 'INR',
    amountMinor: 499900,
    perSiteCount: 1,
    totalAmountMinor: 589882,
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
    id: 'rzpord-r-1',
    razorpayOrderId: 'order_route_xyz',
    subscriptionId: 'sub-r-1',
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
  _setRazorpayClientForTests(makeFakeClient());
  mockPrisma.$transaction.mockImplementation(
    async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
  );
  mockPrisma.invoice.count.mockResolvedValue(0);
  mockPrisma.invoice.create.mockImplementation(async (args) => ({
    id: 'inv-r-1',
    invoiceNumber: 'INV-2026-000001',
    ...args.data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  mockPrisma.invoice.findFirst.mockResolvedValue(null);
  mockPrisma.razorpayWebhookEvent.findUnique.mockResolvedValue(null);
});

// ─── POST /checkout ────────────────────────────────────────────────────

describe('POST /api/v1/billing/checkout', () => {
  it('returns 200 with order config for an authenticated ORG_ADMIN', async () => {
    mockPrisma.subscription.create.mockResolvedValue(makeSubscription());
    mockPrisma.razorpayOrder.create.mockResolvedValue(makeRazorpayOrder());
    mockPrisma.razorpayOrder.update.mockResolvedValue({});

    const res = await call({
      url: '/api/v1/billing/checkout',
      body: { plan: 'MSME_INDIA' },
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });

    expect(res.status).toBe(200);
    const body = res.body as { data: Record<string, unknown> };
    expect(body.data.subscriptionId).toBe('sub-r-1');
    expect(body.data.orderId).toBe('order_route_xyz');
    expect(body.data.keyId).toBe('rzp_test_route');
    expect(body.data.skippedRazorpay).toBe(false);
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await call({
      url: '/api/v1/billing/checkout',
      body: { plan: 'MSME_INDIA' },
    });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ status: 401, title: 'Unauthorized' });
  });

  it('returns 403 for a non-admin role', async () => {
    const res = await call({
      url: '/api/v1/billing/checkout',
      body: { plan: 'MSME_INDIA' },
      authHeader: makeAuthHeader('VIEWER'),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 on a malformed body', async () => {
    const res = await call({
      url: '/api/v1/billing/checkout',
      body: { plan: 'NOT_A_PLAN' },
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(400);
  });

  it('returns 403 when the JWT has no orgId', async () => {
    const res = await call({
      url: '/api/v1/billing/checkout',
      body: { plan: 'MSME_INDIA' },
      authHeader: makeAuthHeader('ORG_ADMIN', { orgId: null }),
    });
    expect(res.status).toBe(403);
  });
});

// ─── POST /checkout/success ────────────────────────────────────────────

describe('POST /api/v1/billing/checkout/success', () => {
  it('verifies signature + activates subscription', async () => {
    const orderId = 'order_route_xyz';
    const paymentId = 'pay_route_abc';
    const sig = createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

    mockPrisma.razorpayOrder.findUnique.mockResolvedValue(makeRazorpayOrder());
    mockPrisma.razorpayOrder.update.mockResolvedValue({});
    mockPrisma.subscription.update.mockResolvedValue(makeSubscription({ status: 'ACTIVE' }));

    const res = await call({
      url: '/api/v1/billing/checkout/success',
      body: { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: sig },
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });

    expect(res.status).toBe(200);
    const body = res.body as { data: Record<string, unknown> };
    expect(body.data.subscriptionId).toBe('sub-r-1');
    expect(body.data.status).toBe('ACTIVE');
    expect(body.data.invoiceNumber).toBe('INV-2026-000001');
  });

  it('rejects forged signature with 400', async () => {
    const res = await call({
      url: '/api/v1/billing/checkout/success',
      body: {
        razorpayOrderId: 'order_route_xyz',
        razorpayPaymentId: 'pay_route_abc',
        razorpaySignature: 'forged_sig_zzz',
      },
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(400);
  });
});

// ─── POST /webhook/razorpay ────────────────────────────────────────────

describe('POST /api/v1/billing/webhook/razorpay', () => {
  it('valid signature → 200 + persists event + processes', async () => {
    const envelope = {
      id: 'evt_route_1',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_route_xyz', order_id: 'order_route_xyz', status: 'captured' },
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(envelope), 'utf8');
    const signature = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

    mockPrisma.razorpayWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.razorpayWebhookEvent.create.mockResolvedValue({
      id: 'evtrow-route-1',
      razorpayEventId: 'evt_route_1',
      signatureValid: true,
      processed: false,
    });
    mockPrisma.razorpayWebhookEvent.update.mockResolvedValue({
      id: 'evtrow-route-1',
      processed: true,
    });
    mockPrisma.razorpayOrder.findUnique.mockResolvedValue(makeRazorpayOrder());
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription());
    mockPrisma.subscription.update.mockResolvedValue(makeSubscription({ status: 'ACTIVE' }));
    mockPrisma.razorpayOrder.update.mockResolvedValue({});

    const res = await call({
      url: '/api/v1/billing/webhook/razorpay',
      rawBody,
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': signature,
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.received).toBe(true);
    expect(body.signatureValid).toBe(true);
    expect(body.processed).toBe(true);
    expect(mockPrisma.razorpayWebhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it('invalid signature → 200 (Razorpay retries on non-2xx) + persists with signatureValid=false + does NOT process', async () => {
    const envelope = {
      id: 'evt_forged_1',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_forged', order_id: 'order_forged', status: 'captured' },
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(envelope), 'utf8');

    mockPrisma.razorpayWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.razorpayWebhookEvent.create.mockResolvedValue({
      id: 'evtrow-forged-1',
      razorpayEventId: 'evt_forged_1',
      signatureValid: false,
      processed: false,
    });

    const res = await call({
      url: '/api/v1/billing/webhook/razorpay',
      rawBody,
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': 'forged_sig',
      },
    });

    expect(res.status).toBe(200); // Critical: ack so Razorpay doesn't retry forever.
    const body = res.body as Record<string, unknown>;
    expect(body.received).toBe(true);
    expect(body.signatureValid).toBe(false);
    expect(body.processed).toBe(false);
    expect(mockPrisma.razorpayOrder.update).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('malformed body → 200 (acks) + does NOT call processWebhook', async () => {
    const rawBody = Buffer.from('this is not json', 'utf8');
    const res = await call({
      url: '/api/v1/billing/webhook/razorpay',
      rawBody,
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': 'whatever',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: false });
    expect(mockPrisma.razorpayWebhookEvent.create).not.toHaveBeenCalled();
  });
});

// ─── GET /subscriptions/me, /invoices ──────────────────────────────────

describe('GET /api/v1/billing/subscriptions/me', () => {
  it('returns the active subscription for the caller org', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(makeSubscription({ status: 'ACTIVE' }));
    const res = await call({
      method: 'GET',
      url: '/api/v1/billing/subscriptions/me',
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(200);
    expect((res.body as { data: Record<string, unknown> }).data.status).toBe('ACTIVE');
  });

  it('returns 401 without auth', async () => {
    const res = await call({
      method: 'GET',
      url: '/api/v1/billing/subscriptions/me',
    });
    expect(res.status).toBe(401);
  });
});
