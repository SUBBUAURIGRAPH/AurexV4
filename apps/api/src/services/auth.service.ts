import bcrypt from 'bcrypt';
import { prisma } from '@aurex/database';
import { signAccessToken, signRefreshToken, verifyRefreshToken, type TokenPayload } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';
import * as couponService from './coupon.service.js';
import * as emailVerificationService from './email-verification.service.js';

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

function toApiRole(role: string): string {
  return role.toLowerCase();
}

export async function login(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  // ADM-052: No user enumeration — same error for both cases
  if (!user || !user.isActive) {
    await logAuthEvent(null, 'LOGIN_FAILURE', ipAddress, userAgent);
    throw new AppError(401, 'Unauthorized', 'Invalid email or password');
  }

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(429, 'Too Many Requests', 'Account temporarily locked. Try again later.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedAttempts + 1;
    const update: Record<string, unknown> = { failedAttempts: attempts };

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
      await logAuthEvent(user.id, 'ACCOUNT_LOCKED', ipAddress, userAgent);
    }

    await prisma.user.update({ where: { id: user.id }, data: update });
    await logAuthEvent(user.id, 'LOGIN_FAILURE', ipAddress, userAgent);
    throw new AppError(401, 'Unauthorized', 'Invalid email or password');
  }

  // Success — clear failed attempts
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });

  const payload: TokenPayload = { sub: user.id, email: user.email, role: user.role as TokenPayload['role'] };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store refresh token in DB
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000), // 7 days
    },
  });

  await logAuthEvent(user.id, 'LOGIN_SUCCESS', ipAddress, userAgent);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: toApiRole(user.role) },
  };
}

export interface RegisterTrial {
  trialStart: Date;
  trialEnd: Date;
  trialTier: string;
  trialDurationDays: number;
  appliedCouponCode: string;
}

export interface RegisterResult {
  id: string;
  email: string;
  name: string;
  /** Trial window when a coupon was successfully redeemed during signup. */
  trial?: RegisterTrial;
  /** Set when a coupon code was provided but redemption failed; the
   *  user is still created. Front-end surfaces "Account created, but
   *  voucher couldn't be applied: <reason>". */
  couponWarning?: string;
}

export interface RegisterOptions {
  couponCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function register(
  email: string,
  password: string,
  name: string,
  options: RegisterOptions = {},
): Promise<RegisterResult> {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new AppError(409, 'Conflict', 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true },
  });

  logger.info({ userId: user.id, email }, 'User registered');

  // Issue email-verification token (best-effort — failure here must NOT
  // roll back user creation). The plaintext token is delivered to the
  // user via SES (AAT-EMAIL); it is NEVER returned in this response,
  // not even in dev. Operators in dev can pick the URL out of the API
  // logs (see emailVerificationService.issueToken).
  try {
    await emailVerificationService.issueToken(user.id, email);
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Failed to issue verification token');
  }

  // Audit log: include couponApplied flag but NOT the raw code value.
  // The redemption row holds the canonical reference; auth events only
  // record whether one was attempted.
  let trial: RegisterTrial | undefined;
  let couponWarning: string | undefined;

  if (options.couponCode) {
    const code = options.couponCode.trim();
    try {
      const redeemed = await couponService.redeemCoupon({
        code,
        email,
        ipAddress: options.ipAddress,
      });
      trial = {
        trialStart: redeemed.trialStart,
        trialEnd: redeemed.trialEnd,
        trialTier: redeemed.trialTier,
        trialDurationDays: redeemed.trialDurationDays,
        appliedCouponCode: redeemed.couponCode,
      };
    } catch (err) {
      // Surface a clean reason but never block account creation.
      const reason =
        err instanceof AppError ? err.message : 'Voucher could not be applied';
      couponWarning = reason;
      logger.warn({ userId: user.id, err }, 'Coupon redemption failed during register');
    }
  }

  await logAuthEvent(
    user.id,
    'REGISTER',
    options.ipAddress,
    options.userAgent,
    { couponApplied: Boolean(trial), couponWarning: couponWarning ?? null },
  );

  const result: RegisterResult = { id: user.id, email: user.email, name: user.name };
  if (trial) result.trial = trial;
  if (couponWarning) result.couponWarning = couponWarning;
  return result;
}

export async function refreshTokens(
  token: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // jwt.verify() throws JsonWebTokenError for malformed tokens and
  // TokenExpiredError for expired ones — both mean 401, not 500.
  let decoded: ReturnType<typeof verifyRefreshToken>;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, 'Unauthorized', 'Invalid or expired refresh token');
  }

  const session = await prisma.session.findUnique({ where: { refreshToken: token } });
  if (!session || session.expiresAt < new Date()) {
    throw new AppError(401, 'Unauthorized', 'Invalid or expired refresh token');
  }

  // Rotate refresh token
  const newRefreshToken = signRefreshToken({
    sub: decoded.sub,
    email: decoded.email,
    role: decoded.role,
  });

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: newRefreshToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    },
  });

  await logAuthEvent(decoded.sub, 'TOKEN_REFRESH', ipAddress, userAgent);

  return {
    accessToken: signAccessToken({ sub: decoded.sub, email: decoded.email, role: decoded.role }),
    refreshToken: newRefreshToken,
  };
}

export async function logout(refreshToken: string, userId?: string): Promise<void> {
  await prisma.session.deleteMany({ where: { refreshToken } });
  if (userId) {
    await logAuthEvent(userId, 'LOGOUT');
  }
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerifiedAt: true,
      orgMembers: {
        where: { isActive: true },
        take: 1,
        include: { org: { select: { name: true } } },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'Not Found', 'User not found');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: toApiRole(user.role),
    organization: user.orgMembers[0]?.org?.name,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
  };
}

export async function updateCurrentUser(userId: string, data: { name?: string; email?: string }) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AppError(404, 'Not Found', 'User not found');
  }

  if (data.email && data.email !== existing.email) {
    const emailExists = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailExists) {
      throw new AppError(409, 'Conflict', 'Email already in use');
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
    },
  });

  return getCurrentUser(userId);
}

export async function logAuthEvent(
  userId: string | null,
  eventType: string,
  ipAddress?: string,
  userAgent?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.authEvent.create({
      data: {
        userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventType: eventType as any,
        ipAddress,
        userAgent,
        ...(metadata !== undefined ? { metadata: metadata as never } : {}),
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to log auth event');
  }
}
