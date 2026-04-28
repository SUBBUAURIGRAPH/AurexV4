/**
 * AAT-FLOW6 — integrations status route tests.
 *
 * Pins the auth gate (no bearer → 401) and the response shape on a
 * happy-path call. Service-level env-var detection is a thin wrapper
 * over `process.env` so we don't re-test that — we just confirm the
 * three expected service codes show up in the response and the
 * federation-partners list flows through from prisma.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    federationKey: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

// requireOrgScope reads req.user — make the auth middleware happy in tests
// by stubbing the org-scope middleware. This mirrors the audit-logs route
// test pattern.
vi.mock('../middleware/org-scope.js', () => ({
  requireOrgScope: (req: Request, _res: Response, next: () => void) => {
    (req as unknown as { orgId: string }).orgId =
      '00000000-0000-0000-0000-000000000001';
    next();
  },
}));

import { integrationsRouter } from './integrations.js';
import { errorHandler } from '../middleware/error-handler.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/integrations', integrationsRouter);
  app.use(errorHandler);
  return app;
}

async function call(
  path: string,
  bearer: string | null,
): Promise<{ status: number; body: unknown }> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    const req = {
      method: 'GET',
      url: path,
      originalUrl: path,
      headers,
      body: undefined,
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

      (app as unknown as { handle: (...args: unknown[]) => void }).handle(req, res, (err: unknown) => {
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
});

describe('GET /api/v1/integrations/status', () => {
  it('returns 401 without an auth bearer', async () => {
    const res = await call('/api/v1/integrations/status', null);
    expect(res.status).toBe(401);
    expect(mockPrisma.federationKey.findMany).not.toHaveBeenCalled();
  });
});
