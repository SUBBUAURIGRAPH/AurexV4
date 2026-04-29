/**
 * Google Sign-In (OAuth 2.0 Authorization Code flow).
 *
 * Server-side flow:
 *   1. /auth/google/start — sign a state JWT (5min, includes redirect
 *      target + nonce), 302 to Google with state in the query.
 *   2. Google redirects back to /auth/google/callback with `code` + same
 *      `state`.
 *   3. We verify the state JWT (CSRF protection — only states we issued
 *      will round-trip), exchange the code for tokens via OAuth2Client,
 *      verify the ID token's audience + issuer + email_verified, and
 *      upsert the user.
 *
 * Account-linking policy: trust Google's email verification. If the
 * incoming `email` matches an existing user with no `googleSub`, link
 * them. If a user already has a `googleSub` that doesn't match the
 * incoming token, refuse — that account is bound to a different Google
 * identity.
 */
import jwt from 'jsonwebtoken';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { prisma } from '@aurex/database';
import { signAccessToken, signRefreshToken, type TokenPayload as AurexTokenPayload } from '../lib/jwt.js';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import * as authService from './auth.service.js';

const STATE_JWT_AUDIENCE = 'aurex:google-oauth-state';
const STATE_TTL_SECONDS = 5 * 60;

function readEnv(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  jwtSecret: string;
  webBaseUrl: string;
} {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const jwtSecret = process.env.JWT_SECRET ?? 'dev-access-secret-change-me';
  const webBaseUrl = process.env.WEB_BASE_URL ?? 'https://aurex.in';
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AppError(
      503,
      'Service Unavailable',
      'Google sign-in is not configured on this server',
    );
  }
  return { clientId, clientSecret, redirectUri, jwtSecret, webBaseUrl };
}

let cachedClient: OAuth2Client | null = null;
function getClient(): OAuth2Client {
  if (cachedClient) return cachedClient;
  const { clientId, clientSecret, redirectUri } = readEnv();
  cachedClient = new OAuth2Client({ clientId, clientSecret, redirectUri });
  return cachedClient;
}

/** For tests: drop the cached client so a fresh one is built next call. */
export function _resetClient(): void {
  cachedClient = null;
}

interface StatePayload {
  redirect: string;
  nonce: string;
}

/**
 * Sign a state JWT and return both the token and the Google authorization
 * URL the caller should 302 to. `redirect` is the post-login frontend
 * route to return the user to.
 */
export function buildAuthorizationUrl(opts: { redirect?: string }): string {
  const { jwtSecret } = readEnv();
  const redirect = sanitizeRedirect(opts.redirect);
  const nonce = randomNonce();
  const state = jwt.sign(
    { redirect, nonce } satisfies StatePayload,
    jwtSecret,
    { audience: STATE_JWT_AUDIENCE, expiresIn: STATE_TTL_SECONDS },
  );

  return getClient().generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
    state,
  });
}

/** Only allow same-origin redirects to prevent open-redirect abuse. */
function sanitizeRedirect(input: string | undefined): string {
  if (!input) return '/';
  if (!input.startsWith('/')) return '/';
  if (input.startsWith('//')) return '/';
  return input;
}

function randomNonce(): string {
  // 16 bytes is plenty; we only need uniqueness within the 5-min TTL.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface CallbackResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
  redirect: string;
  /** True if a new User row was created in this call. */
  created: boolean;
}

export async function handleCallback(opts: {
  code: string;
  state: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<CallbackResult> {
  const { jwtSecret, clientId } = readEnv();

  // 1. Verify the state JWT (CSRF + tampering protection).
  let parsedState: StatePayload;
  try {
    parsedState = jwt.verify(opts.state, jwtSecret, {
      audience: STATE_JWT_AUDIENCE,
    }) as StatePayload & { iat: number; exp: number };
  } catch (err) {
    logger.warn({ err }, 'google-oauth: state verification failed');
    throw new AppError(400, 'Bad Request', 'Invalid or expired state');
  }

  // 2. Exchange the authorization code for tokens.
  const client = getClient();
  let idTokenStr: string | undefined;
  try {
    const { tokens } = await client.getToken(opts.code);
    idTokenStr = tokens.id_token ?? undefined;
  } catch (err) {
    logger.warn({ err }, 'google-oauth: token exchange failed');
    throw new AppError(400, 'Bad Request', 'Could not exchange authorization code');
  }
  if (!idTokenStr) {
    throw new AppError(400, 'Bad Request', 'Google response missing id_token');
  }

  // 3. Verify the ID token (signature, audience, issuer, expiry).
  let payload: TokenPayload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: idTokenStr,
      audience: clientId,
    });
    const p = ticket.getPayload();
    if (!p) throw new Error('empty id token payload');
    payload = p;
  } catch (err) {
    logger.warn({ err }, 'google-oauth: id token verification failed');
    throw new AppError(401, 'Unauthorized', 'Invalid Google credentials');
  }

  if (payload.email_verified !== true) {
    throw new AppError(
      403,
      'Forbidden',
      'Google account email is not verified — verify with Google before signing in',
    );
  }

  const sub = payload.sub;
  const email = payload.email;
  if (!sub || !email) {
    throw new AppError(400, 'Bad Request', 'Google id_token missing sub/email');
  }
  const displayName = payload.name?.trim() || email.split('@')[0]!;

  // 4. Upsert the user.
  const upsert = await upsertGoogleUser({ sub, email, name: displayName });

  // 5. Issue Aurex JWTs (matches the local /auth/login response shape).
  const tokenPayload: AurexTokenPayload = {
    sub: upsert.user.id,
    email: upsert.user.email,
    role: upsert.user.role as AurexTokenPayload['role'],
  };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await prisma.session.create({
    data: {
      userId: upsert.user.id,
      refreshToken,
      userAgent: opts.userAgent,
      ipAddress: opts.ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    },
  });

  await authService.logAuthEvent(
    upsert.user.id,
    'LOGIN_SUCCESS',
    opts.ipAddress,
    opts.userAgent,
    { method: 'google-oauth', linked: upsert.linked, created: upsert.created },
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: upsert.user.id,
      email: upsert.user.email,
      name: upsert.user.name,
      role: upsert.user.role.toLowerCase(),
    },
    redirect: parsedState.redirect,
    created: upsert.created,
  };
}

interface UpsertResult {
  user: { id: string; email: string; name: string; role: string };
  created: boolean;
  linked: boolean;
}

async function upsertGoogleUser(opts: {
  sub: string;
  email: string;
  name: string;
}): Promise<UpsertResult> {
  // Match by Google sub first (stable across email changes), then by email.
  const bySub = await prisma.user.findUnique({ where: { googleSub: opts.sub } });
  if (bySub) {
    if (!bySub.isActive) {
      throw new AppError(403, 'Forbidden', 'Account is disabled');
    }
    await prisma.user.update({
      where: { id: bySub.id },
      data: { lastLoginAt: new Date() },
    });
    return {
      user: { id: bySub.id, email: bySub.email, name: bySub.name, role: bySub.role },
      created: false,
      linked: false,
    };
  }

  const byEmail = await prisma.user.findUnique({ where: { email: opts.email } });
  if (byEmail) {
    if (!byEmail.isActive) {
      throw new AppError(403, 'Forbidden', 'Account is disabled');
    }
    if (byEmail.googleSub && byEmail.googleSub !== opts.sub) {
      // Existing local account is already bound to a different Google
      // identity. Refuse to silently re-bind — operator must intervene.
      throw new AppError(
        409,
        'Conflict',
        'This email is linked to a different Google account',
      );
    }
    // First-time link: attach googleSub, mark verified (Google validated the
    // email), bump login timestamp.
    const updated = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleSub: opts.sub,
        isVerified: true,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
      },
    });
    return {
      user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
      created: false,
      linked: true,
    };
  }

  // Brand-new user — create with a federated identity, no local password.
  const created = await prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name,
      googleSub: opts.sub,
      passwordHash: null,
      isVerified: true,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    },
  });
  logger.info({ userId: created.id, email: opts.email }, 'google-oauth: user created');
  return {
    user: { id: created.id, email: created.email, name: created.name, role: created.role },
    created: true,
    linked: false,
  };
}
