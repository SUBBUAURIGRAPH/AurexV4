import bcrypt from 'bcrypt';
import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';
import { generateSecret, verifyTotp, otpauthUrl } from '../lib/totp.js';
import { logAuthEvent } from './auth.service.js';

const SALT_ROUNDS = 12;

export interface SessionResult {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'Not Found', 'User not found');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    await logAuthEvent(userId, 'LOGIN_FAILURE', ipAddress, userAgent);
    throw new AppError(401, 'Unauthorized', 'Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new AppError(400, 'Bad Request', 'New password must differ from the current password');
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash, failedAttempts: 0, lockedUntil: null },
  });

  // Invalidate every session — force re-login everywhere.
  await prisma.session.deleteMany({ where: { userId } });

  await logAuthEvent(userId, 'PASSWORD_CHANGE', ipAddress, userAgent);
  logger.info({ userId }, 'Password changed');
}

/**
 * Begin MFA enrolment. Writes a pending secret to user.mfaSecret but leaves
 * mfaEnabled=false until the user verifies a code. Returns the secret + an
 * otpauth URL the client can render as a QR code.
 *
 * If MFA is already enabled, this is rejected (409) — the user must disable
 * first. Re-issuing a new secret without confirmation would let an attacker
 * who stole an authenticated session silently swap the device.
 */
export async function enrollMfa(userId: string, email: string): Promise<{
  secret: string;
  otpauthUrl: string;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'Not Found', 'User not found');
  if (user.mfaEnabled) {
    throw new AppError(409, 'Conflict', 'MFA is already enabled. Disable it before re-enrolling.');
  }

  const secret = generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });
  logger.info({ userId }, 'MFA enrolment started');
  return { secret, otpauthUrl: otpauthUrl(secret, email) };
}

export async function verifyMfaEnrollment(
  userId: string,
  code: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'Not Found', 'User not found');
  if (user.mfaEnabled) {
    throw new AppError(409, 'Conflict', 'MFA is already enabled');
  }
  if (!user.mfaSecret) {
    throw new AppError(400, 'Bad Request', 'No MFA enrolment in progress. Call /enroll first.');
  }

  if (!verifyTotp(user.mfaSecret, code)) {
    throw new AppError(401, 'Unauthorized', 'Invalid MFA code');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true },
  });

  await logAuthEvent(userId, 'MFA_ENABLED', ipAddress, userAgent);
  logger.info({ userId }, 'MFA enabled');
}

export async function disableMfa(
  userId: string,
  password: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'Not Found', 'User not found');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Unauthorized', 'Password is incorrect');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  await logAuthEvent(userId, 'MFA_DISABLED', ipAddress, userAgent);
  logger.info({ userId }, 'MFA disabled');
}

export async function listSessions(userId: string): Promise<SessionResult[]> {
  const rows = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      userAgent: true,
      ipAddress: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return rows as unknown as SessionResult[];
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const row = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!row) throw new AppError(404, 'Not Found', 'Session not found');
  await prisma.session.delete({ where: { id: sessionId } });
  logger.info({ userId, sessionId }, 'Session revoked');
}

export async function revokeAllSessions(userId: string): Promise<{ revoked: number }> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  logger.info({ userId, count: result.count }, 'All sessions revoked');
  return { revoked: result.count };
}
