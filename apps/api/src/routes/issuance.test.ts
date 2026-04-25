/**
 * AAT-9C / Wave 9c — route tests for the new GET /api/v1/issuances/:id
 * direct lookup endpoint (persistence audit P2).
 *
 * Surgical: only the new GET-by-id is covered here. The existing
 * approve / reject / tokenize / delist routes are exercised in
 * services tests + e2e-full-lifecycle.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    issuance: {
      findUnique: vi.fn(),
    },
    orgMember: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { issuanceRouter } from './issuance.js';
import { errorHandler } from '../middleware/error-handler.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/issuances', issuanceRouter);
  app.use(errorHandler);
  return app;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret-change-me';
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ORG_ID = '99999999-9999-9999-9999-999999999999';
const USER_ID = '22222222-2222-2222-2222-222222222222';

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
      query: {},
      ip: '127.0.0.1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (app as any).handle(req as Request, res as Response, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.orgMember.findFirst.mockResolvedValue({ orgId: ORG_ID, role: 'ORG_ADMIN' });
});

describe('GET /api/v1/issuances/:id', () => {
  it('returns the issuance when its activity is owned by the caller org', async () => {
    mockPrisma.issuance.findUnique.mockResolvedValue({
      id: 'iss-1',
      activityId: 'act-1',
      vintage: 2024,
      status: 'ISSUED',
      activity: { id: 'act-1', orgId: ORG_ID, title: 'Acme reforest' },
    });
    const res = await getJson('/api/v1/issuances/iss-1', makeAuthHeader());
    expect(res.status).toBe(200);
    expect((res.body as { data: { id: string } }).data.id).toBe('iss-1');
  });

  it('returns 404 when the issuance belongs to a different org', async () => {
    mockPrisma.issuance.findUnique.mockResolvedValue({
      id: 'iss-2',
      activityId: 'act-2',
      vintage: 2024,
      status: 'ISSUED',
      activity: { id: 'act-2', orgId: OTHER_ORG_ID, title: 'Other org' },
    });
    const res = await getJson('/api/v1/issuances/iss-2', makeAuthHeader());
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await getJson('/api/v1/issuances/iss-1');
    expect(res.status).toBe(401);
  });
});
