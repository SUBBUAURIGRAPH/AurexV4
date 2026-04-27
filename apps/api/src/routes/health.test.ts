/**
 * AAT-11C / Wave 11c — tests for GET /api/v1/health/email.
 *
 * Drives the express router directly with a synthetic req/res — same
 * shape as audit-logs.test.ts. We exercise three things:
 *   1. Auth-gating — anon caller and non-admin are rejected.
 *   2. Mock-mode stub — AWS_SES_MOCK_MODE=1 returns the deterministic
 *      payload without touching the AWS SDK or Prisma summaries.
 *   3. Live-mode shape — when SDK probes throw (no creds in CI), the
 *      response still carries every documented field, with credentials
 *      reported as unresolved + identity unknown.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    outboundEmail: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    // AAT-371 — /health/aurigraph aggregates the audit table.
    aurigraphCallLog: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

// AAT-371 — stub the Aurigraph adapter + client so the route never hits
// the real SDK / network. Each test can override the mocks before
// driving the route.
const { aurigraphGetQuotaMock, aurigraphCapabilitiesMock } = vi.hoisted(() => ({
  aurigraphGetQuotaMock: vi.fn(),
  aurigraphCapabilitiesMock: vi.fn(),
}));

vi.mock('../services/chains/aurigraph-dlt-adapter.js', () => ({
  getAurigraphAdapter: () => ({
    getQuota: () => aurigraphGetQuotaMock(),
  }),
}));

vi.mock('../lib/aurigraph-client.js', () => ({
  getAurigraphClient: () => ({
    sdk: {
      capabilities: () => aurigraphCapabilitiesMock(),
    },
  }),
}));

// Stub the AWS SDK pieces so we never touch the network. Each test can
// override the mocks via `mockImplementationOnce` before driving the
// route.
const { sesSendMock, defaultProviderMock } = vi.hoisted(() => ({
  sesSendMock: vi.fn(),
  defaultProviderMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-sesv2', () => {
  class SESv2Client {
    constructor(public cfg: unknown) {}
    send(cmd: unknown) {
      return sesSendMock(cmd);
    }
  }
  class GetEmailIdentityCommand {
    constructor(public input: unknown) {}
  }
  return { SESv2Client, GetEmailIdentityCommand };
});

vi.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: () => defaultProviderMock,
}));

import { healthRouter } from './health.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from '../lib/jwt.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/health', healthRouter);
  app.use(errorHandler);
  return app;
}

interface FakeResponse {
  status: number;
  body: unknown;
}

const SUPER_ADMIN_ID = '00000000-0000-0000-0000-0000000000aa';
const ANALYST_ID = '00000000-0000-0000-0000-0000000000bb';

function adminAuthHeader(): Record<string, string> {
  const token = signAccessToken({
    sub: SUPER_ADMIN_ID,
    email: 'admin@aurex.in',
    // requireRole normalises to uppercase before comparing — match the
    // enum form the users table actually stores.
     
    role: 'SUPER_ADMIN' as any,
  });
  return { authorization: `Bearer ${token}` };
}

function analystAuthHeader(): Record<string, string> {
  const token = signAccessToken({
    sub: ANALYST_ID,
    email: 'analyst@aurex.in',
     
    role: 'ANALYST' as any,
  });
  return { authorization: `Bearer ${token}` };
}

function getRequest(
  url: string,
  headers: Record<string, string> = {},
): Promise<FakeResponse> {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    let status = 200;
    let payload: unknown = undefined;
    const req: Partial<Request> = {
      method: 'GET',
      url,
      originalUrl: url,
      path: url,
      headers,
      ip: '127.0.0.1',
       
      socket: { remoteAddress: '127.0.0.1' } as any,
    };
    const res: Partial<Response> = {
      status(code: number) {
        status = code;
        return this as Response;
      },
      json(data: unknown) {
        payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      send(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      end(data?: unknown) {
        if (payload === undefined && data !== undefined) payload = data;
        resolve({ status, body: payload });
        return this as Response;
      },
      setHeader() {
        return res as Response;
      },
      getHeader() {
        return undefined;
      },
    };
    try {
       
      (app as any).handle(req as Request, res as Response, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

const SAVED_ENV: Record<string, string | undefined> = {};
const TRACKED_KEYS = [
  'AWS_REGION',
  'AURIGRAPH_EMAIL_FROM',
  'AURIGRAPH_EMAIL_REPLY_TO',
  'AWS_SES_MOCK_MODE',
  // AAT-MANDRILL — multi-provider façade.
  'EMAIL_TRANSPORT',
  'MANDRILL_API_KEY',
  'MANDRILL_MOCK_MODE',
  // AAT-371 — Aurigraph DLT tenant onboarding.
  'AURIGRAPH_API_KEY',
  'AURIGRAPH_TENANT_ID',
  'AURIGRAPH_BASE_URL',
  'AURIGRAPH_CHANNEL_ID',
  'AURIGRAPH_MOCK_MODE',
  'AURIGRAPH_UC_CARBON_CHAIN_ID',
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of TRACKED_KEYS) {
    SAVED_ENV[k] = process.env[k];
  }
  mockPrisma.outboundEmail.findFirst.mockResolvedValue(null);
  mockPrisma.outboundEmail.count.mockResolvedValue(0);
  // AAT-371 defaults — no rows + no SDK by default.
  mockPrisma.aurigraphCallLog.findFirst.mockResolvedValue(null);
  mockPrisma.aurigraphCallLog.count.mockResolvedValue(0);
  aurigraphGetQuotaMock.mockReset();
  aurigraphCapabilitiesMock.mockReset();
});

afterEach(() => {
  for (const k of TRACKED_KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

describe('GET /api/v1/health/email — auth gating', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await getRequest('/api/v1/health/email');
    expect(res.status).toBe(401);
  });

  it('returns 403 for an authenticated non-admin caller', async () => {
    const res = await getRequest('/api/v1/health/email', analystAuthHeader());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/health/email — mock mode', () => {
  it('returns the deterministic stub payload without hitting AWS', async () => {
    process.env.AWS_SES_MOCK_MODE = '1';
    process.env.AWS_REGION = 'ap-south-1';
    process.env.AURIGRAPH_EMAIL_FROM = 'noreply@aurex.in';
    process.env.AURIGRAPH_EMAIL_REPLY_TO = 'contact@aurex.in';

    const res = await getRequest('/api/v1/health/email', adminAuthHeader());

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.from).toBe('noreply@aurex.in');
    expect(body.replyTo).toBe('contact@aurex.in');
    expect(body.region).toBe('ap-south-1');
    expect(body.awsCredentialsResolved).toBe(true);
    expect(body.sesIdentityVerified).toBe(true);
    expect(typeof body.lastSendOk).toBe('string');
    expect(body.lastSendError).toBeNull();
    expect(body.outboundQueue24h).toEqual({ sent: 1, failed: 0, pending: 0 });

    // Critical: the stub MUST short-circuit before the SDK calls.
    expect(sesSendMock).not.toHaveBeenCalled();
    expect(defaultProviderMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/health/email — live-mode shape', () => {
  it('returns the full schema even when AWS probes fail (no creds resolvable)', async () => {
    delete process.env.AWS_SES_MOCK_MODE;
    process.env.AWS_REGION = 'ap-south-1';
    process.env.AURIGRAPH_EMAIL_FROM = 'noreply@aurex.in';
    process.env.AURIGRAPH_EMAIL_REPLY_TO = 'contact@aurex.in';

    // Credential provider throws → awsCredentialsResolved=false.
    defaultProviderMock.mockRejectedValueOnce(new Error('no creds'));
    // SES probe should NOT be called when creds are unresolved, but be
    // defensive — if it is, return a verified status (we expect the
    // route to short-circuit and never reach this).
    sesSendMock.mockResolvedValue({ VerifiedForSendingStatus: true });

    mockPrisma.outboundEmail.findFirst
      .mockResolvedValueOnce({ sentAt: new Date('2026-04-25T10:00:00.000Z') })
      .mockResolvedValueOnce({ errorMessage: 'throttled' });
    mockPrisma.outboundEmail.count
      .mockResolvedValueOnce(7) // sent
      .mockResolvedValueOnce(2) // failed
      .mockResolvedValueOnce(1); // pending

    const res = await getRequest('/api/v1/health/email', adminAuthHeader());

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    // AAT-MANDRILL added `provider`, `mandrillKeyResolved`,
    // `mandrillIdentityVerified` to the response schema.
    expect(Object.keys(body).sort()).toEqual([
      'awsCredentialsResolved',
      'from',
      'lastSendError',
      'lastSendOk',
      'mandrillIdentityVerified',
      'mandrillKeyResolved',
      'outboundQueue24h',
      'provider',
      'region',
      'replyTo',
      'sesIdentityVerified',
    ]);
    expect(body.provider).toBe('ses');
    expect(body.awsCredentialsResolved).toBe(false);
    expect(body.sesIdentityVerified).toBe('unknown');
    expect(body.mandrillKeyResolved).toBe(false);
    expect(body.mandrillIdentityVerified).toBe('unknown');
    expect(body.lastSendOk).toBe('2026-04-25T10:00:00.000Z');
    expect(body.lastSendError).toBe('throttled');
    expect(body.outboundQueue24h).toEqual({ sent: 7, failed: 2, pending: 1 });

    // SES identity probe must be skipped when creds are unresolved.
    expect(sesSendMock).not.toHaveBeenCalled();
  });

  it('calls SES GetEmailIdentity when credentials resolve', async () => {
    delete process.env.AWS_SES_MOCK_MODE;
    process.env.AWS_REGION = 'us-east-1';
    process.env.AURIGRAPH_EMAIL_FROM = 'noreply@aurex.in';

    defaultProviderMock.mockResolvedValueOnce({
      accessKeyId: 'AKIA-FAKE',
      secretAccessKey: 'fake',
    });
    sesSendMock.mockResolvedValueOnce({ VerifiedForSendingStatus: false });

    const res = await getRequest('/api/v1/health/email', adminAuthHeader());

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.awsCredentialsResolved).toBe(true);
    expect(body.sesIdentityVerified).toBe(false);
    expect(sesSendMock).toHaveBeenCalledTimes(1);
  });
});

// ─── AAT-MANDRILL ──────────────────────────────────────────────────────

describe('GET /api/v1/health/email — Mandrill provider (AAT-MANDRILL)', () => {
  it('surfaces provider="mandrill" + mandrill stub fields when MANDRILL_MOCK_MODE=1', async () => {
    process.env.MANDRILL_MOCK_MODE = '1';
    process.env.EMAIL_TRANSPORT = 'mandrill';
    process.env.MANDRILL_API_KEY = 'md-test-key';

    const res = await getRequest('/api/v1/health/email', adminAuthHeader());

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.provider).toBe('mandrill');
    expect(body.mandrillKeyResolved).toBe(true);
    expect(body.mandrillIdentityVerified).toBe(true);
    // Stub mode short-circuits; no SDK / fetch call should happen.
    expect(sesSendMock).not.toHaveBeenCalled();
  });

  it('reports mandrillKeyResolved=false when MANDRILL_API_KEY is unset', async () => {
    delete process.env.MANDRILL_API_KEY;
    delete process.env.EMAIL_TRANSPORT; // default = ses
    process.env.AWS_SES_MOCK_MODE = '1';

    const res = await getRequest('/api/v1/health/email', adminAuthHeader());
    const body = res.body as Record<string, unknown>;

    expect(body.provider).toBe('ses');
    expect(body.mandrillKeyResolved).toBe(false);
    expect(body.mandrillIdentityVerified).toBe('unknown');
  });
});

// ─── AAT-371 / AV4-371 — /health/aurigraph ────────────────────────────

describe('GET /api/v1/health/aurigraph — auth gating', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await getRequest('/api/v1/health/aurigraph');
    expect(res.status).toBe(401);
  });

  it('returns 403 for an authenticated non-admin caller', async () => {
    const res = await getRequest(
      '/api/v1/health/aurigraph',
      analystAuthHeader(),
    );
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/health/aurigraph — mock mode', () => {
  it('returns the deterministic stub payload without hitting the SDK', async () => {
    process.env.AURIGRAPH_MOCK_MODE = '1';
    process.env.AURIGRAPH_BASE_URL = 'https://dlt.aurigraph.io';
    process.env.AURIGRAPH_TENANT_ID = 'aurex-test-tenant';
    process.env.AURIGRAPH_API_KEY = 'test-key-not-real';
    process.env.AURIGRAPH_CHANNEL_ID = 'marketplace-channel';

    const res = await getRequest(
      '/api/v1/health/aurigraph',
      adminAuthHeader(),
    );

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.baseUrl).toBe('https://dlt.aurigraph.io');
    expect(body.tenantId).toBe('aurex-test-tenant');
    expect(body.apiKeyResolved).toBe(true);
    expect(body.channelId).toBe('marketplace-channel');
    expect(body.ucCarbonCapability).toBe(true);
    expect(body.tierQuota).toEqual({
      monthlyCalls: 10000,
      used: 12,
      remaining: 9988,
      resetAt: null,
    });
    expect(typeof body.lastCallOk).toBe('string');
    expect(body.lastCallError).toBeNull();
    expect(body.callsLast24h).toEqual({
      success: 1,
      failed: 0,
      retried: 0,
      pending: 0,
    });

    // Critical: stub MUST short-circuit before any SDK or DB call.
    expect(aurigraphGetQuotaMock).not.toHaveBeenCalled();
    expect(aurigraphCapabilitiesMock).not.toHaveBeenCalled();
    expect(mockPrisma.aurigraphCallLog.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.aurigraphCallLog.count).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/health/aurigraph — apiKeyResolved reflects env', () => {
  it('reports apiKeyResolved=false when AURIGRAPH_API_KEY is unset (live mode)', async () => {
    delete process.env.AURIGRAPH_MOCK_MODE;
    delete process.env.AURIGRAPH_API_KEY;
    process.env.AURIGRAPH_BASE_URL = 'https://dlt.aurigraph.io';

    // Adapter + capabilities both fail → tierQuota null + capability unknown.
    aurigraphGetQuotaMock.mockRejectedValue(new Error('no creds'));
    aurigraphCapabilitiesMock.mockRejectedValue(new Error('no creds'));

    const res = await getRequest(
      '/api/v1/health/aurigraph',
      adminAuthHeader(),
    );

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.apiKeyResolved).toBe(false);
    expect(body.tierQuota).toBeNull();
    expect(body.ucCarbonCapability).toBe('unknown');
    // Tenant id stays null when env var is unset.
    expect(body.tenantId).toBeNull();
  });

  it('reports apiKeyResolved=true when AURIGRAPH_API_KEY is set (live mode)', async () => {
    delete process.env.AURIGRAPH_MOCK_MODE;
    process.env.AURIGRAPH_API_KEY = 'live-key';
    process.env.AURIGRAPH_TENANT_ID = 'aurex-prod';

    aurigraphGetQuotaMock.mockResolvedValue({
      mintMonthlyLimit: 5000,
      mintMonthlyUsed: 100,
      mintMonthlyRemaining: 4900,
      dmrvDailyLimit: 1000,
      dmrvDailyUsed: 0,
      dmrvDailyRemaining: 1000,
    });
    aurigraphCapabilitiesMock.mockResolvedValue({
      appId: 'aurex-app',
      approvedScopes: ['UC_CARBON.contracts.deploy', 'tier.read'],
      endpoints: [],
      totalEndpoints: 0,
    });

    const res = await getRequest(
      '/api/v1/health/aurigraph',
      adminAuthHeader(),
    );

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.apiKeyResolved).toBe(true);
    expect(body.tenantId).toBe('aurex-prod');
    expect(body.tierQuota).toEqual({
      monthlyCalls: 5000,
      used: 100,
      remaining: 4900,
      resetAt: null,
    });
    expect(body.ucCarbonCapability).toBe(true);
  });
});

describe('GET /api/v1/health/aurigraph — UC_CARBON detection', () => {
  it('returns ucCarbonCapability=true when an endpoint path mentions UC_CARBON', async () => {
    delete process.env.AURIGRAPH_MOCK_MODE;
    process.env.AURIGRAPH_API_KEY = 'k';

    aurigraphGetQuotaMock.mockResolvedValue({
      mintMonthlyLimit: -1,
      mintMonthlyUsed: 0,
      mintMonthlyRemaining: 0,
      dmrvDailyLimit: 0,
      dmrvDailyUsed: 0,
      dmrvDailyRemaining: 0,
    });
    aurigraphCapabilitiesMock.mockResolvedValue({
      appId: 'aurex-app',
      approvedScopes: ['tier.read'],
      endpoints: [
        {
          method: 'POST',
          path: '/contracts/deploy?useCase=UC_CARBON',
          requiredScope: 'contracts.deploy',
          description: 'Deploy a Ricardian contract',
        },
      ],
      totalEndpoints: 1,
    });

    const res = await getRequest(
      '/api/v1/health/aurigraph',
      adminAuthHeader(),
    );
    const body = res.body as Record<string, unknown>;
    expect(body.ucCarbonCapability).toBe(true);
  });

  it('returns ucCarbonCapability=false when no scope or endpoint references UC_CARBON', async () => {
    delete process.env.AURIGRAPH_MOCK_MODE;
    process.env.AURIGRAPH_API_KEY = 'k';

    aurigraphGetQuotaMock.mockResolvedValue({
      mintMonthlyLimit: -1,
      mintMonthlyUsed: 0,
      mintMonthlyRemaining: 0,
      dmrvDailyLimit: 0,
      dmrvDailyUsed: 0,
      dmrvDailyRemaining: 0,
    });
    aurigraphCapabilitiesMock.mockResolvedValue({
      appId: 'aurex-app',
      approvedScopes: ['UC_GOLD.contracts.deploy'],
      endpoints: [],
      totalEndpoints: 0,
    });

    const res = await getRequest(
      '/api/v1/health/aurigraph',
      adminAuthHeader(),
    );
    const body = res.body as Record<string, unknown>;
    expect(body.ucCarbonCapability).toBe(false);
  });
});

describe('GET /api/v1/health/aurigraph — callsLast24h aggregation', () => {
  it('aggregates lastCallOk / lastCallError + 24h counts from AurigraphCallLog', async () => {
    delete process.env.AURIGRAPH_MOCK_MODE;
    process.env.AURIGRAPH_API_KEY = 'k';

    aurigraphGetQuotaMock.mockRejectedValue(new Error('skip'));
    aurigraphCapabilitiesMock.mockRejectedValue(new Error('skip'));

    mockPrisma.aurigraphCallLog.findFirst
      .mockResolvedValueOnce({
        createdAt: new Date('2026-04-25T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({ errorMsg: 'tier.getQuota failed: 500' });
    mockPrisma.aurigraphCallLog.count
      .mockResolvedValueOnce(17) // success
      .mockResolvedValueOnce(2) // failed
      .mockResolvedValueOnce(1) // retried
      .mockResolvedValueOnce(0); // pending

    const res = await getRequest(
      '/api/v1/health/aurigraph',
      adminAuthHeader(),
    );

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.lastCallOk).toBe('2026-04-25T10:00:00.000Z');
    expect(body.lastCallError).toBe('tier.getQuota failed: 500');
    expect(body.callsLast24h).toEqual({
      success: 17,
      failed: 2,
      retried: 1,
      pending: 0,
    });
  });
});

// ─── AAT-371 — onboarding script: relies on `pnpm typecheck` for the
// import / type sanity (the script auto-runs main() at module load and
// is unsafe to import inside vitest, where process.exit would terminate
// the test run). Don't add a runtime test here. ─────────────────────────

// ─── AAT-R5 / AV4-418 — /health/unfccc-interop ────────────────────────

import { __resetUnfcccAdapterCache } from '../services/registries/index.js';

describe('GET /api/v1/health/unfccc-interop — public manifest (AV4-418)', () => {
  const ORIGINAL_ADAPTER_ENV = process.env.UNFCCC_REGISTRY_ADAPTER;

  beforeEach(() => {
    __resetUnfcccAdapterCache();
  });

  afterEach(() => {
    if (ORIGINAL_ADAPTER_ENV === undefined) {
      delete process.env.UNFCCC_REGISTRY_ADAPTER;
    } else {
      process.env.UNFCCC_REGISTRY_ADAPTER = ORIGINAL_ADAPTER_ENV;
    }
    __resetUnfcccAdapterCache();
  });

  it('returns 200 with the disabled-adapter manifest when no auth header is present', async () => {
    delete process.env.UNFCCC_REGISTRY_ADAPTER;
    const res = await getRequest('/api/v1/health/unfccc-interop');
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.adapterName).toBe('disabled');
    expect(body.specVersion).toBe('0.0.0-pending-spec');
    expect(body.ready).toBe(false);
    expect(body.specReference).toBeNull();
    expect(body.supportedEvents).toEqual([
      'issuance',
      'first-transfer',
      'retirement-ndc',
      'retirement-oimp',
    ]);
  });

  it('returns the disabled-shape manifest even when env is set to a reserved-but-unimplemented adapter', async () => {
    // Factory throws on `live-v1`; route swallows and returns the
    // safe disabled-shape envelope so downstream consumers always
    // get a parseable response.
    process.env.UNFCCC_REGISTRY_ADAPTER = 'live-v1';
    const res = await getRequest('/api/v1/health/unfccc-interop');
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.adapterName).toBe('disabled');
    expect(body.ready).toBe(false);
  });
});
