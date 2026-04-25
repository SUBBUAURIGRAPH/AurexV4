import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DisabledBcrAdapter } from './disabled-bcr-adapter.js';
import { __resetBcrAdapterCache, getBcrAdapter } from './index.js';

// ─── DisabledBcrAdapter ────────────────────────────────────────────────
// Maps to: BIOCARBON_SPARC_PLAN.md Sprint 1 TDD test suite,
//          row "all 7 methods throw 'not authorised'" (B1)
//          + factory rows.

describe('DisabledBcrAdapter', () => {
  const adapter = new DisabledBcrAdapter();

  it('exposes adapterName=disabled and isActive=false', () => {
    expect(adapter.adapterName).toBe('disabled');
    expect(adapter.isActive).toBe(false);
  });

  it('lockVCC returns ok=false without throwing', async () => {
    const result = await adapter.lockVCC({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      projectId: 'BCR-PROJ-001',
      vintage: 2025,
      units: 1000,
      recipientAccount: 'acct-recipient',
    });
    expect(result.ok).toBe(false);
    expect(result.externalRef).toBeNull();
    expect(result.reason).toMatch(/authorisation pending/i);
    expect(result.reason).toMatch(/disabled/i);
  });

  it('confirmLock returns ok=false without throwing', async () => {
    const result = await adapter.confirmLock({ bcrLockId: 'BCR-LOCK-x' });
    expect(result.ok).toBe(false);
    expect(result.externalRef).toBeNull();
    expect(result.reason).toMatch(/authorisation pending/i);
  });

  it('notifyMint returns ok=false without throwing', async () => {
    const result = await adapter.notifyMint({
      bcrLockId: 'BCR-LOCK-x',
      bcrSerialId: 'BCR-SERIAL-x',
      chain: 'polygon-amoy',
      tokenContract: '0xdeadbeef',
      tokenId: '1',
      serialFirst: 'BCR-1-1',
      serialLast: 'BCR-1-1000',
      units: 1000,
    });
    expect(result.ok).toBe(false);
    expect(result.externalRef).toBeNull();
    expect(result.reason).toBeDefined();
  });

  it('notifyTransfer returns ok=false without throwing', async () => {
    const result = await adapter.notifyTransfer({
      bcrSerialId: 'BCR-SERIAL-x',
      fromAccount: 'a',
      toAccount: 'b',
      units: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.externalRef).toBeNull();
  });

  it('notifyBurn returns ok=false for both RETIRE and DELIST without throwing', async () => {
    for (const reason of ['RETIRE', 'DELIST'] as const) {
      const result = await adapter.notifyBurn({
        bcrSerialId: 'BCR-SERIAL-x',
        reason,
        beneficiary: { name: 'Acme Co.', country: 'IN' },
        vintage: 2025,
        units: 100,
      });
      expect(result.ok).toBe(false);
      expect(result.externalRef).toBeNull();
    }
  });

  it('unlockVCC returns ok=false without throwing', async () => {
    const result = await adapter.unlockVCC({
      bcrLockId: 'BCR-LOCK-x',
      reason: 'DELIST',
    });
    expect(result.ok).toBe(false);
    expect(result.externalRef).toBeNull();
  });

  it('retireVCC returns ok=false without throwing', async () => {
    const result = await adapter.retireVCC({
      bcrSerialId: 'BCR-SERIAL-x',
      beneficiary: { name: 'Acme Co.', country: 'IN' },
      purpose: 'voluntary offset',
      units: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.externalRef).toBeNull();
  });

  it('getStatus returns ok=false without throwing', async () => {
    const result = await adapter.getStatus({ bcrSerialId: 'BCR-SERIAL-x' });
    expect(result.ok).toBe(false);
    expect(result.externalRef).toBeNull();
  });
});

// ─── getBcrAdapter — factory ───────────────────────────────────────────
// Maps to: BIOCARBON_SPARC_PLAN.md Sprint 1 TDD test suite,
//          rows "BCR_REGISTRY_ADAPTER=disabled returns disabled" (B3)
//          and "unsupported value throws clear error" (B3).

describe('getBcrAdapter — factory', () => {
  const originalEnv = process.env.BCR_REGISTRY_ADAPTER;

  beforeEach(() => {
    __resetBcrAdapterCache();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BCR_REGISTRY_ADAPTER;
    } else {
      process.env.BCR_REGISTRY_ADAPTER = originalEnv;
    }
    __resetBcrAdapterCache();
  });

  it('returns DisabledBcrAdapter when env var is unset', () => {
    delete process.env.BCR_REGISTRY_ADAPTER;
    const adapter = getBcrAdapter();
    expect(adapter).toBeInstanceOf(DisabledBcrAdapter);
    expect(adapter.adapterName).toBe('disabled');
    expect(adapter.isActive).toBe(false);
  });

  it('returns DisabledBcrAdapter when env var is explicitly `disabled`', () => {
    process.env.BCR_REGISTRY_ADAPTER = 'disabled';
    const adapter = getBcrAdapter();
    expect(adapter).toBeInstanceOf(DisabledBcrAdapter);
  });

  it('returns DisabledBcrAdapter when env var is empty string', () => {
    process.env.BCR_REGISTRY_ADAPTER = '';
    const adapter = getBcrAdapter();
    expect(adapter).toBeInstanceOf(DisabledBcrAdapter);
  });

  it('treats env var case-insensitively', () => {
    process.env.BCR_REGISTRY_ADAPTER = 'DISABLED';
    const adapter = getBcrAdapter();
    expect(adapter).toBeInstanceOf(DisabledBcrAdapter);
  });

  it('caches the adapter instance — second call returns same reference', () => {
    delete process.env.BCR_REGISTRY_ADAPTER;
    const a = getBcrAdapter();
    const b = getBcrAdapter();
    expect(a).toBe(b);
  });

  it('returns a MockBcrAdapter when env var is set to `mock`', () => {
    process.env.BCR_REGISTRY_ADAPTER = 'mock';
    const adapter = getBcrAdapter();
    expect(adapter.adapterName).toBe('mock');
    expect(adapter.isActive).toBe(true);
  });

  it('throws a clear error when env var is set to reserved-but-unimplemented `live-v1`', () => {
    process.env.BCR_REGISTRY_ADAPTER = 'live-v1';
    expect(() => getBcrAdapter()).toThrow(
      /not yet implemented.*BCR Third-Party authorisation/i,
    );
  });

  it('throws a clear error when env var is set to an unknown value', () => {
    process.env.BCR_REGISTRY_ADAPTER = 'totally-bogus';
    expect(() => getBcrAdapter()).toThrow(/not a recognised adapter name/i);
  });
});
