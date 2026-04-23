import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireOrgRole } from './org-role.js';

/**
 * Build a minimal Express req/res/next triple for middleware tests.
 */
function makeCtx(orgRole?: string) {
  const req = { orgRole } as Partial<Request> as Request;
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
  return { req, res: res as unknown as Response & { statusCode: number; body: unknown }, next };
}

describe('requireOrgRole', () => {
  it('allows the request when orgRole matches one of the allowed roles', () => {
    const { req, res, next } = makeCtx('APPROVER');
    requireOrgRole('APPROVER', 'ORG_ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });

  it('denies with 403 + RFC 7807 body when orgRole is not in the allow-list', () => {
    const { req, res, next } = makeCtx('VIEWER');
    requireOrgRole('APPROVER', 'ORG_ADMIN')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      type: expect.stringContaining('forbidden'),
      title: 'Forbidden',
      status: 403,
      detail: 'Insufficient organization role',
    });
  });

  it('denies with 403 + "Organization role required" when orgRole is missing', () => {
    const { req, res, next } = makeCtx(undefined);
    requireOrgRole('APPROVER')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      title: 'Forbidden',
      status: 403,
      detail: 'Organization role required',
    });
  });

  it('normalizes both sides to uppercase (case-insensitive match)', () => {
    const { req, res, next } = makeCtx('maker');
    requireOrgRole('Maker', 'approver')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });
});
