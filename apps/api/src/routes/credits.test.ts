/**
 * AAT-9C / Wave 9c — route tests for the new GET /api/v1/credits/blocks
 * list endpoint (persistence audit P0).
 *
 * Surgical: only the new list endpoint is covered here. The existing
 * single-block + retire/transfer routes are exercised in
 * services/credits.service tests + e2e-full-lifecycle.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    creditUnitBlock: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    creditAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    orgMember: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { creditsRouter } from './credits.js';
import { errorHandler } from '../middleware/error-handler.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/credits', creditsRouter);
  app.use(errorHandler);
  return app;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret-change-me';
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const ACCOUNT_ID = '33333333-3333-3333-3333-333333333333';

function makeAuthHeader(role = 'ORG_ADMIN'): string {
  const token = jwt.sign(
    { sub: USER_ID, email: 'admin@example.com', role, orgId: ORG_ID },
    JWT_SECRET,
    { expiresIn: 60 },
  );
  return `Bearer ${token}`;
}

interface FakeResponse {
  status: number;
  body: unknown;
}

async function getJson(url: string, authHeader?: string): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const reqHeaders: Record<string, string> = { 'content-type': 'application/json' };
    if (authHeader) reqHeaders['authorization'] = authHeader;

    const req: Partial<Request> = {
      method: 'GET',
      url,
      originalUrl: url,
      path: url,
      headers: reqHeaders,
      query: extractQuery(url),
      ip: '127.0.0.1',
       
      socket: { remoteAddress: '127.0.0.1' } as any,
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

function extractQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const out: Record<string, string> = {};
  for (const part of url.slice(idx + 1).split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
  }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.orgMember.findFirst.mockResolvedValue({ orgId: ORG_ID, role: 'ORG_ADMIN' });
});

describe('GET /api/v1/credits/blocks', () => {
  it('returns paginated blocks scoped via holderAccount.orgId', async () => {
    mockPrisma.creditUnitBlock.findMany.mockResolvedValue([
      {
        id: 'blk-1',
        serialFirst: 'A-1',
        serialLast: 'A-100',
        unitCount: 100,
        unitType: 'A6_4ER',
        vintage: 2024,
        activityId: 'act-1',
        hostCountry: 'IN',
        issuanceDate: new Date('2026-04-01'),
        holderAccountId: ACCOUNT_ID,
        authorizationStatus: 'AUTHORIZED',
        retirementStatus: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        holderAccount: { id: ACCOUNT_ID, name: 'Acme Project Account', accountType: 'PROJECT' },
      },
    ]);
    mockPrisma.creditUnitBlock.count.mockResolvedValue(1);

    const res = await getJson('/api/v1/credits/blocks', makeAuthHeader());
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { items: Array<{ id: string }>; total: number; page: number; pageSize: number };
    };
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1);
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBe(25);

    const args = mockPrisma.creditUnitBlock.findMany.mock.calls[0]![0] as Record<string, unknown>;
    const where = args.where as { holderAccount: { orgId: string } };
    expect(where.holderAccount.orgId).toBe(ORG_ID);
  });

  it('forwards the optional accountId filter to prisma', async () => {
    mockPrisma.creditUnitBlock.findMany.mockResolvedValue([]);
    mockPrisma.creditUnitBlock.count.mockResolvedValue(0);

    await getJson(`/api/v1/credits/blocks?accountId=${ACCOUNT_ID}`, makeAuthHeader());
    const args = mockPrisma.creditUnitBlock.findMany.mock.calls[0]![0] as Record<string, unknown>;
    const where = args.where as {
      holderAccount: { orgId: string };
      holderAccountId?: string;
    };
    expect(where.holderAccount.orgId).toBe(ORG_ID);
    expect(where.holderAccountId).toBe(ACCOUNT_ID);
  });

  it('rejects malformed accountId with 400', async () => {
    const res = await getJson('/api/v1/credits/blocks?accountId=not-a-uuid', makeAuthHeader());
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await getJson('/api/v1/credits/blocks');
    expect(res.status).toBe(401);
  });
});
