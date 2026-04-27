/**
 * AAT-9C / Wave 9c — route tests for the new GET /api/v1/kyc/verifications
 * list endpoint (persistence audit P1).
 *
 * Surgical: only the new list endpoint is covered here. The existing
 * verifications POST/GET-by-id + revoke routes are exercised in
 * services/kyc/kyc.service tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    kycVerification: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    orgMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { kycRouter } from './kyc.js';
import { errorHandler } from '../middleware/error-handler.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/kyc', kycRouter);
  app.use(errorHandler);
  return app;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret-change-me';
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function makeAuthHeader(role: string): string {
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
  // requireOrgScope path: orgMember.findFirst → membership row.
  mockPrisma.orgMember.findFirst.mockResolvedValue({ orgId: ORG_ID, role: 'ORG_ADMIN' });
});

describe('GET /api/v1/kyc/verifications', () => {
  it('returns paginated verifications including USER + BENEFICIARY rows', async () => {
    mockPrisma.orgMember.findMany.mockResolvedValue([
      { userId: USER_ID },
      { userId: 'user-2' },
    ]);
    mockPrisma.kycVerification.findMany.mockResolvedValue([
      {
        id: 'kv-1',
        subjectKind: 'USER',
        subjectRef: USER_ID,
        level: 'BASIC',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockPrisma.kycVerification.count.mockResolvedValue(1);

    const res = await getJson(
      '/api/v1/kyc/verifications',
      makeAuthHeader('ORG_ADMIN'),
    );
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { items: Array<{ id: string }>; total: number; page: number; pageSize: number };
    };
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1);
    expect(body.data.pageSize).toBe(25);

    // Both subject-kind branches should be in the OR.
    const args = mockPrisma.kycVerification.findMany.mock.calls[0]![0] as Record<string, unknown>;
    const where = args.where as { OR: Array<{ subjectKind: string }> };
    expect(where.OR).toHaveLength(2);
    expect(where.OR.map((b) => b.subjectKind).sort()).toEqual(['BENEFICIARY', 'USER']);
  });

  it('returns 403 for an OrgMember role not on the allow-list', async () => {
    // Override the global org-scope membership so requireOrgRole sees a
    // role that's not on LIST_ROLES.
    mockPrisma.orgMember.findFirst.mockResolvedValue({ orgId: ORG_ID, role: 'VIEWER' });

    const res = await getJson(
      '/api/v1/kyc/verifications',
      makeAuthHeader('VIEWER'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await getJson('/api/v1/kyc/verifications');
    expect(res.status).toBe(401);
  });
});
