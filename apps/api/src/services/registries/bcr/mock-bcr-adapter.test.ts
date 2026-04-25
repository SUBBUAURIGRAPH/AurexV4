import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Prisma mock for the sync-recorder audit-trail test ──────────────
// Mirrors the pattern in apps/api/src/services/notification.service.test.ts:
// vi.mock is hoisted to the top of the file, so we use vi.hoisted to build
// a mock prisma client that's available both inside the factory and in the
// test body.

const { mockPrisma, createSyncEvent } = vi.hoisted(() => {
  const createSyncEventFn = vi.fn();
  return {
    createSyncEvent: createSyncEventFn,
    mockPrisma: {
      bcrRegistrySyncEvent: {
        create: createSyncEventFn,
      },
    },
  };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import { MockBcrAdapter } from './mock-bcr-adapter.js';
import { recordBcrSyncEvent } from './sync-recorder.js';

// ─── MockBcrAdapter — state machine ───────────────────────────────────
// Maps to: BIOCARBON_SPARC_PLAN.md Sprint 1 TDD test suite,
//   "lockVCC moves VCC to locked" (B5)
//   "notifyMint after lock returns ok" (B5)
//   "notifyMint without lock throws" (B5, B12)  — implemented as ok:false
//   "notifyBurn moves locked → retired (when reason=RETIRE)" (B17)
//   "unlockVCC moves locked → free (when reason=DELIST)" (B18)
//   "getStatus returns current state" (B14)
//   "retireVCC includes beneficiary in payload" (B16)

describe('MockBcrAdapter — state machine', () => {
  let adapter: MockBcrAdapter;

  beforeEach(() => {
    adapter = new MockBcrAdapter();
  });

  it('lockVCC moves VCC from free → locked and returns a fresh bcrLockId', async () => {
    const result = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-1',
      vintage: 2025,
      units: 1000,
      recipientAccount: 'acct-recipient',
      bcrSerialId: 'BCR-SERIAL-1',
    });
    expect(result.ok).toBe(true);
    expect(result.externalRef).toMatch(/^BCR-LOCK-/);
    expect(result.data?.bcrLockId).toMatch(/^BCR-LOCK-/);
    expect(result.data?.bcrSerialId).toBe('BCR-SERIAL-1');
    expect(result.data?.lockedUnits).toBe(1000);

    const status = await adapter.getStatus({ bcrSerialId: 'BCR-SERIAL-1' });
    expect(status.data?.status).toBe('locked');
  });

  it('lockVCC rejects sub-ton units (whole-ton enforcement, B11)', async () => {
    const result = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-1',
      vintage: 2025,
      units: 0.5,
      recipientAccount: 'acct-recipient',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/whole-ton/);
  });

  it('notifyMint after lock + confirmLock moves locked → tokenized', async () => {
    const lock = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-1',
      vintage: 2025,
      units: 1000,
      recipientAccount: 'acct-recipient',
      bcrSerialId: 'BCR-SERIAL-1',
    });
    expect(lock.ok).toBe(true);

    const confirm = await adapter.confirmLock({
      bcrLockId: lock.data!.bcrLockId,
    });
    expect(confirm.ok).toBe(true);
    expect(confirm.data?.confirmed).toBe(true);

    const mint = await adapter.notifyMint({
      bcrLockId: lock.data!.bcrLockId,
      bcrSerialId: 'BCR-SERIAL-1',
      chain: 'aurigraph-dlt-v12-sbx',
      tokenContract: '0xdeadbeef',
      tokenId: '1',
      serialFirst: 'BCR-1-1',
      serialLast: 'BCR-1-1000',
      units: 1000,
    });
    expect(mint.ok).toBe(true);
    expect(mint.externalRef).toMatch(/^BCR-MINT-/);

    const status = await adapter.getStatus({ bcrSerialId: 'BCR-SERIAL-1' });
    expect(status.data?.status).toBe('tokenized');
  });

  it('notifyMint without prior lock fails with a clear reason (B5 lock-then-mint guard)', async () => {
    const result = await adapter.notifyMint({
      bcrLockId: 'BCR-LOCK-nope',
      bcrSerialId: 'BCR-SERIAL-nope',
      chain: 'polygon-amoy',
      tokenContract: '0xdeadbeef',
      tokenId: '1',
      serialFirst: 'BCR-1-1',
      serialLast: 'BCR-1-1000',
      units: 1000,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no such bcrSerialId/);
  });

  it('notifyMint without confirmLock fails (mint must wait for lock confirmation)', async () => {
    const lock = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-1',
      vintage: 2025,
      units: 1000,
      recipientAccount: 'acct-recipient',
      bcrSerialId: 'BCR-SERIAL-2',
    });
    const mint = await adapter.notifyMint({
      bcrLockId: lock.data!.bcrLockId,
      bcrSerialId: 'BCR-SERIAL-2',
      chain: 'polygon-amoy',
      tokenContract: '0xdeadbeef',
      tokenId: '1',
      serialFirst: 'BCR-1-1',
      serialLast: 'BCR-1-1000',
      units: 1000,
    });
    expect(mint.ok).toBe(false);
    expect(mint.reason).toMatch(/not confirmed/);
  });

  it('notifyBurn(RETIRE) moves locked → retired with beneficiary captured (B17)', async () => {
    const lock = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-1',
      vintage: 2025,
      units: 1000,
      recipientAccount: 'acct-recipient',
      bcrSerialId: 'BCR-SERIAL-3',
    });
    expect(lock.ok).toBe(true);

    const burn = await adapter.notifyBurn({
      bcrSerialId: 'BCR-SERIAL-3',
      reason: 'RETIRE',
      beneficiary: { name: 'Acme Co.', country: 'IN' },
      vintage: 2025,
      units: 1000,
    });
    expect(burn.ok).toBe(true);

    const status = await adapter.getStatus({ bcrSerialId: 'BCR-SERIAL-3' });
    expect(status.data?.status).toBe('retired');
  });

  it('notifyBurn(RETIRE) without beneficiary fails (B16)', async () => {
    const lock = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-1',
      vintage: 2025,
      units: 1000,
      recipientAccount: 'acct-recipient',
      bcrSerialId: 'BCR-SERIAL-3b',
    });
    expect(lock.ok).toBe(true);

    const burn = await adapter.notifyBurn({
      bcrSerialId: 'BCR-SERIAL-3b',
      reason: 'RETIRE',
      vintage: 2025,
      units: 1000,
    });
    expect(burn.ok).toBe(false);
    expect(burn.reason).toMatch(/beneficiary/i);
  });

  it('unlockVCC moves locked → free (DELIST two-way bridge, B18)', async () => {
    const lock = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-1',
      vintage: 2025,
      units: 1000,
      recipientAccount: 'acct-recipient',
      bcrSerialId: 'BCR-SERIAL-4',
    });
    expect(lock.ok).toBe(true);

    const unlock = await adapter.unlockVCC({
      bcrLockId: lock.data!.bcrLockId,
      reason: 'DELIST',
    });
    expect(unlock.ok).toBe(true);

    const status = await adapter.getStatus({ bcrSerialId: 'BCR-SERIAL-4' });
    expect(status.data?.status).toBe('free');
  });

  it('getStatus returns the current VCC state', async () => {
    const lock = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-1',
      vintage: 2025,
      units: 1000,
      recipientAccount: 'acct-recipient',
      bcrSerialId: 'BCR-SERIAL-5',
    });
    expect(lock.ok).toBe(true);

    const status = await adapter.getStatus({ bcrSerialId: 'BCR-SERIAL-5' });
    expect(status.ok).toBe(true);
    expect(status.data?.status).toBe('locked');
  });

  it('getStatus on unknown bcrSerialId returns ok=false', async () => {
    const status = await adapter.getStatus({ bcrSerialId: 'BCR-SERIAL-bogus' });
    expect(status.ok).toBe(false);
    expect(status.reason).toMatch(/no such bcrSerialId/);
  });

  it('retireVCC includes beneficiary in payload and returns retirementStatementUrl (B16)', async () => {
    adapter.__seedFreeVcc({
      bcrSerialId: 'BCR-SERIAL-6',
      units: 500,
      vintage: 2025,
      projectId: 'BCR-PROJ-1',
    });

    const retire = await adapter.retireVCC({
      bcrSerialId: 'BCR-SERIAL-6',
      beneficiary: {
        name: 'Aurigraph Sustainability Inc.',
        country: 'US',
        reference: 'org-123',
      },
      purpose: 'corporate net-zero pledge 2030',
      units: 500,
    });
    expect(retire.ok).toBe(true);
    expect(retire.data?.retirementStatementUrl).toMatch(
      /biocarbonstandard\.com\/retirements/,
    );
    expect(retire.externalRef).toMatch(/^BCR-RETIRE-/);

    const status = await adapter.getStatus({ bcrSerialId: 'BCR-SERIAL-6' });
    expect(status.data?.status).toBe('retired');
  });
});

// ─── BcrRegistrySyncEvent — audit trail ──────────────────────────────
// Maps to: BIOCARBON_SPARC_PLAN.md Sprint 1 TDD test suite,
//   "each adapter call writes a BcrRegistrySyncEvent" (B20, B24)

describe('recordBcrSyncEvent — audit trail', () => {
  beforeEach(() => {
    createSyncEvent.mockReset();
    createSyncEvent.mockResolvedValue({ id: 'evt-1' });
  });

  it('persists a row for every adapter call with full payload', async () => {
    const adapter = new MockBcrAdapter();
    const lock = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-1',
      vintage: 2025,
      units: 1000,
      recipientAccount: 'acct-recipient',
      bcrSerialId: 'BCR-SERIAL-AUDIT',
    });

    await recordBcrSyncEvent({
      eventType: 'LOCK_VCC',
      resourceKind: 'issuance',
      resourceId: '00000000-0000-4000-8000-000000000001',
      adapterName: adapter.adapterName,
      bcrSerialId: lock.data?.bcrSerialId ?? null,
      bcrLockId: lock.data?.bcrLockId ?? null,
      result: lock,
      requestPayload: { units: 1000, vintage: 2025 },
    });

    expect(createSyncEvent).toHaveBeenCalledTimes(1);
    const call = createSyncEvent.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data.eventType).toBe('LOCK_VCC');
    expect(call.data.resourceKind).toBe('issuance');
    expect(call.data.adapterName).toBe('mock');
    expect(call.data.synced).toBe(true);
    expect(call.data.bcrSerialId).toBe('BCR-SERIAL-AUDIT');
    expect(call.data.bcrLockId).toBeDefined();
    expect(call.data.responsePayload).toEqual(lock.data);
  });

  it('records ok=false adapter results with the reason field populated', async () => {
    const adapter = new MockBcrAdapter();
    const result = await adapter.notifyMint({
      bcrLockId: 'BCR-LOCK-nope',
      bcrSerialId: 'BCR-SERIAL-nope',
      chain: 'polygon-amoy',
      tokenContract: '0xdeadbeef',
      tokenId: '1',
      serialFirst: 'BCR-1-1',
      serialLast: 'BCR-1-1000',
      units: 1000,
    });

    await recordBcrSyncEvent({
      eventType: 'NOTIFY_MINT',
      resourceKind: 'block',
      resourceId: '00000000-0000-4000-8000-000000000999',
      adapterName: adapter.adapterName,
      bcrSerialId: 'BCR-SERIAL-nope',
      result,
      requestPayload: { tokenId: '1' },
    });

    expect(createSyncEvent).toHaveBeenCalledTimes(1);
    const call = createSyncEvent.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data.synced).toBe(false);
    expect(call.data.reason).toMatch(/no such bcrSerialId/);
    expect(call.data.responsePayload).toBeNull();
  });

  it('never throws even when the underlying create fails', async () => {
    createSyncEvent.mockRejectedValueOnce(new Error('connection refused'));
    await expect(
      recordBcrSyncEvent({
        eventType: 'GET_STATUS',
        resourceKind: 'lock',
        resourceId: '00000000-0000-4000-8000-000000000999',
        adapterName: 'mock',
        result: { ok: true, externalRef: 'x' },
        requestPayload: null,
      }),
    ).resolves.toBeUndefined();
  });
});
