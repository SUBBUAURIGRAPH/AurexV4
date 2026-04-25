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
