/**
 * Password-reset service.
 *
 * Pattern mirrors email-verification.service.ts — the DB stores SHA-256
 * hashes of a 32-byte random secret; the plaintext token rides only in
 * the reset email and the user-facing URL.
 *
 * Flow:
 *   1. requestReset(email) — called from POST /auth/forgot-password.
 *      Looks up the user; if found, invalidates any prior unused tokens
 *      (sets expiresAt = now), issues a fresh one with a 1h TTL, and
 *      delivers the URL via emailService.sendEmail. Always succeeds at
 *      the API boundary — no user enumeration leak (ADM-052), the route
 *      returns 202 regardless of whether the email exists.
 *   2. consumeToken(plaintext, newPassword) — called from POST
 *      /auth/reset-password. Validates the token (404 unknown, 410
 *      expired/used), bcrypt-hashes the new password, updates the user,
 *      stamps usedAt, and DELETEs every active session for that user
 *      (ADM-052: token rotation on credential change).
 *
 * Email send is best-effort. A delivery failure must not throw out of
 * requestReset — the operator-side audit log (outbound_emails) is the
 * canonical evidence of the attempt.
 */

import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import * as emailService from './email/email.service.js';
import { renderPasswordResetEmail } from './email/templates/password-reset.js';
import { logAuthEvent } from './auth.service.js';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const TOKEN_TTL_MINUTES = 60;
const TOKEN_BYTES = 32;
const SALT_ROUNDS = 12;

function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

function buildResetUrl(plaintext: string): string {
  const base =
    process.env.AUREX_PUBLIC_URL ??
    process.env.WEB_BASE_URL ??
    process.env.WEB_PUBLIC_URL ??
    'https://aurex.in';
  return `${base.replace(/\/$/, '')}/reset-password?token=${plaintext}`;
}

export interface RequestResetResult {
  /** Always present so the route can mirror back the same shape, even when
   *  no user matched. The route MUST NOT differentiate to the client. */
  emailQueued: boolean;
  /** Dev-only — never returned by HTTP. Operators in dev can copy the URL
   *  out of the API logs to complete the flow without a real SES/Mandrill
   *  delivery. */
  _devResetUrl?: string;
}

/**
 * Issue a password-reset token for the given email if a matching user
 * exists. Always returns successfully — no user enumeration. Email send
 * is best-effort; we log the attempt either way.
 */
export async function requestReset(
  email: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<RequestResetResult> {
  const normalised = email.trim().toLowerCase();
  if (!normalised) {
    // Same shape as no-match: no enumeration leak.
    return { emailQueued: false };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (!user || !user.isActive) {
    // No user — log auth event with a null subject for audit, but
    // surface success to the caller. ADM-052.
    await logAuthEvent(null, 'PASSWORD_RESET_REQUEST', ipAddress, userAgent, {
      reason: 'unknown_email',
    });
    return { emailQueued: false };
  }

  // Invalidate any outstanding tokens for this user — only one valid
  // reset link should exist at a time. Setting expiresAt to now makes
  // the row look expired without deleting audit history.
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date(0) },
  });

  const plaintext = randomBytes(TOKEN_BYTES).toString('hex');
  const token = hashToken(plaintext);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt },
  });

  const resetUrl = buildResetUrl(plaintext);
  const recipientName = user.name?.trim() || user.email;

  const rendered = renderPasswordResetEmail({
    recipientName,
    resetUrl,
    expiresInMinutes: TOKEN_TTL_MINUTES,
  });

  let emailQueued = false;
  try {
    const result = await emailService.sendEmail({
      to: user.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'password-reset',
    });
    emailQueued = result.ok;
    if (!result.ok) {
      logger.warn(
        { userId: user.id, email: user.email, error: result.error },
        'Password reset email failed to send (best-effort)',
      );
    }
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Password reset email send threw unexpectedly');
  }

  await logAuthEvent(user.id, 'PASSWORD_RESET_REQUEST', ipAddress, userAgent, {
    emailQueued,
    expiresAt: expiresAt.toISOString(),
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.info(
      { userId: user.id, email: user.email, resetUrl, expiresAt },
      'dev-only: password-reset URL (also delivered by email)',
    );
    return { emailQueued, _devResetUrl: resetUrl };
  }

  return { emailQueued };
}

/**
 * Consume a reset token and set a new password. Errors:
 *   - 400 when newPassword fails the strength rules
 *   - 404 when the token doesn't match any row
 *   - 410 when the token has expired or has already been used
 *
 * On success: bcrypt-hashes the new password, updates the user
 * (clearing failedAttempts/lockedUntil), stamps usedAt on the token row,
 * and DELETEs every active session for that user so existing JWTs lose
 * their refresh path.
 */
export async function consumeToken(
  plaintext: string,
  newPassword: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ userId: string; email: string }> {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new AppError(400, 'Bad Request', 'Reset token is required');
  }
  if (!newPassword || newPassword.length < 8) {
    throw new AppError(400, 'Bad Request', 'New password must be at least 8 characters');
  }
  const token = hashToken(plaintext);

  const row = await prisma.passwordReset.findUnique({
    where: { token },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row) {
    throw new AppError(404, 'Not Found', 'Reset token not recognised');
  }
  if (row.usedAt) {
    throw new AppError(410, 'Gone', 'Reset token has already been used');
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError(410, 'Gone', 'Reset token has expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
      },
      select: { id: true, email: true },
    });
    await tx.passwordReset.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    // Boot every existing session — refresh tokens issued under the old
    // password must not survive the reset.
    await tx.session.deleteMany({ where: { userId: row.userId } });
    return updated;
  });

  await logAuthEvent(user.id, 'PASSWORD_RESET_COMPLETE', ipAddress, userAgent);
  logger.info({ userId: user.id }, 'Password reset completed');

  return { userId: user.id, email: user.email };
}

/** Test-only: drop the in-process token TTL constant for unit tests that
 *  need to assert exact expiry boundaries. */
export const _internals = {
  TOKEN_TTL_MS,
  TOKEN_TTL_MINUTES,
  hashToken,
  buildResetUrl,
};
