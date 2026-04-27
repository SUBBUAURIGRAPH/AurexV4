/**
 * AAT-9C / Wave 9c — route tests for GET /api/v1/retirements.
 *
 * Same fake-prisma + synthetic supertest pattern as billing.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    retirement: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    orgMember: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { retirementsRouter } from './retirements.js';
import { errorHandler } from '../middleware/error-handler.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/retirements', retirementsRouter);
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
  headers: Record<string, string>;
}

interface RequestOpts {
  url: string;
  authHeader?: string;
}

async function getJson(opts: RequestOpts): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const respHeaders: Record<string, string> = {};
    const reqHeaders: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.authHeader) reqHeaders['authorization'] = opts.authHeader;

    const req: Partial<Request> = {
      method: 'GET',
      url: opts.url,
      originalUrl: opts.url,
      path: opts.url,
      headers: reqHeaders,
      query: extractQuery(opts.url),
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
        resolve({ status, body: payload, headers: respHeaders });
        return this as Response;
      },
      send(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload, headers: respHeaders });
        return this as Response;
      },
      end(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload, headers: respHeaders });
        return this as Response;
      },
      setHeader(name: string, value: string) {
        respHeaders[String(name).toLowerCase()] = String(value);
        return res as Response;
      },
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
  const search = url.slice(idx + 1);
  for (const part of search.split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
  }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: requireOrgScope's prisma.orgMember.findFirst lookup must
  // succeed so the route reaches the handler. Tests can override.
  mockPrisma.orgMember.findFirst.mockResolvedValue({ orgId: ORG_ID, role: 'ORG_ADMIN' });
});

describe('GET /api/v1/retirements', () => {
  it('returns paginated retirements scoped to the caller org', async () => {
    mockPrisma.retirement.findMany.mockResolvedValue([
      {
        id: 'ret-1',
        issuanceId: 'iss-1',
        bcrSerialId: 'BCR-IND-2024-VM0042-V1-0001',
        tonnesRetired: 100,
        vintage: 2024,
        purpose: 'CSR',
        retiredByUserId: USER_ID,
        retiredByOrgId: ORG_ID,
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
    mockPrisma.retirement.count.mockResolvedValue(1);

    const res = await getJson({
      url: '/api/v1/retirements',
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { items: Array<{ id: string }>; total: number; page: number; pageSize: number };
    };
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1);
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBe(25);

    const args = mockPrisma.retirement.findMany.mock.calls[0]![0] as Record<string, unknown>;
    const where = args.where as { retiredByOrgId: string };
    expect(where.retiredByOrgId).toBe(ORG_ID);
  });

  it('honors page + pageSize query params and computes skip', async () => {
    mockPrisma.retirement.findMany.mockResolvedValue([]);
    mockPrisma.retirement.count.mockResolvedValue(0);

    await getJson({
      url: '/api/v1/retirements?page=3&pageSize=10',
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    const args = mockPrisma.retirement.findMany.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });

  it('returns 401 without auth', async () => {
    const res = await getJson({ url: '/api/v1/retirements' });
    expect(res.status).toBe(401);
  });

  // ── AV4-437 — CBAM disclaimer surfaced on every retirement response ──
  it('surfaces CBAM disclaimer on the list response (AV4-437)', async () => {
    mockPrisma.retirement.findMany.mockResolvedValue([]);
    mockPrisma.retirement.count.mockResolvedValue(0);

    const res = await getJson({
      url: '/api/v1/retirements',
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(200);
    const body = res.body as {
      cbamDisclaimer: { text: string; applicable: boolean; effectiveFrom: string };
    };
    expect(body.cbamDisclaimer).toBeDefined();
    expect(body.cbamDisclaimer.applicable).toBe(true);
    expect(body.cbamDisclaimer.effectiveFrom).toBe('2026-01-01');
    expect(body.cbamDisclaimer.text).toContain('CBAM');
    expect(body.cbamDisclaimer.text).toContain('EU');
  });
});

// ── AV4-437 — GET /:id detail (CBAM disclaimer + 404) ─────────────────────

describe('GET /api/v1/retirements/:id', () => {
  const RETIREMENT_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';

  it('returns the retirement with cbamDisclaimer when found', async () => {
    mockPrisma.retirement.findFirst.mockResolvedValue({
      id: RETIREMENT_ID,
      issuanceId: 'iss-1',
      bcrSerialId: 'BCR-IND-2024-VM0042-V1-0001',
      tonnesRetired: 100,
      vintage: 2024,
      purpose: 'CSR',
      purposeNarrative: null,
      retiredFor: { name: 'Acme' },
      retiredByUserId: USER_ID,
      retiredByOrgId: ORG_ID,
      txHash: '0xfeed',
      status: 'CHAIN_BURNED',
      createdAt: new Date('2026-02-15T10:00:00.000Z'),
      issuance: {
        id: 'iss-1',
        activityId: 'act-1',
        vintage: 2024,
        bcrSerialId: 'BCR-IND-2024-VM0042-V1-0001',
        status: 'ISSUED',
      },
    });

    const res = await getJson({
      url: `/api/v1/retirements/${RETIREMENT_ID}`,
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { id: string };
      cbamDisclaimer: { text: string; applicable: boolean; effectiveFrom: string };
    };
    expect(body.data.id).toBe(RETIREMENT_ID);
    expect(body.cbamDisclaimer.applicable).toBe(true);
    expect(body.cbamDisclaimer.effectiveFrom).toBe('2026-01-01');
    expect(body.cbamDisclaimer.text).toMatch(/CBAM/);

    // Verify org-scope was applied.
    const args = mockPrisma.retirement.findFirst.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    const where = args.where as { id: string; retiredByOrgId: string };
    expect(where.id).toBe(RETIREMENT_ID);
    expect(where.retiredByOrgId).toBe(ORG_ID);
  });

  it('returns 404 when retirement is missing or in another org', async () => {
    mockPrisma.retirement.findFirst.mockResolvedValue(null);
    const res = await getJson({
      url: `/api/v1/retirements/${RETIREMENT_ID}`,
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when id is not a UUID', async () => {
    const res = await getJson({
      url: '/api/v1/retirements/not-a-uuid',
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(400);
  });
});

// ── AV4-437 — GET /:id/statement.pdf — PDF includes CBAM disclaimer ───────

describe('GET /api/v1/retirements/:id/statement.pdf', () => {
  const RETIREMENT_ID = '00000000-0000-4000-8000-bbbbbbbbbbbb';

  it('renders a PDF that contains the CBAM disclaimer text', async () => {
    mockPrisma.retirement.findFirst.mockResolvedValue({
      id: RETIREMENT_ID,
      issuanceId: 'iss-1',
      bcrSerialId: 'BCR-IND-2024-VM0042-V1-0001',
      tonnesRetired: 100,
      vintage: 2024,
      purpose: 'CSR',
      purposeNarrative: 'Q1 2026 CSR disclosure',
      retiredFor: { name: 'Acme Manufacturing' },
      retiredByUserId: USER_ID,
      retiredByOrgId: ORG_ID,
      txHash: '0xdeadbeef',
      status: 'CHAIN_BURNED',
      createdAt: new Date('2026-02-15T10:00:00.000Z'),
      issuance: {
        id: 'iss-1',
        bcrSerialId: 'BCR-IND-2024-VM0042-V1-0001',
        vintage: 2024,
      },
    });

    const res = await getJson({
      url: `/api/v1/retirements/${RETIREMENT_ID}/statement.pdf`,
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(
      `retirement-${RETIREMENT_ID}.pdf`,
    );

    // Body is a Buffer; PDFs start with "%PDF-".
    const buf = res.body as Buffer;
    expect(Buffer.isBuffer(buf)).toBe(true);
    const head = buf.subarray(0, 5).toString('utf-8');
    expect(head).toBe('%PDF-');

    // Spot-check the disclaimer text + effective date appear in the
    // raw PDF stream. Helvetica strings in pdfkit are stored as
    // ASCII inside content streams, so a substring search is reliable.
    const raw = buf.toString('latin1');
    expect(raw).toContain('EU importers');
    expect(raw).toContain('CBAM');
    expect(raw).toContain('2026-01-01');
  });

  it('returns 404 when retirement is missing or in another org', async () => {
    mockPrisma.retirement.findFirst.mockResolvedValue(null);
    const res = await getJson({
      url: `/api/v1/retirements/${RETIREMENT_ID}/statement.pdf`,
      authHeader: makeAuthHeader('ORG_ADMIN'),
    });
    expect(res.status).toBe(404);
  });
});
