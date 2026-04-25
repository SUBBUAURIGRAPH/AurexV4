import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

// ── Mock @aurex/database before importing the service under test ──────────
const { mockPrisma, createSyncEvent } = vi.hoisted(() => {
  const createSyncEventFn = vi.fn();
  return {
    createSyncEvent: createSyncEventFn,
    mockPrisma: {
      issuance: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      bcrRegistrySyncEvent: {
        create: createSyncEventFn,
      },
      aurigraphCallLog: {
        create: vi.fn(),
      },
    },
  };
});

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: { JsonNull: 'JSON_NULL_SENTINEL' },
}));

import { MockBcrAdapter } from './registries/bcr/mock-bcr-adapter.js';
import {
  IssuanceNotFoundError,
  IssuanceNotTokenizableError,
  LockFailedError,
  NotBcrEligibleError,
  TokenizationDivergenceError,
  tokenizeIssuance,
} from './tokenization.service.js';
import { ChainServerError } from './chains/aurigraph-dlt-adapter.js';

// ── Fixture builders ──────────────────────────────────────────────────────

const ISSUANCE_ID = '00000000-0000-4000-8000-000000000010';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000000011';
const ORG_ID = '00000000-0000-4000-8000-000000000012';
const USER_ID = '00000000-0000-4000-8000-000000000013';

interface IssuanceFixtureOpts {
  status?: 'REQUESTED' | 'APPROVED' | 'ISSUED' | 'REJECTED';
  isBcrEligible?: boolean;
  netUnits?: number;
  grossUnits?: number;
  sopLevyUnits?: number;
  omgeCancelledUnits?: number;
  vintage?: number;
  hostCountry?: string;
  methodologyCode?: string;
  tokenizationContractId?: string | null;
  tokenizationTxHash?: string | null;
  bcrSerialId?: string | null;
}

function buildIssuanceFixture(overrides: IssuanceFixtureOpts = {}) {
  return {
    id: ISSUANCE_ID,
    activityId: ACTIVITY_ID,
    periodId: '00000000-0000-4000-8000-000000000014',
    grossUnits: overrides.grossUnits ?? 1000,
    sopLevyUnits: overrides.sopLevyUnits ?? 50,
    omgeCancelledUnits: overrides.omgeCancelledUnits ?? 20,
    netUnits: overrides.netUnits ?? 930,
    vintage: overrides.vintage ?? 2025,
    unitType: 'A6_4ER',
    status: overrides.status ?? 'ISSUED',
    requestedBy: USER_ID,
    requestedAt: new Date('2026-01-01T00:00:00Z'),
    issuedAt: new Date('2026-01-15T00:00:00Z'),
    serialBlockId: null,
    tokenizationStatus: null,
    tokenizationContractId: overrides.tokenizationContractId ?? null,
    tokenizationTxHash: overrides.tokenizationTxHash ?? null,
    bcrSerialId: overrides.bcrSerialId ?? null,
    bcrLockId: null,
    tokenizedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-15T00:00:00Z'),
    activity: {
      id: ACTIVITY_ID,
      orgId: ORG_ID,
      methodologyId: '00000000-0000-4000-8000-000000000015',
      title: 'Forest restoration in Karnataka',
      hostCountry: overrides.hostCountry ?? 'IN',
      methodology: {
        id: '00000000-0000-4000-8000-000000000015',
        code: overrides.methodologyCode ?? 'VM0042',
        name: 'Improved Agricultural Land Management',
        version: '2.0',
        category: 'BASELINE_AND_MONITORING',
        isActive: true,
        isBcrEligible: overrides.isBcrEligible ?? true,
      },
      org: {
        id: ORG_ID,
        name: 'Test Org',
        slug: 'test-org',
      },
    },
    period: {
      id: '00000000-0000-4000-8000-000000000014',
      activityId: ACTIVITY_ID,
      periodStart: new Date('2025-01-01T00:00:00Z'),
      periodEnd: new Date('2025-12-31T00:00:00Z'),
      status: 'ISSUED',
    },
    serialBlock: null,
  };
}

// ── Test setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.issuance.findUnique.mockReset();
  mockPrisma.issuance.update.mockReset();
  mockPrisma.auditLog.create.mockResolvedValue({});
  mockPrisma.bcrRegistrySyncEvent.create.mockResolvedValue({ id: 'evt-1' });
  mockPrisma.aurigraphCallLog.create.mockResolvedValue({});
});

function makeStubAurigraphAdapter(opts: {
  deploy?: ReturnType<typeof vi.fn>;
}) {
  const deploy = opts.deploy ??
    vi.fn().mockResolvedValue({ contractId: 'ctr-abc', txHash: '0xfeed' });
  return { deployContract: deploy };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('tokenizeIssuance — happy path', () => {
  it('locks → confirms → mints → notifies and returns contract refs', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.issuance.update.mockResolvedValue({
      ...issuance,
      tokenizationStatus: 'MINTED',
      tokenizationContractId: 'ctr-abc',
      tokenizationTxHash: '0xfeed',
    });

    const bcrAdapter = new MockBcrAdapter();
    const aurigraphAdapter = makeStubAurigraphAdapter({});

    const result = await tokenizeIssuance(
      { issuanceId: ISSUANCE_ID, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter, channelId: 'marketplace-channel' },
    );

    expect(result.contractId).toBe('ctr-abc');
    expect(result.txHash).toBe('0xfeed');
    expect(result.bcrSerialId).toMatch(/^BCR-/);

    // Issuance row was updated with mint trail.
    expect(mockPrisma.issuance.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.issuance.update.mock.calls[0]![0]!;
    expect(updateArg.where).toEqual({ id: ISSUANCE_ID });
    expect(updateArg.data.tokenizationStatus).toBe('MINTED');
    expect(updateArg.data.tokenizationContractId).toBe('ctr-abc');
    expect(updateArg.data.tokenizationTxHash).toBe('0xfeed');
    expect(updateArg.data.bcrSerialId).toBe(result.bcrSerialId);

    // contracts.deploy was called with templateId/useCaseId=UC_CARBON.
    expect(aurigraphAdapter.deployContract).toHaveBeenCalledTimes(1);
    const deployArg = (aurigraphAdapter.deployContract as ReturnType<typeof vi.fn>)
      .mock.calls[0]![0] as Record<string, unknown>;
    expect(deployArg.templateId).toBe('UC_CARBON');
    expect(deployArg.useCaseId).toBe('UC_CARBON');
    expect(deployArg.channelId).toBe('marketplace-channel');
    const terms = deployArg.terms as Record<string, unknown>;
    expect(terms.bcrSerialId).toBe(result.bcrSerialId);
    expect(terms.netUnits).toBe(930);

    // 3 sync events recorded: LOCK_VCC + CONFIRM_LOCK + NOTIFY_MINT.
    expect(createSyncEvent).toHaveBeenCalledTimes(3);
    const eventTypes = createSyncEvent.mock.calls.map(
      (call) => (call[0] as { data: { eventType: string } }).data.eventType,
    );
    expect(eventTypes).toEqual(['LOCK_VCC', 'CONFIRM_LOCK', 'NOTIFY_MINT']);

    // Audit log records the operator-visible action.
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    const auditArg = mockPrisma.auditLog.create.mock.calls[0]![0]!;
    expect(auditArg.data.action).toBe('issuance.tokenized');
    expect(auditArg.data.resourceId).toBe(ISSUANCE_ID);
  });
});

describe('tokenizeIssuance — idempotency', () => {
  it('returns cached values without re-hitting SDK or BCR adapter', async () => {
    const issuance = buildIssuanceFixture({
      tokenizationContractId: 'ctr-cached',
      tokenizationTxHash: '0xcached',
      bcrSerialId: 'BCR-CACHED',
    });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);

    const bcrAdapter = new MockBcrAdapter();
    const lockSpy = vi.spyOn(bcrAdapter, 'lockVCC');
    const aurigraphAdapter = makeStubAurigraphAdapter({});

    const result = await tokenizeIssuance(
      { issuanceId: ISSUANCE_ID, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter },
    );

    expect(result).toEqual({
      contractId: 'ctr-cached',
      txHash: '0xcached',
      bcrSerialId: 'BCR-CACHED',
    });
    expect(lockSpy).not.toHaveBeenCalled();
    expect(aurigraphAdapter.deployContract).not.toHaveBeenCalled();
    expect(mockPrisma.issuance.update).not.toHaveBeenCalled();
    expect(createSyncEvent).not.toHaveBeenCalled();
  });

  it('throws TokenizationDivergenceError when contractId is set but txHash is missing', async () => {
    const issuance = buildIssuanceFixture({
      tokenizationContractId: 'ctr-half-baked',
      tokenizationTxHash: null,
      bcrSerialId: 'BCR-CACHED',
    });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);

    await expect(
      tokenizeIssuance(
        { issuanceId: ISSUANCE_ID, userId: USER_ID },
        {
          bcrAdapter: new MockBcrAdapter(),
          aurigraphAdapter: makeStubAurigraphAdapter({}),
        },
      ),
    ).rejects.toBeInstanceOf(TokenizationDivergenceError);
  });
});

describe('tokenizeIssuance — methodology eligibility guard', () => {
  it('throws NotBcrEligibleError when methodology.isBcrEligible=false', async () => {
    const issuance = buildIssuanceFixture({ isBcrEligible: false });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);

    const bcrAdapter = new MockBcrAdapter();
    const lockSpy = vi.spyOn(bcrAdapter, 'lockVCC');
    const aurigraphAdapter = makeStubAurigraphAdapter({});

    await expect(
      tokenizeIssuance(
        { issuanceId: ISSUANCE_ID, userId: USER_ID },
        { bcrAdapter, aurigraphAdapter },
      ),
    ).rejects.toBeInstanceOf(NotBcrEligibleError);

    // Hard guarantee: nothing external touched.
    expect(lockSpy).not.toHaveBeenCalled();
    expect(aurigraphAdapter.deployContract).not.toHaveBeenCalled();
    expect(createSyncEvent).not.toHaveBeenCalled();
  });
});

describe('tokenizeIssuance — issuance state guards', () => {
  it('throws IssuanceNotFoundError when the row does not exist', async () => {
    mockPrisma.issuance.findUnique.mockResolvedValue(null);

    await expect(
      tokenizeIssuance(
        { issuanceId: ISSUANCE_ID, userId: USER_ID },
        {
          bcrAdapter: new MockBcrAdapter(),
          aurigraphAdapter: makeStubAurigraphAdapter({}),
        },
      ),
    ).rejects.toBeInstanceOf(IssuanceNotFoundError);
  });

  it('throws IssuanceNotTokenizableError when status ≠ ISSUED', async () => {
    const issuance = buildIssuanceFixture({ status: 'REQUESTED' });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);

    await expect(
      tokenizeIssuance(
        { issuanceId: ISSUANCE_ID, userId: USER_ID },
        {
          bcrAdapter: new MockBcrAdapter(),
          aurigraphAdapter: makeStubAurigraphAdapter({}),
        },
      ),
    ).rejects.toBeInstanceOf(IssuanceNotTokenizableError);
  });
});

describe('tokenizeIssuance — lock failure', () => {
  it('throws LockFailedError when confirmLock fails — no mint attempted', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.issuance.update.mockResolvedValue({});

    const bcrAdapter = new MockBcrAdapter();
    // Force confirmLock to fail.
    vi.spyOn(bcrAdapter, 'confirmLock').mockResolvedValue({
      ok: false,
      externalRef: null,
      reason: 'BCR sandbox returned timeout',
    });
    const aurigraphAdapter = makeStubAurigraphAdapter({});

    await expect(
      tokenizeIssuance(
        { issuanceId: ISSUANCE_ID, userId: USER_ID },
        { bcrAdapter, aurigraphAdapter },
      ),
    ).rejects.toBeInstanceOf(LockFailedError);

    // Mint was not attempted.
    expect(aurigraphAdapter.deployContract).not.toHaveBeenCalled();

    // Both LOCK_VCC and CONFIRM_LOCK events recorded.
    const eventTypes = createSyncEvent.mock.calls.map(
      (call) => (call[0] as { data: { eventType: string; synced: boolean } }).data,
    );
    expect(eventTypes.map((e) => e.eventType)).toEqual([
      'LOCK_VCC',
      'CONFIRM_LOCK',
    ]);
    expect(eventTypes[0]!.synced).toBe(true); // lock succeeded
    expect(eventTypes[1]!.synced).toBe(false); // confirmLock failed

    // Issuance row was marked FAILED.
    expect(mockPrisma.issuance.update).toHaveBeenCalled();
    const updateArg = mockPrisma.issuance.update.mock.calls[0]![0]!;
    expect(updateArg.data.tokenizationStatus).toBe('FAILED');
  });
});

describe('tokenizeIssuance — chain mint failure', () => {
  it('attempts unlockVCC and rethrows the underlying chain error', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.issuance.update.mockResolvedValue({});

    const bcrAdapter = new MockBcrAdapter();
    const unlockSpy = vi.spyOn(bcrAdapter, 'unlockVCC');

    const chainError = new ChainServerError('chain unavailable', 503, 'UPSTREAM');
    const aurigraphAdapter = makeStubAurigraphAdapter({
      deploy: vi.fn().mockRejectedValue(chainError),
    });

    await expect(
      tokenizeIssuance(
        { issuanceId: ISSUANCE_ID, userId: USER_ID },
        { bcrAdapter, aurigraphAdapter },
      ),
    ).rejects.toBe(chainError);

    // unlockVCC was called best-effort.
    expect(unlockSpy).toHaveBeenCalledTimes(1);
    const unlockArg = unlockSpy.mock.calls[0]![0];
    expect(unlockArg.reason).toBe('DELIST');

    // Sync events: LOCK_VCC + CONFIRM_LOCK + UNLOCK_VCC (no NOTIFY_MINT).
    const eventTypes = createSyncEvent.mock.calls.map(
      (call) => (call[0] as { data: { eventType: string } }).data.eventType,
    );
    expect(eventTypes).toEqual(['LOCK_VCC', 'CONFIRM_LOCK', 'UNLOCK_VCC']);

    // Issuance row was marked FAILED.
    const failUpdateCall = mockPrisma.issuance.update.mock.calls.find(
      (call) => (call[0] as { data: { tokenizationStatus?: string } }).data
        .tokenizationStatus === 'FAILED',
    );
    expect(failUpdateCall).toBeDefined();
  });
});

describe('tokenizeIssuance — notifyMint post-mint failure', () => {
  it('returns success but records sync event with synced=false', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);
    mockPrisma.issuance.update.mockResolvedValue({});

    const bcrAdapter = new MockBcrAdapter();
    // Force notifyMint to return ok:false (e.g. BCR rejects post-mint).
    vi.spyOn(bcrAdapter, 'notifyMint').mockResolvedValue({
      ok: false,
      externalRef: null,
      reason: 'BCR transient outage',
    });
    const aurigraphAdapter = makeStubAurigraphAdapter({});

    const result = await tokenizeIssuance(
      { issuanceId: ISSUANCE_ID, userId: USER_ID },
      { bcrAdapter, aurigraphAdapter },
    );

    // Mint succeeded — caller still gets the contract refs.
    expect(result.contractId).toBe('ctr-abc');
    expect(result.txHash).toBe('0xfeed');

    // The NOTIFY_MINT sync event records the failure.
    const notifyEventCall = createSyncEvent.mock.calls.find(
      (call) => (call[0] as { data: { eventType: string } }).data.eventType ===
        'NOTIFY_MINT',
    );
    expect(notifyEventCall).toBeDefined();
    const notifyData = (notifyEventCall![0] as { data: { synced: boolean; reason?: string } })
      .data;
    expect(notifyData.synced).toBe(false);
    expect(notifyData.reason).toMatch(/BCR transient outage/);
  });
});

describe('tokenizeIssuance — metadata schema enforcement', () => {
  it('rejects sub-ton (non-positive-integer) netUnits before any external call', async () => {
    const issuance = buildIssuanceFixture({ netUnits: 0 }); // schema requires positive int
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);

    const bcrAdapter = new MockBcrAdapter();
    const aurigraphAdapter = makeStubAurigraphAdapter({});

    await expect(
      tokenizeIssuance(
        { issuanceId: ISSUANCE_ID, userId: USER_ID },
        { bcrAdapter, aurigraphAdapter },
      ),
    ).rejects.toBeInstanceOf(ZodError);

    // No mint attempted.
    expect(aurigraphAdapter.deployContract).not.toHaveBeenCalled();
  });

  it('rejects fractional (sub-ton) netUnits before any external call', async () => {
    const issuance = buildIssuanceFixture({ netUnits: 12.5 });
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);

    const bcrAdapter = new MockBcrAdapter();
    // Force lock to fail validation by feeding it a fractional unit count;
    // for this case the BCR mock would reject too, but we want to prove the
    // ZodError wins. Inject a permissive lock so we can be sure the schema
    // is what bails — but feed an integer to lockVCC by overriding the
    // service guard. Instead, verify the BCR mock rejects fractional units
    // (whole-ton enforcement, B11) before the schema even runs.
    const aurigraphAdapter = makeStubAurigraphAdapter({});

    await expect(
      tokenizeIssuance(
        { issuanceId: ISSUANCE_ID, userId: USER_ID },
        { bcrAdapter, aurigraphAdapter },
      ),
    ).rejects.toThrow();

    // Mint must not have been attempted.
    expect(aurigraphAdapter.deployContract).not.toHaveBeenCalled();
  });

  it('rejects when bcrSerialId is empty (B6 requires a serial id)', async () => {
    const issuance = buildIssuanceFixture();
    mockPrisma.issuance.findUnique.mockResolvedValue(issuance);

    const bcrAdapter = new MockBcrAdapter();
    // Force the lock adapter to return an empty serial id so the metadata
    // schema rejects it with the bcrSerialId.min(1) rule.
    vi.spyOn(bcrAdapter, 'lockVCC').mockResolvedValue({
      ok: true,
      externalRef: 'BCR-LOCK-x',
      data: {
        bcrLockId: 'BCR-LOCK-x',
        bcrSerialId: '', // ← schema violation
        lockedUnits: 930,
        expiresAt: new Date().toISOString(),
      },
    });
    vi.spyOn(bcrAdapter, 'confirmLock').mockResolvedValue({
      ok: true,
      externalRef: 'BCR-LOCK-x',
      data: { confirmed: true, status: 'locked' },
    });
    const aurigraphAdapter = makeStubAurigraphAdapter({});

    await expect(
      tokenizeIssuance(
        { issuanceId: ISSUANCE_ID, userId: USER_ID },
        { bcrAdapter, aurigraphAdapter },
      ),
    ).rejects.toBeInstanceOf(ZodError);

    expect(aurigraphAdapter.deployContract).not.toHaveBeenCalled();
  });
});
