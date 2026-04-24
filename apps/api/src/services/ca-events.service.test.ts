import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aurex/database before importing the services under test. vi.mock is
// hoisted, so we construct the mock prisma via vi.hoisted().
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    creditUnitBlock: {
      findUnique: vi.fn(),
    },
    correspondingAdjustmentEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import {
  emitOnFirstTransfer,
  emitOnRetirement,
  listByHostCountry,
  markExported,
} from './ca-events.service.js';
import { purposeToRetirementState } from './transaction.service.js';

describe('purposeToRetirementState — purpose → (status, account) mapping', () => {
  it('NDC → RETIRED_FOR_NDC + RETIREMENT_NDC admin account', () => {
    const r = purposeToRetirementState('NDC');
    expect(r.status).toBe('RETIRED_FOR_NDC');
    expect(r.accountId).toBe('a64a0000-0000-4000-8000-000000000004');
  });

  it('OIMP → RETIRED_FOR_OIMP + RETIREMENT_OIMP admin account', () => {
    const r = purposeToRetirementState('OIMP');
    expect(r.status).toBe('RETIRED_FOR_OIMP');
    expect(r.accountId).toBe('a64a0000-0000-4000-8000-000000000005');
  });

  it('VOLUNTARY → RETIRED_VOLUNTARY + RETIREMENT_VOLUNTARY admin account', () => {
    const r = purposeToRetirementState('VOLUNTARY');
    expect(r.status).toBe('RETIRED_VOLUNTARY');
    expect(r.accountId).toBe('a64a0000-0000-4000-8000-000000000006');
  });
});

describe('emitOnFirstTransfer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips A6_4ER_MC blocks — no row created, returns null', async () => {
    mockPrisma.creditUnitBlock.findUnique.mockResolvedValue({
      id: 'b1',
      unitType: 'A6_4ER_MC',
      authorizationStatus: 'MITIGATION_CONTRIBUTION',
      hostCountry: 'IN',
      vintage: 2025,
      unitCount: 100,
    });

    const result = await emitOnFirstTransfer('b1', 'JP', 100, 'user-1');

    expect(result).toBeNull();
    expect(mockPrisma.correspondingAdjustmentEvent.create).not.toHaveBeenCalled();
  });

  it('skips blocks authorized only for MITIGATION_CONTRIBUTION (belt-and-braces)', async () => {
    // Even if someone minted an A6_4ER block with MC scope (shouldn't happen,
    // but belt-and-braces), we refuse to emit.
    mockPrisma.creditUnitBlock.findUnique.mockResolvedValue({
      id: 'b2',
      unitType: 'A6_4ER',
      authorizationStatus: 'MITIGATION_CONTRIBUTION',
      hostCountry: 'IN',
      vintage: 2025,
      unitCount: 50,
    });

    const result = await emitOnFirstTransfer('b2', 'JP', 50, 'user-1');
    expect(result).toBeNull();
    expect(mockPrisma.correspondingAdjustmentEvent.create).not.toHaveBeenCalled();
  });

  it('returns null when the block does not exist', async () => {
    mockPrisma.creditUnitBlock.findUnique.mockResolvedValue(null);
    const result = await emitOnFirstTransfer('missing', 'JP', 100, 'user-1');
    expect(result).toBeNull();
    expect(mockPrisma.correspondingAdjustmentEvent.create).not.toHaveBeenCalled();
  });

  it('emits a PENDING_EXPORT event for authorized A6_4ER blocks', async () => {
    mockPrisma.creditUnitBlock.findUnique.mockResolvedValue({
      id: 'b3',
      unitType: 'A6_4ER',
      authorizationStatus: 'NDC_USE',
      hostCountry: 'IN',
      vintage: 2025,
      unitCount: 500,
    });
    mockPrisma.correspondingAdjustmentEvent.create.mockResolvedValue({
      id: 'ca-1',
      blockId: 'b3',
      hostCountry: 'IN',
      buyerCountry: 'JP',
      units: 500,
      vintage: 2025,
      status: 'PENDING_EXPORT',
      triggeredAt: new Date('2026-04-01T00:00:00Z'),
    });

    const result = await emitOnFirstTransfer('b3', 'JP', 500, 'user-1');

    expect(mockPrisma.correspondingAdjustmentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        blockId: 'b3',
        hostCountry: 'IN',
        buyerCountry: 'JP',
        units: 500,
        vintage: 2025,
        status: 'PENDING_EXPORT',
      }),
    });
    expect(result?.id).toBe('ca-1');
    expect(result?.status).toBe('PENDING_EXPORT');
  });
});

describe('emitOnRetirement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits PENDING_EXPORT CA event when an authorized A6_4ER block retires for NDC', async () => {
    mockPrisma.creditUnitBlock.findUnique.mockResolvedValue({
      id: 'b4',
      unitType: 'A6_4ER',
      authorizationStatus: 'NDC_AND_OIMP',
      hostCountry: 'KE',
      vintage: 2025,
      unitCount: 200,
    });
    mockPrisma.correspondingAdjustmentEvent.create.mockResolvedValue({
      id: 'ca-2',
      blockId: 'b4',
      hostCountry: 'KE',
      buyerCountry: null,
      units: 200,
      vintage: 2025,
      status: 'PENDING_EXPORT',
      triggeredAt: new Date(),
    });

    const result = await emitOnRetirement('b4', 'NDC', 'user-7');

    expect(mockPrisma.correspondingAdjustmentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        blockId: 'b4',
        hostCountry: 'KE',
        buyerCountry: null,
        vintage: 2025,
        status: 'PENDING_EXPORT',
      }),
    });
    expect(result?.id).toBe('ca-2');
  });

  it('returns null for A6_4ER_MC blocks (no CA on MC retirement)', async () => {
    mockPrisma.creditUnitBlock.findUnique.mockResolvedValue({
      id: 'b5',
      unitType: 'A6_4ER_MC',
      authorizationStatus: 'MITIGATION_CONTRIBUTION',
      hostCountry: 'KE',
      vintage: 2025,
      unitCount: 10,
    });

    const result = await emitOnRetirement('b5', 'OIMP', 'user-7');
    expect(result).toBeNull();
    expect(mockPrisma.correspondingAdjustmentEvent.create).not.toHaveBeenCalled();
  });
});

describe('listByHostCountry + markExported (BTR support hooks)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listByHostCountry filters by host + optional status', async () => {
    mockPrisma.correspondingAdjustmentEvent.findMany.mockResolvedValue([]);
    await listByHostCountry('IN', 'PENDING_EXPORT');

    expect(mockPrisma.correspondingAdjustmentEvent.findMany).toHaveBeenCalledWith({
      where: { hostCountry: 'IN', status: 'PENDING_EXPORT' },
      orderBy: { triggeredAt: 'asc' },
    });
  });

  it('listByHostCountry omits status when not provided', async () => {
    mockPrisma.correspondingAdjustmentEvent.findMany.mockResolvedValue([]);
    await listByHostCountry('IN');

    expect(mockPrisma.correspondingAdjustmentEvent.findMany).toHaveBeenCalledWith({
      where: { hostCountry: 'IN' },
      orderBy: { triggeredAt: 'asc' },
    });
  });

  it('markExported transitions PENDING_EXPORT → EXPORTED and stamps btrExportedAt', async () => {
    mockPrisma.correspondingAdjustmentEvent.findUnique.mockResolvedValue({
      id: 'ca-9',
      status: 'PENDING_EXPORT',
    });
    mockPrisma.correspondingAdjustmentEvent.update.mockResolvedValue({
      id: 'ca-9',
      status: 'EXPORTED',
      btrExportedAt: new Date(),
    });

    const result = await markExported('ca-9');

    expect(mockPrisma.correspondingAdjustmentEvent.update).toHaveBeenCalledWith({
      where: { id: 'ca-9' },
      data: expect.objectContaining({
        status: 'EXPORTED',
        btrExportedAt: expect.any(Date),
      }),
    });
    expect((result as { status: string }).status).toBe('EXPORTED');
  });

  it('markExported is a no-op for events already past PENDING_EXPORT', async () => {
    mockPrisma.correspondingAdjustmentEvent.findUnique.mockResolvedValue({
      id: 'ca-10',
      status: 'EXPORTED',
    });

    const result = await markExported('ca-10');
    // Returns the existing row, does not update.
    expect((result as { id: string }).id).toBe('ca-10');
    expect(mockPrisma.correspondingAdjustmentEvent.update).not.toHaveBeenCalled();
  });
});
