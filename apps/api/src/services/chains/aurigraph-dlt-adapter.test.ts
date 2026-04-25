import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AurigraphClientError, AurigraphServerError } from '@aurigraph/dlt-sdk';

// ── Mock @aurex/database before importing the adapter ──────────────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    aurigraphCallLog: {
      create: vi.fn(),
    },
  },
}));

// Mirror the @prisma/client `Prisma` namespace shape needed by the adapter's
// JSON-helper usage. We supply only the symbols the adapter actually touches.
vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: { JsonNull: 'JSON_NULL_SENTINEL' },
}));

import {
  AurigraphDltAdapter,
  ChainClientError,
  ChainServerError,
  QuotaExhaustedError,
  type AurigraphClientLike,
} from './aurigraph-dlt-adapter.js';

// ── Test helpers ───────────────────────────────────────────────────────────

interface MockClient extends AurigraphClientLike {
  __spies: {
    deploy: ReturnType<typeof vi.fn>;
    transfer: ReturnType<typeof vi.fn>;
    getAsset: ReturnType<typeof vi.fn>;
    listByUseCase: ReturnType<typeof vi.fn>;
    getPublicLedger: ReturnType<typeof vi.fn>;
    getQuota: ReturnType<typeof vi.fn>;
    complianceAssess: ReturnType<typeof vi.fn>;
    complianceGetAssessments: ReturnType<typeof vi.fn>;
    dmrvRecordEvent: ReturnType<typeof vi.fn>;
    dmrvGetAuditTrail: ReturnType<typeof vi.fn>;
  };
}

function makeMockClient(opts?: {
  quotaRemaining?: number;
  quotaLimit?: number;
}): MockClient {
  const remaining = opts?.quotaRemaining ?? 1000;
  const limit = opts?.quotaLimit ?? 10_000;

  const spies = {
    deploy: vi.fn(),
    transfer: vi.fn(),
    getAsset: vi.fn(),
    listByUseCase: vi.fn(),
    getPublicLedger: vi.fn(),
    getQuota: vi.fn().mockResolvedValue({
      mintMonthlyLimit: limit,
      mintMonthlyUsed: limit - remaining,
      mintMonthlyRemaining: remaining,
      dmrvDailyLimit: 1000,
      dmrvDailyUsed: 0,
      dmrvDailyRemaining: 1000,
    }),
    complianceAssess: vi.fn(),
    complianceGetAssessments: vi.fn(),
    dmrvRecordEvent: vi.fn(),
    dmrvGetAuditTrail: vi.fn(),
  };

  const client = {
    contracts: {
      deploy: spies.deploy,
    },
    assets: {
      get: spies.getAsset,
      listByUseCase: spies.listByUseCase,
      getPublicLedger: spies.getPublicLedger,
    },
    wallet: {
      transfer: spies.transfer,
    },
    tier: {
      getQuota: spies.getQuota,
    },
    compliance: {
      assess: spies.complianceAssess,
      getAssessments: spies.complianceGetAssessments,
    },
    dmrv: {
      recordEvent: spies.dmrvRecordEvent,
      getAuditTrail: spies.dmrvGetAuditTrail,
    },
    __spies: spies,
  } as unknown as MockClient;

  return client;
}

const VALID_DEPLOY = {
  templateId: 'UC_CARBON',
  useCaseId: 'UC_CARBON',
  channelId: 'marketplace-channel',
  terms: {
    sourceProjectId: 'proj-1',
    vintageYear: 2025,
    quantityTonnes: 100,
    methodology: 'VCS',
    retiredBy: 'org-1',
    retiredFor: 'NDC',
  },
};

const DEPLOY_OK = { contractId: 'ctr-123', txHash: '0xdead' };

// 7807 problem-detail builder for SDK error fixtures.
function problem(status: number, errorCode = 'X') {
  return {
    type: 'about:blank',
    title: 'Error',
    status,
    errorCode,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.aurigraphCallLog.create.mockResolvedValue({});
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AurigraphDltAdapter — construction', () => {
  it('constructs with an injected client and exposes adapterName', () => {
    const adapter = new AurigraphDltAdapter({
      client: makeMockClient(),
      channelId: 'test-channel',
    });
    expect(adapter.adapterName).toBe('aurigraph-dlt-v1.2.0');
  });
});

describe('AurigraphDltAdapter — deployContract', () => {
  it('happy path: returns contractId/txHash and writes a SUCCESS audit row', async () => {
    const client = makeMockClient();
    client.__spies.deploy.mockResolvedValue(DEPLOY_OK);
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.deployContract(VALID_DEPLOY);

    expect(result).toEqual(DEPLOY_OK);
    expect(client.__spies.getQuota).toHaveBeenCalledTimes(1); // pre-flight
    expect(client.__spies.deploy).toHaveBeenCalledTimes(1);

    // Two audit rows: pre-flight is silent on success; only the deploy logs.
    expect(mockPrisma.aurigraphCallLog.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('contracts.deploy');
    expect(arg.data.status).toBe('SUCCESS');
    expect(arg.data.responseRef).toBe('ctr-123');
    expect(typeof arg.data.latencyMs).toBe('number');
  });

  it('retries on transient AurigraphServerError and succeeds on retry — logs RETRIED', async () => {
    const client = makeMockClient();
    client.__spies.deploy
      .mockRejectedValueOnce(
        new AurigraphServerError('boom', 502, problem(502, 'BAD_GATEWAY')),
      )
      .mockResolvedValueOnce(DEPLOY_OK);
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.deployContract(VALID_DEPLOY);

    expect(result).toEqual(DEPLOY_OK);
    expect(client.__spies.deploy).toHaveBeenCalledTimes(2);
    expect(mockPrisma.aurigraphCallLog.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.status).toBe('RETRIED');
    expect(arg.data.responseRef).toBe('ctr-123');
  });

  it('exhausts retries on persistent AurigraphServerError — throws ChainServerError + FAILED audit row', async () => {
    const client = makeMockClient();
    client.__spies.deploy.mockRejectedValue(
      new AurigraphServerError('still down', 503, problem(503, 'UPSTREAM')),
    );
    const adapter = new AurigraphDltAdapter({ client });

    await expect(adapter.deployContract(VALID_DEPLOY)).rejects.toBeInstanceOf(
      ChainServerError,
    );
    expect(client.__spies.deploy).toHaveBeenCalledTimes(3); // 3 attempts

    expect(mockPrisma.aurigraphCallLog.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.status).toBe('FAILED');
    expect(arg.data.errorCode).toBe('UPSTREAM');
    expect(arg.data.errorMsg).toMatch(/still down/);
  });

  it('quota exhausted: throws QuotaExhaustedError WITHOUT contacting the SDK and writes a FAILED audit row', async () => {
    const client = makeMockClient({ quotaRemaining: 0, quotaLimit: 10_000 });
    const adapter = new AurigraphDltAdapter({ client });

    await expect(adapter.deployContract(VALID_DEPLOY)).rejects.toBeInstanceOf(
      QuotaExhaustedError,
    );

    expect(client.__spies.getQuota).toHaveBeenCalledTimes(1);
    expect(client.__spies.deploy).not.toHaveBeenCalled();

    expect(mockPrisma.aurigraphCallLog.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.status).toBe('FAILED');
    expect(arg.data.errorCode).toBe('QUOTA_EXHAUSTED');
  });

  it('does not retry on AurigraphClientError (4xx) — maps to ChainClientError immediately', async () => {
    const client = makeMockClient();
    client.__spies.deploy.mockRejectedValue(
      new AurigraphClientError('bad input', 400, problem(400, 'VALIDATION')),
    );
    const adapter = new AurigraphDltAdapter({ client });

    await expect(adapter.deployContract(VALID_DEPLOY)).rejects.toBeInstanceOf(
      ChainClientError,
    );
    expect(client.__spies.deploy).toHaveBeenCalledTimes(1);

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.status).toBe('FAILED');
    expect(arg.data.errorCode).toBe('VALIDATION');
  });
});

describe('AurigraphDltAdapter — reads', () => {
  it('getAsset: happy path returns SDK payload + writes SUCCESS audit row', async () => {
    const client = makeMockClient();
    client.__spies.getAsset.mockResolvedValue({ id: 'asset-1', useCase: 'UC_CARBON' });
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.getAsset('asset-1');

    expect(result).toEqual({ id: 'asset-1', useCase: 'UC_CARBON' });
    expect(client.__spies.getAsset).toHaveBeenCalledWith('asset-1');
    expect(client.__spies.getQuota).not.toHaveBeenCalled(); // reads skip pre-flight

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('assets.get');
    expect(arg.data.status).toBe('SUCCESS');
  });

  it('listByUseCase: returns the assets envelope from the SDK', async () => {
    const client = makeMockClient();
    const envelope = { assets: [{ id: 'a1' }, { id: 'a2' }], total: 2 };
    client.__spies.listByUseCase.mockResolvedValue(envelope);
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.listByUseCase('UC_CARBON');

    expect(result).toEqual(envelope);
    expect(client.__spies.listByUseCase).toHaveBeenCalledWith('UC_CARBON');
    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('assets.listByUseCase');
  });

  it('getPublicLedger: returns enriched ledger view from the SDK', async () => {
    const client = makeMockClient();
    const ledger = { useCase: 'UC_CARBON', entries: [{ tokenId: 't1' }] };
    client.__spies.getPublicLedger.mockResolvedValue(ledger);
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.getPublicLedger('UC_CARBON');

    expect(result).toEqual(ledger);
    expect(client.__spies.getPublicLedger).toHaveBeenCalledWith('UC_CARBON');
    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('assets.getPublicLedger');
  });
});

describe('AurigraphDltAdapter — mutations write call logs', () => {
  it('transferAsset: writes a SUCCESS call log with txHash as responseRef', async () => {
    const client = makeMockClient();
    client.__spies.transfer.mockResolvedValue({
      txHash: '0xtransfer',
      status: 'COMMITTED',
      timestamp: '2026-04-24T00:00:00Z',
    });
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.transferAsset({
      from: 'wallet-a',
      to: 'wallet-b',
      amount: 50,
      currency: 'CARBON',
    });

    expect(result.txHash).toBe('0xtransfer');
    expect(client.__spies.transfer).toHaveBeenCalledTimes(1);
    expect(client.__spies.getQuota).toHaveBeenCalledTimes(1); // pre-flight

    expect(mockPrisma.aurigraphCallLog.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('wallet.transfer');
    expect(arg.data.status).toBe('SUCCESS');
    expect(arg.data.responseRef).toBe('0xtransfer');
  });

  it('burnAsset: dispatches via contracts.deploy with RETIREMENT template + writes call log', async () => {
    const client = makeMockClient();
    client.__spies.deploy.mockResolvedValue({ contractId: 'retire-1', txHash: '0xburn' });
    const adapter = new AurigraphDltAdapter({ client, channelId: 'marketplace-channel' });

    const result = await adapter.burnAsset({
      assetId: 'asset-1',
      amount: 25,
      reason: 'voluntary retirement',
      retiredBy: 'org-7',
    });

    expect(result.contractId).toBe('retire-1');
    expect(client.__spies.deploy).toHaveBeenCalledTimes(1);
    const deployArg = client.__spies.deploy.mock.calls[0]![0]!;
    expect(deployArg.templateId).toBe('RETIREMENT');
    expect(deployArg.useCaseId).toBe('RETIREMENT');
    expect(deployArg.channelId).toBe('marketplace-channel');
    expect(deployArg.terms).toMatchObject({
      assetId: 'asset-1',
      amount: 25,
      reason: 'voluntary retirement',
      retiredBy: 'org-7',
    });

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('contracts.deploy.retire');
    expect(arg.data.status).toBe('SUCCESS');
    expect(arg.data.responseRef).toBe('retire-1');
  });
});

describe('AurigraphDltAdapter — getQuota', () => {
  it('returns the SDK quota payload + writes SUCCESS audit row', async () => {
    const client = makeMockClient({ quotaRemaining: 42, quotaLimit: 100 });
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.getQuota();

    expect(result.mintMonthlyRemaining).toBe(42);
    expect(result.mintMonthlyLimit).toBe(100);

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('tier.getQuota');
    expect(arg.data.status).toBe('SUCCESS');
  });
});

describe('AurigraphDltAdapter — audit log resilience', () => {
  it('does not propagate Prisma errors from the audit-log write', async () => {
    const client = makeMockClient();
    client.__spies.deploy.mockResolvedValue(DEPLOY_OK);
    mockPrisma.aurigraphCallLog.create.mockRejectedValueOnce(
      new Error('audit DB down'),
    );
    const adapter = new AurigraphDltAdapter({ client });

    // Even though the audit write fails, the deploy must succeed.
    const result = await adapter.deployContract(VALID_DEPLOY);
    expect(result).toEqual(DEPLOY_OK);
  });
});

// ── AAT-ρ / AV4-376 — Compliance namespace ─────────────────────────────────

describe('AurigraphDltAdapter — getComplianceAttestation', () => {
  it('happy path: returns the matching assessment + writes SUCCESS audit row', async () => {
    const client = makeMockClient();
    const assessment = {
      id: 'attest-7',
      assetId: 'subject-1',
      framework: 'IFRS_S2',
      status: 'COMPLIANT',
      assessedAt: '2026-04-01T00:00:00Z',
    };
    client.__spies.complianceGetAssessments.mockResolvedValue([
      assessment,
      { id: 'attest-other', assetId: 'subject-1', framework: 'X', status: 'PENDING', assessedAt: '2026-04-02T00:00:00Z' },
    ]);
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.getComplianceAttestation('attest-7');

    expect(result).toEqual(assessment);
    expect(client.__spies.complianceGetAssessments).toHaveBeenCalledWith('attest-7');
    expect(client.__spies.getQuota).not.toHaveBeenCalled(); // reads skip pre-flight

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('compliance.getAttestation');
    expect(arg.data.status).toBe('SUCCESS');
  });

  it('not-found: maps to ChainClientError + FAILED audit row (no retry)', async () => {
    const client = makeMockClient();
    client.__spies.complianceGetAssessments.mockResolvedValue([]);
    const adapter = new AurigraphDltAdapter({ client });

    await expect(adapter.getComplianceAttestation('missing')).rejects.toBeInstanceOf(
      ChainClientError,
    );
    // 4xx semantics — only one call (no retry on ChainClientError).
    expect(client.__spies.complianceGetAssessments).toHaveBeenCalledTimes(1);

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.status).toBe('FAILED');
    expect(arg.data.errorCode).toBe('COMPLIANCE_ATTESTATION_NOT_FOUND');
  });

  it('does not retry on AurigraphClientError (4xx) — maps to ChainClientError immediately', async () => {
    const client = makeMockClient();
    client.__spies.complianceGetAssessments.mockRejectedValue(
      new AurigraphClientError('forbidden', 403, problem(403, 'FORBIDDEN')),
    );
    const adapter = new AurigraphDltAdapter({ client });

    await expect(adapter.getComplianceAttestation('attest-1')).rejects.toBeInstanceOf(
      ChainClientError,
    );
    expect(client.__spies.complianceGetAssessments).toHaveBeenCalledTimes(1);

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.status).toBe('FAILED');
    expect(arg.data.errorCode).toBe('FORBIDDEN');
  });

  it('retries on transient AurigraphServerError and succeeds — logs RETRIED', async () => {
    const client = makeMockClient();
    const assessment = {
      id: 'attest-9',
      assetId: 'subject-1',
      framework: 'IFRS_S2',
      status: 'COMPLIANT',
      assessedAt: '2026-04-01T00:00:00Z',
    };
    client.__spies.complianceGetAssessments
      .mockRejectedValueOnce(
        new AurigraphServerError('flap', 503, problem(503, 'UPSTREAM_DOWN')),
      )
      .mockResolvedValueOnce([assessment]);
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.getComplianceAttestation('attest-9');

    expect(result).toEqual(assessment);
    expect(client.__spies.complianceGetAssessments).toHaveBeenCalledTimes(2);
    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.status).toBe('RETRIED');
  });
});

describe('AurigraphDltAdapter — listComplianceAttestations', () => {
  it('honours since + limit client-side after fetching SDK assessments', async () => {
    const client = makeMockClient();
    client.__spies.complianceGetAssessments.mockResolvedValue([
      { id: 'a1', assetId: 'org-1', framework: 'F', status: 'OK', assessedAt: '2026-01-01T00:00:00Z' },
      { id: 'a2', assetId: 'org-1', framework: 'F', status: 'OK', assessedAt: '2026-03-01T00:00:00Z' },
      { id: 'a3', assetId: 'org-1', framework: 'F', status: 'OK', assessedAt: '2026-04-01T00:00:00Z' },
    ]);
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.listComplianceAttestations({
      subject: 'org-1',
      since: new Date('2026-02-01T00:00:00Z'),
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a2');
    expect(client.__spies.complianceGetAssessments).toHaveBeenCalledWith('org-1');
  });
});

describe('AurigraphDltAdapter — submitComplianceAttestation', () => {
  it('happy path: calls compliance.assess + returns attestationId/txHash + SUCCESS audit row', async () => {
    const client = makeMockClient();
    client.__spies.complianceAssess.mockResolvedValue({
      id: 'attest-100',
      txHash: '0xcompliance',
      assetId: 'org-1',
      framework: 'IFRS_S2',
      status: 'COMPLIANT',
      assessedAt: '2026-04-25T00:00:00Z',
    });
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.submitComplianceAttestation({
      subject: 'org-1',
      kind: 'IFRS_S2',
      payload: { reportingPeriod: '2025' },
    });

    expect(result.attestationId).toBe('attest-100');
    expect(result.txHash).toBe('0xcompliance');
    expect(client.__spies.complianceAssess).toHaveBeenCalledWith(
      'org-1',
      'IFRS_S2',
      { reportingPeriod: '2025' },
    );
    expect(client.__spies.getQuota).toHaveBeenCalledTimes(1); // pre-flight

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('compliance.submitAttestation');
    expect(arg.data.status).toBe('SUCCESS');
    expect(arg.data.responseRef).toBe('attest-100');
  });

  it('does not retry on 5xx — submit semantics match transferAsset', async () => {
    const client = makeMockClient();
    client.__spies.complianceAssess.mockRejectedValue(
      new AurigraphServerError('boom', 502, problem(502, 'UPSTREAM_BAD_GATEWAY')),
    );
    const adapter = new AurigraphDltAdapter({ client });

    await expect(
      adapter.submitComplianceAttestation({ subject: 'org-1', kind: 'X', payload: {} }),
    ).rejects.toBeInstanceOf(ChainServerError);
    // Single call — no retry on 5xx for submits (per spec).
    expect(client.__spies.complianceAssess).toHaveBeenCalledTimes(1);

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.status).toBe('FAILED');
    expect(arg.data.errorCode).toBe('UPSTREAM_BAD_GATEWAY');
  });
});

// ── AAT-ρ / AV4-377 — DMRV namespace ───────────────────────────────────────

describe('AurigraphDltAdapter — submitDmrvAttestation', () => {
  it('happy path: returns dmrvId/txHash + SUCCESS audit row + injects metadata', async () => {
    const client = makeMockClient();
    client.__spies.dmrvRecordEvent.mockResolvedValue({
      eventId: 'dmrv-42',
      status: 'ACCEPTED',
      txHash: '0xanchor',
      timestamp: '2026-04-25T00:00:00Z',
    });
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.submitDmrvAttestation({
      activityId: 'act-1',
      periodId: 'period-1',
      payload: { verifiedEr: 100 },
    });

    expect(result).toEqual({ dmrvId: 'dmrv-42', txHash: '0xanchor' });
    expect(client.__spies.getQuota).toHaveBeenCalledTimes(1); // pre-flight

    const event = client.__spies.dmrvRecordEvent.mock.calls[0]![0]!;
    expect(event.deviceId).toBe('aurex:verification:period-1');
    expect(event.eventType).toBe('CARBON_OFFSET');
    expect(event.metadata).toMatchObject({
      verifiedEr: 100,
      aurexActivityId: 'act-1',
      aurexPeriodId: 'period-1',
      attestationKind: 'verification_report',
    });

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('dmrv.submitAttestation');
    expect(arg.data.status).toBe('SUCCESS');
    expect(arg.data.responseRef).toBe('dmrv-42');
  });

  it('writes a FAILED audit row when the SDK throws and surfaces ChainClientError', async () => {
    const client = makeMockClient();
    client.__spies.dmrvRecordEvent.mockRejectedValue(
      new AurigraphClientError('bad device', 422, problem(422, 'DEVICE_UNREGISTERED')),
    );
    const adapter = new AurigraphDltAdapter({ client });

    await expect(
      adapter.submitDmrvAttestation({
        activityId: 'act-1',
        periodId: 'period-1',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(ChainClientError);

    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('dmrv.submitAttestation');
    expect(arg.data.status).toBe('FAILED');
    expect(arg.data.errorCode).toBe('DEVICE_UNREGISTERED');
  });
});

describe('AurigraphDltAdapter — listDmrvForActivity', () => {
  it('filters audit-trail events by metadata.aurexActivityId or contractId', async () => {
    const client = makeMockClient();
    client.__spies.dmrvGetAuditTrail.mockResolvedValue([
      { eventId: 'e1', deviceId: 'd1', eventType: 'METER_READING', quantity: 1, metadata: { aurexActivityId: 'act-1' } },
      { eventId: 'e2', deviceId: 'd2', eventType: 'METER_READING', quantity: 1, metadata: { aurexActivityId: 'act-other' } },
      { eventId: 'e3', deviceId: 'd3', eventType: 'METER_READING', quantity: 1, contractId: 'act-1' },
    ]);
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.listDmrvForActivity('act-1', { limit: 50 });

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.eventId)).toEqual(['e1', 'e3']);
    const arg = mockPrisma.aurigraphCallLog.create.mock.calls[0]![0]!;
    expect(arg.data.method).toBe('dmrv.listForActivity');
    expect(arg.data.status).toBe('SUCCESS');
  });
});
