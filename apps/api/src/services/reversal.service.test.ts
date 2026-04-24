import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aurex/database before importing the service.
const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    activity: {
      findFirst: vi.fn(),
    },
    creditUnitBlock: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  // $transaction invokes its callback with a tx-like client wired to the
  // same mocks, matching prisma's interactive-transaction signature.
  mock.$transaction.mockImplementation(async (cb: (tx: typeof mock) => unknown) => cb(mock));
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import { draw } from './reversal.service.js';

const REVERSAL_BUFFER_ID = 'a64a0000-0000-4000-8000-000000000003';

const baseInput = {
  activityId: 'act-1',
  evidence: 'Satellite-detected loss of 200 t forest biomass, ref: MRV-2026-04-12',
  actorUserId: 'user-1',
  orgId: 'org-1',
};

describe('reversal.service.draw — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
    );
  });

  it('cancels buffer blocks FIFO and returns drawnUnits', async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: 'act-1',
      orgId: 'org-1',
      isRemoval: true,
      status: 'ISSUING',
    });
    mockPrisma.creditUnitBlock.findMany.mockResolvedValue([
      { id: 'b1', unitCount: 100, issuanceDate: new Date('2026-01-01') },
      { id: 'b2', unitCount: 150, issuanceDate: new Date('2026-02-01') },
    ]);
    mockPrisma.creditUnitBlock.update.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({ id: where.id }),
    );
    mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const result = await draw({ ...baseInput, units: 120 });

    // FIFO: b1 (100) is fully covered first, b2 (150) brings cumulative to 250,
    // so both b1 and b2 are cancelled (whole-block policy).
    expect(mockPrisma.creditUnitBlock.update).toHaveBeenCalledTimes(2);
    expect(result.drawnUnits).toBe(250);
    expect(result.cancelledBlockIds).toEqual(['b1', 'b2']);
    expect(result.bufferRemaining).toBe(0);
    // One Transaction row per cancelled block (per-block ledger model).
    expect(result.transactionIds).toEqual(['tx-1', 'tx-1']);
  });

  it('records a Transaction row of type REVERSAL_DRAW', async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: 'act-1',
      orgId: 'org-1',
      isRemoval: true,
      status: 'REGISTERED',
    });
    mockPrisma.creditUnitBlock.findMany.mockResolvedValue([
      { id: 'b1', unitCount: 500, issuanceDate: new Date('2026-01-01') },
    ]);
    mockPrisma.creditUnitBlock.update.mockResolvedValue({ id: 'b1' });
    mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-99' });

    await draw({ ...baseInput, units: 50 });

    // Per-block ledger (AAT-1 canonical): blockId + toAccountId required;
    // activityId is carried in the narrative, not a column.
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionType: 'REVERSAL_DRAW',
          blockId: 'b1',
          fromAccountId: REVERSAL_BUFFER_ID,
          toAccountId: REVERSAL_BUFFER_ID,
        }),
      }),
    );
  });
});

describe('reversal.service.draw — insufficient buffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
    );
  });

  it('throws 409 when buffer total < requested units', async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: 'act-1',
      orgId: 'org-1',
      isRemoval: true,
      status: 'ISSUING',
    });
    mockPrisma.creditUnitBlock.findMany.mockResolvedValue([
      { id: 'b1', unitCount: 30, issuanceDate: new Date('2026-01-01') },
    ]);

    await expect(draw({ ...baseInput, units: 200 })).rejects.toMatchObject({
      status: 409,
      title: 'Conflict',
    });
    expect(mockPrisma.creditUnitBlock.update).not.toHaveBeenCalled();
  });
});

describe('reversal.service.draw — non-removal activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
    );
  });

  it('throws 400 when activity is not a removal', async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: 'act-1',
      orgId: 'org-1',
      isRemoval: false,
      status: 'ISSUING',
    });

    await expect(draw({ ...baseInput, units: 100 })).rejects.toMatchObject({
      status: 400,
      title: 'Bad Request',
    });
    expect(mockPrisma.creditUnitBlock.findMany).not.toHaveBeenCalled();
  });

  it('throws 404 when activity not found in caller org', async () => {
    mockPrisma.activity.findFirst.mockResolvedValue(null);

    await expect(draw({ ...baseInput, units: 100 })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('throws 400 on invalid units', async () => {
    await expect(draw({ ...baseInput, units: 0 })).rejects.toMatchObject({
      status: 400,
    });
    await expect(draw({ ...baseInput, units: -5 })).rejects.toMatchObject({
      status: 400,
    });
    await expect(draw({ ...baseInput, units: 1.5 })).rejects.toMatchObject({
      status: 400,
    });
  });
});
