/**
 * AAT-DEEPRESEARCH — research.service tests.
 *
 * Mocks @aurex/database with vi.hoisted so the service module sees the
 * fakes when it's imported. We mirror the prisma surface used by the
 * service (regulatoryResearchRun.create / update / findMany / count /
 * findFirst / findUnique).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  _setProviderForTests,
  getRunById,
  listRecentRuns,
  loadLastRunSummary,
  loadRunsLast24h,
  runResearch,
} from './research.service.js';
import type {
  ResearchFinding,
  ResearchProvider,
  ResearchQuery,
} from './provider.js';

// ─── Fake provider ─────────────────────────────────────────────────────

class StubProvider implements ResearchProvider {
  readonly providerName = 'mock' as const;
  research = vi.fn(async (q: ResearchQuery): Promise<ResearchFinding> => ({
    summary: `stub summary for ${q.topic}`,
    keyPoints: ['point a', 'point b'],
    citations: [
      {
        title: 'stub source',
        url: 'https://example.com/stub',
        publishedAt: '2026-04-01T00:00:00Z',
      },
    ],
    meta: {
      provider: 'mock',
      model: 'stub-model',
      durationMs: 42,
      tokensInput: 10,
      tokensOutput: 20,
    },
  }));
  ping = vi.fn(async () => ({ ok: true }));
}

class FailingProvider implements ResearchProvider {
  readonly providerName = 'mock' as const;
  research = vi.fn(async () => {
    throw new Error('upstream exploded');
  });
  ping = vi.fn(async () => ({ ok: false, reason: 'broken' }));
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

// ─── runResearch — happy path ──────────────────────────────────────────

describe('runResearch', () => {
  it('persists a SUCCESS row with citations + tokens after a successful call', async () => {
    const provider = new StubProvider();
    _setProviderForTests(provider);

    mockPrisma.regulatoryResearchRun.create.mockResolvedValueOnce({
      id: 'run-1',
    });
    mockPrisma.regulatoryResearchRun.update.mockResolvedValueOnce({});

    const { finding, runId } = await runResearch(
      { topic: 'UNFCCC SB-60', depth: 'deep' },
      { triggeredBy: 'admin' },
    );

    expect(runId).toBe('run-1');
    expect(finding.summary).toContain('UNFCCC SB-60');
    expect(provider.research).toHaveBeenCalledTimes(1);

    // Initial PENDING insert
    expect(mockPrisma.regulatoryResearchRun.create).toHaveBeenCalledTimes(1);
    const createArg =
      mockPrisma.regulatoryResearchRun.create.mock.calls[0]![0]!;
    expect(createArg.data.topic).toBe('UNFCCC SB-60');
    expect(createArg.data.depth).toBe('deep');
    expect(createArg.data.provider).toBe('mock');
    expect(createArg.data.status).toBe('PENDING');
    expect(createArg.data.triggeredBy).toBe('admin');

    // Flip to SUCCESS with finding payload
    expect(mockPrisma.regulatoryResearchRun.update).toHaveBeenCalledTimes(1);
    const updateArg =
      mockPrisma.regulatoryResearchRun.update.mock.calls[0]![0]!;
    expect(updateArg.where.id).toBe('run-1');
    expect(updateArg.data.status).toBe('SUCCESS');
    expect(updateArg.data.summary).toBe('stub summary for UNFCCC SB-60');
    expect(updateArg.data.keyPoints).toEqual(['point a', 'point b']);
    expect(updateArg.data.tokensInput).toBe(10);
    expect(updateArg.data.tokensOutput).toBe(20);
  });

  it('persists a FAILED row + rethrows when the provider throws', async () => {
    const provider = new FailingProvider();
    _setProviderForTests(provider);

    mockPrisma.regulatoryResearchRun.create.mockResolvedValueOnce({
      id: 'run-2',
    });
    mockPrisma.regulatoryResearchRun.update.mockResolvedValueOnce({});

    await expect(
      runResearch({ topic: 'Verra release' }, { triggeredBy: 'cron' }),
    ).rejects.toThrow('upstream exploded');

    expect(mockPrisma.regulatoryResearchRun.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.regulatoryResearchRun.update).toHaveBeenCalledTimes(1);
    const updateArg =
      mockPrisma.regulatoryResearchRun.update.mock.calls[0]![0]!;
    expect(updateArg.where.id).toBe('run-2');
    expect(updateArg.data.status).toBe('FAILED');
    expect(updateArg.data.errorMessage).toContain('upstream exploded');
  });

  it('still returns the finding when the audit row create fails (best-effort)', async () => {
    const provider = new StubProvider();
    _setProviderForTests(provider);

    // Initial create blows up — service should swallow it.
    mockPrisma.regulatoryResearchRun.create.mockRejectedValueOnce(
      new Error('DB down'),
    );

    const { finding, runId } = await runResearch({ topic: 'BCR' });

    // runId is empty string when persistence failed
    expect(runId).toBe('');
    expect(finding.summary).toContain('BCR');
    // No update is attempted because we have no record id
    expect(mockPrisma.regulatoryResearchRun.update).not.toHaveBeenCalled();
  });
});

// ─── listRecentRuns ────────────────────────────────────────────────────

describe('listRecentRuns', () => {
  it('paginates with default limit + filters by status', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    mockPrisma.regulatoryResearchRun.findMany.mockResolvedValueOnce(rows);
    mockPrisma.regulatoryResearchRun.count.mockResolvedValueOnce(2);

    const result = await listRecentRuns({ status: 'SUCCESS' });

    expect(result.rows).toEqual(rows);
    expect(result.total).toBe(2);

    const findArg =
      mockPrisma.regulatoryResearchRun.findMany.mock.calls[0]![0]!;
    expect(findArg.where.status).toBe('SUCCESS');
    expect(findArg.orderBy).toEqual({ createdAt: 'desc' });
    expect(findArg.take).toBe(25); // default limit
    expect(findArg.skip).toBe(0);
  });

  it('clamps limit to MAX_LIMIT=100', async () => {
    mockPrisma.regulatoryResearchRun.findMany.mockResolvedValueOnce([]);
    mockPrisma.regulatoryResearchRun.count.mockResolvedValueOnce(0);

    await listRecentRuns({ limit: 999 });
    const findArg =
      mockPrisma.regulatoryResearchRun.findMany.mock.calls[0]![0]!;
    expect(findArg.take).toBe(100);
  });

  it('applies topic + since filters', async () => {
    mockPrisma.regulatoryResearchRun.findMany.mockResolvedValueOnce([]);
    mockPrisma.regulatoryResearchRun.count.mockResolvedValueOnce(0);

    const since = new Date('2026-04-01T00:00:00Z');
    await listRecentRuns({ topic: 'BCR', since, offset: 50 });

    const findArg =
      mockPrisma.regulatoryResearchRun.findMany.mock.calls[0]![0]!;
    expect(findArg.where.topic).toEqual({
      contains: 'BCR',
      mode: 'insensitive',
    });
    expect(findArg.where.createdAt).toEqual({ gte: since });
    expect(findArg.skip).toBe(50);
  });
});

// ─── getRunById ────────────────────────────────────────────────────────

describe('getRunById', () => {
  it('returns the row when found', async () => {
    mockPrisma.regulatoryResearchRun.findUnique.mockResolvedValueOnce({
      id: 'r1',
      topic: 'x',
    });
    const row = await getRunById('r1');
    expect(row?.id).toBe('r1');
  });

  it('returns null when not found', async () => {
    mockPrisma.regulatoryResearchRun.findUnique.mockResolvedValueOnce(null);
    expect(await getRunById('r1')).toBeNull();
  });
});

// ─── loadRunsLast24h / loadLastRunSummary ──────────────────────────────

describe('rollups', () => {
  it('loadRunsLast24h aggregates SUCCESS + FAILED counts', async () => {
    mockPrisma.regulatoryResearchRun.count.mockResolvedValueOnce(3);
    mockPrisma.regulatoryResearchRun.count.mockResolvedValueOnce(1);
    const result = await loadRunsLast24h();
    expect(result.success).toBe(3);
    expect(result.failed).toBe(1);
  });

  it('loadRunsLast24h returns zeros if the DB throws', async () => {
    mockPrisma.regulatoryResearchRun.count.mockRejectedValueOnce(
      new Error('boom'),
    );
    const result = await loadRunsLast24h();
    expect(result).toEqual({ success: 0, failed: 0 });
  });

  it('loadLastRunSummary returns ISO timestamps for last SUCCESS + FAILED', async () => {
    const ok = new Date('2026-04-01T10:00:00Z');
    const failed = new Date('2026-03-30T10:00:00Z');
    mockPrisma.regulatoryResearchRun.findFirst.mockResolvedValueOnce({
      createdAt: ok,
    });
    mockPrisma.regulatoryResearchRun.findFirst.mockResolvedValueOnce({
      createdAt: failed,
    });

    const result = await loadLastRunSummary();
    expect(result.lastRunOk).toBe(ok.toISOString());
    expect(result.lastRunFailed).toBe(failed.toISOString());
  });
});
