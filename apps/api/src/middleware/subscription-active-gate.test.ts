/**
 * Tests for AAT-11B / Wave 11b subscription-active-gate middleware.
 *
 * Mocks prisma directly via vi.mock so the middleware's
 * `prisma.subscription.findFirst` calls hit our stub. Each case sets up
 * one specific Subscription state and asserts the gate either calls
 * next() or 402s.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockSubFindFirst } = vi.hoisted(() => ({
  mockSubFindFirst: vi.fn(),
}));

vi.mock('@aurex/database', () => ({
  prisma: {
    subscription: {
      findFirst: mockSubFindFirst,
    },
  },
}));

import {
  requireActiveSubscription,
  SUBSCRIPTION_EXPIRED_TYPE,
} from './subscription-active-gate.js';

function makeReq(orgId: string | null = 'org-1'): Request {
  return {
    orgId: orgId ?? undefined,
    originalUrl: '/api/v1/emissions',
  } as unknown as Request;
}

function makeRes(): { res: Response; calls: { status?: number; body?: unknown } } {
  const calls: { status?: number; body?: unknown } = {};
  const res = {
    status: vi.fn(function (this: Response, code: number) {
      calls.status = code;
      return this;
    }),
    json: vi.fn(function (this: Response, body: unknown) {
      calls.body = body;
      return this;
    }),
  } as unknown as Response;
  return { res, calls };
}

beforeEach(() => {
  mockSubFindFirst.mockReset();
});

describe('requireActiveSubscription', () => {
  it('calls next() when no subscription exists at all (free tier / pre-checkout)', async () => {
    mockSubFindFirst.mockResolvedValueOnce(null); // no non-cancelled
    mockSubFindFirst.mockResolvedValueOnce(null); // no cancelled either
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(calls.status).toBeUndefined();
  });

  it('calls next() on ACTIVE subscription', async () => {
    mockSubFindFirst.mockResolvedValueOnce({
      status: 'ACTIVE',
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(calls.status).toBeUndefined();
  });

  it('calls next() on TRIAL subscription', async () => {
    mockSubFindFirst.mockResolvedValueOnce({ status: 'TRIAL', endsAt: null });
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(calls.status).toBeUndefined();
  });

  it('calls next() on PENDING subscription (checkout in flight)', async () => {
    mockSubFindFirst.mockResolvedValueOnce({ status: 'PENDING', endsAt: null });
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(calls.status).toBeUndefined();
  });

  it('returns 402 RFC 7807 on EXPIRED subscription', async () => {
    mockSubFindFirst.mockResolvedValueOnce({
      status: 'EXPIRED',
      endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(calls.status).toBe(402);
    const body = calls.body as Record<string, unknown>;
    expect(body.type).toBe(SUBSCRIPTION_EXPIRED_TYPE);
    expect(body.status).toBe(402);
    expect(body.nextStep).toBe('/billing/manage');
  });

  it('returns 402 on PAYMENT_FAILED with endsAt in the past (grace expired)', async () => {
    mockSubFindFirst.mockResolvedValueOnce({
      status: 'PAYMENT_FAILED',
      endsAt: new Date(Date.now() - 60_000),
    });
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(calls.status).toBe(402);
  });

  it('calls next() on PAYMENT_FAILED with endsAt in the future (still in grace)', async () => {
    mockSubFindFirst.mockResolvedValueOnce({
      status: 'PAYMENT_FAILED',
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(calls.status).toBeUndefined();
  });

  it('calls next() when only a CANCELLED subscription exists with endsAt in the future', async () => {
    mockSubFindFirst.mockResolvedValueOnce(null); // findFirst with status not CANCELLED returns null
    mockSubFindFirst.mockResolvedValueOnce({
      endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(calls.status).toBeUndefined();
  });

  it('returns 402 when only a CANCELLED subscription exists with endsAt in the past', async () => {
    mockSubFindFirst.mockResolvedValueOnce(null); // no non-cancelled
    mockSubFindFirst.mockResolvedValueOnce({
      endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(calls.status).toBe(402);
  });

  it('returns 403 when req.orgId is missing (defensive)', async () => {
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(null), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(calls.status).toBe(403);
  });

  it('passes Prisma errors to next(err) (does not 500 directly)', async () => {
    mockSubFindFirst.mockRejectedValueOnce(new Error('db connection lost'));
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    await requireActiveSubscription(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(calls.status).toBeUndefined();
  });
});
