/**
 * FLOW-REWORK — financials.service tests.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    organizationFinancials: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

import {
  getFinancials,
  upsertFinancials,
  deleteFinancials,
} from './financials.service.js';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

beforeEach(() => {
  vi.clearAllMocks();
});

const ROW = {
  id: 'fin-1',
  orgId: ORG_ID,
  fiscalYear: 2025,
  fiscalYearStartMonth: 4,
  currency: 'INR',
  annualRevenue: '1000000.00',
  totalAssets: null,
  employeeCount: 50,
  contractorCount: null,
  industrySector: null,
  reportingScope: 'standalone',
  notes: null,
  capturedBy: USER_ID,
  capturedAt: new Date('2026-04-27T00:00:00Z'),
  updatedAt: new Date('2026-04-27T00:00:00Z'),
};

describe('getFinancials', () => {
  it('returns null when no financials exist', async () => {
    mockPrisma.organizationFinancials.findUnique.mockResolvedValue(null);
    const result = await getFinancials(ORG_ID);
    expect(result).toBeNull();
  });

  it('returns serialised financials when present', async () => {
    mockPrisma.organizationFinancials.findUnique.mockResolvedValue(ROW);
    const result = await getFinancials(ORG_ID);
    expect(result).toBeTruthy();
    expect(result!.fiscalYear).toBe(2025);
    expect(result!.annualRevenue).toBe('1000000.00');
    expect(result!.employeeCount).toBe(50);
  });
});

describe('upsertFinancials', () => {
  it('upserts with default fiscalYearStartMonth + currency + reportingScope', async () => {
    mockPrisma.organizationFinancials.upsert.mockResolvedValue(ROW);
    await upsertFinancials(ORG_ID, USER_ID, {
      fiscalYear: 2025,
      annualRevenue: 1000000,
      employeeCount: 50,
    });
    expect(mockPrisma.organizationFinancials.upsert).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
      update: expect.objectContaining({
        fiscalYear: 2025,
        fiscalYearStartMonth: 4,
        currency: 'INR',
        reportingScope: 'standalone',
        annualRevenue: 1000000,
        employeeCount: 50,
      }),
      create: expect.objectContaining({
        orgId: ORG_ID,
        capturedBy: USER_ID,
      }),
    });
  });

  it('respects supplied currency + reporting scope', async () => {
    mockPrisma.organizationFinancials.upsert.mockResolvedValue(ROW);
    await upsertFinancials(ORG_ID, USER_ID, {
      fiscalYear: 2025,
      currency: 'USD',
      reportingScope: 'consolidated',
    });
    const call = mockPrisma.organizationFinancials.upsert.mock.calls[0][0];
    expect(call.update.currency).toBe('USD');
    expect(call.update.reportingScope).toBe('consolidated');
  });
});

describe('deleteFinancials', () => {
  it('deletes by orgId', async () => {
    mockPrisma.organizationFinancials.deleteMany.mockResolvedValue({ count: 1 });
    await deleteFinancials(ORG_ID);
    expect(mockPrisma.organizationFinancials.deleteMany).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
    });
  });
});
