/**
 * AAT-378 / AV4-378 — quota-gate middleware tests.
 *
 * Tests for the middleware factory in `quota-gate.ts`. Mocks the
 * underlying `quota.service.checkQuota` so we don't need a Prisma
 * fixture — the gate's only responsibility is shaping the RFC 7807
 * body and converting `allowed=false` into a 429.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockCheckQuota } = vi.hoisted(() => ({
  mockCheckQuota: vi.fn(),
}));

vi.mock('../services/billing/quota.service.js', () => ({
  checkQuota: mockCheckQuota,
}));

import { requireQuota, QUOTA_EXCEEDED_TYPE } from './quota-gate.js';

function makeReq(orgId: string | null = 'org-1'): Request {
  return {
    orgId: orgId ?? undefined,
    originalUrl: '/api/v1/emissions',
  } as unknown as Request;
}

function makeRes(): {
  res: Response;
  calls: { status?: number; body?: unknown };
} {
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
  mockCheckQuota.mockReset();
});

describe('requireQuota middleware', () => {
  it('calls next() when quota check returns allowed', async () => {
    mockCheckQuota.mockResolvedValueOnce({
      resource: 'monthlyEmissionEntries',
      allowed: true,
      used: 10,
      limit: 1000,
      remaining: 990,
    });

    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    const gate = requireQuota('monthlyEmissionEntries');
    await gate(makeReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(calls.status).toBeUndefined();
  });

  it('returns 429 RFC 7807 when quota check denies', async () => {
    mockCheckQuota.mockResolvedValueOnce({
      resource: 'monthlyEmissionEntries',
      allowed: false,
      used: 1000,
      limit: 1000,
      remaining: 0,
    });

    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    const gate = requireQuota('monthlyEmissionEntries');
    await gate(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(calls.status).toBe(429);

    const body = calls.body as Record<string, unknown>;
    expect(body.type).toBe(QUOTA_EXCEEDED_TYPE);
    expect(body.title).toBe('Quota Exceeded');
    expect(body.status).toBe(429);
    expect(body.resource).toBe('monthlyEmissionEntries');
    expect(body.used).toBe(1000);
    expect(body.limit).toBe(1000);
    expect(body.nextStep).toBe('/billing/manage');
    expect(body.detail).toContain('monthly emission entries');
    expect(body.instance).toBe('/api/v1/emissions');
  });

  it('returns 403 when req.orgId is missing (defensive)', async () => {
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    const gate = requireQuota('monthlyEmissionEntries');
    await gate(makeReq(null), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(calls.status).toBe(403);
    expect(mockCheckQuota).not.toHaveBeenCalled();
  });

  it('forwards underlying errors to next(err) (does not 500 directly)', async () => {
    mockCheckQuota.mockRejectedValueOnce(new Error('db down'));

    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    const gate = requireQuota('reportsPerYear');
    await gate(makeReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(calls.status).toBeUndefined();
  });

  it('uses the resource label in the detail message', async () => {
    mockCheckQuota.mockResolvedValueOnce({
      resource: 'reportsPerYear',
      allowed: false,
      used: 12,
      limit: 12,
      remaining: 0,
    });
    const next = vi.fn() as NextFunction;
    const { res, calls } = makeRes();
    const gate = requireQuota('reportsPerYear');
    await gate(makeReq(), res, next);

    const body = calls.body as Record<string, unknown>;
    expect(String(body.detail)).toContain('reports this year');
  });
});
