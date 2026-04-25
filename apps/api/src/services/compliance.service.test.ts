import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock @aurex/database before importing the service under test ──────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    activity: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import {
  ComplianceActivityNotFoundError,
  getAttestation,
  listAttestationsForOrg,
  submitAttestationForActivity,
} from './compliance.service.js';

// ── Adapter stub builder ───────────────────────────────────────────────────

function makeAdapterStub(overrides?: {
  getComplianceAttestation?: ReturnType<typeof vi.fn>;
  listComplianceAttestations?: ReturnType<typeof vi.fn>;
  submitComplianceAttestation?: ReturnType<typeof vi.fn>;
}) {
  return {
    getComplianceAttestation: overrides?.getComplianceAttestation ?? vi.fn(),
    listComplianceAttestations: overrides?.listComplianceAttestations ?? vi.fn(),
    submitComplianceAttestation: overrides?.submitComplianceAttestation ?? vi.fn(),
  };
}

const ACTIVITY_ID = '00000000-0000-4000-8000-000000000010';
const ORG_ID = '00000000-0000-4000-8000-000000000020';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('compliance.service — getAttestation', () => {
  it('passes through to adapter.getComplianceAttestation unchanged', async () => {
    const expected = {
      id: 'attest-1',
      assetId: ORG_ID,
      framework: 'IFRS_S2',
      status: 'COMPLIANT',
      assessedAt: '2026-04-01T00:00:00Z',
    };
    const adapter = makeAdapterStub({
      getComplianceAttestation: vi.fn().mockResolvedValue(expected),
    });

    const result = await getAttestation('attest-1', { aurigraphAdapter: adapter });

    expect(result).toEqual(expected);
    expect(adapter.getComplianceAttestation).toHaveBeenCalledWith('attest-1');
  });
});

describe('compliance.service — listAttestationsForOrg', () => {
  it('maps orgId to subject and forwards since/limit options', async () => {
    const list = [
      { id: 'a1', assetId: ORG_ID, framework: 'F', status: 'OK', assessedAt: '2026-04-01T00:00:00Z' },
    ];
    const stub = vi.fn().mockResolvedValue(list);
    const adapter = makeAdapterStub({ listComplianceAttestations: stub });

    const since = new Date('2026-01-01T00:00:00Z');
    const result = await listAttestationsForOrg(
      ORG_ID,
      { since, limit: 10 },
      { aurigraphAdapter: adapter },
    );

    expect(result).toEqual(list);
    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenCalledWith({
      subject: ORG_ID,
      since,
      limit: 10,
    });
  });

  it('uses default empty opts when none supplied', async () => {
    const stub = vi.fn().mockResolvedValue([]);
    const adapter = makeAdapterStub({ listComplianceAttestations: stub });

    const result = await listAttestationsForOrg(ORG_ID, undefined, {
      aurigraphAdapter: adapter,
    });

    expect(result).toEqual([]);
    expect(stub).toHaveBeenCalledWith({
      subject: ORG_ID,
      since: undefined,
      limit: undefined,
    });
  });
});

describe('compliance.service — submitAttestationForActivity', () => {
  it('rejects unknown activity with ComplianceActivityNotFoundError', async () => {
    mockPrisma.activity.findUnique.mockResolvedValueOnce(null);
    const submit = vi.fn();
    const adapter = makeAdapterStub({ submitComplianceAttestation: submit });

    await expect(
      submitAttestationForActivity(
        ACTIVITY_ID,
        'IFRS_S2',
        { reportingPeriod: '2025' },
        { aurigraphAdapter: adapter },
      ),
    ).rejects.toBeInstanceOf(ComplianceActivityNotFoundError);

    expect(submit).not.toHaveBeenCalled();
  });

  it('happy path: looks up activity, derives subject, augments payload, returns adapter result', async () => {
    mockPrisma.activity.findUnique.mockResolvedValueOnce({
      id: ACTIVITY_ID,
      orgId: ORG_ID,
      title: 'Mangrove restoration',
    });
    const submit = vi.fn().mockResolvedValue({
      attestationId: 'attest-99',
      txHash: '0xtxhash',
    });
    const adapter = makeAdapterStub({ submitComplianceAttestation: submit });

    const result = await submitAttestationForActivity(
      ACTIVITY_ID,
      'BCR_RETIREMENT_PASSTHROUGH',
      { vintage: 2025 },
      { aurigraphAdapter: adapter },
    );

    expect(result).toEqual({ attestationId: 'attest-99', txHash: '0xtxhash' });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      subject: ACTIVITY_ID,
      kind: 'BCR_RETIREMENT_PASSTHROUGH',
      payload: {
        vintage: 2025,
        aurexActivityId: ACTIVITY_ID,
        aurexOrgId: ORG_ID,
      },
    });
  });
});
