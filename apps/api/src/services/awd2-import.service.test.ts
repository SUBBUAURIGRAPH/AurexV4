import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock @aurex/database before importing the service under test ──────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    awd2Handoff: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    methodology: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    activity: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    monitoringPeriod: {
      create: vi.fn(),
    },
    issuance: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: { JsonNull: 'JSON_NULL_SENTINEL' },
}));

import {
  HolderOrgNotFoundError,
  MethodologyNotEligibleError,
  WholeTonViolationError,
  importAwd2Handoff,
  type Awd2HandoffInput,
} from './awd2-import.service.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

const HANDOFF_ID = '00000000-0000-4000-8000-000000000201';
const ORG_ID = '00000000-0000-4000-8000-000000000202';
const METHODOLOGY_ID = '00000000-0000-4000-8000-000000000203';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000000204';
const PERIOD_ID = '00000000-0000-4000-8000-000000000205';
const ISSUANCE_ID = '00000000-0000-4000-8000-000000000206';

function makeInput(overrides: Partial<Awd2HandoffInput> = {}): Awd2HandoffInput {
  return {
    awd2HandoffId: HANDOFF_ID,
    handoffNonce: 'nonce-aaaa-bbbb-cccc',
    awd2ContractAddress: '0xabcdef0123456789abcdef0123456789abcdef01',
    awd2TokenId: '12345',
    bcrSerialId: 'BCR-IND-2024-AR-VM0042-V1-0001',
    vintage: 2024,
    methodologyCode: 'VM0042',
    projectId: 'AWD2-PROJ-7891',
    projectTitle: 'Imported Reforestation Project',
    tonnes: 500,
    currentHolderOrgId: ORG_ID,
    provenanceHash:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    handoffEmittedAt: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  };
}

function makeHandoffRow(overrides: Record<string, unknown> = {}) {
  return {
    id: HANDOFF_ID,
    handoffNonce: 'nonce-aaaa-bbbb-cccc',
    status: 'RECEIVED',
    issuanceId: null,
    importedAt: null,
    ...overrides,
  };
}

function makeMethodology(overrides: Record<string, unknown> = {}) {
  return {
    id: METHODOLOGY_ID,
    code: 'VM0042',
    name: 'Improved Agricultural Land Management',
    version: '2.0',
    category: 'BASELINE_AND_MONITORING',
    registryCategory: 'BCR',
    sectoralScope: 14,
    summary: null,
    referenceUrl: 'https://verra.org/',
    effectiveFrom: new Date('2023-09-26T00:00:00.000Z'),
    effectiveUntil: null,
    isActive: true,
    isBcrEligible: true,
    gases: ['CO2'],
    notes: null,
    ...overrides,
  };
}

/**
 * AAT-π / AV4-368: stage both reads the awd2 service now performs:
 *   1. methodology.service.findByCode → prisma.methodology.findMany
 *   2. awd2-import.service local id lookup → prisma.methodology.findUnique
 * Returning null from either is the "missing" path.
 */
function stageMethodologyLookup(
  result: ReturnType<typeof makeMethodology> | null,
): void {
  mockPrisma.methodology.findMany.mockResolvedValue(result ? [result] : []);
  mockPrisma.methodology.findUnique.mockResolvedValue(result);
  // Keep findFirst staged for legacy assertions in tests that still
  // reference it directly. Returns same row.
  mockPrisma.methodology.findFirst.mockResolvedValue(result);
}

function makeOrg(overrides: Record<string, unknown> = {}) {
  return { id: ORG_ID, name: 'Holder Org', isActive: true, ...overrides };
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    orgId: ORG_ID,
    methodologyId: METHODOLOGY_ID,
    awd2ProjectRef: 'AWD2-PROJ-7891',
    title: 'Imported Reforestation Project',
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.awd2Handoff.findUnique.mockReset();
  mockPrisma.awd2Handoff.update.mockReset();
  mockPrisma.methodology.findFirst.mockReset();
  mockPrisma.methodology.findUnique.mockReset();
  mockPrisma.methodology.findMany.mockReset();
  mockPrisma.organization.findUnique.mockReset();
  mockPrisma.activity.findFirst.mockReset();
  mockPrisma.activity.create.mockReset();
  mockPrisma.monitoringPeriod.create.mockReset();
  mockPrisma.issuance.create.mockReset();
  mockPrisma.auditLog.create.mockReset();
  mockPrisma.$transaction.mockReset();

  // Default: $transaction passes a tx with the same model methods.
  mockPrisma.$transaction.mockImplementation(async (cb: unknown) => {
    const tx = {
      monitoringPeriod: mockPrisma.monitoringPeriod,
      issuance: mockPrisma.issuance,
      awd2Handoff: mockPrisma.awd2Handoff,
    };
    return (cb as (t: typeof tx) => Promise<unknown>)(tx);
  });

  mockPrisma.auditLog.create.mockResolvedValue({});
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('importAwd2Handoff — happy path', () => {
  it('creates a synthetic Activity, MonitoringPeriod and Issuance with MINTED + AWD2 contract ref', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    stageMethodologyLookup(makeMethodology());
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockPrisma.activity.findFirst.mockResolvedValue(null); // first import
    mockPrisma.activity.create.mockResolvedValue(makeActivity());
    mockPrisma.monitoringPeriod.create.mockResolvedValue({
      id: PERIOD_ID,
      activityId: ACTIVITY_ID,
    });
    mockPrisma.issuance.create.mockResolvedValue({
      id: ISSUANCE_ID,
      activityId: ACTIVITY_ID,
    });
    mockPrisma.awd2Handoff.update.mockResolvedValue({
      id: HANDOFF_ID,
      status: 'IMPORTED',
      issuanceId: ISSUANCE_ID,
    });

    const result = await importAwd2Handoff(makeInput());

    expect(result.status).toBe('imported');
    expect(result.issuanceId).toBe(ISSUANCE_ID);
    expect(result.awd2HandoffId).toBe(HANDOFF_ID);

    // Issuance was created with MINTED status + composite AWD2 contract ref.
    expect(mockPrisma.issuance.create).toHaveBeenCalledTimes(1);
    const issuanceArg = mockPrisma.issuance.create.mock.calls[0]![0]!;
    expect(issuanceArg.data.tokenizationStatus).toBe('MINTED');
    expect(issuanceArg.data.tokenizationContractId).toBe(
      '0xabcdef0123456789abcdef0123456789abcdef01:12345',
    );
    expect(issuanceArg.data.bcrSerialId).toBe('BCR-IND-2024-AR-VM0042-V1-0001');
    expect(issuanceArg.data.bcrLockId).toMatch(/^AWD2-LOCK-/);
    expect(issuanceArg.data.tokenizedAt).toEqual(new Date('2026-04-01T00:00:00Z'));
    expect(issuanceArg.data.netUnits).toBe(500);
    expect(issuanceArg.data.grossUnits).toBe(500);
    expect(issuanceArg.data.sopLevyUnits).toBe(0);
    expect(issuanceArg.data.omgeCancelledUnits).toBe(0);
    expect(issuanceArg.data.vintage).toBe(2024);
    expect(issuanceArg.data.unitType).toBe('A6_4ER');
    expect(issuanceArg.data.status).toBe('ISSUED');

    // Handoff row was marked IMPORTED.
    const handoffUpdates = mockPrisma.awd2Handoff.update.mock.calls;
    const importedCall = handoffUpdates.find(
      (call) => (call[0] as { data: { status?: string } }).data.status === 'IMPORTED',
    );
    expect(importedCall).toBeDefined();
    expect(
      (importedCall![0] as { data: { issuanceId?: string } }).data.issuanceId,
    ).toBe(ISSUANCE_ID);

    // Audit log records the import.
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    const auditArg = mockPrisma.auditLog.create.mock.calls[0]![0]!;
    expect(auditArg.data.action).toBe('awd2.handoff.imported');
    expect(auditArg.data.resource).toBe('awd2_handoff');
  });
});

describe('importAwd2Handoff — methodology eligibility', () => {
  it('throws MethodologyNotEligibleError when methodology not found', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    stageMethodologyLookup(null);
    mockPrisma.awd2Handoff.update.mockResolvedValue({});

    await expect(importAwd2Handoff(makeInput())).rejects.toBeInstanceOf(
      MethodologyNotEligibleError,
    );

    // Handoff was marked FAILED with a structured reason.
    const failCall = mockPrisma.awd2Handoff.update.mock.calls.find(
      (c) => (c[0] as { data: { status?: string } }).data.status === 'FAILED',
    );
    expect(failCall).toBeDefined();
    expect((failCall![0] as { data: { reason?: string } }).data.reason).toMatch(
      /not BCR-eligible/i,
    );

    // No issuance was created.
    expect(mockPrisma.issuance.create).not.toHaveBeenCalled();
  });

  it('throws MethodologyNotEligibleError when methodology found but isBcrEligible=false', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    stageMethodologyLookup(makeMethodology({ isBcrEligible: false }));
    mockPrisma.awd2Handoff.update.mockResolvedValue({});

    await expect(importAwd2Handoff(makeInput())).rejects.toBeInstanceOf(
      MethodologyNotEligibleError,
    );

    // Handoff marked FAILED.
    const failCall = mockPrisma.awd2Handoff.update.mock.calls.find(
      (c) => (c[0] as { data: { status?: string } }).data.status === 'FAILED',
    );
    expect(failCall).toBeDefined();
    expect(mockPrisma.issuance.create).not.toHaveBeenCalled();
  });
});

describe('importAwd2Handoff — org existence', () => {
  it('throws HolderOrgNotFoundError when org does not exist', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    stageMethodologyLookup(makeMethodology());
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    mockPrisma.awd2Handoff.update.mockResolvedValue({});

    await expect(importAwd2Handoff(makeInput())).rejects.toBeInstanceOf(
      HolderOrgNotFoundError,
    );

    // Handoff marked FAILED.
    const failCall = mockPrisma.awd2Handoff.update.mock.calls.find(
      (c) => (c[0] as { data: { status?: string } }).data.status === 'FAILED',
    );
    expect(failCall).toBeDefined();
    expect((failCall![0] as { data: { reason?: string } }).data.reason).toMatch(
      /not found/,
    );

    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
    expect(mockPrisma.issuance.create).not.toHaveBeenCalled();
  });
});

describe('importAwd2Handoff — idempotent re-import', () => {
  it('returns existing issuanceId when handoff is already IMPORTED — no duplicate Issuance', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(
      makeHandoffRow({
        status: 'IMPORTED',
        issuanceId: ISSUANCE_ID,
        importedAt: new Date('2026-04-01T01:00:00Z'),
      }),
    );

    const result = await importAwd2Handoff(makeInput());

    expect(result.status).toBe('duplicate');
    expect(result.issuanceId).toBe(ISSUANCE_ID);

    // No reads or writes downstream of the dedup check.
    expect(mockPrisma.methodology.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.methodology.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.methodology.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.activity.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
    expect(mockPrisma.issuance.create).not.toHaveBeenCalled();
    expect(mockPrisma.awd2Handoff.update).not.toHaveBeenCalled();
  });
});

describe('importAwd2Handoff — whole-ton defence in depth', () => {
  it('throws WholeTonViolationError on fractional tonnes (route schema also rejects, but service defends)', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    mockPrisma.awd2Handoff.update.mockResolvedValue({});

    await expect(
      importAwd2Handoff(makeInput({ tonnes: 12.5 })),
    ).rejects.toBeInstanceOf(WholeTonViolationError);

    // Handoff marked FAILED with whole-ton message.
    const failCall = mockPrisma.awd2Handoff.update.mock.calls.find(
      (c) => (c[0] as { data: { status?: string } }).data.status === 'FAILED',
    );
    expect(failCall).toBeDefined();
    expect((failCall![0] as { data: { reason?: string } }).data.reason).toMatch(
      /whole number/i,
    );

    // Methodology / org checks should not have been reached.
    expect(mockPrisma.methodology.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.methodology.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.methodology.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.issuance.create).not.toHaveBeenCalled();
  });

  it('throws WholeTonViolationError on zero tonnes', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    mockPrisma.awd2Handoff.update.mockResolvedValue({});

    await expect(
      importAwd2Handoff(makeInput({ tonnes: 0 })),
    ).rejects.toBeInstanceOf(WholeTonViolationError);
  });

  it('throws WholeTonViolationError on negative tonnes', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    mockPrisma.awd2Handoff.update.mockResolvedValue({});

    await expect(
      importAwd2Handoff(makeInput({ tonnes: -10 })),
    ).rejects.toBeInstanceOf(WholeTonViolationError);
  });
});

describe('importAwd2Handoff — Activity find-or-create', () => {
  it('creates a new Activity when no row matches awd2ProjectRef', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    stageMethodologyLookup(makeMethodology());
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockPrisma.activity.findFirst.mockResolvedValue(null); // ← no existing
    mockPrisma.activity.create.mockResolvedValue(makeActivity());
    mockPrisma.monitoringPeriod.create.mockResolvedValue({ id: PERIOD_ID });
    mockPrisma.issuance.create.mockResolvedValue({ id: ISSUANCE_ID });
    mockPrisma.awd2Handoff.update.mockResolvedValue({});

    await importAwd2Handoff(makeInput());

    expect(mockPrisma.activity.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.activity.create.mock.calls[0]![0]!;
    expect(createArg.data.awd2ProjectRef).toBe('AWD2-PROJ-7891');
    expect(createArg.data.title).toBe('Imported Reforestation Project');
    expect(createArg.data.methodologyId).toBe(METHODOLOGY_ID);
    expect(createArg.data.orgId).toBe(ORG_ID);
    expect(createArg.data.status).toBe('REGISTERED');
    expect(createArg.data.technologyType).toBe('AWD2_IMPORT');
  });

  it('reuses an existing Activity when one already matches awd2ProjectRef', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    stageMethodologyLookup(makeMethodology());
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    // ← existing Activity returned by findFirst
    mockPrisma.activity.findFirst.mockResolvedValue(makeActivity());
    mockPrisma.monitoringPeriod.create.mockResolvedValue({ id: PERIOD_ID });
    mockPrisma.issuance.create.mockResolvedValue({ id: ISSUANCE_ID });
    mockPrisma.awd2Handoff.update.mockResolvedValue({});

    await importAwd2Handoff(makeInput());

    // No Activity create happened — reused existing.
    expect(mockPrisma.activity.create).not.toHaveBeenCalled();

    // Issuance still created against the existing activity id.
    const issuanceArg = mockPrisma.issuance.create.mock.calls[0]![0]!;
    expect(issuanceArg.data.activityId).toBe(ACTIVITY_ID);
  });
});

describe('importAwd2Handoff — composite AWD2 contract ref', () => {
  it('encodes contractAddress + tokenId into tokenizationContractId', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(makeHandoffRow());
    stageMethodologyLookup(makeMethodology());
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockPrisma.activity.findFirst.mockResolvedValue(makeActivity());
    mockPrisma.monitoringPeriod.create.mockResolvedValue({ id: PERIOD_ID });
    mockPrisma.issuance.create.mockResolvedValue({ id: ISSUANCE_ID });
    mockPrisma.awd2Handoff.update.mockResolvedValue({});

    await importAwd2Handoff(
      makeInput({
        awd2ContractAddress: '0x0000000000000000000000000000000000001234',
        awd2TokenId: '99999999999999999999999999',
      }),
    );

    const issuanceArg = mockPrisma.issuance.create.mock.calls[0]![0]!;
    expect(issuanceArg.data.tokenizationContractId).toBe(
      '0x0000000000000000000000000000000000001234:99999999999999999999999999',
    );
  });
});

describe('importAwd2Handoff — service-called-out-of-order', () => {
  it('throws when the Awd2Handoff row does not exist', async () => {
    mockPrisma.awd2Handoff.findUnique.mockResolvedValue(null);

    await expect(importAwd2Handoff(makeInput())).rejects.toThrow(
      /service called out of order/,
    );
  });
});
