import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

// ── Mock @aurex/database before importing the service under test ──────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    issuance: {
      findUnique: vi.fn(),
    },
    retirement: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: { JsonNull: 'JSON_NULL_SENTINEL' },
}));

import {
  AlreadyRetiredError,
  IssuanceNotFoundError,
  IssuanceNotMintedError,
  KycNotApprovedError,
  RetirementDivergenceError,
  retireToken,
  type KycLookup,
  type RetireTokenOpts,
} from './retirement.service.js';

// ── Fixture builders ──────────────────────────────────────────────────────

const ISSUANCE_ID = '00000000-0000-4000-8000-000000000010';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000000011';
const ORG_ID = '00000000-0000-4000-8000-000000000012';
const USER_ID = '00000000-0000-4000-8000-000000000013';
const KYC_VERIFICATION_ID = '00000000-0000-4000-8000-000000000020';
const RETIREMENT_ID = '00000000-0000-4000-8000-000000000030';

interface IssuanceFixtureOpts {
  status?: 'REQUESTED' | 'APPROVED' | 'ISSUED' | 'REJECTED' | 'RETIRED';
  tokenizationStatus?: 'PENDING' | 'MINTED' | 'FAILED' | null;
  tokenizationContractId?: string | null;
  bcrSerialId?: string | null;
  bcrLockId?: string | null;
  vintage?: number;
}

function buildIssuanceFixture(overrides: IssuanceFixtureOpts = {}) {
  return {
    id: ISSUANCE_ID,
    activityId: ACTIVITY_ID,
    periodId: '00000000-0000-4000-8000-000000000014',
    grossUnits: 1000,
    sopLevyUnits: 50,
    omgeCancelledUnits: 20,
    netUnits: 930,
    vintage: overrides.vintage ?? 2025,
    unitType: 'A6_4ER',
    status: overrides.status ?? 'ISSUED',
    requestedBy: USER_ID,
    requestedAt: new Date('2026-01-01T00:00:00Z'),
    issuedAt: new Date('2026-01-15T00:00:00Z'),
    serialBlockId: null,
    tokenizationStatus:
      overrides.tokenizationStatus === undefined
        ? 'MINTED'
        : overrides.tokenizationStatus,
    tokenizationContractId:
      overrides.tokenizationContractId === undefined
        ? 'ctr-abc'
        : overrides.tokenizationContractId,
    tokenizationTxHash: '0xfeed',
    bcrSerialId:
      overrides.bcrSerialId === undefined ? 'BCR-SERIAL-1' : overrides.bcrSerialId,
    bcrLockId:
      overrides.bcrLockId === undefined ? 'BCR-LOCK-1' : overrides.bcrLockId,
    tokenizedAt: new Date('2026-01-20T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-20T00:00:00Z'),
  };
}

interface PayloadOpts {
  tonnesRetired?: number;
  vintage?: number;
  bcrSerialId?: string;
  beneficiaryName?: string;
  legalIdRef?: string;
  jurisdiction?: string;
  kycVerificationId?: string;
}

function buildRetirePayload(
  overrides: PayloadOpts = {},
): RetireTokenOpts['payload'] {
  return {
    bcrSerialId: overrides.bcrSerialId ?? 'BCR-SERIAL-1',
    tonnesRetired: overrides.tonnesRetired ?? 100,
    vintage: overrides.vintage ?? 2025,
    purpose: 'CSR',
    retiredFor: {
      name: overrides.beneficiaryName ?? 'Acme Sustainability Inc.',
      legalIdRef: overrides.legalIdRef,
      jurisdiction: overrides.jurisdiction,
    },
    kycVerificationId: overrides.kycVerificationId ?? KYC_VERIFICATION_ID,
  };
}

function buildOpts(payloadOverrides: PayloadOpts = {}): RetireTokenOpts {
  return {
    issuanceId: ISSUANCE_ID,
    payload: buildRetirePayload(payloadOverrides),
    userId: USER_ID,
    orgId: ORG_ID,
  };
}

function approvedKycLookup(
  beneficiaryRef: string = 'Acme Sustainability Inc.',
): KycLookup {
  return vi.fn().mockResolvedValue({
    approved: true,
    subjectKind: 'beneficiary',
    beneficiaryRef,
  });
}

function makeStubAurigraphAdapter(opts: { burn?: ReturnType<typeof vi.fn> } = {}) {
  const burnAsset =
    opts.burn ??
    vi.fn().mockResolvedValue({ contractId: 'ctr-retire', txHash: '0xburn' });
  return { burnAsset };
}

// ── Test setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.issuance.findUnique.mockReset();
  mockPrisma.retirement.findUnique.mockReset();
  mockPrisma.retirement.create.mockReset();
  mockPrisma.retirement.update.mockReset();
  mockPrisma.auditLog.create.mockResolvedValue({});
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('retireToken — happy path', () => {
  it('persists Retirement row, calls burnAsset, returns retirementId + txHash + passthrough', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.retirement.findUnique.mockResolvedValue(null);
    mockPrisma.retirement.create.mockResolvedValue({
      id: RETIREMENT_ID,
      status: 'INITIATED',
    });
    mockPrisma.retirement.update.mockResolvedValue({});

    const aurigraphAdapter = makeStubAurigraphAdapter();
    const kycLookup = approvedKycLookup();

    const result = await retireToken(buildOpts(), {
      aurigraphAdapter,
      kycLookup,
    });

    expect(result.retirementId).toBe(RETIREMENT_ID);
    expect(result.txHash).toBe('0xburn');
    expect(result.expectedBcrPassthrough).toEqual({
      vintage: 2025,
      amount: 100,
      purpose: 'CSR',
      beneficiary: {
        name: 'Acme Sustainability Inc.',
        legalIdRef: undefined,
        jurisdiction: undefined,
        orgRef: undefined,
      },
    });

    // KYC was probed with the supplied id.
    expect(kycLookup).toHaveBeenCalledWith(KYC_VERIFICATION_ID);

    // Retirement.create called with INITIATED status + the parsed payload.
    expect(mockPrisma.retirement.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.retirement.create.mock.calls[0]![0]!;
    expect(createArg.data.status).toBe('INITIATED');
    expect(createArg.data.issuanceId).toBe(ISSUANCE_ID);
    expect(createArg.data.kycVerificationId).toBe(KYC_VERIFICATION_ID);
    expect(createArg.data.tonnesRetired).toBe(100);
    expect(createArg.data.vintage).toBe(2025);
    expect(createArg.data.purpose).toBe('CSR');

    // burnAsset called once with retire reason metadata.
    expect(aurigraphAdapter.burnAsset).toHaveBeenCalledTimes(1);
    const burnArg = aurigraphAdapter.burnAsset.mock.calls[0]![0]! as {
      assetId: string;
      amount: number;
      reason: string;
      retiredBy?: string;
    };
    expect(burnArg.assetId).toBe('ctr-abc');
    expect(burnArg.amount).toBe(100);
    expect(burnArg.retiredBy).toBe('Acme Sustainability Inc.');
    const reason = JSON.parse(burnArg.reason) as Record<string, unknown>;
    expect(reason.retirement).toBe(true);
    expect(reason.aurexIssuanceId).toBe(ISSUANCE_ID);
    expect(reason.aurexRetirementId).toBe(RETIREMENT_ID);
    expect(reason.bcrSerialId).toBe('BCR-SERIAL-1');
    expect(reason.netUnits).toBe(100);

    // Final flip to CHAIN_BURNED + txHash.
    expect(mockPrisma.retirement.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.retirement.update.mock.calls[0]![0]!;
    expect(updateArg.where).toEqual({ id: RETIREMENT_ID });
    expect(updateArg.data.status).toBe('CHAIN_BURNED');
    expect(updateArg.data.txHash).toBe('0xburn');

    // Audit log row emitted for operator visibility.
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    const auditArg = mockPrisma.auditLog.create.mock.calls[0]![0]!;
    expect(auditArg.data.action).toBe('retirement.initiated');
    expect(auditArg.data.resource).toBe('issuance');
    expect(auditArg.data.resourceId).toBe(ISSUANCE_ID);
  });
});

describe('retireToken — KYC gate (B16)', () => {
  it('throws KycNotApprovedError when kycLookup returns null (not found)', async () => {
    const aurigraphAdapter = makeStubAurigraphAdapter();
    const kycLookup = vi.fn().mockResolvedValue(null);

    await expect(
      retireToken(buildOpts(), { aurigraphAdapter, kycLookup }),
    ).rejects.toBeInstanceOf(KycNotApprovedError);

    // No DB read of issuance and no chain call.
    expect(mockPrisma.issuance.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.retirement.create).not.toHaveBeenCalled();
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });

  it('throws KycNotApprovedError when verification is in pending/rejected status', async () => {
    const aurigraphAdapter = makeStubAurigraphAdapter();
    const kycLookup = vi.fn().mockResolvedValue({
      approved: false,
      subjectKind: 'beneficiary',
      beneficiaryRef: 'Acme Sustainability Inc.',
    });

    await expect(
      retireToken(buildOpts(), { aurigraphAdapter, kycLookup }),
    ).rejects.toBeInstanceOf(KycNotApprovedError);

    expect(mockPrisma.retirement.create).not.toHaveBeenCalled();
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });

  it('throws KycNotApprovedError when subjectKind is not "beneficiary"', async () => {
    const aurigraphAdapter = makeStubAurigraphAdapter();
    const kycLookup = vi.fn().mockResolvedValue({
      approved: true,
      subjectKind: 'tokenizer',
      beneficiaryRef: 'Acme Sustainability Inc.',
    });

    await expect(
      retireToken(buildOpts(), { aurigraphAdapter, kycLookup }),
    ).rejects.toBeInstanceOf(KycNotApprovedError);

    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });

  it('falls back to the rejecting stub when kycLookup is not injected', async () => {
    const aurigraphAdapter = makeStubAurigraphAdapter();
    await expect(
      retireToken(buildOpts(), { aurigraphAdapter }),
    ).rejects.toBeInstanceOf(KycNotApprovedError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });
});

describe('retireToken — issuance state guards', () => {
  it('throws IssuanceNotFoundError when no issuance row exists', async () => {
    mockPrisma.issuance.findUnique.mockResolvedValue(null);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    await expect(
      retireToken(buildOpts(), {
        aurigraphAdapter,
        kycLookup: approvedKycLookup(),
      }),
    ).rejects.toBeInstanceOf(IssuanceNotFoundError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });

  it('throws AlreadyRetiredError when issuance.status === RETIRED', async () => {
    const issuance = buildIssuanceFixture({ status: 'RETIRED' });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    await expect(
      retireToken(buildOpts(), {
        aurigraphAdapter,
        kycLookup: approvedKycLookup(),
      }),
    ).rejects.toBeInstanceOf(AlreadyRetiredError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
    expect(mockPrisma.retirement.create).not.toHaveBeenCalled();
  });

  it('throws IssuanceNotMintedError when tokenizationStatus is not MINTED', async () => {
    const issuance = buildIssuanceFixture({ tokenizationStatus: 'PENDING' });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    await expect(
      retireToken(buildOpts(), {
        aurigraphAdapter,
        kycLookup: approvedKycLookup(),
      }),
    ).rejects.toBeInstanceOf(IssuanceNotMintedError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });
});

describe('retireToken — idempotency', () => {
  it('returns the existing Retirement row without re-burning when row already exists', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.retirement.findUnique.mockResolvedValue({
      id: RETIREMENT_ID,
      status: 'CHAIN_BURNED',
      txHash: '0xcached-burn',
    });

    const aurigraphAdapter = makeStubAurigraphAdapter();

    const result = await retireToken(buildOpts(), {
      aurigraphAdapter,
      kycLookup: approvedKycLookup(),
    });

    expect(result.retirementId).toBe(RETIREMENT_ID);
    expect(result.txHash).toBe('0xcached-burn');
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
    expect(mockPrisma.retirement.create).not.toHaveBeenCalled();
    expect(mockPrisma.retirement.update).not.toHaveBeenCalled();
  });

  it('throws RetirementDivergenceError when prior row is in FAILED status', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.retirement.findUnique.mockResolvedValue({
      id: RETIREMENT_ID,
      status: 'FAILED',
      txHash: null,
    });

    const aurigraphAdapter = makeStubAurigraphAdapter();

    await expect(
      retireToken(buildOpts(), {
        aurigraphAdapter,
        kycLookup: approvedKycLookup(),
      }),
    ).rejects.toBeInstanceOf(RetirementDivergenceError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });
});

describe('retireToken — schema enforcement (B11 whole-ton)', () => {
  it('rejects sub-ton (fractional) tonnesRetired before any chain call', async () => {
    const aurigraphAdapter = makeStubAurigraphAdapter();
    await expect(
      retireToken(buildOpts({ tonnesRetired: 12.5 }), {
        aurigraphAdapter,
        kycLookup: approvedKycLookup(),
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(mockPrisma.issuance.findUnique).not.toHaveBeenCalled();
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });

  it('rejects zero tonnesRetired before any chain call', async () => {
    const aurigraphAdapter = makeStubAurigraphAdapter();
    await expect(
      retireToken(buildOpts({ tonnesRetired: 0 }), {
        aurigraphAdapter,
        kycLookup: approvedKycLookup(),
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });
});

describe('retireToken — chain burn failure', () => {
  it('marks Retirement row FAILED and rethrows the underlying chain error', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.retirement.findUnique.mockResolvedValue(null);
    mockPrisma.retirement.create.mockResolvedValue({
      id: RETIREMENT_ID,
      status: 'INITIATED',
    });
    mockPrisma.retirement.update.mockResolvedValue({});

    const chainError = new Error('chain unavailable');
    const aurigraphAdapter = makeStubAurigraphAdapter({
      burn: vi.fn().mockRejectedValue(chainError),
    });

    await expect(
      retireToken(buildOpts(), {
        aurigraphAdapter,
        kycLookup: approvedKycLookup(),
      }),
    ).rejects.toBe(chainError);

    // Row was marked FAILED.
    expect(mockPrisma.retirement.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.retirement.update.mock.calls[0]![0]!;
    expect(updateArg.where).toEqual({ id: RETIREMENT_ID });
    expect(updateArg.data.status).toBe('FAILED');

    // No audit log row for retirement.initiated when the burn failed.
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});
