/**
 * AAT-10D (Wave 10d): tests for the BRSR render route — covers the
 * PDF + XBRL download branches on
 * GET /api/v1/brsr/responses/:year/render?format=pdf|xbrl.
 *
 * Drives the express router directly with supertest-style request
 * forwarding (same pattern as audit-logs.test.ts). We mock Prisma at
 * the @aurex/database boundary so we don't need a live DB connection.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    organization: {
      findUnique: vi.fn(),
    },
    orgMember: {
      findFirst: vi.fn(),
    },
    brsrPrinciple: {
      findMany: vi.fn(),
    },
    brsrResponse: {
      findMany: vi.fn(),
    },
    brsrIndicator: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    onboardingProgress: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import { brsrRouter } from './brsr.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from '../lib/jwt.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/brsr', brsrRouter);
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

function authHeader(): Record<string, string> {
  const token = signAccessToken({
    sub: USER_ID,
    email: 'admin@aurex.in',
    // The route uses requireOrgRole(...), so the global User.role can
    // be anything — the org-scope middleware loads OrgMember.role.
     
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
      path: url.split('?')[0],
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

beforeEach(() => {
  vi.clearAllMocks();
  // Org-scope membership lookup.
  mockPrisma.orgMember.findFirst.mockResolvedValue({
    orgId: ORG_ID,
    role: 'ORG_ADMIN',
  });
  // Org row used to build the filename.
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: ORG_ID,
    name: 'Acme Sustainability Corp',
    slug: 'acme',
  });
  mockPrisma.brsrPrinciple.findMany.mockResolvedValue([
    {
      id: 'p1',
      number: 1,
      title: 'Principle 1',
      description: null,
    },
  ]);
  mockPrisma.brsrResponse.findMany.mockResolvedValue([]);
});

describe('GET /api/v1/brsr/responses/:year/render?format=pdf', () => {
  it('returns application/pdf with the right Content-Disposition filename', async () => {
    const res = await getRequest(
      '/api/v1/brsr/responses/2024/render?format=pdf',
      authHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toBe(
      'attachment; filename="brsr-acme-2024.pdf"',
    );
    expect(res.headers['Content-Length']).toBeDefined();

    const buf = res.body as Buffer;
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('defaults to PDF when ?format is omitted', async () => {
    const res = await getRequest(
      '/api/v1/brsr/responses/2024/render',
      authHeader(),
    );
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toContain('.pdf"');
  });

  it('returns 400 for an out-of-range year', async () => {
    const res = await getRequest(
      '/api/v1/brsr/responses/1899/render?format=pdf',
      authHeader(),
    );
    expect(res.status).toBe(400);
    const body = res.body as Record<string, unknown>;
    expect(body.type).toBe('https://aurex.in/errors/bad-request');
    expect(String(body.detail)).toMatch(/Invalid BRSR year/);
  });
});

describe('GET /api/v1/brsr/responses/:year/render?format=xbrl', () => {
  it('returns application/xml with the right Content-Disposition filename', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([
      {
        id: 'resp-1',
        orgId: ORG_ID,
        indicatorId: 'ind-1',
        fiscalYear: '2024-25',
        value: 'Trained 100 employees',
        notes: null,
        indicator: {
          id: 'ind-1',
          principleId: 'p1',
          section: 'SECTION_C',
          indicatorType: 'ESSENTIAL',
          code: 'P1-E-1',
          title: 'Training on principles',
          description: null,
        },
      },
    ]);

    const res = await getRequest(
      '/api/v1/brsr/responses/2024/render?format=xbrl',
      authHeader(),
    );

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/xml; charset=utf-8');
    expect(res.headers['Content-Disposition']).toBe(
      'attachment; filename="brsr-acme-2024.xbrl"',
    );
    expect(res.headers['Content-Length']).toBeDefined();
    // AAT-R2 / AV4-426: warn-mode XSD validation surfaces via headers.
    expect(res.headers['X-Brsr-Xsd-Valid']).toBe('true');
    expect(res.headers['X-Brsr-Xsd-Version']).toBeDefined();
    expect(res.headers['X-Brsr-Xsd-Placeholder']).toBe('true');

    const xml =
      res.body instanceof Buffer
        ? res.body.toString('utf-8')
        : String(res.body);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<xbrl');
    expect(xml).toContain('xmlns:brsr=');
    expect(xml).toContain('<brsr:P1_E_1');
    expect(xml).toContain('</xbrl>');
  });

  it('returns a JSON envelope with xsdValidation when ?validate=true', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([
      {
        id: 'resp-1',
        orgId: ORG_ID,
        indicatorId: 'ind-1',
        fiscalYear: '2024-25',
        value: 'Trained 100 employees',
        notes: null,
        indicator: {
          id: 'ind-1',
          principleId: 'p1',
          section: 'SECTION_C',
          indicatorType: 'ESSENTIAL',
          code: 'P1-E-1',
          title: 'Training on principles',
          description: null,
        },
      },
    ]);

    const res = await getRequest(
      '/api/v1/brsr/responses/2024/render?format=xbrl&validate=true',
      authHeader(),
    );

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(typeof data.xml).toBe('string');
    expect(String(data.xml)).toContain('<xbrl');
    const xsdValidation = data.xsdValidation as Record<string, unknown>;
    expect(xsdValidation.valid).toBe(true);
    expect(Array.isArray(xsdValidation.errors)).toBe(true);
    expect(xsdValidation.placeholder).toBe(true);
    expect(typeof xsdValidation.xsdVersion).toBe('string');
    expect(data.fiscalYear).toBe('2024-25');
    expect(data.orgSlug).toBe('acme');
  });

  it('returns 400 for an unknown format', async () => {
    const res = await getRequest(
      '/api/v1/brsr/responses/2024/render?format=docx',
      authHeader(),
    );
    expect(res.status).toBe(400);
    const body = res.body as Record<string, unknown>;
    expect(body.type).toBe('https://aurex.in/errors/bad-request');
    expect(String(body.detail)).toMatch(/Invalid format/);
  });
});

describe('auth gating on the render route', () => {
  it('returns 403 when the caller is a viewer (no MAKER/APPROVER/ADMIN)', async () => {
    mockPrisma.orgMember.findFirst.mockResolvedValue({
      orgId: ORG_ID,
      role: 'VIEWER',
    });

    const res = await getRequest(
      '/api/v1/brsr/responses/2024/render?format=pdf',
      authHeader(),
    );
    expect(res.status).toBe(403);
    const body = res.body as Record<string, unknown>;
    expect(String(body.type)).toContain('forbidden');
  });
});
