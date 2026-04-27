/**
 * AAT-10C (Wave 10c): tests for the report download endpoint with the
 * three formats (json | csv | pdf).
 *
 * Drives the express router directly with a synthetic req/res — same
 * pattern as `audit-logs.test.ts` and `awd2-handoff.test.ts`. We mock
 * `@aurex/database` so the suite stays unit-level and never touches
 * Postgres.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    report: {
      findFirst: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    orgMember: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import { reportRouter } from './reports.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from '../lib/jwt.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reports', reportRouter);
  app.use(errorHandler);
  return app;
}

interface FakeResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

const ORG_ID = '00000000-0000-0000-0000-0000000000aa';
const USER_ID = '00000000-0000-0000-0000-0000000000bb';
const REPORT_ID = '00000000-0000-0000-0000-0000000000cc';

function authHeader(): Record<string, string> {
  const token = signAccessToken({
    sub: USER_ID,
    email: 'jane@aurex.in',
     
    role: 'ORG_ADMIN' as any,
  });
  return { authorization: `Bearer ${token}` };
}

function getRequest(
  url: string,
  headers: Record<string, string> = {},
): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const captured: Record<string, string> = {};
    const req: Partial<Request> = {
      method: 'GET',
      url,
      originalUrl: url,
      path: url,
      headers,
      ip: '127.0.0.1',
       
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
       
      (app as any).handle(req as Request, res as Response, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

interface ReportFixtureOverrides {
  type?: string;
  reportData?: unknown;
  parameters?: unknown;
  status?: string;
  lifecycleStatus?: string;
}

function makeReport(overrides: ReportFixtureOverrides = {}) {
  return {
    id: REPORT_ID,
    orgId: ORG_ID,
    type: 'ghg',
    status: 'COMPLETED',
    lifecycleStatus: 'PUBLISHED',
    parameters: { year: 2025, scopes: ['SCOPE_1', 'SCOPE_2'] },
    reportData: {
      reportType: 'ghg',
      reportYear: 2025,
      summary: {
        totalEmissions: 100,
        unit: 'tCO2e',
        scopeTotals: { SCOPE_1: 60, SCOPE_2: 40 },
        recordCount: 5,
      },
      categoryBreakdown: {
        SCOPE_1: { stationary: 60 },
        SCOPE_2: { electricity: 40 },
      },
    },
    createdBy: USER_ID,
    publishedAt: new Date('2026-04-20T12:00:00.000Z'),
    createdAt: new Date('2026-04-19T08:00:00.000Z'),
    updatedAt: new Date('2026-04-20T12:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.orgMember.findFirst.mockResolvedValue({
    orgId: ORG_ID,
    role: 'ORG_ADMIN',
  });
  mockPrisma.organization.findUnique.mockResolvedValue({ slug: 'acme-co' });
});

describe('GET /api/v1/reports/:id/download (AAT-10C: JSON / CSV / PDF)', () => {
  it('defaults to JSON when ?format is omitted (back-compat)', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(makeReport());

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download`,
      authHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json; charset=utf-8');
    expect(res.headers['Content-Disposition']).toBe(
      `attachment; filename="report-ghg-${REPORT_ID}.json"`,
    );
    expect(res.headers['Content-Length']).toBeDefined();

    const body =
      typeof res.body === 'string'
        ? (JSON.parse(res.body) as Record<string, unknown>)
        : (res.body as Record<string, unknown>);
    expect(body.report).toMatchObject({ id: REPORT_ID, type: 'ghg' });
    expect(body.data).toBeDefined();
    expect(body.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('explicit ?format=json behaves the same as default', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(makeReport());

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=json`,
      authHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json; charset=utf-8');
    expect(res.headers['Content-Disposition']).toMatch(/\.json"$/);
  });

  it('returns text/csv with attachment headers when ?format=csv', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(makeReport());

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=csv`,
      authHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['Content-Disposition']).toBe(
      `attachment; filename="report-ghg-${REPORT_ID}.csv"`,
    );
    expect(res.headers['Content-Length']).toBeDefined();

    const csv =
      res.body instanceof Buffer
        ? res.body.toString('utf-8')
        : String(res.body);
    const [header] = csv.split('\r\n');
    expect(header).toBe(
      'category,source,quantity,unit,factor,emissions_kgco2e',
    );
  });

  it('GHG CSV emits one row per (scope, category) with kg conversion', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(makeReport());

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=csv`,
      authHeader(),
    );

    const csv =
      res.body instanceof Buffer
        ? res.body.toString('utf-8')
        : String(res.body);
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    // 1 header + 2 category rows
    expect(lines).toHaveLength(3);
    // Stationary: SCOPE_1, 60 tCO2e → 60000 kgCO2e
    expect(lines[1]).toBe('stationary,SCOPE_1,60,tCO2e,,60000');
    expect(lines[2]).toBe('electricity,SCOPE_2,40,tCO2e,,40000');
  });

  it('TCFD CSV dumps top-level keys as key,value pairs', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(
      makeReport({
        type: 'tcfd',
        reportData: {
          governance: 'Board oversight in place',
          strategy: 'Aligned to 1.5°C scenario',
          riskManagement: { process: 'integrated' },
        },
      }),
    );

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=csv`,
      authHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Disposition']).toMatch(
      /^attachment; filename="report-tcfd-/,
    );
    const csv =
      res.body instanceof Buffer
        ? res.body.toString('utf-8')
        : String(res.body);
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    expect(lines[0]).toBe('key,value');
    expect(lines).toContain('governance,Board oversight in place');
    expect(lines).toContain('strategy,Aligned to 1.5°C scenario');
    // Nested object is JSON-stringified, then RFC-4180 quoted because of `"`s.
    const riskRow = lines.find((l) => l.startsWith('riskManagement,'));
    expect(riskRow).toBeDefined();
    expect(riskRow).toContain('"{""process"":""integrated""}"');
  });

  it('CDP CSV dumps top-level keys as key,value pairs', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(
      makeReport({
        type: 'cdp',
        reportData: { sector: 'manufacturing', score: 'A-' },
      }),
    );

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=csv`,
      authHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Disposition']).toMatch(
      /^attachment; filename="report-cdp-/,
    );
    const csv =
      res.body instanceof Buffer
        ? res.body.toString('utf-8')
        : String(res.body);
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    expect(lines[0]).toBe('key,value');
    expect(lines).toContain('sector,manufacturing');
    expect(lines).toContain('score,A-');
  });

  it('Custom CSV dumps top-level keys as key,value pairs', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(
      makeReport({
        type: 'custom',
        reportData: { metricA: 12.5, metricB: 'green' },
      }),
    );

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=csv`,
      authHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Disposition']).toMatch(
      /^attachment; filename="report-custom-/,
    );
    const csv =
      res.body instanceof Buffer
        ? res.body.toString('utf-8')
        : String(res.body);
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    expect(lines[0]).toBe('key,value');
    expect(lines).toContain('metricA,12.5');
    expect(lines).toContain('metricB,green');
  });

  it('CSV escapes commas, doubled quotes, and newlines per RFC 4180', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(
      makeReport({
        type: 'custom',
        reportData: {
          'with,comma': 'simple',
          'with"quote': 'a "quoted" b',
          'with\nnewline': 'line1\nline2',
        },
      }),
    );

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=csv`,
      authHeader(),
    );

    const csv =
      res.body instanceof Buffer
        ? res.body.toString('utf-8')
        : String(res.body);
    // Comma in cell → wrapped in quotes
    expect(csv).toContain('"with,comma",simple');
    // Embedded quotes → doubled and the cell is wrapped
    expect(csv).toContain('"with""quote","a ""quoted"" b"');
    // Newlines in either cell → entire cell wrapped in quotes
    expect(csv).toContain('"with\nnewline","line1\nline2"');
  });

  it('returns application/pdf with a non-empty buffer when ?format=pdf', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(makeReport());

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=pdf`,
      authHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toBe(
      `attachment; filename="report-ghg-${REPORT_ID}.pdf"`,
    );
    expect(res.headers['Content-Length']).toBeDefined();

    const buf = res.body as Buffer;
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.byteLength).toBeGreaterThan(100);
    // PDF magic header bytes ("%PDF-")
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('rejects unknown formats with a 400 RFC 7807 problem detail', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(makeReport());

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=xml`,
      authHeader(),
    );

    expect(res.status).toBe(400);
    const body = res.body as Record<string, unknown>;
    expect(body.type).toBe('https://aurex.in/errors/unsupported-format');
    expect(body.status).toBe(400);
    expect(String(body.detail)).toMatch(/xml/i);
    expect(body.supported).toEqual(['json', 'csv', 'pdf']);
    // Must not have hit the DB to load the report — bail before that.
    expect(mockPrisma.report.findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 (RFC 7807) when the report is not found', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(null);

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=csv`,
      authHeader(),
    );

    expect(res.status).toBe(404);
    const body = res.body as Record<string, unknown>;
    expect(body.status).toBe(404);
  });

  it('returns 400 (RFC 7807) when the report is not yet COMPLETED', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(
      makeReport({ status: 'GENERATING' }),
    );

    const res = await getRequest(
      `/api/v1/reports/${REPORT_ID}/download?format=csv`,
      authHeader(),
    );

    expect(res.status).toBe(400);
    const body = res.body as Record<string, unknown>;
    expect(body.status).toBe(400);
    expect(String(body.detail)).toMatch(/GENERATING/);
  });
});
