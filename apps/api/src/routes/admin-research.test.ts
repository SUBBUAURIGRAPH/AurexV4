/**
 * AAT-DEEPRESEARCH — admin-research router tests.
 *
 * Asserts:
 *   - POST /run rejects unauthenticated callers (401)
 *   - POST /run happy path with a stub provider returns the finding +
 *     runId, and persists a SUCCESS row.
 *   - GET /runs returns the persisted rows with filter pass-through.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    regulatoryResearchRun: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

import { adminResearchRouter } from './admin-research.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from '../lib/jwt.js';
import { _setProviderForTests } from '../services/research/research.service.js';
import type {
  ResearchFinding,
  ResearchProvider,
  ResearchQuery,
} from '../services/research/provider.js';

class StubProvider implements ResearchProvider {
  readonly providerName = 'mock' as const;
  research = vi.fn(async (q: ResearchQuery): Promise<ResearchFinding> => ({
    summary: `stub summary for ${q.topic}`,
    keyPoints: ['kp 1', 'kp 2', 'kp 3'],
    citations: [
      {
        title: 'stub source',
        url: 'https://example.com/stub',
      },
    ],
    meta: {
      provider: 'mock',
      model: 'stub-model',
      durationMs: 5,
    },
  }));
  ping = vi.fn(async () => ({ ok: true }));
}

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/research', adminResearchRouter);
  app.use(errorHandler);
  return app;
}

interface FakeResponse {
  status: number;
  body: unknown;
}

const SUPER_ADMIN_ID = '00000000-0000-0000-0000-0000000000aa';

function adminAuthHeader(): Record<string, string> {
  const token = signAccessToken({
    sub: SUPER_ADMIN_ID,
    email: 'admin@aurex.in',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: 'SUPER_ADMIN' as any,
  });
  return { authorization: `Bearer ${token}` };
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
    const req: Partial<Request> = {
      method,
      url: path,
      originalUrl: path,
      path: path.split('?')[0],
      headers: { 'content-type': 'application/json', ...headers },
      // body parser usually populates `body` — supply it directly here
      body: body ?? {},
      query: {},
      params: {},
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
        resolve({ status, body: payload });
        return this as Response;
      },
      send(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      end(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      setHeader() {
        return res as Response;
      },
      getHeader() {
        return undefined;
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

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(mockPrisma.regulatoryResearchRun) as Array<
    keyof typeof mockPrisma.regulatoryResearchRun
  >) {
    mockPrisma.regulatoryResearchRun[key].mockReset();
  }
});

afterEach(() => {
  _setProviderForTests(null);
});

// ─── POST /run ─────────────────────────────────────────────────────────

describe('POST /api/v1/admin/research/run', () => {
  it('returns 401 without an admin auth bearer', async () => {
    const res = await call(
      'POST',
      '/api/v1/admin/research/run',
      { topic: 'BCR procedure changes' },
      {},
    );
    expect(res.status).toBe(401);
    expect(mockPrisma.regulatoryResearchRun.create).not.toHaveBeenCalled();
  });

  it('happy path: returns finding + runId and persists SUCCESS row', async () => {
    const provider = new StubProvider();
    _setProviderForTests(provider);

    mockPrisma.regulatoryResearchRun.create.mockResolvedValueOnce({
      id: 'run-abc',
    });
    mockPrisma.regulatoryResearchRun.update.mockResolvedValueOnce({});

    const res = await call(
      'POST',
      '/api/v1/admin/research/run',
      {
        topic: 'UNFCCC SB-60 outcomes',
        depth: 'deep',
        maxSources: 5,
      },
      adminAuthHeader(),
    );

    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        summary: string;
        keyPoints: string[];
        citations: { url: string }[];
        runId: string;
      };
    };
    expect(body.data.summary).toContain('UNFCCC SB-60 outcomes');
    expect(body.data.keyPoints).toHaveLength(3);
    expect(body.data.citations[0]!.url).toBe('https://example.com/stub');
    expect(body.data.runId).toBe('run-abc');
    expect(provider.research).toHaveBeenCalledTimes(1);

    // Verify persisted PENDING + SUCCESS
    expect(mockPrisma.regulatoryResearchRun.create).toHaveBeenCalledTimes(1);
    const createArg =
      mockPrisma.regulatoryResearchRun.create.mock.calls[0]![0]!;
    expect(createArg.data.topic).toBe('UNFCCC SB-60 outcomes');
    expect(createArg.data.depth).toBe('deep');
    expect(createArg.data.triggeredBy).toBe('admin');

    expect(mockPrisma.regulatoryResearchRun.update).toHaveBeenCalledTimes(1);
    const updateArg =
      mockPrisma.regulatoryResearchRun.update.mock.calls[0]![0]!;
    expect(updateArg.data.status).toBe('SUCCESS');
  });

  it('returns 400 on validation error (topic too short)', async () => {
    _setProviderForTests(new StubProvider());
    const res = await call(
      'POST',
      '/api/v1/admin/research/run',
      { topic: 'x' }, // < 3 chars
      adminAuthHeader(),
    );
    expect(res.status).toBe(400);
  });
});

// ─── GET /runs ─────────────────────────────────────────────────────────

describe('GET /api/v1/admin/research/runs', () => {
  it('returns 401 without an admin auth bearer', async () => {
    const res = await call(
      'GET',
      '/api/v1/admin/research/runs',
      undefined,
      {},
    );
    expect(res.status).toBe(401);
    expect(mockPrisma.regulatoryResearchRun.findMany).not.toHaveBeenCalled();
  });

  it('happy path: returns persisted rows with envelope shape', async () => {
    const rows = [
      {
        id: 'r-1',
        topic: 'UNFCCC SB-60',
        status: 'SUCCESS',
        provider: 'gemini-deep-research',
        model: 'gemini-2.5-pro-deep-research',
      },
      {
        id: 'r-2',
        topic: 'BCR procedure',
        status: 'FAILED',
        provider: 'gemini-deep-research',
        model: 'gemini-2.5-pro',
      },
    ];
    mockPrisma.regulatoryResearchRun.findMany.mockResolvedValueOnce(rows);
    mockPrisma.regulatoryResearchRun.count.mockResolvedValueOnce(2);

    const res = await call(
      'GET',
      '/api/v1/admin/research/runs',
      undefined,
      adminAuthHeader(),
    );

    expect(res.status).toBe(200);
    const body = res.body as {
      data: typeof rows;
      count: number;
      total: number;
      limit: number;
      offset: number;
    };
    expect(body.data).toHaveLength(2);
    expect(body.count).toBe(2);
    expect(body.total).toBe(2);
    expect(body.limit).toBe(25);
    expect(body.offset).toBe(0);
  });
});
