import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock @aurex/database before importing the service under test ──────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    issuance: {
      findUnique: vi.fn(),
    },
    delistRequest: {
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import {
  DelistIssuanceNotFoundError,
  NotMintedError,
  NotOwnerError,
  delistIssuance,
  type DelistIssuanceOpts,
} from './delist.service.js';

// ── Fixture builders ──────────────────────────────────────────────────────

const ISSUANCE_ID = '00000000-0000-4000-8000-000000000010';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000000011';
const ORG_ID = '00000000-0000-4000-8000-000000000012';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000013';
const DELIST_REQUEST_ID = '00000000-0000-4000-8000-000000000040';

interface IssuanceFixtureOpts {
  status?: 'REQUESTED' | 'APPROVED' | 'ISSUED' | 'REJECTED' | 'RETIRED';
  tokenizationStatus?: 'PENDING' | 'MINTED' | 'FAILED' | null;
  tokenizationContractId?: string | null;
  bcrSerialId?: string | null;
  bcrLockId?: string | null;
  ownerOrgId?: string;
  delistRequest?:
    | null
    | {
        id?: string;
        status: 'INITIATED' | 'CHAIN_BURNED' | 'BCR_UNLOCKED' | 'FAILED';
        txHash?: string | null;
      };
}

function buildIssuanceFixture(overrides: IssuanceFixtureOpts = {}) {
  const ownerOrgId = overrides.ownerOrgId ?? ORG_ID;
  const delistRequest =
    overrides.delistRequest === undefined
      ? null
      : overrides.delistRequest === null
      ? null
      : {
          id: overrides.delistRequest.id ?? DELIST_REQUEST_ID,
          issuanceId: ISSUANCE_ID,
          status: overrides.delistRequest.status,
          txHash:
            overrides.delistRequest.txHash === undefined
              ? '0xcached-burn'
              : overrides.delistRequest.txHash,
          bcrSerialId: 'BCR-SERIAL-1',
          requestedByUserId: USER_ID,
          requestedByOrgId: ownerOrgId,
          reason: null,
          bcrUnlockedAt: null,
          createdAt: new Date('2026-02-01T00:00:00Z'),
          updatedAt: new Date('2026-02-01T00:00:00Z'),
        };

  return {
    id: ISSUANCE_ID,
    activityId: ACTIVITY_ID,
    netUnits: 100,
    vintage: 2025,
    status: overrides.status ?? 'ISSUED',
    tokenizationStatus:
      overrides.tokenizationStatus === undefined
        ? 'MINTED'
        : overrides.tokenizationStatus,
    tokenizationContractId:
      overrides.tokenizationContractId === undefined
        ? 'ctr-abc'
        : overrides.tokenizationContractId,
    bcrSerialId:
      overrides.bcrSerialId === undefined ? 'BCR-SERIAL-1' : overrides.bcrSerialId,
    bcrLockId:
      overrides.bcrLockId === undefined ? 'BCR-LOCK-1' : overrides.bcrLockId,
    activity: {
      id: ACTIVITY_ID,
      orgId: ownerOrgId,
      title: 'Forest restoration in Karnataka',
    },
    delistRequest,
  };
}

function buildOpts(overrides: Partial<DelistIssuanceOpts> = {}): DelistIssuanceOpts {
  return {
    issuanceId: ISSUANCE_ID,
    userId: USER_ID,
    orgId: ORG_ID,
    role: 'sustainability_admin',
    reason: 'voluntary delist',
    ...overrides,
  };
}

function makeStubAurigraphAdapter(opts: { burn?: ReturnType<typeof vi.fn> } = {}) {
  const burnAsset =
    opts.burn ??
    vi.fn().mockResolvedValue({ contractId: 'ctr-delist', txHash: '0xburn' });
  return { burnAsset };
}

// ── Test setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.issuance.findUnique.mockReset();
  mockPrisma.delistRequest.upsert.mockReset();
  mockPrisma.auditLog.create.mockResolvedValue({});
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('delistIssuance — happy path', () => {
  it('persists DelistRequest at CHAIN_BURNED, calls burnAsset with delist metadata, returns refs', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.delistRequest.upsert.mockResolvedValue({
      id: DELIST_REQUEST_ID,
      status: 'CHAIN_BURNED',
      txHash: '0xburn',
    });

    const aurigraphAdapter = makeStubAurigraphAdapter();

    const result = await delistIssuance(buildOpts(), { aurigraphAdapter });

    expect(result.delistRequestId).toBe(DELIST_REQUEST_ID);
    expect(result.txHash).toBe('0xburn');

    // burnAsset was called with delist metadata + no retiredBy.
    expect(aurigraphAdapter.burnAsset).toHaveBeenCalledTimes(1);
    const burnArg = aurigraphAdapter.burnAsset.mock.calls[0]![0]! as {
      assetId: string;
      amount: number;
      reason: string;
      retiredBy?: string;
      metadata?: Record<string, unknown>;
    };
    expect(burnArg.assetId).toBe('ctr-abc');
    expect(burnArg.amount).toBe(100);
    expect(burnArg.reason).toBe('voluntary delist');
    expect(burnArg.retiredBy).toBeUndefined();
    expect(burnArg.metadata?.delist).toBe(true);
    expect(burnArg.metadata?.bcrSerialId).toBe('BCR-SERIAL-1');
    expect(burnArg.metadata?.bcrLockId).toBe('BCR-LOCK-1');
    expect(burnArg.metadata?.aurexIssuanceId).toBe(ISSUANCE_ID);
    expect(burnArg.metadata?.netUnits).toBe(100);

    // upsert called once with status=CHAIN_BURNED + txHash recorded.
    expect(mockPrisma.delistRequest.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockPrisma.delistRequest.upsert.mock.calls[0]![0]!;
    expect(upsertArg.where).toEqual({ issuanceId: ISSUANCE_ID });
    expect(upsertArg.create.status).toBe('CHAIN_BURNED');
    expect(upsertArg.create.txHash).toBe('0xburn');
    expect(upsertArg.create.requestedByOrgId).toBe(ORG_ID);

    // Audit row.
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    const auditArg = mockPrisma.auditLog.create.mock.calls[0]![0]!;
    expect(auditArg.data.action).toBe('issuance.delist_requested');
    expect(auditArg.data.resourceId).toBe(ISSUANCE_ID);
  });
});

describe('delistIssuance — issuance state guards', () => {
  it('throws DelistIssuanceNotFoundError when no issuance row exists', async () => {
    mockPrisma.issuance.findUnique.mockResolvedValue(null);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    await expect(
      delistIssuance(buildOpts(), { aurigraphAdapter }),
    ).rejects.toBeInstanceOf(DelistIssuanceNotFoundError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
    expect(mockPrisma.delistRequest.upsert).not.toHaveBeenCalled();
  });

  it('throws NotMintedError when tokenizationStatus is not MINTED (already retired)', async () => {
    const issuance = buildIssuanceFixture({
      status: 'RETIRED',
      tokenizationStatus: null,
    });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    await expect(
      delistIssuance(buildOpts(), { aurigraphAdapter }),
    ).rejects.toBeInstanceOf(NotMintedError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
    expect(mockPrisma.delistRequest.upsert).not.toHaveBeenCalled();
  });

  it('throws NotMintedError when tokenizationStatus is PENDING', async () => {
    const issuance = buildIssuanceFixture({ tokenizationStatus: 'PENDING' });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    await expect(
      delistIssuance(buildOpts(), { aurigraphAdapter }),
    ).rejects.toBeInstanceOf(NotMintedError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });
});

describe('delistIssuance — ownership guard', () => {
  it('throws NotOwnerError when caller orgId does not match the issuance owner', async () => {
    const issuance = buildIssuanceFixture({ ownerOrgId: OTHER_ORG_ID });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    await expect(
      delistIssuance(buildOpts({ orgId: ORG_ID }), { aurigraphAdapter }),
    ).rejects.toBeInstanceOf(NotOwnerError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
    expect(mockPrisma.delistRequest.upsert).not.toHaveBeenCalled();
  });
});

describe('delistIssuance — idempotency', () => {
  it('returns existing DelistRequest when prior row is CHAIN_BURNED', async () => {
    const issuance = buildIssuanceFixture({
      delistRequest: { status: 'CHAIN_BURNED', txHash: '0xcached' },
    });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    const result = await delistIssuance(buildOpts(), { aurigraphAdapter });

    expect(result.delistRequestId).toBe(DELIST_REQUEST_ID);
    expect(result.txHash).toBe('0xcached');
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
    expect(mockPrisma.delistRequest.upsert).not.toHaveBeenCalled();
  });

  it('returns existing DelistRequest when prior row is INITIATED (no re-burn)', async () => {
    const issuance = buildIssuanceFixture({
      delistRequest: { status: 'INITIATED', txHash: null },
    });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    const result = await delistIssuance(buildOpts(), { aurigraphAdapter });

    expect(result.delistRequestId).toBe(DELIST_REQUEST_ID);
    expect(result.txHash).toBe('');
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });

  it('throws NotMintedError when prior delist already reached BCR_UNLOCKED', async () => {
    const issuance = buildIssuanceFixture({
      delistRequest: { status: 'BCR_UNLOCKED' },
    });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    const aurigraphAdapter = makeStubAurigraphAdapter();

    await expect(
      delistIssuance(buildOpts(), { aurigraphAdapter }),
    ).rejects.toBeInstanceOf(NotMintedError);
    expect(aurigraphAdapter.burnAsset).not.toHaveBeenCalled();
  });
});

describe('delistIssuance — chain burn failure', () => {
  it('persists FAILED DelistRequest and rethrows the underlying chain error', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.delistRequest.upsert.mockResolvedValue({
      id: DELIST_REQUEST_ID,
      status: 'FAILED',
      txHash: null,
    });

    const chainError = new Error('chain unavailable');
    const aurigraphAdapter = makeStubAurigraphAdapter({
      burn: vi.fn().mockRejectedValue(chainError),
    });

    await expect(
      delistIssuance(buildOpts(), { aurigraphAdapter }),
    ).rejects.toBe(chainError);

    // upsert was called once to persist the FAILED state.
    expect(mockPrisma.delistRequest.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockPrisma.delistRequest.upsert.mock.calls[0]![0]!;
    expect(upsertArg.create.status).toBe('FAILED');
    expect(upsertArg.update.status).toBe('FAILED');

    // No audit row for delist_requested when the burn failed.
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});
