/**
 * AAT-R4 / AV4-438 — tests for the CSRD ESRS E1-7 admin endpoints.
 *
 *   - GET /api/v1/admin/retirements/csrd-export — auth gate, date range,
 *     CSV column ordering, RFC 7807 on bad inputs.
 *   - POST /api/v1/admin/retirements/backfill-granularity — calls the
 *     service exactly once and surfaces the BackfillResult.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    retirement: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    issuance: {
      findUnique: vi.fn(),
    },
    activity: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import { adminRetirementsRouter } from './admin-retirements.js';
import { CSRD_RETIREMENT_CSV_HEADER } from '../services/retirement-csrd-export.service.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from '../lib/jwt.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/retirements', adminRetirementsRouter);
  app.use(errorHandler);
  return app;
}

interface FakeResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

const ORG_ID = '11111111-2222-4333-8444-555555555555';
const USER_ID = '11111111-2222-4333-8444-666666666666';

function superAdminAuth(): Record<string, string> {
  const token = signAccessToken({
    sub: USER_ID,
    email: 'ops@aurex.in',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: 'SUPER_ADMIN' as any,
  });
  return { authorization: `Bearer ${token}` };
}

function orgAdminAuth(): Record<string, string> {
  const token = signAccessToken({
    sub: USER_ID,
    email: 'admin@example.com',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: 'ORG_ADMIN' as any,
  });
  return { authorization: `Bearer ${token}` };
}

function request(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string> = {},
): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const captured: Record<string, string> = {};
    const req: Partial<Request> = {
      method,
      url,
      originalUrl: url,
      path: url.split('?')[0]!,
      headers,
      ip: '127.0.0.1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket: { remoteAddress: '127.0.0.1' } as any,
    };
    const res: Partial<Response> = {
      status(code: number) {
        status = code;
        return this as Response;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload, headers: captured });
        return this as Response;
      },
      send(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload, headers: captured });
        return this as Response;
      },
      end(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload, headers: captured });
        return this as Response;
      },
      setHeader(name: string, value: string | number | readonly string[]) {
        captured[name] = String(value);
        return res as Response;
      },
      getHeader(name: string) {
        return captured[name];
      },
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

function makeRetirementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-aaaaaaaaaaaa',
    issuanceId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    kycVerificationId: '00000000-0000-4000-8000-cccccccccccc',
    bcrSerialId: 'BCR-1',
    tonnesRetired: 100,
    vintage: 2025,
    purpose: 'CSR',
    purposeNarrative: 'Q1 disclosure',
    retiredFor: { name: 'Acme' },
    retiredByUserId: USER_ID,
    retiredByOrgId: ORG_ID,
    retirementCertificateUrl: null,
    txHash: '0xfeed',
    status: 'CHAIN_BURNED',
    bcrSyncedAt: null,
    methodologyCode: 'AR-AMS-0007',
    projectType: 'arr',
    isRemoval: true,
    bufferPoolContributionPct: 20,
    hostCountryIso: 'KE',
    corsiaEligible: false,
    ccpEligible: false,
    correspondingAdjustmentApplied: false,
    createdAt: new Date('2026-02-15T10:00:00.000Z'),
    updatedAt: new Date('2026-02-15T10:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.retirement.findMany.mockReset();
  mockPrisma.retirement.update.mockReset();
  mockPrisma.issuance.findUnique.mockReset();
  mockPrisma.activity.findUnique.mockReset();
});

// ── auth gate ─────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/retirements/csrd-export — auth gate', () => {
  it('rejects unauthenticated requests with 401 RFC 7807', async () => {
    const res = await request(
      'GET',
      `/api/v1/admin/retirements/csrd-export?orgId=${ORG_ID}&from=2026-01-01&to=2026-04-01`,
    );
    expect(res.status).toBe(401);
    const body = res.body as Record<string, unknown>;
    expect(body.title).toBe('Unauthorized');
  });

  it('rejects ORG_ADMIN with 403 (SUPER_ADMIN-gated)', async () => {
    const res = await request(
      'GET',
      `/api/v1/admin/retirements/csrd-export?orgId=${ORG_ID}&from=2026-01-01&to=2026-04-01`,
      orgAdminAuth(),
    );
    expect(res.status).toBe(403);
  });
});

// ── input validation ──────────────────────────────────────────────────────

describe('GET /api/v1/admin/retirements/csrd-export — input validation', () => {
  it('rejects missing orgId with 400 RFC 7807', async () => {
    const res = await request(
      'GET',
      `/api/v1/admin/retirements/csrd-export?from=2026-01-01&to=2026-04-01`,
      superAdminAuth(),
    );
    expect(res.status).toBe(400);
    const body = res.body as Record<string, unknown>;
    expect(body.type).toBe('https://aurex.in/errors/validation');
  });

  it('rejects malformed from/to with 400 RFC 7807', async () => {
    const res = await request(
      'GET',
      `/api/v1/admin/retirements/csrd-export?orgId=${ORG_ID}&from=not-a-date&to=2026-04-01`,
      superAdminAuth(),
    );
    expect(res.status).toBe(400);
  });

  it('rejects to <= from with 400 RFC 7807', async () => {
    const res = await request(
      'GET',
      `/api/v1/admin/retirements/csrd-export?orgId=${ORG_ID}&from=2026-04-01&to=2026-04-01`,
      superAdminAuth(),
    );
    expect(res.status).toBe(400);
  });
});

// ── happy path CSV ────────────────────────────────────────────────────────

describe('GET /api/v1/admin/retirements/csrd-export — CSV output', () => {
  it('returns text/csv with the ESRS E1-7 column header', async () => {
    mockPrisma.retirement.findMany.mockResolvedValue([
      makeRetirementRow(),
      makeRetirementRow({
        id: '00000000-0000-4000-8000-dddddddddddd',
        methodologyCode: 'AMS-II.G',
        projectType: 'cookstove',
        isRemoval: false,
        bufferPoolContributionPct: null,
        hostCountryIso: 'IN',
      }),
    ]);

    const res = await request(
      'GET',
      `/api/v1/admin/retirements/csrd-export?orgId=${ORG_ID}&from=2026-01-01&to=2026-04-01`,
      superAdminAuth(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['Content-Disposition']).toMatch(
      /^attachment; filename="csrd-retirements-/,
    );
    expect(res.headers['X-Csrd-Row-Count']).toBe('2');

    const csv = String(res.body);
    const [header, row1, row2] = csv.split('\r\n');

    // Column order is load-bearing.
    const expectedHeader = CSRD_RETIREMENT_CSV_HEADER.map((c) => `"${c}"`).join(
      ',',
    );
    expect(header).toBe(expectedHeader);
    expect(header).toContain('retirement_id');
    expect(header).toContain('methodology_code');
    expect(header).toContain('project_type');
    expect(header).toContain('is_removal');
    expect(header).toContain('buffer_pool_pct');
    expect(header).toContain('host_country');
    expect(header).toContain('corsia_eligible');
    expect(header).toContain('ccp_eligible');
    expect(header).toContain('ca_applied');

    // First retirement row carries the granularity values.
    expect(row1).toContain('"AR-AMS-0007"');
    expect(row1).toContain('"arr"');
    expect(row1).toContain('"true"');
    expect(row1).toContain('"KE"');

    // Second row uses different methodology bucket + null buffer.
    expect(row2).toContain('"AMS-II.G"');
    expect(row2).toContain('"cookstove"');
    expect(row2).toContain('"IN"');
  });

  it('honours the date range filter on createdAt', async () => {
    mockPrisma.retirement.findMany.mockResolvedValue([]);
    await request(
      'GET',
      `/api/v1/admin/retirements/csrd-export?orgId=${ORG_ID}&from=2026-01-01&to=2026-04-01`,
      superAdminAuth(),
    );
    expect(mockPrisma.retirement.findMany).toHaveBeenCalledTimes(1);
    const where = mockPrisma.retirement.findMany.mock.calls[0]![0]!.where;
    expect(where.retiredByOrgId).toBe(ORG_ID);
    expect(where.createdAt.gte).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(where.createdAt.lt).toEqual(new Date('2026-04-01T00:00:00.000Z'));
  });

  it('handles zero rows with a header-only CSV body', async () => {
    mockPrisma.retirement.findMany.mockResolvedValue([]);
    const res = await request(
      'GET',
      `/api/v1/admin/retirements/csrd-export?orgId=${ORG_ID}&from=2026-01-01&to=2026-04-01`,
      superAdminAuth(),
    );
    expect(res.status).toBe(200);
    expect(res.headers['X-Csrd-Row-Count']).toBe('0');
    const csv = String(res.body);
    expect(csv.split('\r\n')).toHaveLength(1);
  });
});

// ── backfill ──────────────────────────────────────────────────────────────

describe('POST /api/v1/admin/retirements/backfill-granularity', () => {
  it('updates pre-existing rows that lack methodology/project denormalisation', async () => {
    // Seed a single un-backfilled row, then return [] on the second batch
    // call so the loop terminates.
    mockPrisma.retirement.findMany
      .mockResolvedValueOnce([
        makeRetirementRow({
          id: '00000000-0000-4000-8000-eeeeeeeeeeee',
          methodologyCode: null,
          projectType: null,
          isRemoval: false,
          bufferPoolContributionPct: null,
          hostCountryIso: null,
          corsiaEligible: false,
          ccpEligible: false,
          correspondingAdjustmentApplied: false,
        }),
      ])
      .mockResolvedValueOnce([]);

    mockPrisma.issuance.findUnique.mockResolvedValue({
      id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      activityId: '00000000-0000-4000-8000-fffffffffff0',
    });

    mockPrisma.activity.findUnique.mockResolvedValue({
      id: '00000000-0000-4000-8000-fffffffffff0',
      methodologyId: 'm1',
      technologyType: 'reforestation',
      hostCountry: 'BR',
      isRemoval: true,
      bufferPoolContributionPct: 20,
      methodology: { id: 'm1', code: 'AR-AMS-0007' },
      hostAuthorization: null,
    });

    mockPrisma.retirement.update.mockResolvedValue({});

    const res = await request(
      'POST',
      '/api/v1/admin/retirements/backfill-granularity',
      superAdminAuth(),
    );

    expect(res.status).toBe(200);
    const body = res.body as { data: { scanned: number; updated: number } };
    expect(body.data.scanned).toBe(1);
    expect(body.data.updated).toBe(1);

    expect(mockPrisma.retirement.update).toHaveBeenCalledTimes(1);
    const data = mockPrisma.retirement.update.mock.calls[0]![0]!.data;
    expect(data.methodologyCode).toBe('AR-AMS-0007');
    expect(data.projectType).toBe('arr');
    expect(data.isRemoval).toBe(true);
    expect(data.bufferPoolContributionPct).toBe(20);
    expect(data.hostCountryIso).toBe('BR');
  });

  it('skips rows where the issuance is missing', async () => {
    mockPrisma.retirement.findMany
      .mockResolvedValueOnce([
        makeRetirementRow({
          id: '00000000-0000-4000-8000-eeeeeeeeeeef',
          methodologyCode: null,
          projectType: null,
        }),
      ])
      .mockResolvedValueOnce([]);
    mockPrisma.issuance.findUnique.mockResolvedValue(null);

    const res = await request(
      'POST',
      '/api/v1/admin/retirements/backfill-granularity',
      superAdminAuth(),
    );

    expect(res.status).toBe(200);
    const body = res.body as { data: { skipped: number; updated: number } };
    expect(body.data.skipped).toBe(1);
    expect(body.data.updated).toBe(0);
    expect(mockPrisma.retirement.update).not.toHaveBeenCalled();
  });

  it('is idempotent — empty scan returns zero scanned/updated/skipped/failed', async () => {
    mockPrisma.retirement.findMany.mockResolvedValueOnce([]);
    const res = await request(
      'POST',
      '/api/v1/admin/retirements/backfill-granularity',
      superAdminAuth(),
    );
    expect(res.status).toBe(200);
    const body = res.body as { data: { scanned: number } };
    expect(body.data.scanned).toBe(0);
    expect(mockPrisma.retirement.update).not.toHaveBeenCalled();
  });

  it('rejects non-SUPER_ADMIN with 403', async () => {
    const res = await request(
      'POST',
      '/api/v1/admin/retirements/backfill-granularity',
      orgAdminAuth(),
    );
    expect(res.status).toBe(403);
  });
});
