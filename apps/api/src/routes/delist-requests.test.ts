/**
 * AAT-9C / Wave 9c — route tests for GET /api/v1/delist-requests.
 *
 * Mirrors retirements.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    delistRequest: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    orgMember: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { delistRequestsRouter } from './delist-requests.js';
import { errorHandler } from '../middleware/error-handler.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/delist-requests', delistRequestsRouter);
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

describe('GET /api/v1/delist-requests', () => {
  it('returns paginated delist requests scoped to the caller org', async () => {
    mockPrisma.delistRequest.findMany.mockResolvedValue([
      {
        id: 'dr-1',
        issuanceId: 'iss-1',
        bcrSerialId: 'BCR-IND-2024-VM0042-V1-0001',
        requestedByUserId: USER_ID,
        requestedByOrgId: ORG_ID,
        reason: 'cancelled',
        status: 'INITIATED',
        createdAt: new Date(),
        updatedAt: new Date(),
        issuance: {
          id: 'iss-1',
          activityId: 'act-1',
          vintage: 2024,
          bcrSerialId: 'BCR-IND-2024-VM0042-V1-0001',
          status: 'ISSUED',
        },
      },
    ]);
    mockPrisma.delistRequest.count.mockResolvedValue(1);

    const res = await getJson('/api/v1/delist-requests', makeAuthHeader('ORG_ADMIN'));
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { items: Array<{ id: string }>; total: number };
    };
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1);

    const args = mockPrisma.delistRequest.findMany.mock.calls[0]![0] as Record<string, unknown>;
    const where = args.where as { requestedByOrgId: string };
    expect(where.requestedByOrgId).toBe(ORG_ID);
  });

  it('returns 401 without auth', async () => {
    const res = await getJson('/api/v1/delist-requests');
    expect(res.status).toBe(401);
  });
});
