/**
 * AAT-10A (Wave 10a): tests for the CSV export branch on
 * GET /api/v1/audit-logs?format=csv.
 *
 * Drives the express router directly with a synthetic req/res — same
 * pattern as awd2-handoff.test.ts / coupons.test.ts. Avoids adding
 * supertest as a runtime dep.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
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

import {
  auditLogRouter,
  AUDIT_CSV_HEADER,
  AUDIT_CSV_ROW_CAP,
} from './audit-logs.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from '../lib/jwt.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/audit-logs', auditLogRouter);
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

function adminAuthHeader(): Record<string, string> {
  const token = signAccessToken({
    sub: USER_ID,
    email: 'admin@aurex.in',
    // matches the requireRole('org_admin', 'super_admin') check on the
    // route — Role enum stores uppercase enum names.
     
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

function makeRow(overrides: Partial<{
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: Date;
}> = {}) {
  return {
    id: 'a1',
    userId: USER_ID,
    action: 'user.update',
    resource: 'User',
    resourceId: '00000000-0000-0000-0000-0000000000cc',
    oldValue: null,
    newValue: { email: 'new@aurex.in' },
    ipAddress: '203.0.113.4',
    createdAt: new Date('2026-04-01T12:34:56.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The requireOrgScope middleware looks up an active membership.
  mockPrisma.orgMember.findFirst.mockResolvedValue({
    orgId: ORG_ID,
    role: 'ORG_ADMIN',
  });
  mockPrisma.organization.findUnique.mockResolvedValue({ slug: 'acme-co' });
  mockPrisma.user.findMany.mockResolvedValue([
    { id: USER_ID, email: 'jane@aurex.in' },
  ]);
});

describe('GET /api/v1/audit-logs?format=csv', () => {
  it('returns text/csv with attachment headers and the spec header row', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(1);
    mockPrisma.auditLog.findMany.mockResolvedValue([makeRow()]);

    const res = await getRequest(
      '/api/v1/audit-logs?format=csv',
      adminAuthHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['Content-Disposition']).toMatch(
      /^attachment; filename="audit-logs-acme-co-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.headers['Content-Length']).toBeDefined();

    const body =
      res.body instanceof Buffer
        ? res.body.toString('utf-8')
        : String(res.body);
    const [header, firstRow] = body.split('\r\n');

    // Header row must match the AAT-10A contract exactly (column order
    // is load-bearing for spreadsheet consumers).
    expect(header).toBe(AUDIT_CSV_HEADER.join(','));
    expect(header).toBe(
      'timestamp,actor,action,resourceKind,resourceId,changeSummary,ipAddress',
    );

    // ISO-8601 timestamp + resolved actor email.
    expect(firstRow).toContain('2026-04-01T12:34:56.000Z');
    expect(firstRow).toContain('jane@aurex.in');
    expect(firstRow).toContain('user.update');
    expect(firstRow).toContain('203.0.113.4');
  });

  it('returns 413 RFC 7807 when matched rows exceed the row cap', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(AUDIT_CSV_ROW_CAP + 1);

    const res = await getRequest(
      '/api/v1/audit-logs?format=csv',
      adminAuthHeader(),
    );

    expect(res.status).toBe(413);
    // findMany must NOT be called once we've decided to bail.
    expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();

    const body = res.body as Record<string, unknown>;
    expect(body.type).toBe('https://aurex.in/errors/payload-too-large');
    expect(body.status).toBe(413);
    expect(String(body.detail)).toMatch(/narrow your filters/i);
    expect(body.cap).toBe(AUDIT_CSV_ROW_CAP);
    expect(body.matched).toBe(AUDIT_CSV_ROW_CAP + 1);
  });

  it('forwards the dateFrom filter into the prisma where clause', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(0);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const since = '2026-03-01T00:00:00Z';
    const res = await getRequest(
      `/api/v1/audit-logs?format=csv&dateFrom=${encodeURIComponent(since)}`,
      adminAuthHeader(),
    );

    expect(res.status).toBe(200);
    // Both calls (count + findMany) must include the org scope and the
    // narrowed createdAt.gte derived from `dateFrom`.
    const countCall = mockPrisma.auditLog.count.mock.calls[0]?.[0] as {
      where: { orgId: string; createdAt: { gte: Date } };
    };
    expect(countCall.where.orgId).toBe(ORG_ID);
    expect(countCall.where.createdAt.gte).toEqual(new Date(since));

    const findCall = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as {
      where: { orgId: string; createdAt: { gte: Date } };
      take: number;
    };
    expect(findCall.where.orgId).toBe(ORG_ID);
    expect(findCall.where.createdAt.gte).toEqual(new Date(since));
    // The CSV branch always pulls up to the cap (pagination is bypassed).
    expect(findCall.take).toBe(AUDIT_CSV_ROW_CAP);
  });

  it('still returns paginated JSON when ?format is omitted (back-compat)', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([makeRow()]);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const res = await getRequest('/api/v1/audit-logs', adminAuthHeader());

    expect(res.status).toBe(200);
    // No Content-Disposition — this is the JSON path.
    expect(res.headers['Content-Disposition']).toBeUndefined();
    const body = res.body as {
      data: Array<{ action: string }>;
      pagination: { page: number; pageSize: number; total: number };
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]?.action).toBe('user.update');
    expect(body.pagination.total).toBe(1);
  });

  it('serializes a system actor when userId/userEmail are both absent', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(1);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      makeRow({ userId: null, ipAddress: null }),
    ]);

    const res = await getRequest(
      '/api/v1/audit-logs?format=csv',
      adminAuthHeader(),
    );

    expect(res.status).toBe(200);
    const body =
      res.body instanceof Buffer
        ? res.body.toString('utf-8')
        : String(res.body);
    const lines = body.split('\r\n');
    const dataRow = lines[1] ?? '';
    // actor column (index 1) should fall back to the literal "system".
    const cells = dataRow.split(',');
    expect(cells[1]).toBe('system');
    // ipAddress column (last) should be an empty cell, not "null".
    expect(dataRow.endsWith(',')).toBe(true);
  });
});
