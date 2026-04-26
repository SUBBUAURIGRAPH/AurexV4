/**
 * AAT-R3 / AV4-428, AV4-429, AV4-430, AV4-432 — DPDP route tests.
 *
 * Same handler-style harness as kyc.test.ts (no real HTTP listener).
 * Covers:
 *   - POST /me/consent records via service + audit (AV4-428)
 *   - POST /me/data-export creates DSAR + returns inline export (AV4-430)
 *   - POST /admin/dpdp/breach computes 72h deadline (AV4-432)
 *   - SUPER_ADMIN gate on admin endpoints
 *   - 412 dpdp-consent-required mapping on KYC startVerification (AV4-429)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    consentRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    dataPrincipalRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    dataBreachIncident: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    emissionsRecord: { findMany: vi.fn() },
    retirement: { findMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    orgMember: { findFirst: vi.fn(), findMany: vi.fn() },
    kycVerification: { create: vi.fn() },
    kycVerificationEvent: { create: vi.fn().mockResolvedValue({ id: 'kev' }) },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import { dpdpRouter } from './dpdp.js';
import { kycRouter } from './kyc.js';
import { errorHandler } from '../middleware/error-handler.js';
import { __resetKycAdapterCache } from '../services/kyc/index.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', dpdpRouter);
  app.use('/api/v1/kyc', kycRouter);
  app.use(errorHandler);
  return app;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret-change-me';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';

function tokenFor(role: string): string {
  return jwt.sign(
    { sub: USER_ID, email: 'a@b.com', role, orgId: ORG_ID },
    JWT_SECRET,
    { expiresIn: 60 },
  );
}

interface FakeResponse {
  status: number;
  body: unknown;
}

async function call(
  method: string,
  url: string,
  body: unknown,
  authHeader?: string,
): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const reqHeaders: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (authHeader) reqHeaders['authorization'] = authHeader;

    const req: Partial<Request> = {
      method,
      url,
      originalUrl: url,
      path: url,
      headers: reqHeaders,
      query: {},
      body: body ?? {},
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
});

// ─── AV4-428 — consent ────────────────────────────────────────────────────

describe('POST /api/v1/me/consent (AV4-428)', () => {
  it('records consent and returns 201', async () => {
    mockPrisma.consentRecord.create.mockResolvedValue({
      id: 'cr-1',
      userId: USER_ID,
      purpose: 'marketing_email',
      granted: true,
      grantedAt: new Date(),
      withdrawnAt: null,
      consentText: 'I consent.',
      consentVersion: 'v1',
      ipAddress: '127.0.0.1',
      userAgent: null,
      createdAt: new Date(),
    });

    const res = await call(
      'POST',
      '/api/v1/me/consent',
      {
        purpose: 'marketing_email',
        granted: true,
        consentText: 'I consent.',
        consentVersion: 'v1',
      },
      `Bearer ${tokenFor('ORG_ADMIN')}`,
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.consentRecord.create).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('returns 401 without auth', async () => {
    const res = await call('POST', '/api/v1/me/consent', {
      purpose: 'marketing_email',
      granted: true,
      consentText: 'x',
      consentVersion: 'v1',
    });
    expect(res.status).toBe(401);
  });
});

// ─── AV4-430 — data principal rights ──────────────────────────────────────

describe('POST /api/v1/me/data-export (AV4-430)', () => {
  it('creates an access DSAR and returns inline export payload', async () => {
    mockPrisma.dataPrincipalRequest.create.mockResolvedValue({
      id: 'dsar-1',
      userId: USER_ID,
      requestType: 'access',
      status: 'pending',
      requestNotes: null,
      responseUrl: null,
      responseNotes: null,
      requestedAt: new Date(),
      completedAt: null,
      rejectedAt: null,
      rejectedReason: null,
      handlerUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: 'a@b.com',
      name: 'Alice',
    });
    mockPrisma.emissionsRecord.findMany.mockResolvedValue([]);
    mockPrisma.retirement.findMany.mockResolvedValue([]);
    mockPrisma.consentRecord.findMany.mockResolvedValue([]);

    const res = await call(
      'POST',
      '/api/v1/me/data-export',
      {},
      `Bearer ${tokenFor('VIEWER')}`,
    );

    expect(res.status).toBe(201);
    const body = res.body as {
      data: { request: { id: string }; export: { user: unknown } };
    };
    expect(body.data.request.id).toBe('dsar-1');
    expect(body.data.export.user).toEqual({
      id: USER_ID,
      email: 'a@b.com',
      name: 'Alice',
    });
  });
});

describe('GET /api/v1/admin/dpdp/requests (AV4-430)', () => {
  it('returns 403 for non-SUPER_ADMIN', async () => {
    const res = await call(
      'GET',
      '/api/v1/admin/dpdp/requests',
      undefined,
      `Bearer ${tokenFor('ORG_ADMIN')}`,
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 for SUPER_ADMIN', async () => {
    mockPrisma.dataPrincipalRequest.findMany.mockResolvedValue([]);
    mockPrisma.dataPrincipalRequest.count.mockResolvedValue(0);
    const res = await call(
      'GET',
      '/api/v1/admin/dpdp/requests',
      undefined,
      `Bearer ${tokenFor('SUPER_ADMIN')}`,
    );
    expect(res.status).toBe(200);
  });
});

// ─── AV4-432 — breach incidents ───────────────────────────────────────────

describe('POST /api/v1/admin/dpdp/breach (AV4-432)', () => {
  it('returns 403 for non-SUPER_ADMIN', async () => {
    const res = await call(
      'POST',
      '/api/v1/admin/dpdp/breach',
      {
        severity: 'high',
        description: 'leak',
        affectedDataTypes: ['kyc'],
      },
      `Bearer ${tokenFor('ORG_ADMIN')}`,
    );
    expect(res.status).toBe(403);
  });

  it('returns 201 with reportingDeadline = detectedAt + 72h', async () => {
    const detectedAt = new Date('2026-04-26T00:00:00Z');
    mockPrisma.dataBreachIncident.create.mockResolvedValue({
      id: 'inc-1',
      detectedAt,
      reportedAt: null,
      affectedUserCount: 100,
      affectedDataTypes: ['kyc'],
      severity: 'high',
      description: 'leak',
      containmentNotes: null,
      remediationNotes: null,
      status: 'open',
      reportedToDpb: false,
      dpbReferenceId: null,
      reportedByUserId: USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await call(
      'POST',
      '/api/v1/admin/dpdp/breach',
      {
        detectedAt: detectedAt.toISOString(),
        severity: 'high',
        description: 'leak',
        affectedDataTypes: ['kyc'],
        affectedUserCount: 100,
      },
      `Bearer ${tokenFor('SUPER_ADMIN')}`,
    );

    expect(res.status).toBe(201);
    const body = res.body as { data: { reportingDeadline: string } };
    expect(body.data.reportingDeadline).toBe('2026-04-29T00:00:00.000Z');
  });
});

// ─── AV4-429 — KYC consent gate produces 412 on /api/v1/kyc/verifications ──

describe('AV4-429 — POST /api/v1/kyc/verifications without consent', () => {
  beforeEach(() => {
    process.env.KYC_ADAPTER = 'mock';
    __resetKycAdapterCache();
    // requireOrgScope finds an active org membership.
    mockPrisma.orgMember.findFirst.mockResolvedValue({
      orgId: ORG_ID,
      role: 'ORG_ADMIN',
    });
  });

  it('returns 412 with type=/problems/dpdp-consent-required when no active KYC consent', async () => {
    // No matching consent row.
    mockPrisma.consentRecord.findFirst.mockResolvedValue(null);

    const res = await call(
      'POST',
      '/api/v1/kyc/verifications',
      {
        subjectRef: USER_ID,
        level: 'basic',
        metadata: {},
      },
      `Bearer ${tokenFor('ORG_ADMIN')}`,
    );

    expect(res.status).toBe(412);
    const body = res.body as { type: string; status: number; purpose: string };
    expect(body.type).toBe(
      'https://aurex.in/problems/dpdp-consent-required',
    );
    expect(body.purpose).toBe('kyc_verification');
    // Adapter must not have been allowed to create a KYC row.
    expect(mockPrisma.kycVerification.create).not.toHaveBeenCalled();
  });
});
