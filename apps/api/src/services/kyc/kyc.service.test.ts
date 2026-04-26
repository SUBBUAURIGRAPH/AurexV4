import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock @aurex/database before importing the service ─────────────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    kycVerification: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    kycVerificationEvent: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

// AAT-R3 / AV4-429: the new DPDP consent gate inside startVerification calls
// hasActiveConsent(). The original suite predates that gate and seeds USER
// verifications without consent rows — short-circuit the gate to true here
// so the suite stays focused on KYC adapter behaviour. The new
// `kyc.consent-gate.test.ts` covers the gate behaviour explicitly.
const { mockHasActiveConsent } = vi.hoisted(() => ({
  mockHasActiveConsent: vi.fn().mockResolvedValue(true),
}));
vi.mock('../dpdp/consent.service.js', () => ({
  CONSENT_PURPOSES: {
    KYC_VERIFICATION: 'kyc_verification',
  },
  hasActiveConsent: mockHasActiveConsent,
}));

import { __resetKycAdapterCache } from './index.js';
import {
  markBeneficiaryVerified,
  revokeVerification,
  startVerification,
} from './kyc.service.js';

// ─── Setup ──────────────────────────────────────────────────────────────
//
// The service uses the `mock` adapter (env-keyed factory) so each test
// drives a real MockKycAdapter under the hood. Persistence + event
// recording is mocked at the prisma layer.

const ORIGINAL_KYC_ADAPTER = process.env.KYC_ADAPTER;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.kycVerification.create.mockReset();
  mockPrisma.kycVerification.findUnique.mockReset();
  mockPrisma.kycVerification.update.mockReset();
  mockPrisma.kycVerificationEvent.create.mockReset();
  mockPrisma.kycVerificationEvent.create.mockResolvedValue({ id: 'evt-1' });
  mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

  process.env.KYC_ADAPTER = 'mock';
  __resetKycAdapterCache();
});

afterEach(() => {
  if (ORIGINAL_KYC_ADAPTER === undefined) {
    delete process.env.KYC_ADAPTER;
  } else {
    process.env.KYC_ADAPTER = ORIGINAL_KYC_ADAPTER;
  }
  __resetKycAdapterCache();
});

// ─── Tests ──────────────────────────────────────────────────────────────

describe('startVerification — service-level integration', () => {
  it('persists a KycVerification row with subjectKind=USER + adapter vendorRef on success', async () => {
    const persistedRow = {
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
      lastCheckedAt: new Date('2026-04-25T00:00:00Z'),
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date('2026-04-25T00:00:00Z'),
      updatedAt: new Date('2026-04-25T00:00:00Z'),
    };
    mockPrisma.kycVerification.create.mockResolvedValue(persistedRow);

    const result = await startVerification({
      subjectKind: 'user',
      subjectRef: '00000000-0000-4000-8000-000000000001',
      level: 'basic',
      metadata: { country: 'IN' },
      orgId: '00000000-0000-4000-8000-000000000050',
      userId: '00000000-0000-4000-8000-000000000060',
    });

    expect(result.synced).toBe(true);
    expect(result.adapterName).toBe('mock');
    expect(result.verification?.id).toBe(
      '00000000-0000-4000-8000-000000000100',
    );
    expect(result.verification?.subjectKind).toBe('user');
    expect(result.verification?.status).toBe('pending');

    // Persistence: subjectKind goes in as the upper-case prisma enum.
    expect(mockPrisma.kycVerification.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.kycVerification.create.mock.calls[0]![0]!;
    expect(createArg.data.subjectKind).toBe('USER');
    expect(createArg.data.level).toBe('BASIC');
    expect(createArg.data.status).toBe('PENDING');
    expect(createArg.data.vendorName).toBe('mock');
    expect(createArg.data.vendorRef).toMatch(/^MOCK-KYC-/);

    // Sync event + audit log written for observability.
    expect(mockPrisma.kycVerificationEvent.create).toHaveBeenCalledTimes(1);
    const eventArg = mockPrisma.kycVerificationEvent.create.mock.calls[0]![0]!;
    expect(eventArg.data.eventType).toBe('START_VERIFICATION');
    expect(eventArg.data.adapterName).toBe('mock');
    expect(eventArg.data.synced).toBe(true);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('starts a beneficiary KYC and persists with subjectKind=BENEFICIARY', async () => {
    mockPrisma.kycVerification.create.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000101',
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
      lastCheckedAt: new Date('2026-04-25T00:00:00Z'),
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date('2026-04-25T00:00:00Z'),
      updatedAt: new Date('2026-04-25T00:00:00Z'),
    });

    const result = await startVerification({
      subjectKind: 'beneficiary',
      subjectRef: 'beneficiary-ref-1',
      level: 'enhanced',
      metadata: { name: 'Acme Co.' },
      orgId: '00000000-0000-4000-8000-000000000050',
      userId: null,
    });

    expect(result.synced).toBe(true);
    expect(result.verification?.subjectKind).toBe('beneficiary');
    expect(result.verification?.level).toBe('enhanced');

    const createArg = mockPrisma.kycVerification.create.mock.calls[0]![0]!;
    expect(createArg.data.subjectKind).toBe('BENEFICIARY');
    expect(createArg.data.level).toBe('ENHANCED');
  });

  it('records a sync event with synced=false when the adapter rejects (no row created)', async () => {
    // Empty subjectRef triggers the mock adapter to reject without creating a
    // verification — the service must NOT call kycVerification.create.
    const result = await startVerification({
      subjectKind: 'user',
      subjectRef: '   ',
      level: 'basic',
      metadata: {},
      orgId: null,
      userId: null,
    });

    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/subjectRef is required/);
    expect(result.verification).toBeNull();
    expect(mockPrisma.kycVerification.create).not.toHaveBeenCalled();
    // The org-wide audit row is still written so the failure is auditable.
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});

describe('revokeVerification — service-level integration', () => {
  it('flips the row to REVOKED with revokedAt + revokedReason on adapter success', async () => {
    const verificationId = '00000000-0000-4000-8000-000000000200';
    const vendorRef = 'MOCK-KYC-vendor-ref-3';

    // First, populate the mock adapter so revokeVerification works against it.
    // We start a verification, auto-approve via getVerificationStatus, and use
    // the resulting vendor verification id for the underlying revoke call.
    const { getKycAdapter } = await import('./index.js');
    const adapter = getKycAdapter();
    const start = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-revoke-svc',
      level: 'basic',
      metadata: {},
    });
    expect(start.synced).toBe(true);
    await adapter.getVerificationStatus({
      verificationId: start.data!.verificationId,
    });

    // The service looks up the row by id, then calls the adapter using the
    // row's vendorRef. We seed the mock-side row to have a vendorRef that
    // matches the live mock adapter's verification id so the revoke succeeds.
    mockPrisma.kycVerification.findUnique.mockResolvedValue({
      id: verificationId,
      subjectKind: 'USER',
      subjectRef: 'subject-revoke-svc',
      level: 'BASIC',
      status: 'APPROVED',
      vendorName: 'mock',
      vendorRef: start.data!.verificationId, // bridge to the in-memory mock
      riskScore: 10,
      sanctionsHit: false,
      beneficiaryRef: null,
      attestations: null,
      lastCheckedAt: new Date('2026-04-25T00:00:00Z'),
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date('2026-04-25T00:00:00Z'),
      updatedAt: new Date('2026-04-25T00:00:00Z'),
    });
    mockPrisma.kycVerification.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: verificationId,
        subjectKind: 'USER',
        subjectRef: 'subject-revoke-svc',
        level: 'BASIC',
        status: data.status,
        vendorName: 'mock',
        vendorRef: vendorRef,
        riskScore: 10,
        sanctionsHit: false,
        beneficiaryRef: null,
        attestations: null,
        lastCheckedAt: new Date('2026-04-25T00:00:00Z'),
        revokedAt: data.revokedAt,
        revokedReason: data.revokedReason,
        createdAt: new Date('2026-04-25T00:00:00Z'),
        updatedAt: new Date('2026-04-25T00:00:00Z'),
      }),
    );

    const result = await revokeVerification({
      verificationId,
      reason: 'sanctions list match',
      orgId: '00000000-0000-4000-8000-000000000050',
      userId: '00000000-0000-4000-8000-000000000060',
    });

    expect(result.synced).toBe(true);
    expect(result.verification?.status).toBe('revoked');
    expect(result.verification?.revokedReason).toBe('sanctions list match');
    expect(result.verification?.revokedAt).not.toBeNull();

    expect(mockPrisma.kycVerification.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.kycVerification.update.mock.calls[0]![0]!;
    expect(updateArg.where).toEqual({ id: verificationId });
    expect(updateArg.data.status).toBe('REVOKED');
    expect(updateArg.data.revokedReason).toBe('sanctions list match');
    expect(updateArg.data.revokedAt).toBeInstanceOf(Date);

    // Sync event recorded.
    expect(mockPrisma.kycVerificationEvent.create).toHaveBeenCalledTimes(1);
    const eventArg = mockPrisma.kycVerificationEvent.create.mock.calls[0]![0]!;
    expect(eventArg.data.eventType).toBe('REVOKE');
    expect(eventArg.data.synced).toBe(true);
  });
});

describe('markBeneficiaryVerified — service-level integration', () => {
  it('persists beneficiaryRef + attestations on adapter success', async () => {
    const verificationId = '00000000-0000-4000-8000-000000000300';

    // Drive the underlying mock adapter to an approved state.
    const { getKycAdapter } = await import('./index.js');
    const adapter = getKycAdapter();
    const start = await adapter.startVerification({
      subjectKind: 'beneficiary',
      subjectRef: 'beneficiary-svc',
      level: 'basic',
      metadata: {},
    });
    await adapter.getVerificationStatus({
      verificationId: start.data!.verificationId,
    });

    mockPrisma.kycVerification.findUnique.mockResolvedValue({
      id: verificationId,
      subjectKind: 'BENEFICIARY',
      subjectRef: 'beneficiary-svc',
      level: 'BASIC',
      status: 'APPROVED',
      vendorName: 'mock',
      vendorRef: start.data!.verificationId,
      riskScore: 10,
      sanctionsHit: false,
      beneficiaryRef: null,
      attestations: null,
      lastCheckedAt: new Date('2026-04-25T00:00:00Z'),
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date('2026-04-25T00:00:00Z'),
      updatedAt: new Date('2026-04-25T00:00:00Z'),
    });
    mockPrisma.kycVerification.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: verificationId,
        subjectKind: 'BENEFICIARY',
        subjectRef: 'beneficiary-svc',
        level: 'BASIC',
        status: 'APPROVED',
        vendorName: 'mock',
        vendorRef: start.data!.verificationId,
        riskScore: 10,
        sanctionsHit: false,
        beneficiaryRef: data.beneficiaryRef,
        attestations: data.attestations,
        lastCheckedAt: data.lastCheckedAt,
        revokedAt: null,
        revokedReason: null,
        createdAt: new Date('2026-04-25T00:00:00Z'),
        updatedAt: new Date('2026-04-25T00:00:00Z'),
      }),
    );

    const result = await markBeneficiaryVerified({
      verificationId,
      beneficiaryRef: 'Acme Sustainability Inc.',
      attestations: [
        {
          kind: 'aml_screening_v1',
          value: 'clean',
          signedAt: '2026-04-25T00:00:00Z',
        },
      ],
      orgId: '00000000-0000-4000-8000-000000000050',
      userId: '00000000-0000-4000-8000-000000000060',
    });

    expect(result.synced).toBe(true);
    expect(result.verification?.beneficiaryRef).toBe(
      'Acme Sustainability Inc.',
    );
    expect(result.verification?.attestations?.length).toBe(1);

    const updateArg = mockPrisma.kycVerification.update.mock.calls[0]![0]!;
    expect(updateArg.data.beneficiaryRef).toBe('Acme Sustainability Inc.');
    expect(updateArg.data.attestations).toHaveLength(1);

    const eventArg = mockPrisma.kycVerificationEvent.create.mock.calls[0]![0]!;
    expect(eventArg.data.eventType).toBe('MARK_BENEFICIARY');
    expect(eventArg.data.synced).toBe(true);
  });
});
