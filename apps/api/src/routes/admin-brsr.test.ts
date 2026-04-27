/**
 * AAT-R2 / AV4-427 — tests for the admin BRSR assurance-readiness
 * route + service.
 *
 *   POST /api/v1/admin/brsr/responses/:id/assurance
 *
 * Coverage:
 *   - 401 without an admin auth bearer
 *   - 403 for a non-admin user (VIEWER)
 *   - 200 happy path: status updated, assurance audit log emitted
 *   - 400 for an invalid assuranceStatus
 *   - 404 when the response id is unknown
 *   - service-layer: setAssurance writes the AuditLog row with the
 *     before/after diff
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    brsrResponse: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { adminBrsrRouter } from './admin-brsr.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from '../lib/jwt.js';
import { setAssurance } from '../services/brsr.service.js';

const ADMIN_ID = '00000000-0000-0000-0000-0000000000aa';
const ORG_ID = '00000000-0000-0000-0000-0000000000bb';
const RESP_ID = '00000000-0000-0000-0000-0000000000cc';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/brsr', adminBrsrRouter);
  app.use(errorHandler);
  return app;
}

function adminAuthHeader(role = 'SUPER_ADMIN'): Record<string, string> {
  const token = signAccessToken({
    sub: ADMIN_ID,
    email: 'admin@aurex.in',
     
    role: role as any,
  });
  return { authorization: `Bearer ${token}` };
}

interface FakeResponse {
  status: number;
  body: unknown;
}

function call(
  method: 'POST' | 'GET',
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const params = (() => {
      // Trivial path-param extractor for the one route shape we exercise.
      const m = /\/responses\/([^/]+)\/assurance/.exec(path);
      return m ? { id: m[1] as string } : {};
    })();
    const req: Partial<Request> = {
      method,
      url: path,
      originalUrl: path,
      path: path.split('?')[0],
      headers: { 'content-type': 'application/json', ...headers },
      body: body ?? {},
      query: {},
      params,
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
        resolve({ status, body: payload });
        return this as Response;
      },
      send(data?: unknown) {
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

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.brsrResponse.findUnique.mockReset();
  mockPrisma.brsrResponse.update.mockReset();
  mockPrisma.auditLog.create.mockReset();
  mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
});

describe('POST /api/v1/admin/brsr/responses/:id/assurance — auth', () => {
  it('returns 401 without an auth bearer', async () => {
    const res = await call(
      'POST',
      `/api/v1/admin/brsr/responses/${RESP_ID}/assurance`,
      { assuranceStatus: 'limited_assurance' },
      {},
    );
    expect(res.status).toBe(401);
    expect(mockPrisma.brsrResponse.update).not.toHaveBeenCalled();
  });

  it('returns 403 for a VIEWER user', async () => {
    const res = await call(
      'POST',
      `/api/v1/admin/brsr/responses/${RESP_ID}/assurance`,
      { assuranceStatus: 'limited_assurance' },
      adminAuthHeader('VIEWER'),
    );
    expect(res.status).toBe(403);
    expect(mockPrisma.brsrResponse.update).not.toHaveBeenCalled();
  });

  it('accepts ORG_ADMIN (tenant administrator)', async () => {
    mockPrisma.brsrResponse.findUnique.mockResolvedValue({
      id: RESP_ID,
      orgId: ORG_ID,
      assuranceStatus: 'unaudited',
      lastReviewedBy: null,
      lastReviewedAt: null,
    });
    mockPrisma.brsrResponse.update.mockResolvedValue({
      id: RESP_ID,
      orgId: ORG_ID,
      indicatorId: 'ind-1',
      fiscalYear: '2024-25',
      value: 100,
      notes: null,
      createdBy: ADMIN_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      dataProvenance: null,
      evidenceUrls: [],
      assuranceStatus: 'limited_assurance',
      lastReviewedBy: ADMIN_ID,
      lastReviewedAt: new Date(),
    });

    const res = await call(
      'POST',
      `/api/v1/admin/brsr/responses/${RESP_ID}/assurance`,
      { assuranceStatus: 'limited_assurance' },
      adminAuthHeader('ORG_ADMIN'),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.brsrResponse.update).toHaveBeenCalledOnce();
  });
});

describe('POST /api/v1/admin/brsr/responses/:id/assurance — happy path', () => {
  beforeEach(() => {
    mockPrisma.brsrResponse.findUnique.mockResolvedValue({
      id: RESP_ID,
      orgId: ORG_ID,
      assuranceStatus: 'unaudited',
      lastReviewedBy: null,
      lastReviewedAt: null,
    });
    mockPrisma.brsrResponse.update.mockResolvedValue({
      id: RESP_ID,
      orgId: ORG_ID,
      indicatorId: 'ind-1',
      fiscalYear: '2024-25',
      value: 100,
      notes: null,
      createdBy: ADMIN_ID,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-04-01T00:00:00Z'),
      dataProvenance: 'meter:utility-invoice-2025-Q3',
      evidenceUrls: ['https://docs.example.com/invoice-q3.pdf'],
      assuranceStatus: 'reasonable_assurance',
      lastReviewedBy: ADMIN_ID,
      lastReviewedAt: new Date('2026-04-15T00:00:00Z'),
    });
  });

  it('promotes the assurance status and returns the response + previousStatus', async () => {
    const res = await call(
      'POST',
      `/api/v1/admin/brsr/responses/${RESP_ID}/assurance`,
      { assuranceStatus: 'reasonable_assurance' },
      adminAuthHeader('SUPER_ADMIN'),
    );

    expect(res.status).toBe(200);
    const body = res.body as { data: Record<string, unknown> };
    const data = body.data;
    expect(data.previousStatus).toBe('unaudited');
    const responseRow = data.response as Record<string, unknown>;
    expect(responseRow.id).toBe(RESP_ID);
    expect(responseRow.assuranceStatus).toBe('reasonable_assurance');

    // Service-layer should have called update() with the right shape.
    expect(mockPrisma.brsrResponse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RESP_ID },
        data: expect.objectContaining({
          assuranceStatus: 'reasonable_assurance',
          lastReviewedBy: ADMIN_ID,
        }),
      }),
    );

    // Audit log entry recorded with the diff.
    expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
    const auditCall = mockPrisma.auditLog.create.mock.calls[0]?.[0] as {
      data: {
        action: string;
        resource: string;
        resourceId: string;
        oldValue: { assuranceStatus: string };
        newValue: { assuranceStatus: string };
        userId: string;
        orgId: string;
      };
    };
    expect(auditCall.data.action).toBe('brsr.assurance.update');
    expect(auditCall.data.resource).toBe('BrsrResponse');
    expect(auditCall.data.resourceId).toBe(RESP_ID);
    expect(auditCall.data.oldValue.assuranceStatus).toBe('unaudited');
    expect(auditCall.data.newValue.assuranceStatus).toBe('reasonable_assurance');
    expect(auditCall.data.userId).toBe(ADMIN_ID);
    expect(auditCall.data.orgId).toBe(ORG_ID);
  });

  it('rejects an invalid assuranceStatus with 400', async () => {
    const res = await call(
      'POST',
      `/api/v1/admin/brsr/responses/${RESP_ID}/assurance`,
      { assuranceStatus: 'gold_plated' },
      adminAuthHeader('SUPER_ADMIN'),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.brsrResponse.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the response id does not exist', async () => {
    mockPrisma.brsrResponse.findUnique.mockResolvedValue(null);
    const res = await call(
      'POST',
      `/api/v1/admin/brsr/responses/${RESP_ID}/assurance`,
      { assuranceStatus: 'limited_assurance' },
      adminAuthHeader('SUPER_ADMIN'),
    );
    expect(res.status).toBe(404);
    expect(mockPrisma.brsrResponse.update).not.toHaveBeenCalled();
  });

  it('honours an explicit lastReviewedBy / lastReviewedAt override', async () => {
    const otherUserId = '00000000-0000-0000-0000-0000000000ee';
    const reviewIso = '2026-03-10T12:00:00.000Z';
    const res = await call(
      'POST',
      `/api/v1/admin/brsr/responses/${RESP_ID}/assurance`,
      {
        assuranceStatus: 'reasonable_assurance',
        lastReviewedBy: otherUserId,
        lastReviewedAt: reviewIso,
      },
      adminAuthHeader('SUPER_ADMIN'),
    );
    expect(res.status).toBe(200);

    const updateCall = mockPrisma.brsrResponse.update.mock.calls[0]?.[0] as {
      data: { lastReviewedBy: string; lastReviewedAt: Date };
    };
    expect(updateCall.data.lastReviewedBy).toBe(otherUserId);
    expect(updateCall.data.lastReviewedAt.toISOString()).toBe(reviewIso);
  });
});

describe('setAssurance — service-layer audit', () => {
  it('records oldValue and newValue with the full review chain', async () => {
    mockPrisma.brsrResponse.findUnique.mockResolvedValue({
      id: RESP_ID,
      orgId: ORG_ID,
      assuranceStatus: 'internal_review',
      lastReviewedBy: '11111111-1111-1111-1111-111111111111',
      lastReviewedAt: new Date('2026-02-01T10:00:00Z'),
    });
    mockPrisma.brsrResponse.update.mockResolvedValue({
      id: RESP_ID,
      orgId: ORG_ID,
      indicatorId: 'ind-1',
      fiscalYear: '2024-25',
      value: 100,
      notes: null,
      createdBy: ADMIN_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      dataProvenance: null,
      evidenceUrls: [],
      assuranceStatus: 'limited_assurance',
      lastReviewedBy: ADMIN_ID,
      lastReviewedAt: new Date('2026-04-15T00:00:00Z'),
    });

    const result = await setAssurance(RESP_ID, ADMIN_ID, {
      assuranceStatus: 'limited_assurance',
    });

    expect(result.previousStatus).toBe('internal_review');

    const auditCall = mockPrisma.auditLog.create.mock.calls[0]?.[0] as {
      data: {
        oldValue: {
          assuranceStatus: string;
          lastReviewedBy: string | null;
          lastReviewedAt: string | null;
        };
        newValue: {
          assuranceStatus: string;
          lastReviewedBy: string | null;
          lastReviewedAt: string | null;
        };
      };
    };
    expect(auditCall.data.oldValue.assuranceStatus).toBe('internal_review');
    expect(auditCall.data.oldValue.lastReviewedBy).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(auditCall.data.oldValue.lastReviewedAt).toBe(
      '2026-02-01T10:00:00.000Z',
    );
    expect(auditCall.data.newValue.assuranceStatus).toBe('limited_assurance');
    expect(auditCall.data.newValue.lastReviewedBy).toBe(ADMIN_ID);
  });

  it('throws 400 for an invalid status', async () => {
    await expect(
      setAssurance(RESP_ID, ADMIN_ID, {
         
        assuranceStatus: 'unknown_status' as any,
      }),
    ).rejects.toThrow(/Invalid assurance status/);
  });

  it('throws 404 when the response is missing', async () => {
    mockPrisma.brsrResponse.findUnique.mockResolvedValue(null);
    await expect(
      setAssurance(RESP_ID, ADMIN_ID, {
        assuranceStatus: 'limited_assurance',
      }),
    ).rejects.toThrow(/not found/);
  });
});
