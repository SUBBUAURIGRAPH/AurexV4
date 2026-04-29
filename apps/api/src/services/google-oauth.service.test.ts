/**
 * Google Sign-In service tests.
 *
 * Mocks google-auth-library's OAuth2Client so we never hit Google. The
 * mock returns a fake id_token payload we can shape per case.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const { mockPrisma, mockOAuth } = vi.hoisted(() => {
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
  const oauth = {
    generateAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?stub=1'),
    getToken: vi.fn(),
    verifyIdToken: vi.fn(),
  };
  return { mockPrisma: prisma, mockOAuth: oauth };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(() => mockOAuth),
}));

vi.mock('../lib/jwt.js', () => ({
  signAccessToken: vi.fn(() => 'access.jwt'),
  signRefreshToken: vi.fn(() => 'refresh.jwt'),
}));

import {
  buildAuthorizationUrl,
  handleCallback,
  _resetClient,
} from './google-oauth.service.js';

const STATE_SECRET = 'test-jwt-secret';
const STATE_AUDIENCE = 'aurex:google-oauth-state';

beforeEach(() => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id-stub.apps.googleusercontent.com';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret-stub';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://aurex.in/api/v1/auth/google/callback';
  process.env.JWT_SECRET = STATE_SECRET;
  process.env.WEB_BASE_URL = 'https://aurex.in';
  vi.clearAllMocks();
  _resetClient();
});

afterEach(() => {
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  delete process.env.JWT_SECRET;
  delete process.env.WEB_BASE_URL;
});

function signValidState(redirect = '/dashboard'): string {
  return jwt.sign({ redirect, nonce: 'n1' }, STATE_SECRET, {
    audience: STATE_AUDIENCE,
    expiresIn: 60,
  });
}

describe('buildAuthorizationUrl', () => {
  it('returns Google authorization URL and includes a signed state', () => {
    const url = buildAuthorizationUrl({ redirect: '/dashboard' });
    expect(url).toContain('accounts.google.com');

    expect(mockOAuth.generateAuthUrl).toHaveBeenCalledTimes(1);
    const args = mockOAuth.generateAuthUrl.mock.calls[0]![0] as {
      state: string;
      scope: string[];
    };
    expect(args.scope).toContain('openid');
    expect(args.scope).toContain('email');

    // State must be a valid JWT with our audience.
    const decoded = jwt.verify(args.state, STATE_SECRET, {
      audience: STATE_AUDIENCE,
    }) as { redirect: string; nonce: string };
    expect(decoded.redirect).toBe('/dashboard');
    expect(decoded.nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('rejects open-redirect attempts (external URL or //evil.com)', () => {
    const u1 = buildAuthorizationUrl({ redirect: 'https://evil.com/steal' });
    const s1 = mockOAuth.generateAuthUrl.mock.calls[0]![0]!.state;
    expect(
      (jwt.verify(s1, STATE_SECRET, { audience: STATE_AUDIENCE }) as { redirect: string }).redirect,
    ).toBe('/');

    mockOAuth.generateAuthUrl.mockClear();
    buildAuthorizationUrl({ redirect: '//evil.com/steal' });
    const s2 = mockOAuth.generateAuthUrl.mock.calls[0]![0]!.state;
    expect(
      (jwt.verify(s2, STATE_SECRET, { audience: STATE_AUDIENCE }) as { redirect: string }).redirect,
    ).toBe('/');
  });

  it('throws 503 when env vars are missing', () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    _resetClient();
    expect(() => buildAuthorizationUrl({})).toThrow(/not configured/i);
  });
});

describe('handleCallback', () => {
  function stubExchange(idTokenPayload: Record<string, unknown>) {
    mockOAuth.getToken.mockResolvedValue({ tokens: { id_token: 'fake.id.token' } });
    mockOAuth.verifyIdToken.mockResolvedValue({
      getPayload: () => idTokenPayload,
    });
  }

  it('rejects an invalid (tampered) state with 400', async () => {
    await expect(
      handleCallback({ code: 'c', state: 'not-a-jwt' }),
    ).rejects.toThrow(/state/i);
  });

  it('rejects state signed with a different secret (CSRF)', async () => {
    const wrongState = jwt.sign(
      { redirect: '/', nonce: 'x' },
      'attacker-secret',
      { audience: STATE_AUDIENCE, expiresIn: 60 },
    );
    await expect(
      handleCallback({ code: 'c', state: wrongState }),
    ).rejects.toThrow(/state/i);
  });

  it('rejects when email_verified is false', async () => {
    stubExchange({
      sub: 'g-sub-1',
      email: 'unverified@example.com',
      email_verified: false,
      name: 'Mallory',
    });

    await expect(
      handleCallback({ code: 'c', state: signValidState() }),
    ).rejects.toThrow(/not verified/i);
  });

  it('creates a brand-new user when no match by sub or email', async () => {
    stubExchange({
      sub: 'g-sub-new',
      email: 'new@example.com',
      email_verified: true,
      name: 'New User',
    });
    mockPrisma.user.findUnique.mockResolvedValue(null); // both lookups
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
    stubExchange({
      sub: 'g-sub-link',
      email: 'existing@example.com',
      email_verified: true,
      name: 'Existing User',
    });
    // First call: findUnique by googleSub → null
    // Second call: findUnique by email → existing user with no googleSub yet
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

    // The update must set googleSub + isVerified.
    const updateArgs = mockPrisma.user.update.mock.calls[0]![0] as {
      data: { googleSub: string; isVerified: boolean };
    };
    expect(updateArgs.data.googleSub).toBe('g-sub-link');
    expect(updateArgs.data.isVerified).toBe(true);
  });

  it('refuses to re-bind when email matches but a different googleSub is already linked', async () => {
    stubExchange({
      sub: 'g-sub-attacker',
      email: 'victim@example.com',
      email_verified: true,
      name: 'Attacker',
    });
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
    stubExchange({
      sub: 'g-sub-returning',
      email: 'returning@example.com',
      email_verified: true,
      name: 'Returning User',
    });
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
    // Only the lastLoginAt bump — no link mutation, no create.
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    const args = mockPrisma.user.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(Object.keys(args.data)).toEqual(['lastLoginAt']);
  });

  it('rejects a disabled account (isActive=false) on returning sign-in', async () => {
    stubExchange({
      sub: 'g-sub-disabled',
      email: 'disabled@example.com',
      email_verified: true,
      name: 'Disabled',
    });
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
