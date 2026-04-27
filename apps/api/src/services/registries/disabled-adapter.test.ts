import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { DisabledUnfcccAdapter } from './disabled-adapter.js';
import {
  getUnfcccAdapter,
  __resetUnfcccAdapterCache,
} from './index.js';

describe('DisabledUnfcccAdapter', () => {
  const adapter = new DisabledUnfcccAdapter();

  it('exposes adapterName=disabled and isActive=false', () => {
    expect(adapter.adapterName).toBe('disabled');
    expect(adapter.isActive).toBe(false);
  });

  it('notifyIssuance returns synced=false without throwing', async () => {
    const result = await adapter.notifyIssuance({
      issuanceId: '00000000-0000-4000-8000-000000000001',
      activityId: '00000000-0000-4000-8000-000000000002',
      hostCountry: 'IN',
      unitType: 'A6_4ER',
      vintage: 2025,
      grossUnits: 1000,
      netUnits: 930,
      sopUnits: 50,
      omgeUnits: 20,
    });
    expect(result.synced).toBe(false);
    expect(result.externalRef).toBeNull();
    expect(result.reason).toMatch(/CMA\.6\+/);
    expect(result.reason).toMatch(/disabled/);
  });

  it('notifyFirstTransfer returns synced=false without throwing', async () => {
    const result = await adapter.notifyFirstTransfer({
      blockSerialFirst: 'A64-IN-deadbeef-V2025-N-0000000001',
      fromAccountKey: 'acct-from',
      toAccountKey: 'acct-to',
      units: 500,
      buyerCountry: 'JP',
    });
    expect(result.synced).toBe(false);
    expect(result.externalRef).toBeNull();
    expect(result.reason).toBeDefined();
  });

  it('notifyRetirement returns synced=false without throwing for all purposes', async () => {
    for (const purpose of ['NDC', 'OIMP', 'VOLUNTARY'] as const) {
      const result = await adapter.notifyRetirement({
        blockSerialFirst: 'A64-IN-deadbeef-V2025-N-0000000001',
        purpose,
        units: 100,
        narrative: `retire for ${purpose}`,
      });
      expect(result.synced).toBe(false);
      expect(result.externalRef).toBeNull();
      expect(result.reason).toBeDefined();
    }
  });

  // ── AAT-R5 / AV4-418 — interop manifest contract ────────────────────
  it('getInteropManifest returns the disabled-adapter shape (AV4-418)', () => {
    const manifest = adapter.getInteropManifest();
    expect(manifest.adapterName).toBe('disabled');
    expect(manifest.specVersion).toBe('0.0.0-pending-spec');
    expect(manifest.ready).toBe(false);
    expect(manifest.specReference).toBeNull();
    // Supported events: issuance, first-transfer, retirement-ndc,
    // retirement-oimp. Order is stable so consumers can rely on it.
    expect([...manifest.supportedEvents]).toEqual([
      'issuance',
      'first-transfer',
      'retirement-ndc',
      'retirement-oimp',
    ]);
  });

  it('getInteropManifest is a pure synchronous read (no network)', () => {
    // Manifest is a static description — calling it many times must
    // be cheap and deterministic.
    const m1 = adapter.getInteropManifest();
    const m2 = adapter.getInteropManifest();
    expect(m1).toEqual(m2);
  });
});

describe('getUnfcccAdapter — factory', () => {
  const originalEnv = process.env.UNFCCC_REGISTRY_ADAPTER;

  beforeEach(() => {
    __resetUnfcccAdapterCache();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.UNFCCC_REGISTRY_ADAPTER;
    } else {
      process.env.UNFCCC_REGISTRY_ADAPTER = originalEnv;
    }
    __resetUnfcccAdapterCache();
  });

  it('returns DisabledUnfcccAdapter when env var is unset', () => {
    delete process.env.UNFCCC_REGISTRY_ADAPTER;
    const adapter = getUnfcccAdapter();
    expect(adapter).toBeInstanceOf(DisabledUnfcccAdapter);
    expect(adapter.adapterName).toBe('disabled');
    expect(adapter.isActive).toBe(false);
  });

  it('returns DisabledUnfcccAdapter when env var is explicitly `disabled`', () => {
    process.env.UNFCCC_REGISTRY_ADAPTER = 'disabled';
    const adapter = getUnfcccAdapter();
    expect(adapter).toBeInstanceOf(DisabledUnfcccAdapter);
  });

  it('returns DisabledUnfcccAdapter when env var is empty string', () => {
    process.env.UNFCCC_REGISTRY_ADAPTER = '';
    const adapter = getUnfcccAdapter();
    expect(adapter).toBeInstanceOf(DisabledUnfcccAdapter);
  });

  it('treats env var case-insensitively', () => {
    process.env.UNFCCC_REGISTRY_ADAPTER = 'DISABLED';
    const adapter = getUnfcccAdapter();
    expect(adapter).toBeInstanceOf(DisabledUnfcccAdapter);
  });

  it('caches the adapter instance — second call returns same reference', () => {
    delete process.env.UNFCCC_REGISTRY_ADAPTER;
    const a = getUnfcccAdapter();
    const b = getUnfcccAdapter();
    expect(a).toBe(b);
  });

  it('throws a clear error when env var is set to reserved-but-unimplemented `mock`', () => {
    process.env.UNFCCC_REGISTRY_ADAPTER = 'mock';
    expect(() => getUnfcccAdapter()).toThrow(/not yet implemented/i);
  });

  it('throws a clear error when env var is set to `live-v1`', () => {
    process.env.UNFCCC_REGISTRY_ADAPTER = 'live-v1';
    expect(() => getUnfcccAdapter()).toThrow(/not yet implemented/i);
  });

  it('throws a clear error when env var is set to `backblaze-b2`', () => {
    process.env.UNFCCC_REGISTRY_ADAPTER = 'backblaze-b2';
    expect(() => getUnfcccAdapter()).toThrow(/not yet implemented/i);
  });

  it('throws a clear error when env var is set to an unknown value', () => {
    process.env.UNFCCC_REGISTRY_ADAPTER = 'totally-bogus';
    expect(() => getUnfcccAdapter()).toThrow(/not a recognised adapter name/i);
  });
});
