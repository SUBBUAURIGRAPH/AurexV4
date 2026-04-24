import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    activity: {
      findFirst: vi.fn(),
    },
    baselineScenario: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    baselineEmission: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import { AppError } from '../middleware/error-handler.js';
import {
  approveByDoe,
  computeForYear,
  createScenario,
  submitScenario,
} from './baseline-scenario.service.js';

describe('baseline-scenario.service — createScenario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bumps version from the prior highest version', async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({ id: 'act-1', orgId: 'org-1' });
    // Existing scenario at v2 — next should be v3.
    mockPrisma.baselineScenario.findFirst.mockResolvedValue({ version: 2 });
    mockPrisma.baselineScenario.create.mockResolvedValue({
      id: 'sc-new',
      activityId: 'act-1',
      version: 3,
      status: 'DRAFT',
      emissions: [],
    });

    const result = await createScenario('act-1', 'org-1', 'user-1', {
      narrative: 'Baseline for grid RE replacement',
      methodologyVersion: '04.0',
      emissions: [{ year: 2026, emissionsTco2e: 1000 }],
    });

    expect(mockPrisma.baselineScenario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 3, activityId: 'act-1' }),
      }),
    );
    expect(result.version).toBe(3);
  });

  it('starts at version 1 when no prior scenario exists', async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({ id: 'act-1', orgId: 'org-1' });
    mockPrisma.baselineScenario.findFirst.mockResolvedValue(null);
    mockPrisma.baselineScenario.create.mockResolvedValue({
      id: 'sc-new',
      version: 1,
      emissions: [],
    });

    const result = await createScenario('act-1', 'org-1', 'user-1', {
      narrative: 'First baseline',
      methodologyVersion: '04.0',
      emissions: [{ year: 2026, emissionsTco2e: 500 }],
    });

    expect(mockPrisma.baselineScenario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 1 }),
      }),
    );
    expect(result.version).toBe(1);
  });

  it('throws 404 when the activity is not in the caller org', async () => {
    mockPrisma.activity.findFirst.mockResolvedValue(null);

    const err = await createScenario('act-x', 'org-1', 'user-1', {
      narrative: 'x',
      methodologyVersion: '04.0',
      emissions: [{ year: 2026, emissionsTco2e: 10 }],
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
  });
});

describe('baseline-scenario.service — submitScenario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 400 when the scenario has no emissions', async () => {
    mockPrisma.baselineScenario.findUnique.mockResolvedValue({
      id: 'sc-1',
      status: 'DRAFT',
      activity: { orgId: 'org-1' },
      emissions: [],
    });

    const err = await submitScenario('sc-1', 'org-1', 'user-1').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(400);
    expect(mockPrisma.baselineScenario.update).not.toHaveBeenCalled();
  });

  it('transitions DRAFT → SUBMITTED when emissions present', async () => {
    mockPrisma.baselineScenario.findUnique.mockResolvedValue({
      id: 'sc-1',
      status: 'DRAFT',
      activity: { orgId: 'org-1' },
      emissions: [{ year: 2026, emissionsTco2e: 100 }],
    });
    mockPrisma.baselineScenario.update.mockResolvedValue({
      id: 'sc-1',
      status: 'SUBMITTED',
      emissions: [],
    });

    const result = await submitScenario('sc-1', 'org-1', 'user-1');

    expect(mockPrisma.baselineScenario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sc-1' },
        data: expect.objectContaining({ status: 'SUBMITTED' }),
      }),
    );
    expect(result.status).toBe('SUBMITTED');
  });
});

describe('baseline-scenario.service — approveByDoe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supersedes any prior APPROVED scenario on the same activity', async () => {
    mockPrisma.baselineScenario.findUnique.mockResolvedValue({
      id: 'sc-v2',
      status: 'SUBMITTED',
      activity: { id: 'act-1', orgId: 'org-1' },
    });
    mockPrisma.baselineScenario.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.baselineScenario.update.mockResolvedValue({
      id: 'sc-v2',
      status: 'APPROVED',
      emissions: [],
    });

    const result = await approveByDoe('sc-v2', 'doe-user');

    // updateMany should target the same activity's prior APPROVED rows (excluding self).
    expect(mockPrisma.baselineScenario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activityId: 'act-1',
          status: 'APPROVED',
          id: { not: 'sc-v2' },
        }),
        data: expect.objectContaining({ status: 'SUPERSEDED' }),
      }),
    );
    expect(mockPrisma.baselineScenario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sc-v2' },
        data: expect.objectContaining({
          status: 'APPROVED',
          approvedBy: 'doe-user',
        }),
      }),
    );
    expect(result.status).toBe('APPROVED');
  });

  it('throws 409 when scenario is not in SUBMITTED status', async () => {
    mockPrisma.baselineScenario.findUnique.mockResolvedValue({
      id: 'sc-1',
      status: 'DRAFT',
      activity: { id: 'act-1', orgId: 'org-1' },
    });

    const err = await approveByDoe('sc-1', 'doe-user').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(409);
  });
});

describe('baseline-scenario.service — computeForYear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies the downward-adjustment factor to the raw year emissions', async () => {
    mockPrisma.baselineEmission.findUnique.mockResolvedValue({
      emissionsTco2e: { toString: () => '10000' },
      downwardAdjustmentFactor: { toString: () => '0.9' },
    });

    const result = await computeForYear('sc-1', 2026);

    expect(result).toBeCloseTo(9000, 3);
  });

  it('returns the raw value when factor is 1.0', async () => {
    mockPrisma.baselineEmission.findUnique.mockResolvedValue({
      emissionsTco2e: { toString: () => '5000' },
      downwardAdjustmentFactor: { toString: () => '1.0' },
    });

    const result = await computeForYear('sc-1', 2027);

    expect(result).toBeCloseTo(5000, 3);
  });

  it('throws 400 when no emission row exists for the year', async () => {
    mockPrisma.baselineEmission.findUnique.mockResolvedValue(null);

    const err = await computeForYear('sc-1', 2099).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(400);
    expect((err as AppError).message).toContain('2099');
  });
});
