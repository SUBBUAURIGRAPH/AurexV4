import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * AAT-WORKFLOW (Wave 9a): tests for the onboarding-gate middleware.
 * Mocks the @aurex/database singleton so we don't need a real DB.
 */

const findUniqueMock = vi.fn();

vi.mock('@aurex/database', () => ({
  prisma: {
    onboardingProgress: {
      findUnique: (args: unknown) => findUniqueMock(args),
    },
  },
}));

import {
  requireOnboardingComplete,
  ONBOARDING_INCOMPLETE_TYPE,
} from './onboarding-gate.js';

function makeCtx(orgId: string | undefined, originalUrl = '/api/v1/emissions') {
  const req = { orgId, originalUrl } as Partial<Request> as Request;
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const next = vi.fn() as unknown as NextFunction;
  return {
    req,
    res: res as unknown as Response & { statusCode: number; body: unknown },
    next,
  };
}

describe('requireOnboardingComplete', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it('returns 412 with onboarding-incomplete type when no progress row exists', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const { req, res, next } = makeCtx('org-1');
    await requireOnboardingComplete(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(412);
    expect(res.body).toMatchObject({
      type: ONBOARDING_INCOMPLETE_TYPE,
      title: 'Complete onboarding',
      status: 412,
      nextStep: '/onboarding',
      instance: '/api/v1/emissions',
    });
  });

  it('returns 412 when onboarding is IN_PROGRESS', async () => {
    findUniqueMock.mockResolvedValueOnce({ status: 'IN_PROGRESS' });
    const { req, res, next } = makeCtx('org-1');
    await requireOnboardingComplete(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(412);
    expect(res.body).toMatchObject({
      type: ONBOARDING_INCOMPLETE_TYPE,
      status: 412,
      nextStep: '/onboarding',
    });
  });

  it('passes through when onboarding is COMPLETED', async () => {
    findUniqueMock.mockResolvedValueOnce({ status: 'COMPLETED' });
    const { req, res, next } = makeCtx('org-1');
    await requireOnboardingComplete(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });

  it('passes through when onboarding was SKIPPED', async () => {
    findUniqueMock.mockResolvedValueOnce({ status: 'SKIPPED' });
    const { req, res, next } = makeCtx('org-1');
    await requireOnboardingComplete(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });

  it('returns 403 when orgId is missing on the request', async () => {
    const { req, res, next } = makeCtx(undefined);
    await requireOnboardingComplete(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('forwards DB errors to next() instead of swallowing them', async () => {
    const boom = new Error('db down');
    findUniqueMock.mockRejectedValueOnce(boom);
    const { req, res, next } = makeCtx('org-1');
    await requireOnboardingComplete(req, res, next);

    expect(next).toHaveBeenCalledWith(boom);
  });
});
