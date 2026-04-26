/**
 * AAT-R3 / AV4-429 — DPDP §6 verifiable-consent gate on KYC.
 *
 * The gate fires inside `kyc.service.startVerification` for user-kind
 * subjects only. These tests mock both Prisma and the consent service so
 * we can drive the gate state directly without touching the database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    kycVerification: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    kycVerificationEvent: { create: vi.fn().mockResolvedValue({ id: 'evt' }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit' }) },
  },
}));

const { mockHasActiveConsent } = vi.hoisted(() => ({
  mockHasActiveConsent: vi.fn(),
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));
vi.mock('../dpdp/consent.service.js', () => ({
  CONSENT_PURPOSES: { KYC_VERIFICATION: 'kyc_verification' },
  hasActiveConsent: mockHasActiveConsent,
}));

import { __resetKycAdapterCache } from './index.js';
import {
  DpdpConsentRequiredError,
  startVerification,
} from './kyc.service.js';

const ORIGINAL_KYC_ADAPTER = process.env.KYC_ADAPTER;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KYC_ADAPTER = 'mock';
  __resetKycAdapterCache();
});

afterEach(() => {
  if (ORIGINAL_KYC_ADAPTER === undefined) delete process.env.KYC_ADAPTER;
  else process.env.KYC_ADAPTER = ORIGINAL_KYC_ADAPTER;
  __resetKycAdapterCache();
});

describe('AV4-429 — DPDP consent gate on KYC startVerification', () => {
  it('throws DpdpConsentRequiredError when no active KYC consent for user-kind subject', async () => {
    mockHasActiveConsent.mockResolvedValue(false);
    await expect(
      startVerification({
        subjectKind: 'user',
        subjectRef: '00000000-0000-4000-8000-000000000001',
        level: 'basic',
        metadata: {},
        orgId: null,
        userId: '00000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toBeInstanceOf(DpdpConsentRequiredError);

    // Adapter must NOT be called when consent is missing.
    expect(mockPrisma.kycVerification.create).not.toHaveBeenCalled();
    expect(mockHasActiveConsent).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      'kyc_verification',
    );
  });

  it('proceeds when active KYC consent exists', async () => {
    mockHasActiveConsent.mockResolvedValue(true);
    mockPrisma.kycVerification.create.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000100',
      subjectKind: 'USER',
      subjectRef: '00000000-0000-4000-8000-000000000001',
      level: 'BASIC',
      status: 'PENDING',
      vendorName: 'mock',
      vendorRef: 'MOCK-KYC-vendor-ref',
      riskScore: null,
      sanctionsHit: null,
      beneficiaryRef: null,
      attestations: null,
      lastCheckedAt: new Date(),
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await startVerification({
      subjectKind: 'user',
      subjectRef: '00000000-0000-4000-8000-000000000001',
      level: 'basic',
      metadata: {},
      orgId: null,
      userId: '00000000-0000-4000-8000-000000000001',
    });

    expect(result.synced).toBe(true);
    expect(mockPrisma.kycVerification.create).toHaveBeenCalledTimes(1);
  });

  it('skips the consent gate for beneficiary-kind subjects (external third parties)', async () => {
    mockHasActiveConsent.mockResolvedValue(false);
    mockPrisma.kycVerification.create.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000200',
      subjectKind: 'BENEFICIARY',
      subjectRef: 'beneficiary-ref-1',
      level: 'ENHANCED',
      status: 'PENDING',
      vendorName: 'mock',
      vendorRef: 'MOCK-KYC-vendor-ref-2',
      riskScore: null,
      sanctionsHit: null,
      beneficiaryRef: null,
      attestations: null,
      lastCheckedAt: new Date(),
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await startVerification({
      subjectKind: 'beneficiary',
      subjectRef: 'beneficiary-ref-1',
      level: 'enhanced',
      metadata: {},
      orgId: null,
      userId: null,
    });

    expect(result.synced).toBe(true);
    // Beneficiaries are exempt — consent service must not be consulted.
    expect(mockHasActiveConsent).not.toHaveBeenCalled();
  });
});
