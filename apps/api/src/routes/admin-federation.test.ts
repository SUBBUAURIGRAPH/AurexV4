/**
 * AAT-367 / AV4-367 — admin-federation router tests.
 *
 * Asserts the SUPER_ADMIN gate fires on the GET /keys listing and the
 * POST /keys registration. Full CRUD happy-path coverage lives at the
 * service layer (identity.service.test.ts) — these tests pin the wiring.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    federationKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

import { adminFederationRouter } from './admin-federation.js';
import { errorHandler } from '../middleware/error-handler.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/federation', adminFederationRouter);
  app.use(errorHandler);
  return app;
}

async function call(
  method: 'POST' | 'GET',
  path: string,
  body: unknown,
  bearer: string | null,
): Promise<{ status: number; body: unknown }> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    const req = {
      method,
      url: path,
      originalUrl: path,
      headers,
      body,
      query: {},
      params: {},
    } as unknown as Request;
    let status = 200;
    let payload: unknown;
    const res = {
      status(code: number) {
        status = code;
        return this as Response;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      setHeader: () => res,
      getHeader: () => undefined,
    } as unknown as Response;
    try {
       
      (app as any).handle(req, res, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.federationKey.findMany.mockReset();
  mockPrisma.federationKey.findUnique.mockReset();
  mockPrisma.federationKey.create.mockReset();
  mockPrisma.federationKey.update.mockReset();
  mockPrisma.auditLog.create.mockReset();
  mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
});

describe('GET /api/v1/admin/federation/keys', () => {
  it('returns 401 without an admin auth bearer', async () => {
    const res = await call('GET', '/api/v1/admin/federation/keys', null, null);
    expect(res.status).toBe(401);
    expect(mockPrisma.federationKey.findMany).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/admin/federation/keys', () => {
  it('returns 401 without an admin auth bearer', async () => {
    const res = await call(
      'POST',
      '/api/v1/admin/federation/keys',
      {
        partner: 'AWD2',
        keyId: 'awd2-prod-2026-04',
        publicKeyPem:
          '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgk\n-----END PUBLIC KEY-----',
      },
      null,
    );
    expect(res.status).toBe(401);
    expect(mockPrisma.federationKey.create).not.toHaveBeenCalled();
  });
});
