import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DisabledKycAdapter } from './disabled-kyc-adapter.js';
import { __resetKycAdapterCache, getKycAdapter } from './index.js';

// ─── DisabledKycAdapter ────────────────────────────────────────────────
// AAT-θ / AV4-354 — BCR binding requirement B15 (KYC / CDD / AML / CTF).
// Contract: every method returns synced=false with a "vendor onboarding
// pending" reason and never throws or has side-effects.

describe('DisabledKycAdapter', () => {
  const adapter = new DisabledKycAdapter();

  it('exposes adapterName=disabled and isActive=false', () => {
    expect(adapter.adapterName).toBe('disabled');
    expect(adapter.isActive).toBe(false);
  });

  it('startVerification returns synced=false without throwing', async () => {
    const result = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: '00000000-0000-4000-8000-000000000001',
      level: 'basic',
      metadata: { country: 'IN' },
    });
    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/onboarding pending/i);
    expect(result.reason).toMatch(/disabled/i);
    expect(result.data).toBeUndefined();
  });

  it('getVerificationStatus returns synced=false without throwing', async () => {
    const result = await adapter.getVerificationStatus({
      verificationId: '00000000-0000-4000-8000-000000000001',
    });
    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/onboarding pending/i);
  });

  it('markBeneficiaryVerified returns synced=false without throwing', async () => {
    const result = await adapter.markBeneficiaryVerified({
      verificationId: '00000000-0000-4000-8000-000000000001',
      beneficiaryRef: 'beneficiary-1',
      attestations: [
        { kind: 'aml_screening_v1', value: 'clean', signedAt: '2026-04-25T00:00:00Z' },
      ],
    });
    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/onboarding pending/i);
  });

  it('revokeVerification returns synced=false without throwing', async () => {
    const result = await adapter.revokeVerification({
      verificationId: '00000000-0000-4000-8000-000000000001',
      reason: 'sanctions list update',
    });
    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/onboarding pending/i);
  });

  it('listForSubject returns synced=false without throwing', async () => {
    const result = await adapter.listForSubject({
      subjectKind: 'user',
      subjectRef: '00000000-0000-4000-8000-000000000001',
    });
    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/onboarding pending/i);
  });
});

// ─── getKycAdapter — factory ───────────────────────────────────────────
// AAT-θ / AV4-354 — env-keyed factory mirrors the BCR adapter pattern.
// Default → disabled, `mock` → mock, reserved (`sumsub`/`onfido`/`persona`)
// throw, unknown values throw.

describe('getKycAdapter — factory', () => {
  const originalEnv = process.env.KYC_ADAPTER;

  beforeEach(() => {
    __resetKycAdapterCache();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.KYC_ADAPTER;
    } else {
      process.env.KYC_ADAPTER = originalEnv;
    }
    __resetKycAdapterCache();
  });

  it('returns DisabledKycAdapter when env var is unset', () => {
    delete process.env.KYC_ADAPTER;
    const adapter = getKycAdapter();
    expect(adapter).toBeInstanceOf(DisabledKycAdapter);
    expect(adapter.adapterName).toBe('disabled');
    expect(adapter.isActive).toBe(false);
  });

  it('returns DisabledKycAdapter when env var is explicitly `disabled`', () => {
    process.env.KYC_ADAPTER = 'disabled';
    const adapter = getKycAdapter();
    expect(adapter).toBeInstanceOf(DisabledKycAdapter);
  });

  it('returns DisabledKycAdapter when env var is empty string', () => {
    process.env.KYC_ADAPTER = '';
    const adapter = getKycAdapter();
    expect(adapter).toBeInstanceOf(DisabledKycAdapter);
  });

  it('treats env var case-insensitively', () => {
    process.env.KYC_ADAPTER = 'DISABLED';
    const adapter = getKycAdapter();
    expect(adapter).toBeInstanceOf(DisabledKycAdapter);
  });

  it('caches the adapter instance — second call returns same reference', () => {
    delete process.env.KYC_ADAPTER;
    const a = getKycAdapter();
    const b = getKycAdapter();
    expect(a).toBe(b);
  });

  it('returns a MockKycAdapter when env var is set to `mock`', () => {
    process.env.KYC_ADAPTER = 'mock';
    const adapter = getKycAdapter();
    expect(adapter.adapterName).toBe('mock');
    expect(adapter.isActive).toBe(true);
  });

  it('throws a clear error when env var is set to reserved-but-unimplemented `sumsub`', () => {
    process.env.KYC_ADAPTER = 'sumsub';
    expect(() => getKycAdapter()).toThrow(
      /not yet implemented.*vendor contract/i,
    );
  });

  it('throws a clear error when env var is set to reserved-but-unimplemented `onfido`', () => {
    process.env.KYC_ADAPTER = 'onfido';
    expect(() => getKycAdapter()).toThrow(/not yet implemented/i);
  });

  it('throws a clear error when env var is set to reserved-but-unimplemented `persona`', () => {
    process.env.KYC_ADAPTER = 'persona';
    expect(() => getKycAdapter()).toThrow(/not yet implemented/i);
  });

  it('throws a clear error when env var is set to an unknown value', () => {
    process.env.KYC_ADAPTER = 'totally-bogus';
    expect(() => getKycAdapter()).toThrow(/not a recognised adapter name/i);
  });
});
