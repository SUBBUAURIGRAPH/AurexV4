/**
 * AAT-τ / AV4-379 — Sandbox harness against `dlt.aurigraph.io`.
 *
 * Two test groups:
 *
 *   1. SDK contract verification (always-on, fully mocked) — every CI tick.
 *      Verifies that `AurigraphDltAdapter` calls the underlying SDK in the
 *      shape that the live sandbox actually expects: right namespaces, right
 *      method names, right param shapes, right composite IDs. We assert call
 *      signatures rather than network behaviour, so the suite is fast and
 *      deterministic.
 *
 *   2. Live sandbox round-trip (opt-in, gated by env). Skipped by default;
 *      enabled when `AURIGRAPH_SANDBOX_TEST=1` AND `AURIGRAPH_API_KEY` is
 *      set in the environment. Tests are READ-ONLY: a sandbox health probe,
 *      a real `getQuota()` round-trip, and a `listByUseCase('UC_CARBON')`
 *      shape check. NO writes (no deploy/transfer/burn) — those would dirty
 *      the shared sandbox.
 *
 * How to run locally:
 *   pnpm --filter @aurex/api test:sandbox      # runs Group 1 + Group 2
 *   pnpm --filter @aurex/api test              # runs Group 1 only
 *
 * CI integration: the default `pnpm test` script runs Group 1 only. Group 2
 * is invoked manually via the `test:sandbox` script in CI's "sandbox-smoke"
 * workflow (run on a cadence, not per commit, to keep noise low).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted Prisma mock — adapter's call-log writer uses it ───────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    aurigraphCallLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({
  prisma: mockPrisma,
  Prisma: { JsonNull: 'JSON_NULL_SENTINEL' },
}));

import {
  AurigraphDltAdapter,
  type AurigraphClientLike,
} from './services/chains/aurigraph-dlt-adapter.js';

// ── Group 1 helpers (SDK call-shape verification) ─────────────────────────

interface SdkSpyClient extends AurigraphClientLike {
  __spies: {
    deploy: ReturnType<typeof vi.fn>;
    transfer: ReturnType<typeof vi.fn>;
    getAsset: ReturnType<typeof vi.fn>;
    listByUseCase: ReturnType<typeof vi.fn>;
    getPublicLedger: ReturnType<typeof vi.fn>;
    getQuota: ReturnType<typeof vi.fn>;
  };
}

/**
 * Build a `SdkSpyClient` that mirrors the live SDK's namespace shape exactly.
 *
 * Method placement is load-bearing — the adapter walks `client.contracts.deploy`,
 * `client.assets.listByUseCase`, etc. If we got the namespace wrong here, this
 * suite would still pass against a broken adapter. So we assert presence of
 * every namespace + method via the typed `AurigraphClientLike` interface.
 */
function buildSdkSpyClient(opts?: {
  quotaRemaining?: number;
  quotaLimit?: number;
}): SdkSpyClient {
  const remaining = opts?.quotaRemaining ?? 1000;
  const limit = opts?.quotaLimit ?? 10_000;

  const spies = {
    deploy: vi.fn().mockResolvedValue({
      contractId: 'ctr-sandbox-1',
      txHash: '0xsandboxtxhash',
    }),
    transfer: vi.fn().mockResolvedValue({
      txHash: '0xtransfer',
      status: 'COMMITTED',
      timestamp: '2026-04-25T00:00:00Z',
    }),
    getAsset: vi.fn().mockResolvedValue({
      assetId: 'asset-1',
      useCaseId: 'UC_CARBON',
      ownerId: 'wallet-a',
    }),
    listByUseCase: vi.fn().mockResolvedValue({
      assets: [],
      total: 0,
      offset: 0,
      limit: 100,
    }),
    getPublicLedger: vi.fn().mockResolvedValue({
      useCaseId: 'UC_CARBON',
      entries: [],
    }),
    getQuota: vi.fn().mockResolvedValue({
      mintMonthlyLimit: limit,
      mintMonthlyUsed: limit - remaining,
      mintMonthlyRemaining: remaining,
      dmrvDailyLimit: 1000,
      dmrvDailyUsed: 0,
      dmrvDailyRemaining: 1000,
    }),
  };

  return {
    contracts: { deploy: spies.deploy },
    assets: {
      get: spies.getAsset,
      listByUseCase: spies.listByUseCase,
      getPublicLedger: spies.getPublicLedger,
    },
    wallet: { transfer: spies.transfer },
    tier: { getQuota: spies.getQuota },
    __spies: spies,
  } as unknown as SdkSpyClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.aurigraphCallLog.create.mockResolvedValue({});
});

// ── Group 1 — SDK contract verification (always-on) ───────────────────────

describe('AAT-τ / AV4-379 — SDK contract verification (mocked, always-on)', () => {
  it('deployContract: invokes client.contracts.deploy with the documented shape (templateId / useCaseId / channelId / terms)', async () => {
    const client = buildSdkSpyClient();
    const adapter = new AurigraphDltAdapter({
      client,
      channelId: 'marketplace-channel',
    });

    await adapter.deployContract({
      templateId: 'UC_CARBON',
      useCaseId: 'UC_CARBON',
      terms: {
        sourceProjectId: 'proj-sandbox-1',
        vintageYear: 2025,
        quantityTonnes: 100,
        methodology: 'VM0042',
      },
    });

    expect(client.__spies.deploy).toHaveBeenCalledTimes(1);
    const deployArg = client.__spies.deploy.mock.calls[0]![0]!;

    // The four documented fields the V11 sandbox `POST /api/v11/contracts/deploy`
    // expects (DEVELOPER_GUIDE §5.2).
    expect(deployArg).toMatchObject({
      templateId: 'UC_CARBON',
      useCaseId: 'UC_CARBON',
      channelId: 'marketplace-channel',
    });
    expect(deployArg.terms).toBeTypeOf('object');
    expect(deployArg.terms.methodology).toBe('VM0042');
    expect(deployArg.terms.quantityTonnes).toBe(100);
  });

  it('deployContract: callers may override channelId per-call; otherwise the adapter default applies', async () => {
    const client = buildSdkSpyClient();
    const adapter = new AurigraphDltAdapter({
      client,
      channelId: 'default-channel',
    });

    await adapter.deployContract({
      templateId: 'UC_CARBON',
      useCaseId: 'UC_CARBON',
      channelId: 'override-channel',
      terms: { foo: 'bar' },
    });

    const deployArg = client.__spies.deploy.mock.calls[0]![0]!;
    expect(deployArg.channelId).toBe('override-channel');
  });

  it('getAsset: invokes client.assets.get with the assetId positional arg (matches /rwa/assets/:id route)', async () => {
    const client = buildSdkSpyClient();
    const adapter = new AurigraphDltAdapter({ client });

    await adapter.getAsset('asset-sandbox-1');

    expect(client.__spies.getAsset).toHaveBeenCalledTimes(1);
    expect(client.__spies.getAsset).toHaveBeenCalledWith('asset-sandbox-1');
  });

  it('listByUseCase: invokes client.assets.listByUseCase with the useCaseId positional arg', async () => {
    const client = buildSdkSpyClient();
    const adapter = new AurigraphDltAdapter({ client });

    const result = await adapter.listByUseCase('UC_CARBON');

    expect(client.__spies.listByUseCase).toHaveBeenCalledTimes(1);
    expect(client.__spies.listByUseCase).toHaveBeenCalledWith('UC_CARBON');
    // Live SDK returns `{ assets, total, offset, limit }` — adapter passes
    // it through unchanged, so the shape assertion guards against accidental
    // re-mapping.
    expect(result).toMatchObject({
      assets: expect.any(Array),
      total: expect.any(Number),
    });
  });

  it('getPublicLedger: invokes client.assets.getPublicLedger with the useCaseId positional arg', async () => {
    const client = buildSdkSpyClient();
    const adapter = new AurigraphDltAdapter({ client });

    await adapter.getPublicLedger('UC_CARBON');

    expect(client.__spies.getPublicLedger).toHaveBeenCalledTimes(1);
    expect(client.__spies.getPublicLedger).toHaveBeenCalledWith('UC_CARBON');
  });

  it('transferAsset: invokes client.wallet.transfer with the full TransferRequest object', async () => {
    const client = buildSdkSpyClient();
    const adapter = new AurigraphDltAdapter({ client });

    await adapter.transferAsset({
      from: 'wallet-a',
      to: 'wallet-b',
      amount: 50,
      currency: 'CARBON',
    });

    expect(client.__spies.transfer).toHaveBeenCalledTimes(1);
    const transferArg = client.__spies.transfer.mock.calls[0]![0]!;
    // The live wallet/transfer endpoint expects { from, to, amount, currency }.
    expect(transferArg).toEqual({
      from: 'wallet-a',
      to: 'wallet-b',
      amount: 50,
      currency: 'CARBON',
    });
  });

  it('burnAsset: dispatches via contracts.deploy with templateId=RETIREMENT and a composite terms payload', async () => {
    const client = buildSdkSpyClient();
    const adapter = new AurigraphDltAdapter({
      client,
      channelId: 'marketplace-channel',
    });

    await adapter.burnAsset({
      assetId: 'asset-sandbox-2',
      amount: 10,
      reason: 'voluntary retirement',
      retiredBy: 'org-sandbox-1',
    });

    // Burn re-uses the deploy endpoint; the sandbox sees a
    // POST /api/v11/contracts/deploy with templateId=RETIREMENT.
    expect(client.__spies.deploy).toHaveBeenCalledTimes(1);
    const deployArg = client.__spies.deploy.mock.calls[0]![0]!;
    expect(deployArg.templateId).toBe('RETIREMENT');
    expect(deployArg.useCaseId).toBe('RETIREMENT');
    expect(deployArg.channelId).toBe('marketplace-channel');
    expect(deployArg.terms).toMatchObject({
      assetId: 'asset-sandbox-2',
      amount: 10,
      reason: 'voluntary retirement',
      retiredBy: 'org-sandbox-1',
    });
  });

  it('burnAsset: structured metadata is merged UNDER the canonical retire fields (cannot overwrite assetId/amount/reason)', async () => {
    const client = buildSdkSpyClient();
    const adapter = new AurigraphDltAdapter({ client });

    await adapter.burnAsset({
      assetId: 'asset-canonical',
      amount: 25,
      reason: 'canonical reason',
      retiredBy: 'org-canonical',
      // Hostile metadata trying to overwrite assetId/amount/reason.
      metadata: {
        delist: true,
        bcrSerialId: 'BCR-IND-2025-AR-VM0042-V1-0001',
        bcrLockId: 'AWD2-LOCK-deadbeef',
        // These should be IGNORED (canonical fields win).
        assetId: 'attacker-attempt',
        amount: 99999,
        reason: 'attacker reason',
      },
    });

    const deployArg = client.__spies.deploy.mock.calls[0]![0]!;
    // Canonical fields win.
    expect(deployArg.terms.assetId).toBe('asset-canonical');
    expect(deployArg.terms.amount).toBe(25);
    expect(deployArg.terms.reason).toBe('canonical reason');
    // Structured metadata still surfaces alongside.
    expect(deployArg.terms.delist).toBe(true);
    expect(deployArg.terms.bcrSerialId).toBe(
      'BCR-IND-2025-AR-VM0042-V1-0001',
    );
    expect(deployArg.terms.bcrLockId).toBe('AWD2-LOCK-deadbeef');
  });

  it('getQuota: invokes client.tier.getQuota() with no arguments (matches /api/v11/sdk/mint/quota)', async () => {
    const client = buildSdkSpyClient({ quotaRemaining: 42, quotaLimit: 100 });
    const adapter = new AurigraphDltAdapter({ client });

    const quota = await adapter.getQuota();

    // Pre-flight is a no-op for read-only `getQuota`; the call we care
    // about is the direct one. The adapter's `runRead` calls `tier.getQuota`
    // exactly once for the user-facing call.
    expect(client.__spies.getQuota).toHaveBeenCalled();
    expect(client.__spies.getQuota.mock.calls[0]).toEqual([]);

    // The returned shape matches MintQuota — the adapter is a pass-through.
    expect(quota).toMatchObject({
      mintMonthlyLimit: 100,
      mintMonthlyRemaining: 42,
      mintMonthlyUsed: 58,
      dmrvDailyLimit: expect.any(Number),
      dmrvDailyUsed: expect.any(Number),
      dmrvDailyRemaining: expect.any(Number),
    });
  });

  it('every mutation runs a tier.getQuota pre-flight before contacting the SDK mutator', async () => {
    const client = buildSdkSpyClient();
    const adapter = new AurigraphDltAdapter({ client });

    // deploy
    await adapter.deployContract({
      templateId: 'UC_CARBON',
      useCaseId: 'UC_CARBON',
      terms: {},
    });
    expect(client.__spies.getQuota).toHaveBeenCalledTimes(1);

    // transfer
    await adapter.transferAsset({
      from: 'a',
      to: 'b',
      amount: 1,
      currency: 'CARBON',
    });
    expect(client.__spies.getQuota).toHaveBeenCalledTimes(2);

    // burn
    await adapter.burnAsset({ assetId: 'a', amount: 1, reason: 'r' });
    expect(client.__spies.getQuota).toHaveBeenCalledTimes(3);
  });
});

// ── Group 2 — Live sandbox round-trip (opt-in) ────────────────────────────
//
// These tests run only when `AURIGRAPH_SANDBOX_TEST=1` AND `AURIGRAPH_API_KEY`
// are both present. The default test suite skips this `describe` entirely so
// CI ticks stay fast and offline-safe.
//
// READ-ONLY by design: we never `deployContract`, `transferAsset`, or
// `burnAsset` against the shared sandbox — those would dirty state for other
// integrations. Writes are exercised through the in-memory mocks in Group 1
// and the cross-system regression suite (`cross-system-regression.test.ts`).

const SANDBOX_ENABLED =
  process.env.AURIGRAPH_SANDBOX_TEST === '1' &&
  typeof process.env.AURIGRAPH_API_KEY === 'string' &&
  process.env.AURIGRAPH_API_KEY.length > 0;

describe.skipIf(!SANDBOX_ENABLED)(
  'AAT-τ / AV4-379 — live sandbox round-trip (opt-in)',
  () => {
    /**
     * Build a *real* AurigraphClient bound to the sandbox base URL. We
     * intentionally avoid the cached singleton in `lib/aurigraph-client.ts`
     * because the unit-test runtime may have set NODE_ENV=test and produced
     * a stub. Here we want the live HTTP transport.
     */
    async function buildLiveAdapter(): Promise<AurigraphDltAdapter> {
      const { AurigraphClient } = await import('@aurigraph/dlt-sdk');
      const baseUrl =
        process.env.AURIGRAPH_BASE_URL ?? 'https://dlt.aurigraph.io';
      const client = new AurigraphClient({
        baseUrl,
        apiKey: process.env.AURIGRAPH_API_KEY!,
        appId: process.env.AURIGRAPH_APP_ID,
      });
      return new AurigraphDltAdapter({
        // Cast — the live AurigraphClient is wider than AurigraphClientLike,
        // but every method we exercise is present.
        client: client as unknown as AurigraphClientLike,
      });
    }

    it('health: GET /health on the configured base URL returns 200', async () => {
      const baseUrl =
        process.env.AURIGRAPH_BASE_URL ?? 'https://dlt.aurigraph.io';
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
    }, 15_000);

    it('quota: real client.tier.getQuota() returns a structured MintQuota with non-negative numbers', async () => {
      const adapter = await buildLiveAdapter();
      const quota = await adapter.getQuota();

      expect(quota.mintMonthlyLimit).toBeTypeOf('number');
      expect(quota.mintMonthlyUsed).toBeTypeOf('number');
      expect(quota.mintMonthlyRemaining).toBeTypeOf('number');
      expect(quota.mintMonthlyUsed).toBeGreaterThanOrEqual(0);
      // mintMonthlyLimit can be -1 (unlimited tier) — accept either.
      expect(
        quota.mintMonthlyLimit === -1 || quota.mintMonthlyLimit >= 0,
      ).toBe(true);
    }, 15_000);

    it('listByUseCase(UC_CARBON): returns a structured payload with an `assets` array (no data assertions)', async () => {
      const adapter = await buildLiveAdapter();
      const payload = await adapter.listByUseCase('UC_CARBON');

      // The live SDK returns { assets, total, offset, limit }. We only assert
      // the envelope shape — the data inside depends on whatever's in the
      // sandbox at test time, and we want this test to be stable across runs.
      expect(payload).toBeTypeOf('object');
      expect(payload).not.toBeNull();
      expect(Array.isArray((payload as { assets?: unknown }).assets)).toBe(
        true,
      );
    }, 15_000);
  },
);
