import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock @aurex/database before importing the service under test ──────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    monitoringPeriod: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    verificationReport: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

// Stub out baseline scenario lookup so we exercise the legacy "input"
// baseline path. The DMRV anchor hook does not depend on the scenario.
vi.mock('./baseline-scenario.service.js', () => ({
  getActiveForActivity: vi.fn().mockResolvedValue(null),
  computeForYear: vi.fn(),
}));

vi.mock('./audit-log.service.js', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

import { submitVerificationReport } from './verification.service.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const PERIOD_ID = '00000000-0000-4000-8000-000000000010';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000000011';
const ORG_ID = '00000000-0000-4000-8000-000000000012';
const DOE_USER_ID = '00000000-0000-4000-8000-000000000013';
const REPORT_ID = '00000000-0000-4000-8000-000000000014';

function buildPeriod() {
  return {
    id: PERIOD_ID,
    activityId: ACTIVITY_ID,
    status: 'SUBMITTED',
    periodEnd: new Date('2025-12-31T00:00:00Z'),
    activity: {
      id: ACTIVITY_ID,
      orgId: ORG_ID,
      isRemoval: false,
    },
  };
}

function buildReport(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    periodId: PERIOD_ID,
    doeUserId: DOE_USER_ID,
    doeOrgName: 'TUV-NORD',
    methodologyVersion: '1.0',
    baselineEmissions: 1000,
    projectEmissions: 200,
    leakageEmissions: 50,
    verifiedEr: 750,
    conservativeness: null,
    opinion: 'POSITIVE',
    findings: null,
    documentUrl: null,
    verifiedAt: new Date('2026-04-25T00:00:00Z'),
    dmrvAttestationId: null,
    dmrvTxHash: null,
    createdAt: new Date('2026-04-25T00:00:00Z'),
    ...overrides,
  };
}

const VALID_INPUT = {
  doeOrgName: 'TUV-NORD',
  methodologyVersion: '1.0',
  baselineEmissions: 1000,
  projectEmissions: 200,
  leakageEmissions: 50,
  opinion: 'POSITIVE' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('verification.service — DMRV anchor hook (AAT-ρ / AV4-377)', () => {
  it('signing a POSITIVE VerificationReport calls submitDmrvAttestation and persists ids', async () => {
    mockPrisma.monitoringPeriod.findUnique.mockResolvedValueOnce(buildPeriod());
    mockPrisma.verificationReport.findUnique.mockResolvedValueOnce(null);
    const created = buildReport();
    mockPrisma.verificationReport.create.mockResolvedValueOnce(created);
    mockPrisma.verificationReport.update.mockResolvedValueOnce({
      ...created,
      dmrvAttestationId: 'dmrv-77',
      dmrvTxHash: '0xanchor',
    });
    mockPrisma.monitoringPeriod.update.mockResolvedValueOnce({});

    const submitDmrv = vi.fn().mockResolvedValue({
      dmrvId: 'dmrv-77',
      txHash: '0xanchor',
    });

    const out = await submitVerificationReport(
      PERIOD_ID,
      ORG_ID,
      DOE_USER_ID,
      VALID_INPUT,
      { aurigraphAdapter: { submitDmrvAttestation: submitDmrv } },
    );

    expect(submitDmrv).toHaveBeenCalledTimes(1);
    expect(submitDmrv).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: ACTIVITY_ID,
        periodId: PERIOD_ID,
        payload: expect.objectContaining({
          verificationReportId: REPORT_ID,
          opinion: 'POSITIVE',
          methodologyVersion: '1.0',
        }),
      }),
    );

    // Persisted ids on the returned report.
    expect(out.report.dmrvAttestationId).toBe('dmrv-77');
    expect(out.report.dmrvTxHash).toBe('0xanchor');

    expect(mockPrisma.verificationReport.update).toHaveBeenCalledWith({
      where: { id: REPORT_ID },
      data: { dmrvAttestationId: 'dmrv-77', dmrvTxHash: '0xanchor' },
    });
  });

  it('DMRV anchor failure does NOT fail the verification (logged + retry pending)', async () => {
    mockPrisma.monitoringPeriod.findUnique.mockResolvedValueOnce(buildPeriod());
    mockPrisma.verificationReport.findUnique.mockResolvedValueOnce(null);
    const created = buildReport();
    mockPrisma.verificationReport.create.mockResolvedValueOnce(created);
    mockPrisma.monitoringPeriod.update.mockResolvedValueOnce({});

    const submitDmrv = vi
      .fn()
      .mockRejectedValue(new Error('Aurigraph DLT unreachable'));

    const out = await submitVerificationReport(
      PERIOD_ID,
      ORG_ID,
      DOE_USER_ID,
      VALID_INPUT,
      { aurigraphAdapter: { submitDmrvAttestation: submitDmrv } },
    );

    expect(submitDmrv).toHaveBeenCalledTimes(1);

    // Verification still returns successfully — the report is the unmodified
    // create() result with dmrvAttestationId still null (worker will retry).
    expect(out.report.id).toBe(REPORT_ID);
    expect(out.report.dmrvAttestationId).toBeNull();
    expect(out.report.dmrvTxHash).toBeNull();

    // No update call should have happened — anchor failed.
    expect(mockPrisma.verificationReport.update).not.toHaveBeenCalled();
  });

  it('NEGATIVE opinion does not anchor (DMRV is for signed positives only)', async () => {
    mockPrisma.monitoringPeriod.findUnique.mockResolvedValueOnce(buildPeriod());
    mockPrisma.verificationReport.findUnique.mockResolvedValueOnce(null);
    const created = buildReport({ opinion: 'NEGATIVE' });
    mockPrisma.verificationReport.create.mockResolvedValueOnce(created);
    mockPrisma.monitoringPeriod.update.mockResolvedValueOnce({});

    const submitDmrv = vi.fn();

    const out = await submitVerificationReport(
      PERIOD_ID,
      ORG_ID,
      DOE_USER_ID,
      { ...VALID_INPUT, opinion: 'NEGATIVE' },
      { aurigraphAdapter: { submitDmrvAttestation: submitDmrv } },
    );

    expect(submitDmrv).not.toHaveBeenCalled();
    expect(out.report.dmrvAttestationId).toBeNull();
  });

  it('already-anchored report does not re-anchor (idempotency by dmrvAttestationId presence)', async () => {
    mockPrisma.monitoringPeriod.findUnique.mockResolvedValueOnce(buildPeriod());
    mockPrisma.verificationReport.findUnique.mockResolvedValueOnce(null);
    // create() returns a report that already has an anchor id (e.g. from a
    // prior partial run that managed to persist before failing). The hook
    // must skip on presence.
    const alreadyAnchored = buildReport({
      dmrvAttestationId: 'dmrv-existing',
      dmrvTxHash: '0xexisting',
    });
    mockPrisma.verificationReport.create.mockResolvedValueOnce(alreadyAnchored);
    mockPrisma.monitoringPeriod.update.mockResolvedValueOnce({});

    const submitDmrv = vi.fn();

    const out = await submitVerificationReport(
      PERIOD_ID,
      ORG_ID,
      DOE_USER_ID,
      VALID_INPUT,
      { aurigraphAdapter: { submitDmrvAttestation: submitDmrv } },
    );

    expect(submitDmrv).not.toHaveBeenCalled();
    expect(out.report.dmrvAttestationId).toBe('dmrv-existing');
    expect(mockPrisma.verificationReport.update).not.toHaveBeenCalled();
  });
});
