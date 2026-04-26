/**
 * AAT-R3 / AV4-432 — breach incident service tests.
 *
 * Covers: 72h reporting deadline computation, overdue detection, and the
 * "mark reported" lifecycle that auto-fills `reportedAt`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    dataBreachIncident: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import {
  computeReportingDeadline,
  createBreach,
  DPB_REPORTING_WINDOW_HOURS,
  DPB_REPORTING_WINDOW_MS,
  getBreachById,
  getOverdueBreaches,
  listBreaches,
  updateBreach,
} from './breach-reminder.service.js';

const REPORTER_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeBreach(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inc-1',
    detectedAt: new Date('2026-04-26T00:00:00Z'),
    reportedAt: null,
    affectedUserCount: 100,
    affectedDataTypes: ['kyc'],
    severity: 'high',
    description: 'Stolen laptop with KYC samples',
    containmentNotes: null,
    remediationNotes: null,
    status: 'open',
    reportedToDpb: false,
    dpbReferenceId: null,
    reportedByUserId: REPORTER_ID,
    createdAt: new Date('2026-04-26T00:00:00Z'),
    updatedAt: new Date('2026-04-26T00:00:00Z'),
    ...overrides,
  };
}

describe('DPB reporting window constants', () => {
  it('matches DPDP §8 — 72 hours', () => {
    expect(DPB_REPORTING_WINDOW_HOURS).toBe(72);
    expect(DPB_REPORTING_WINDOW_MS).toBe(72 * 60 * 60 * 1000);
  });

  it('computeReportingDeadline = detectedAt + 72h', () => {
    const detectedAt = new Date('2026-04-26T00:00:00Z');
    const deadline = computeReportingDeadline(detectedAt);
    expect(deadline.toISOString()).toBe('2026-04-29T00:00:00.000Z');
  });
});

describe('createBreach', () => {
  it('persists with status=open + reportedToDpb=false + reporter', async () => {
    mockPrisma.dataBreachIncident.create.mockResolvedValue(makeBreach());
    const dto = await createBreach({
      detectedAt: new Date('2026-04-26T00:00:00Z'),
      affectedUserCount: 100,
      affectedDataTypes: ['kyc'],
      severity: 'high',
      description: 'Stolen laptop with KYC samples',
      reportedByUserId: REPORTER_ID,
    });
    expect(dto.status).toBe('open');
    expect(dto.reportedToDpb).toBe(false);
    expect(dto.reportingDeadline).toBe('2026-04-29T00:00:00.000Z');
    expect(dto.affectedDataTypes).toEqual(['kyc']);
  });

  it('returns overdue=true when detectedAt is more than 72h ago', async () => {
    const old = new Date(Date.now() - (DPB_REPORTING_WINDOW_MS + 1000));
    mockPrisma.dataBreachIncident.create.mockResolvedValue(
      makeBreach({ detectedAt: old }),
    );
    const dto = await createBreach({
      detectedAt: old,
      affectedDataTypes: ['kyc'],
      severity: 'high',
      description: 'Backdated incident discovered late',
    });
    expect(dto.overdue).toBe(true);
  });
});

describe('updateBreach — mark reported', () => {
  it('auto-fills reportedAt + flips status to reported when reportedToDpb=true', async () => {
    mockPrisma.dataBreachIncident.findUnique.mockResolvedValue(makeBreach());
    mockPrisma.dataBreachIncident.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        return makeBreach({
          ...args.data,
          reportedAt: args.data.reportedAt ?? new Date(),
        });
      },
    );

    const dto = await updateBreach('inc-1', {
      reportedToDpb: true,
      dpbReferenceId: 'DPB-2026-001',
    });
    expect(dto?.reportedToDpb).toBe(true);
    expect(dto?.status).toBe('reported');
    expect(dto?.dpbReferenceId).toBe('DPB-2026-001');
    expect(dto?.reportedAt).not.toBeNull();
  });

  it('returns null on missing breach id', async () => {
    mockPrisma.dataBreachIncident.findUnique.mockResolvedValue(null);
    const dto = await updateBreach('missing', { status: 'contained' });
    expect(dto).toBeNull();
  });
});

describe('getOverdueBreaches', () => {
  it('queries with reportedToDpb=false AND detectedAt < (now - 72h)', async () => {
    mockPrisma.dataBreachIncident.findMany.mockResolvedValue([]);
    const now = new Date('2026-05-01T00:00:00Z');
    await getOverdueBreaches(now);
    const args = mockPrisma.dataBreachIncident.findMany.mock.calls[0]![0]!;
    expect(args.where.reportedToDpb).toBe(false);
    const cutoff = new Date(now.getTime() - DPB_REPORTING_WINDOW_MS);
    expect((args.where.detectedAt as { lt: Date }).lt.toISOString()).toBe(
      cutoff.toISOString(),
    );
    expect(args.orderBy).toEqual({ detectedAt: 'asc' });
  });

  it('decorates each row with overdue=true + computed deadline', async () => {
    const now = new Date('2026-05-01T00:00:00Z');
    mockPrisma.dataBreachIncident.findMany.mockResolvedValue([
      makeBreach({ detectedAt: new Date('2026-04-26T00:00:00Z') }),
    ]);
    const items = await getOverdueBreaches(now);
    expect(items).toHaveLength(1);
    expect(items[0]!.overdue).toBe(true);
    expect(items[0]!.reportingDeadline).toBe('2026-04-29T00:00:00.000Z');
  });
});

describe('listBreaches / getBreachById', () => {
  it('lists with optional status filter', async () => {
    mockPrisma.dataBreachIncident.findMany.mockResolvedValue([makeBreach()]);
    mockPrisma.dataBreachIncident.count.mockResolvedValue(1);
    const result = await listBreaches({
      status: 'open',
      page: 1,
      pageSize: 10,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]!.status).toBe('open');
  });

  it('getBreachById returns null when missing', async () => {
    mockPrisma.dataBreachIncident.findUnique.mockResolvedValue(null);
    const dto = await getBreachById('missing');
    expect(dto).toBeNull();
  });
});
