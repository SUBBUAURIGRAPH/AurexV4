import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock @aurex/database before importing the service under test ──────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    methodology: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
}));

import {
  _resetCatalogueCacheForTests,
  assertBcrEligible,
  findByCode,
  getCatalogue,
  MethodologyNotBcrEligibleError,
  MethodologyNotFoundError,
} from './methodology.service.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

interface MockRow {
  code: string;
  name: string;
  version: string;
  category: string;
  registryCategory: 'A6_4' | 'BCR' | 'VOLUNTARY_OTHER';
  sectoralScope: number | null;
  summary: string | null;
  referenceUrl: string | null;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  isActive: boolean;
  isBcrEligible: boolean;
  gases: string[];
  notes: string | null;
}

function makeRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    code: 'VM0042',
    name: 'Improved Agricultural Land Management',
    version: '2.0',
    category: 'BASELINE_AND_MONITORING',
    registryCategory: 'BCR',
    sectoralScope: 14,
    summary: 'SOC sequestration on cropland.',
    referenceUrl: 'https://verra.org/methodologies/vm0042/',
    effectiveFrom: new Date('2023-09-26T00:00:00.000Z'),
    effectiveUntil: null,
    isActive: true,
    isBcrEligible: true,
    gases: ['CO2'],
    notes: 'SOC sequestration on cropland.',
    ...overrides,
  };
}

const A64_AR_ROW = makeRow({
  code: 'AR-AMS0001',
  name: 'Simplified baseline and monitoring for small-scale A/R',
  version: '06.0',
  category: 'SMALL_SCALE',
  // Per AAT-α: AR-AMS series is BCR-eligible.
  registryCategory: 'BCR',
  isBcrEligible: true,
  effectiveFrom: new Date('2013-04-26T00:00:00.000Z'),
});

const A64_STANDARD_ROW = makeRow({
  code: 'A6.4-AM-AR-001',
  name: 'Afforestation and reforestation (AR)',
  version: '01.0',
  category: 'REMOVAL',
  registryCategory: 'A6_4',
  isBcrEligible: true,
  effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
});

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.methodology.findMany.mockReset();
  mockPrisma.methodology.findFirst.mockReset();
  mockPrisma.methodology.findUnique.mockReset();
  _resetCatalogueCacheForTests();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('getCatalogue', () => {
  it('returns entries normalised + sorted by (category, code, version)', async () => {
    // Prisma orderBy already produces sorted output; the service trusts it.
    // Verify the mapper preserves order and produces correct shape.
    mockPrisma.methodology.findMany.mockResolvedValue([
      A64_STANDARD_ROW,
      makeRow(),
      A64_AR_ROW,
    ]);

    const { entries, etag, generatedAt } = await getCatalogue();

    expect(entries).toHaveLength(3);
    expect(entries[0]?.code).toBe('A6.4-AM-AR-001');
    expect(entries[0]?.category).toBe('A6_4');
    expect(entries[0]?.isA64Eligible).toBe(true);
    expect(entries[1]?.code).toBe('VM0042');
    expect(entries[1]?.category).toBe('BCR');
    expect(entries[1]?.isBcrEligible).toBe(true);
    expect(entries[2]?.code).toBe('AR-AMS0001');
    expect(etag).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof generatedAt).toBe('string');
    // findMany invoked with sort + active-only filter.
    const callArg = mockPrisma.methodology.findMany.mock.calls[0]![0]!;
    expect(callArg.where.isActive).toBe(true);
    expect(callArg.orderBy).toEqual([
      { registryCategory: 'asc' },
      { code: 'asc' },
      { version: 'asc' },
    ]);
  });

  it('ETag is stable across calls when underlying data is unchanged', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([makeRow()]);

    const first = await getCatalogue();
    // Force cache invalidation so the second call hits prisma again.
    _resetCatalogueCacheForTests();
    mockPrisma.methodology.findMany.mockResolvedValue([makeRow()]);
    const second = await getCatalogue();

    expect(second.etag).toBe(first.etag);
  });

  it('ETag changes when underlying data changes', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([makeRow()]);
    const first = await getCatalogue();

    _resetCatalogueCacheForTests();
    mockPrisma.methodology.findMany.mockResolvedValue([
      makeRow(),
      A64_AR_ROW,
    ]);
    const second = await getCatalogue();

    expect(second.etag).not.toBe(first.etag);
    expect(second.entries).toHaveLength(2);
  });

  it('caches results for 60s — second call within window does not re-query Prisma', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([makeRow()]);

    await getCatalogue();
    await getCatalogue();

    expect(mockPrisma.methodology.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('findByCode', () => {
  it('returns the latest version when version is omitted', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([
      makeRow({ version: '1.0' }),
      makeRow({ version: '2.0' }),
      makeRow({ version: '1.5' }),
    ]);

    const result = await findByCode('VM0042');
    expect(result.version).toBe('2.0');
  });

  it('prefers active rows (effectiveUntil IS NULL) over sunset rows even with higher version numbers', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([
      makeRow({ version: '3.0', effectiveUntil: new Date('2024-01-01') }), // sunset
      makeRow({ version: '2.0', effectiveUntil: null }), // active
    ]);

    const result = await findByCode('VM0042');
    expect(result.version).toBe('2.0');
    expect(result.effectiveUntil).toBeNull();
  });

  it('returns the exact match when version is provided', async () => {
    mockPrisma.methodology.findFirst.mockResolvedValue(
      makeRow({ version: '1.5' }),
    );

    const result = await findByCode('VM0042', '1.5');
    expect(result.version).toBe('1.5');
    const callArg = mockPrisma.methodology.findFirst.mock.calls[0]![0]!;
    expect(callArg.where).toEqual({ code: 'VM0042', version: '1.5' });
  });

  it('throws MethodologyNotFoundError when nothing matches (no version)', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([]);
    await expect(findByCode('NONEXISTENT')).rejects.toBeInstanceOf(
      MethodologyNotFoundError,
    );
  });

  it('throws MethodologyNotFoundError when nothing matches (with version)', async () => {
    mockPrisma.methodology.findFirst.mockResolvedValue(null);
    await expect(findByCode('VM0042', '99.9')).rejects.toBeInstanceOf(
      MethodologyNotFoundError,
    );
  });
});

describe('assertBcrEligible', () => {
  it('succeeds for a BCR-eligible Verra-style methodology (VM0042)', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([makeRow()]);
    const result = await assertBcrEligible('VM0042');
    expect(result.code).toBe('VM0042');
    expect(result.isBcrEligible).toBe(true);
  });

  it('succeeds for a BCR-eligible AR-AMS small-scale methodology (AR-AMS0001)', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([A64_AR_ROW]);
    const result = await assertBcrEligible('AR-AMS0001');
    expect(result.code).toBe('AR-AMS0001');
    expect(result.isBcrEligible).toBe(true);
  });

  it('throws MethodologyNotFoundError for an unknown code', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([]);
    await expect(assertBcrEligible('UNKNOWN-METH-XXX')).rejects.toBeInstanceOf(
      MethodologyNotFoundError,
    );
  });

  it('throws MethodologyNotBcrEligibleError when the row exists but is not BCR-eligible', async () => {
    mockPrisma.methodology.findMany.mockResolvedValue([
      makeRow({ isBcrEligible: false }),
    ]);
    await expect(assertBcrEligible('VM0042')).rejects.toBeInstanceOf(
      MethodologyNotBcrEligibleError,
    );
  });
});
