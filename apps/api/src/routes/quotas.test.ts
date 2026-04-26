/**
 * AAT-378 / AV4-378 — route tests for /api/v1/quotas/me and
 * /api/v1/admin/quotas.
 *
 * Pattern mirrors billing.test.ts — synthetic request through the
 * mounted express app; @aurex/database is mocked at module level so
 * the live count queries become stubs we control.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => {
  const orgMember = { findFirst: vi.fn(), count: vi.fn() };
  const subscription = { findFirst: vi.fn() };
  const organization = { findUnique: vi.fn(), findMany: vi.fn() };
  const emissionsRecord = { count: vi.fn() };
  const report = { count: vi.fn() };
  const activity = { count: vi.fn() };
  const creditAccount = { findFirst: vi.fn() };
  const creditUnitBlock = { count: vi.fn() };
  return {
    mockPrisma: {
      orgMember,
      subscription,
      organization,
      emissionsRecord,
      report,
      activity,
      creditAccount,
      creditUnitBlock,
    },
  };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { quotasRouter } from './quotas.js';
import { adminQuotasRouter } from './admin-quotas.js';
import { errorHandler } from '../middleware/error-handler.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret-change-me';
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function makeAuthHeader(role: string): string {
  return `Bearer ${jwt.sign(
    { sub: USER_ID, email: 'admin@example.com', role, orgId: ORG_ID },
    JWT_SECRET,
    { expiresIn: 60 },
  )}`;
}

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/quotas', quotasRouter);
  app.use('/api/v1/admin/quotas', adminQuotasRouter);
  app.use(errorHandler);
  return app;
}

interface FakeResponse {
  status: number;
  body: unknown;
}

async function callApp(opts: {
  method: 'GET';
  url: string;
  authHeader?: string;
}): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const reqHeaders: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.authHeader) reqHeaders['authorization'] = opts.authHeader;

    const req = {
      method: opts.method,
      url: opts.url,
      originalUrl: opts.url,
      path: opts.url,
      headers: reqHeaders,
      ip: '198.51.100.99',
      socket: { remoteAddress: '198.51.100.99' },
      query: {},
      header(name: string) {
        return reqHeaders[String(name).toLowerCase()];
      },
    } as unknown as express.Request;

    // Express's router uses req.url for matching; set query manually.
    const qIdx = opts.url.indexOf('?');
    if (qIdx >= 0) {
      const qs = new URLSearchParams(opts.url.slice(qIdx + 1));
      const q: Record<string, string> = {};
      qs.forEach((v, k) => {
        q[k] = v;
      });
      (req as { query: Record<string, string> }).query = q;
    }

    const res = {
      status(code: number) {
        status = code;
        return res;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload });
        return res;
      },
      end(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload });
        return res;
      },
      setHeader: () => res,
      getHeader: () => undefined,
      send(data: unknown) {
        if (payload === undefined) payload = data;
        resolve({ status, body: payload });
        return res;
      },
    } as unknown as express.Response;

    app(req, res, (err: unknown) => {
      if (err) reject(err);
    });
  });
}

beforeEach(() => {
  for (const model of Object.values(mockPrisma)) {
    for (const fn of Object.values(model)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
  // Defaults — usage counts → 0 unless overridden.
  mockPrisma.emissionsRecord.count.mockResolvedValue(0);
  mockPrisma.report.count.mockResolvedValue(0);
  mockPrisma.activity.count.mockResolvedValue(0);
  mockPrisma.orgMember.count.mockResolvedValue(0);
  mockPrisma.creditAccount.findFirst.mockResolvedValue(null);
  mockPrisma.creditUnitBlock.count.mockResolvedValue(0);
});

describe('GET /api/v1/quotas/me', () => {
  it('returns the caller-org snapshot for an authenticated user', async () => {
    // requireOrgScope membership lookup
    mockPrisma.orgMember.findFirst.mockResolvedValueOnce({
      orgId: ORG_ID,
      role: 'ORG_ADMIN',
    });
    // Subscription resolution
    mockPrisma.subscription.findFirst.mockResolvedValue({
      plan: 'MSME_INDIA',
      status: 'ACTIVE',
    });
    // Org name lookup (parallel with snapshot)
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      name: 'Acme Carbon',
      slug: 'acme-carbon',
    });
    // Some fake usage
    mockPrisma.emissionsRecord.count.mockResolvedValue(123);
    mockPrisma.report.count.mockResolvedValue(2);

    const resp = await callApp({
      method: 'GET',
      url: '/api/v1/quotas/me',
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });

    expect(resp.status).toBe(200);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.orgId).toBe(ORG_ID);
    expect(body.data.plan).toBe('MSME_INDIA');
    expect(body.data.orgName).toBe('Acme Carbon');
    expect(
      (body.data.usage as { monthlyEmissionEntries: number }).monthlyEmissionEntries,
    ).toBe(123);
  });

  it('rejects unauthenticated callers with 401', async () => {
    const resp = await callApp({
      method: 'GET',
      url: '/api/v1/quotas/me',
    });
    expect(resp.status).toBe(401);
  });
});

describe('GET /api/v1/admin/quotas/:orgId', () => {
  it('returns a single-org snapshot to a SUPER_ADMIN', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      id: ORG_ID,
      name: 'Acme Carbon',
      slug: 'acme-carbon',
    });
    mockPrisma.subscription.findFirst.mockResolvedValue({
      plan: 'ENTERPRISE_INDIA',
      status: 'ACTIVE',
    });
    mockPrisma.activity.count.mockResolvedValue(7);

    const resp = await callApp({
      method: 'GET',
      url: `/api/v1/admin/quotas/${ORG_ID}`,
      authHeader: makeAuthHeader('SUPER_ADMIN'),
    });

    expect(resp.status).toBe(200);
    const body = resp.body as { data: Record<string, unknown> };
    expect(body.data.orgId).toBe(ORG_ID);
    expect(body.data.plan).toBe('ENTERPRISE_INDIA');
    expect((body.data.usage as { activitiesActive: number }).activitiesActive).toBe(7);
  });

  it('forbids non-SUPER_ADMIN roles', async () => {
    const resp = await callApp({
      method: 'GET',
      url: `/api/v1/admin/quotas/${ORG_ID}`,
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(resp.status).toBe(403);
  });

  it('returns 404 when the org does not exist', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce(null);
    const resp = await callApp({
      method: 'GET',
      url: `/api/v1/admin/quotas/${ORG_ID}`,
      authHeader: makeAuthHeader('SUPER_ADMIN'),
    });
    expect(resp.status).toBe(404);
  });
});

describe('GET /api/v1/admin/quotas (list with utilisation filter)', () => {
  it('filters out orgs whose max-utilisation is below the threshold', async () => {
    mockPrisma.organization.findMany.mockResolvedValueOnce([
      { id: 'org-low', name: 'Low Util', slug: 'low' },
      { id: 'org-high', name: 'High Util', slug: 'high' },
    ]);

    // Each org-snapshot calls subscription.findFirst twice (plan + quotas)
    // and a bunch of count() queries. We simply alternate plan responses
    // and configure usage so the second org breaks the 80% threshold.
    mockPrisma.subscription.findFirst.mockImplementation(async () => ({
      plan: 'MSME_INDIA',
      status: 'ACTIVE',
    }));

    let invocation = 0;
    mockPrisma.emissionsRecord.count.mockImplementation(async () => {
      invocation += 1;
      // First org → 100/1000 = 10%; second org → 950/1000 = 95%.
      return invocation === 1 ? 100 : 950;
    });

    const resp = await callApp({
      method: 'GET',
      url: '/api/v1/admin/quotas',
      authHeader: makeAuthHeader('SUPER_ADMIN'),
    });

    expect(resp.status).toBe(200);
    const body = resp.body as {
      data: Array<{ orgId: string; maxRatio: number }>;
      meta: { total: number; scanned: number; threshold: number };
    };
    expect(body.meta.scanned).toBe(2);
    expect(body.meta.threshold).toBe(0.8);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.orgId).toBe('org-high');
    expect(body.data[0]?.maxRatio).toBeGreaterThanOrEqual(0.8);
  });

  it('returns every org when ?all=true', async () => {
    mockPrisma.organization.findMany.mockResolvedValueOnce([
      { id: 'org-a', name: 'A', slug: 'a' },
      { id: 'org-b', name: 'B', slug: 'b' },
    ]);
    mockPrisma.subscription.findFirst.mockResolvedValue({
      plan: 'MSME_INDIA',
      status: 'ACTIVE',
    });

    const resp = await callApp({
      method: 'GET',
      url: '/api/v1/admin/quotas?all=true',
      authHeader: makeAuthHeader('SUPER_ADMIN'),
    });

    expect(resp.status).toBe(200);
    const body = resp.body as {
      data: Array<{ orgId: string }>;
      meta: { all: boolean };
    };
    expect(body.meta.all).toBe(true);
    expect(body.data).toHaveLength(2);
  });
});
