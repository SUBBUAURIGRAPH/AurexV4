/**
 * AAT-ONBOARD: email-verification scaffold.
 *
 * The DB stores SHA-256 hashes of the random token; the plaintext value
 * is delivered out-of-band (email in production, returned in the dev
 * response in NODE_ENV !== 'production' so dev/test can complete the
 * flow without an SMTP server).
 *
 * Flow:
 *   1. issueToken(userId, email) — called from registration. Generates a
 *      32-byte random secret, stores its sha256, expires in 24h.
 *   2. verifyToken(plaintext)    — flips both EmailVerification.verifiedAt
 *      and User.emailVerifiedAt. Idempotent: a row already verified just
 *      no-ops with success.
 *   3. resendForUser(userId)     — invalidates prior tokens for this user
 *      (sets expiresAt to now) and issues a fresh one.
 *
 * Email send is stubbed via logger.info — replace with a real provider
 * (SES, Postmark) when one is wired.
 */

import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const TOKEN_BYTES = 32;

export interface IssueResult {
  /** SHA-256 hex stored in the DB (also the row's primary key). */
  token: string;
  /** Plaintext token. NEVER persist. Email this to the user. */
  plaintextToken: string;
  expiresAt: Date;
}

function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

function buildVerificationUrl(plaintext: string): string {
  const base = process.env.WEB_PUBLIC_URL ?? 'https://app.aurex.in';
  return `${base.replace(/\/$/, '')}/verify-email?token=${plaintext}`;
}

/**
 * Issue a new verification token for the given user. Returns both the
 * stored hash (so callers can audit) and the plaintext (so dev/test can
 * complete the flow).
 */
export async function issueToken(userId: string, email: string): Promise<IssueResult> {
  const plaintext = randomBytes(TOKEN_BYTES).toString('hex');
  const token = hashToken(plaintext);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.emailVerification.create({
    data: { userId, email, token, expiresAt },
  });

  // Stubbed email send. In production this would push to SES/Postmark.
  logger.info(
    {
      userId,
      email,
      verificationUrl: buildVerificationUrl(plaintext),
      expiresAt,
    },
    'Email verification link issued (email stub)',
  );

  return { token, plaintextToken: plaintext, expiresAt };
}

/**
 * Mark a verification token as consumed and flip User.emailVerifiedAt.
 * Idempotent: if the matching row is already verified, returns the
 * existing verifiedAt without throwing.
 *
 * Errors:
 *   - 404 when the token doesn't match any row
 *   - 410 when the token has expired
 */
export async function verifyToken(plaintext: string): Promise<{
  userId: string;
  email: string;
  verifiedAt: Date;
  alreadyVerified: boolean;
}> {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new AppError(400, 'Bad Request', 'Verification token is required');
  }
  const token = hashToken(plaintext);

  const row = await prisma.emailVerification.findUnique({ where: { token } });
  if (!row) {
    throw new AppError(404, 'Not Found', 'Verification token not recognised');
  }

  // Idempotent: already-verified is a 200, not a 409. Re-verifying the
  // same link from an email client (which often pre-fetches) shouldn't
  // surface as an error.
  if (row.verifiedAt) {
    return {
      userId: row.userId,
      email: row.email,
      verifiedAt: row.verifiedAt,
      alreadyVerified: true,
    };
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError(410, 'Gone', 'Verification token has expired');
  }

  const now = new Date();

  // Two-row update under a transaction so we never end up with a
  // verified token but an unverified user (or vice versa).
  await prisma.$transaction([
    prisma.emailVerification.update({
      where: { id: row.id },
      data: { verifiedAt: now },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: now, isVerified: true },
    }),
  ]);

  logger.info({ userId: row.userId, email: row.email }, 'Email verified');
  return {
    userId: row.userId,
    email: row.email,
    verifiedAt: now,
    alreadyVerified: false,
  };
}

/**
 * Invalidate all prior tokens for the user (set expiresAt = now()) and
 * issue a fresh one. Returns the new IssueResult so the caller can
 * surface the dev plaintext payload in non-prod.
 *
 * Errors:
 *   - 404 when the user does not exist
 *   - 409 when the user is already verified
 */
export async function resendForUser(userId: string): Promise<IssueResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'Not Found', 'User not found');
  }
  if (user.emailVerifiedAt) {
    throw new AppError(409, 'Conflict', 'Email already verified');
  }

  // Invalidate prior tokens. We do NOT delete them — keep them for audit
  // — but mark them expired so they cannot complete a verify call.
  const now = new Date();
  await prisma.emailVerification.updateMany({
    where: { userId, verifiedAt: null, expiresAt: { gt: now } },
    data: { expiresAt: now },
  });

  return issueToken(userId, user.email);
}
