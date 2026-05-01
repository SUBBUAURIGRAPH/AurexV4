/**
 * org-scope.ts — multi-tenant aware middleware tests.
 *
 * Drives the prisma mock the same way as auth.service.test.ts. Covers:
 *   - x-org-id header path (member, super_admin, non-member rejected,
 *     missing org rejected)
 *   - no-header fallback (oldest membership picked, super_admin without
 *     memberships gets a global oldest-org fallback, plain user with no
 *     membership gets 403)
 *   - missing JWT user → 401
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    organization: { findFirst: vi.fn() },
    orgMember: { findFirst: vi.fn() },
  };
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { requireOrgScope } from './org-scope.js';

interface TestRes {
  statusCode: number;
  body: unknown;
  status(code: number): TestRes;
  json(payload: unknown): TestRes;
}

function makeCtx(opts: {
  user?: { sub: string; email: string; role: string } | null;
  headers?: Record<string, string>;
}) {
  const req = {
    user: opts.user ?? undefined,
    headers: opts.headers ?? {},
    orgId: undefined as string | undefined,
    orgRole: undefined as string | undefined,
  } as Partial<Request> as Request;
  const res: TestRes = {
    statusCode: 0,
    body: undefined,
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
  return { req, res: res as unknown as Response & TestRes, next };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireOrgScope — auth gate', () => {
  it('returns 401 when no JWT user is attached', async () => {
    const { req, res, next } = makeCtx({ user: null });
    await requireOrgScope(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireOrgScope — x-org-id header path', () => {
  it('SUPER_ADMIN: header honored, no membership row required, attaches super_admin role', async () => {
    mockPrisma.organization.findFirst.mockResolvedValue({ id: 'org-target' });
    const { req, res, next } = makeCtx({
      user: { sub: 'u1', email: 's@a', role: 'super_admin' },
      headers: { 'x-org-id': 'org-target' },
    });

    await requireOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.orgId).toBe('org-target');
    expect(req.orgRole).toBe('super_admin');
    // Membership lookup is skipped entirely for super_admin.
    expect(mockPrisma.orgMember.findFirst).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN: 404 when the requested org does not exist or is inactive', async () => {
    mockPrisma.organization.findFirst.mockResolvedValue(null);
    const { req, res, next } = makeCtx({
      user: { sub: 'u1', email: 's@a', role: 'super_admin' },
      headers: { 'x-org-id': 'org-deleted' },
    });

    await requireOrgScope(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('non-super_admin: header honored when user has a membership in that org', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue({
      orgId: 'org-target',
      role: 'org_admin',
    });
    const { req, res, next } = makeCtx({
      user: { sub: 'u1', email: 'a@b', role: 'viewer' },
      headers: { 'x-org-id': 'org-target' },
    });

    await requireOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.orgId).toBe('org-target');
    expect(req.orgRole).toBe('org_admin');
    // The findFirst was scoped to the requested org id.
    const findCall = mockPrisma.orgMember.findFirst.mock.calls[0]![0] as {
      where: { userId: string; orgId: string; isActive: boolean };
    };
    expect(findCall.where.orgId).toBe('org-target');
    expect(findCall.where.userId).toBe('u1');
  });

  it('non-super_admin: 403 when user is NOT a member of the requested org', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue(null);
    const { req, res, next } = makeCtx({
      user: { sub: 'u1', email: 'a@b', role: 'viewer' },
      headers: { 'x-org-id': 'org-foreign' },
    });

    await requireOrgScope(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      detail: expect.stringContaining('not a member of the requested organization'),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an empty header value the same as no header (treat as fallback path)', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue({
      orgId: 'org-oldest',
      role: 'org_admin',
    });
    const { req, res, next } = makeCtx({
      user: { sub: 'u1', email: 'a@b', role: 'viewer' },
      headers: { 'x-org-id': '   ' },
    });

    await requireOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.orgId).toBe('org-oldest');
    // Falls back to oldest-membership query (no orgId in where).
    const findCall = mockPrisma.orgMember.findFirst.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      orderBy?: unknown;
    };
    expect(findCall.where.orgId).toBeUndefined();
    expect(findCall.orderBy).toBeDefined();
  });
});

describe('requireOrgScope — fallback (no header)', () => {
  it('uses the user oldest active membership', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue({
      orgId: 'org-oldest',
      role: 'maker',
    });
    const { req, res, next } = makeCtx({
      user: { sub: 'u1', email: 'a@b', role: 'viewer' },
    });

    await requireOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.orgId).toBe('org-oldest');
    expect(req.orgRole).toBe('maker');
  });

  it('plain user with no memberships: 403 "User is not a member of any organization"', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue(null);
    const { req, res, next } = makeCtx({
      user: { sub: 'u1', email: 'a@b', role: 'viewer' },
    });

    await requireOrgScope(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      detail: 'User is not a member of any organization',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN with NO memberships: falls back to the oldest active org globally', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue(null);
    mockPrisma.organization.findFirst.mockResolvedValue({ id: 'org-global-oldest' });
    const { req, res, next } = makeCtx({
      user: { sub: 'u1', email: 's@a', role: 'super_admin' },
    });

    await requireOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.orgId).toBe('org-global-oldest');
    expect(req.orgRole).toBe('super_admin');
  });

  it('SUPER_ADMIN with no memberships AND no orgs at all: 403', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue(null);
    mockPrisma.organization.findFirst.mockResolvedValue(null);
    const { req, res, next } = makeCtx({
      user: { sub: 'u1', email: 's@a', role: 'super_admin' },
    });

    await requireOrgScope(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
