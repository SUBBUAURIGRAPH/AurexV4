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
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: 'SUPER_ADMIN' as any,
  });
  return { authorization: `Bearer ${token}` };
}

function analystAuthHeader(): Record<string, string> {
  const token = signAccessToken({
    sub: ANALYST_ID,
    email: 'analyst@aurex.in',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of TRACKED_KEYS) {
    SAVED_ENV[k] = process.env[k];
  }
  mockPrisma.outboundEmail.findFirst.mockResolvedValue(null);
  mockPrisma.outboundEmail.count.mockResolvedValue(0);
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
