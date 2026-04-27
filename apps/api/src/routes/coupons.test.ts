/**
 * AAT-V3PORT: route tests for the public coupon endpoints.
 *
 * Drives the express router directly with a synthetic req/res — same
 * pattern as awd2-handoff.test.ts and biocarbon-public.test.ts. Avoids
 * adding supertest as a runtime dep.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    signupCoupon: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    couponRedemption: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation(
    async (cb: (tx: typeof mock) => unknown) => cb(mock),
  );
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { couponsRouter } from './coupons.js';
import { errorHandler } from '../middleware/error-handler.js';
import { _resetValidateBurstForTests } from '../services/coupon.service.js';
import { signAccessToken } from '../lib/jwt.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/coupons', couponsRouter);
  app.use(errorHandler);
  return app;
}

interface FakeResponse {
  status: number;
  body: unknown;
}

async function postJson(url: string, body: unknown, ip = '198.51.100.99', headers: Record<string, string> = {}): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const req: Partial<Request> = {
      method: 'POST',
      url,
      originalUrl: url,
      path: url,
      headers: { 'content-type': 'application/json', ...headers },
      body,
      ip,
       
      socket: { remoteAddress: ip } as any,
    };
    const res: Partial<Response> = {
      status(code: number) {
        status = code;
        return this as Response;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      end(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      setHeader: () => res as Response,
      getHeader: () => undefined,
    };
    try {
       
      (app as any).handle(req as Request, res as Response, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const req: Partial<Request> = {
      method: 'GET',
      url,
      originalUrl: url,
      path: url,
      headers,
      ip: '198.51.100.99',
       
      socket: { remoteAddress: '198.51.100.99' } as any,
    };
    const res: Partial<Response> = {
      status(code: number) {
        status = code;
        return this as Response;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      end(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      setHeader: () => res as Response,
      getHeader: () => undefined,
    };
    try {
       
      (app as any).handle(req as Request, res as Response, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function makeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    couponCode: 'HEF-PUNE-2026',
    chapterName: 'Pune Chapter',
    organizationName: 'Hydrogen Energy Foundation',
    trialDurationDays: 45,
    trialTier: 'PROFESSIONAL',
    maxRedemptions: 200,
    currentRedemptions: 0,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: new Date('2027-12-31T00:00:00Z'),
    isActive: true,
    metadata: { discount_percentage: 25 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetValidateBurstForTests();
  mockPrisma.$transaction.mockImplementation(
    async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
  );
});

// ── /validate ─────────────────────────────────────────────────────────────

describe('POST /api/v1/coupons/validate', () => {
  it('returns 200 + coupon shape on a valid code', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());

    const res = await postJson('/api/v1/coupons/validate', { code: 'HEF-PUNE-2026' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      valid: true,
      coupon: {
        code: 'HEF-PUNE-2026',
        chapterName: 'Pune Chapter',
        trialDurationDays: 45,
        trialTier: 'PROFESSIONAL',
      },
    });
    // Internal IDs must not leak.
    expect((res.body as Record<string, unknown>).id).toBeUndefined();
  });

  it('returns 200 with valid:false + reason for an unknown code', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(null);

    const res = await postJson('/api/v1/coupons/validate', { code: 'NOPE-2026' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valid: false, reason: 'COUPON_NOT_FOUND' });
  });

  it('returns 400 (RFC 7807) when the body is malformed', async () => {
    const res = await postJson('/api/v1/coupons/validate', { wrongField: 'x' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: 'https://aurex.in/errors/validation',
      status: 400,
    });
  });
});

// ── /hef/validate (V3 parity alias) ───────────────────────────────────────

describe('POST /api/v1/coupons/hef/validate (V3 alias)', () => {
  it('shares the same handler as /validate', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());

    const res = await postJson('/api/v1/coupons/hef/validate', { code: 'HEF-PUNE-2026' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valid: true });
  });
});

// ── /redeem ───────────────────────────────────────────────────────────────

describe('POST /api/v1/coupons/redeem', () => {
  it('returns 201 + trial window on first redemption', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());
    mockPrisma.couponRedemption.findUnique.mockResolvedValue(null);
    mockPrisma.signupCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.couponRedemption.create.mockResolvedValue({ id: 'red-1' });

    const res = await postJson('/api/v1/coupons/redeem', {
      code: 'HEF-PUNE-2026',
      email: 'first@example.com',
      geoCountry: 'IN',
    });

    expect(res.status).toBe(201);
    const body = res.body as { data: Record<string, unknown> };
    expect(body.data.redemptionId).toBe('red-1');
    expect(body.data.trialTier).toBe('PROFESSIONAL');
    expect(body.data.trialDurationDays).toBe(45);
    expect(typeof body.data.trialStart).toBe('string');
    expect(typeof body.data.trialEnd).toBe('string');
  });

  it('returns 409 when the same email tries to redeem twice (dedup)', async () => {
    mockPrisma.signupCoupon.findFirst.mockResolvedValue(makeCoupon());
    // Second call: redemption already exists.
    mockPrisma.couponRedemption.findUnique.mockResolvedValue({
      id: 'red-existing',
      couponId: 'coupon-1',
      userEmail: 'second@example.com',
    });

    const res = await postJson('/api/v1/coupons/redeem', {
      code: 'HEF-PUNE-2026',
      email: 'second@example.com',
    });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      type: expect.stringContaining('aurex.in/errors'),
      status: 409,
      title: 'Conflict',
    });
  });

  it('returns 400 when email is missing', async () => {
    const res = await postJson('/api/v1/coupons/redeem', { code: 'HEF-PUNE-2026' });
    expect(res.status).toBe(400);
  });
});

// ── /redemptions/me (AAT-ONBOARD) ─────────────────────────────────────────

describe('GET /api/v1/coupons/redemptions/me', () => {
  function authHeader(): Record<string, string> {
    const token = signAccessToken({
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'me@aurex.in',
       
      role: 'VIEWER' as any,
    });
    return { authorization: `Bearer ${token}` };
  }

  it('returns the active trial card when one exists', async () => {
    const trialEnd = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'me@aurex.in' });
    mockPrisma.couponRedemption.findFirst.mockResolvedValue({
      id: 'red-1',
      couponId: 'coupon-1',
      userEmail: 'me@aurex.in',
      trialStart: new Date(),
      trialEnd,
      trialStatus: 'ACTIVE',
      coupon: makeCoupon({ trialDurationDays: 365 }),
    });

    const res = await getJson('/api/v1/coupons/redemptions/me', authHeader());

    expect(res.status).toBe(200);
    const body = res.body as { data: Record<string, unknown> };
    expect(body.data.couponCode).toBe('HEF-PUNE-2026');
    expect(body.data.trialDurationDays).toBe(365);
    expect(typeof body.data.daysRemaining).toBe('number');
    expect(body.data.daysRemaining).toBeGreaterThan(190);
  });

  it('returns 200 with data:null when the user has no active redemption', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'fresh@aurex.in' });
    mockPrisma.couponRedemption.findFirst.mockResolvedValue(null);

    const res = await getJson('/api/v1/coupons/redemptions/me', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
  });

  it('returns 200 with data:null when the trial has ended (trialEnd guard)', async () => {
    // The query filters on `trialEnd > now`, so an expired row simply
    // won't match — Prisma returns null.
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'me@aurex.in' });
    mockPrisma.couponRedemption.findFirst.mockResolvedValue(null);

    const res = await getJson('/api/v1/coupons/redemptions/me', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
  });

  it('returns 401 without an auth header', async () => {
    const res = await getJson('/api/v1/coupons/redemptions/me');
    expect(res.status).toBe(401);
  });
});
