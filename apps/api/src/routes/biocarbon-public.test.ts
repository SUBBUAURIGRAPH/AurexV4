import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

// ── Mock @aurex/database before importing anything that depends on it ──────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    methodology: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    issuance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
}));

import { biocarbonPublicRouter } from './biocarbon-public.js';
import { errorHandler } from '../middleware/error-handler.js';
import { _resetCatalogueCacheForTests } from '../services/methodology.service.js';

// ── Test app helper ───────────────────────────────────────────────────────

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/biocarbon', biocarbonPublicRouter);
  app.use(errorHandler);
  return app;
}

interface FakeResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

/**
 * Drive a GET through the express router using a synthetic req/res — same
 * pattern as `awd2-handoff.test.ts`. Captures status, json/end body and
 * any headers set via `setHeader`.
 */
async function getRequest(
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
      // express extracts the path segment from `url`; the router mount
      // strips `/api/v1/biocarbon`. Provide both to be safe.
      headers,
      header: (name: string) => headers[name.toLowerCase()],
      get: ((name: string) => headers[name.toLowerCase()]) as never,
      // The rateLimiter middleware reads req.ip / req.socket.remoteAddress
      // for client identification. Provide a stable test IP.
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

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    code: 'VM0042',
    name: 'Improved Agricultural Land Management',
    version: '2.0',
    category: 'BASELINE_AND_MONITORING',
    registryCategory: 'BCR',
    sectoralScope: 14,
    summary: null,
    referenceUrl: 'https://verra.org/methodologies/vm0042/',
    effectiveFrom: new Date('2023-09-26T00:00:00.000Z'),
    effectiveUntil: null,
    isActive: true,
    isBcrEligible: true,
    gases: ['CO2'],
    notes: 'Improved agricultural land management',
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.methodology.findMany.mockReset();
  _resetCatalogueCacheForTests();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/biocarbon/methodologies', () => {
  it('returns 200 with entries + ETag header', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([makeRow()]);

    const res = await getRequest('/api/v1/biocarbon/methodologies');

    expect(res.status).toBe(200);
    const body = res.body as {
      entries: Array<{ code: string }>;
      etag: string;
      generatedAt: string;
    };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]?.code).toBe('VM0042');
    expect(body.etag).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof body.generatedAt).toBe('string');

    // Strong ETag, quoted, with public cache-control.
    expect(res.headers.ETag).toBe(`"${body.etag}"`);
    expect(res.headers['Cache-Control']).toBe('public, max-age=60');
  });

  it('returns 304 when If-None-Match matches the current ETag', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([makeRow()]);

    // First request: get the ETag.
    const first = await getRequest('/api/v1/biocarbon/methodologies');
    const firstBody = first.body as { etag: string };
    const etag = firstBody.etag;

    // Second request with matching If-None-Match → 304, no body.
    const second = await getRequest('/api/v1/biocarbon/methodologies', {
      'if-none-match': `"${etag}"`,
    });
    expect(second.status).toBe(304);
    expect(second.headers.ETag).toBe(`"${etag}"`);
    expect(second.headers['Cache-Control']).toBe('public, max-age=60');
  });

  it('returns 200 with body when If-None-Match does not match', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([makeRow()]);

    const res = await getRequest('/api/v1/biocarbon/methodologies', {
      'if-none-match': '"deadbeef"',
    });
    expect(res.status).toBe(200);
    const body = res.body as { entries: unknown[]; etag: string };
    expect(body.entries).toHaveLength(1);
    expect(body.etag).not.toBe('deadbeef');
  });

  it('returns an empty entries array when the catalogue is empty (does not 404)', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([]);

    const res = await getRequest('/api/v1/biocarbon/methodologies');
    expect(res.status).toBe(200);
    const body = res.body as { entries: unknown[]; etag: string };
    expect(body.entries).toEqual([]);
    expect(body.etag).toMatch(/^[0-9a-f]{64}$/);
  });
});
