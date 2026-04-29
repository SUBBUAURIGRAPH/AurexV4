/**
 * Google Sign-In service tests.
 *
 * Stubs global fetch so the JWKS + token-exchange paths are deterministic.
 * Generates a real RSA-2048 keypair so the ID-token signature really
 * round-trips through crypto.createPublicKey + jsonwebtoken.verify.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: { create: vi.fn() },
    authEvent: { create: vi.fn() },
    outboundEmail: {
      create: vi.fn().mockResolvedValue({ id: 'oe-1' }),
      update: vi.fn().mockResolvedValue({ id: 'oe-1' }),
    },
    $transaction: vi.fn().mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      if (Array.isArray(arg)) return Promise.all(arg);
      return undefined;
    }),
  };
  return { mockPrisma: prisma };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

vi.mock('../lib/jwt.js', () => ({
  signAccessToken: vi.fn(() => 'access.jwt'),
  signRefreshToken: vi.fn(() => 'refresh.jwt'),
}));

import {
  buildAuthorizationUrl,
  handleCallback,
  _resetJwksCache,
} from './google-oauth.service.js';

const STATE_SECRET = 'test-jwt-secret';
const STATE_AUDIENCE = 'aurex:google-oauth-state';
const CLIENT_ID = 'client-id-stub.apps.googleusercontent.com';

// One RSA-2048 keypair shared across the test file. JWK is published as
// our fake JWKS; the private key signs every test id_token.
const { publicKey: rsaPublic, privateKey: rsaPrivate } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const jwk = rsaPublic.export({ format: 'jwk' }) as {
  n: string;
  e: string;
  kty: string;
};
const KID = 'test-kid-1';

function fakeJwksResponse(): Response {
  const payload = {
    keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }],
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeIdToken(claims: Record<string, unknown>, opts?: { kid?: string; alg?: string }): string {
  return jwt.sign(claims, rsaPrivate, {
    algorithm: (opts?.alg as 'RS256') ?? 'RS256',
    keyid: opts?.kid ?? KID,
  });
}

beforeEach(() => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = CLIENT_ID;
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret-stub';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://aurex.in/api/v1/auth/google/callback';
  process.env.JWT_SECRET = STATE_SECRET;
  process.env.WEB_BASE_URL = 'https://aurex.in';
  vi.clearAllMocks();
  _resetJwksCache();
});

afterEach(() => {
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  delete process.env.JWT_SECRET;
  delete process.env.WEB_BASE_URL;
  vi.unstubAllGlobals();
});

function signValidState(redirect = '/dashboard'): string {
  return jwt.sign({ redirect, nonce: 'n1' }, STATE_SECRET, {
    audience: STATE_AUDIENCE,
    expiresIn: 60,
  });
}

describe('buildAuthorizationUrl', () => {
  it('returns a Google authorization URL with all the required pieces', () => {
    const url = buildAuthorizationUrl({ redirect: '/dashboard' });
    const parsed = new URL(url);
    expect(parsed.host).toBe('accounts.google.com');
    expect(parsed.pathname).toBe('/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://aurex.in/api/v1/auth/google/callback');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('scope')).toBe('openid email profile');
    expect(parsed.searchParams.get('prompt')).toBe('select_account');

    const state = parsed.searchParams.get('state')!;
    const decoded = jwt.verify(state, STATE_SECRET, { audience: STATE_AUDIENCE }) as {
      redirect: string;
      nonce: string;
    };
    expect(decoded.redirect).toBe('/dashboard');
    expect(decoded.nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('rejects open-redirect attempts (external URL or //evil.com)', () => {
    const u1 = buildAuthorizationUrl({ redirect: 'https://evil.com/steal' });
    const s1 = new URL(u1).searchParams.get('state')!;
    expect(
      (jwt.verify(s1, STATE_SECRET, { audience: STATE_AUDIENCE }) as { redirect: string }).redirect,
    ).toBe('/');

    const u2 = buildAuthorizationUrl({ redirect: '//evil.com/steal' });
    const s2 = new URL(u2).searchParams.get('state')!;
    expect(
      (jwt.verify(s2, STATE_SECRET, { audience: STATE_AUDIENCE }) as { redirect: string }).redirect,
    ).toBe('/');
  });

  it('throws 503 when env vars are missing', () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    expect(() => buildAuthorizationUrl({})).toThrow(/not configured/i);
  });
});

describe('handleCallback', () => {
  /**
   * Drive global fetch with two scripted responses:
   * 1. token endpoint → returns the supplied id_token string
   * 2. JWKS endpoint  → returns our fake JWKS
   */
  function stubFetch(idTokenStr: string | null, opts?: { tokenStatus?: number; tokenBody?: string }) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/oauth2/v3/certs')) return fakeJwksResponse();
      if (url.includes('/token')) {
        if (opts?.tokenStatus && opts.tokenStatus >= 400) {
          return new Response(opts.tokenBody ?? '{"error":"invalid_grant"}', { status: opts.tokenStatus });
        }
        return new Response(JSON.stringify(idTokenStr ? { id_token: idTokenStr } : {}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function tokenClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      sub: 'g-sub-default',
      email: 'default@example.com',
      email_verified: true,
      name: 'Default User',
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      exp: Math.floor(Date.now() / 1000) + 600,
      ...overrides,
    };
  }

  it('rejects an invalid (tampered) state with 400', async () => {
    stubFetch(makeIdToken(tokenClaims()));
    await expect(
      handleCallback({ code: 'c', state: 'not-a-jwt' }),
    ).rejects.toThrow(/state/i);
  });

  it('rejects state signed with a different secret (CSRF)', async () => {
    stubFetch(makeIdToken(tokenClaims()));
    const wrongState = jwt.sign(
      { redirect: '/', nonce: 'x' },
      'attacker-secret',
      { audience: STATE_AUDIENCE, expiresIn: 60 },
    );
    await expect(
      handleCallback({ code: 'c', state: wrongState }),
    ).rejects.toThrow(/state/i);
  });

  it('rejects an id_token signed with the wrong key', async () => {
    // Sign with a *different* RSA keypair — the JWKS we publish won't have
    // a matching kid for it, so verification must reject.
    const { privateKey: otherPriv } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const wrongIdToken = jwt.sign(tokenClaims(), otherPriv, {
      algorithm: 'RS256',
      keyid: 'attacker-kid',
    });
    stubFetch(wrongIdToken);
    await expect(
      handleCallback({ code: 'c', state: signValidState() }),
    ).rejects.toThrow(/Invalid|kid/i);
  });

  it('rejects when id_token audience does not match our client_id', async () => {
    stubFetch(makeIdToken(tokenClaims({ aud: 'different-client-id.apps.googleusercontent.com' })));
    await expect(
      handleCallback({ code: 'c', state: signValidState() }),
    ).rejects.toThrow(/Invalid Google id_token/);
  });

  it('rejects when issuer is not Google', async () => {
    stubFetch(makeIdToken(tokenClaims({ iss: 'https://accounts.evil.com' })));
    await expect(
      handleCallback({ code: 'c', state: signValidState() }),
    ).rejects.toThrow(/Invalid Google id_token/);
  });

  it('rejects when email_verified is false', async () => {
    stubFetch(makeIdToken(tokenClaims({
      sub: 'g-sub-1',
      email: 'unverified@example.com',
      email_verified: false,
      name: 'Mallory',
    })));
    await expect(
      handleCallback({ code: 'c', state: signValidState() }),
    ).rejects.toThrow(/not verified/i);
  });

  it('rejects when the token endpoint returns 4xx (bad code)', async () => {
    stubFetch(null, { tokenStatus: 400, tokenBody: '{"error":"invalid_grant"}' });
    await expect(
      handleCallback({ code: 'c', state: signValidState() }),
    ).rejects.toThrow(/Could not exchange/i);
  });

  it('creates a brand-new user when no match by sub or email', async () => {
    stubFetch(makeIdToken(tokenClaims({
      sub: 'g-sub-new',
      email: 'new@example.com',
      name: 'New User',
    })));
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'u-new',
      email: 'new@example.com',
      name: 'New User',
      role: 'VIEWER',
    });
    mockPrisma.session.create.mockResolvedValue({ id: 'sess-1' });

    const result = await handleCallback({ code: 'c', state: signValidState('/dashboard') });

    expect(result.created).toBe(true);
    expect(result.user.email).toBe('new@example.com');
    expect(result.user.role).toBe('viewer');
    expect(result.redirect).toBe('/dashboard');

    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    const createArgs = mockPrisma.user.create.mock.calls[0]![0] as {
      data: { passwordHash: unknown; googleSub: string; isVerified: boolean };
    };
    expect(createArgs.data.passwordHash).toBeNull();
    expect(createArgs.data.googleSub).toBe('g-sub-new');
    expect(createArgs.data.isVerified).toBe(true);

    expect(mockPrisma.session.create).toHaveBeenCalledTimes(1);
  });

  it('links googleSub to an existing local account when email matches', async () => {
    stubFetch(makeIdToken(tokenClaims({
      sub: 'g-sub-link',
      email: 'existing@example.com',
      name: 'Existing User',
    })));
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'u-existing',
        email: 'existing@example.com',
        name: 'Existing User',
        role: 'ORG_ADMIN',
        isActive: true,
        googleSub: null,
        emailVerifiedAt: null,
      });
    mockPrisma.user.update.mockResolvedValue({
      id: 'u-existing',
      email: 'existing@example.com',
      name: 'Existing User',
      role: 'ORG_ADMIN',
    });
    mockPrisma.session.create.mockResolvedValue({ id: 'sess-2' });

    const result = await handleCallback({ code: 'c', state: signValidState() });

    expect(result.created).toBe(false);
    expect(result.user.id).toBe('u-existing');
    expect(result.user.role).toBe('org_admin');

    const updateArgs = mockPrisma.user.update.mock.calls[0]![0] as {
      data: { googleSub: string; isVerified: boolean };
    };
    expect(updateArgs.data.googleSub).toBe('g-sub-link');
    expect(updateArgs.data.isVerified).toBe(true);
  });

  it('refuses to re-bind when email matches but a different googleSub is already linked', async () => {
    stubFetch(makeIdToken(tokenClaims({
      sub: 'g-sub-attacker',
      email: 'victim@example.com',
      name: 'Attacker',
    })));
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'u-victim',
        email: 'victim@example.com',
        name: 'Victim',
        role: 'VIEWER',
        isActive: true,
        googleSub: 'g-sub-real-owner',
        emailVerifiedAt: new Date(),
      });

    await expect(
      handleCallback({ code: 'c', state: signValidState() }),
    ).rejects.toThrow(/different Google account/i);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('logs in returning user matched by googleSub (no upsert)', async () => {
    stubFetch(makeIdToken(tokenClaims({
      sub: 'g-sub-returning',
      email: 'returning@example.com',
      name: 'Returning User',
    })));
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-ret',
      email: 'returning@example.com',
      name: 'Returning User',
      role: 'VIEWER',
      isActive: true,
      googleSub: 'g-sub-returning',
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.session.create.mockResolvedValue({ id: 'sess-3' });

    const result = await handleCallback({ code: 'c', state: signValidState() });

    expect(result.created).toBe(false);
    expect(result.user.id).toBe('u-ret');
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    const args = mockPrisma.user.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(Object.keys(args.data)).toEqual(['lastLoginAt']);
  });

  it('rejects a disabled account (isActive=false) on returning sign-in', async () => {
    stubFetch(makeIdToken(tokenClaims({
      sub: 'g-sub-disabled',
      email: 'disabled@example.com',
      name: 'Disabled',
    })));
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-disabled',
      email: 'disabled@example.com',
      role: 'VIEWER',
      isActive: false,
      googleSub: 'g-sub-disabled',
    });

    await expect(
      handleCallback({ code: 'c', state: signValidState() }),
    ).rejects.toThrow(/disabled/i);
  });
});
