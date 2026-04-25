/**
 * AAT-ONBOARD: email-verification scaffold.
 *
 * The DB stores SHA-256 hashes of the random token; the plaintext value
 * is delivered out-of-band via the SES-backed email service (AAT-EMAIL).
 *
 * Flow:
 *   1. issueToken(userId, email) — called from registration. Generates a
 *      32-byte random secret, stores its sha256, expires in 24h, sends
 *      the verification email via emailService.sendEmail.
 *   2. verifyToken(plaintext)    — flips both EmailVerification.verifiedAt
 *      and User.emailVerifiedAt. Idempotent: a row already verified just
 *      no-ops with success. On the FIRST verification it also fires a
 *      welcome email to the user.
 *   3. resendForUser(userId)     — invalidates prior tokens for this user
 *      (sets expiresAt to now) and issues a fresh one.
 *
 * Email send is best-effort — a failure here MUST NOT roll back the
 * verification row or the user row. The caller relies on that to keep
 * registration / verify flows working even if SES is degraded.
 */

import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import * as emailService from './email/email.service.js';
import { renderVerificationEmail } from './email/templates/verification.js';
import { renderWelcomeEmail } from './email/templates/welcome.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const TOKEN_TTL_HOURS = 24;
const TOKEN_BYTES = 32;

export interface IssueResult {
  /** SHA-256 hex stored in the DB (also the row's primary key). */
  token: string;
  /** Plaintext token. NEVER persist. NEVER surface in API responses. */
  plaintextToken: string;
  expiresAt: Date;
}

function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

function buildVerificationUrl(plaintext: string): string {
  // AUREX_PUBLIC_URL is the canonical web origin for v4; we keep the
  // legacy WEB_PUBLIC_URL fallback so existing deploy envs don't break.
  const base =
    process.env.AUREX_PUBLIC_URL ??
    process.env.WEB_PUBLIC_URL ??
    'https://aurex.in';
  return `${base.replace(/\/$/, '')}/verify-email?token=${plaintext}`;
}

/**
 * Issue a new verification token for the given user. Returns both the
 * stored hash (for audit) and the plaintext (so internal callers like
 * `resendForUser` can chain). The plaintext MUST NOT be returned by HTTP
 * routes — it's delivered to the user via email.
 */
export async function issueToken(userId: string, email: string): Promise<IssueResult> {
  const plaintext = randomBytes(TOKEN_BYTES).toString('hex');
  const token = hashToken(plaintext);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.emailVerification.create({
    data: { userId, email, token, expiresAt },
  });

  const verificationUrl = buildVerificationUrl(plaintext);

  // Look up the user so we can personalise the email body. If the
  // lookup fails (race with deletion, etc.) we fall back to a generic
  // greeting — the email itself must still go out.
  let recipientName = email;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (user?.name) recipientName = user.name;
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to fetch user name for verification email');
  }

  const rendered = renderVerificationEmail({
    recipientName,
    verificationUrl,
    expiresInHours: TOKEN_TTL_HOURS,
  });

  // Fire-and-don't-throw. emailService.sendEmail is already best-effort,
  // but defence-in-depth: we wrap in try/catch so a programmer error in
  // the service never breaks registration.
  try {
    const result = await emailService.sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'verification',
    });
    if (!result.ok) {
      // Surface a clear ops signal: SES failed but we did NOT throw.
      logger.warn(
        { userId, email, error: result.error },
        'Verification email failed to send (best-effort)',
      );
    }
  } catch (err) {
    logger.error({ err, userId }, 'Verification email send threw unexpectedly');
  }

  // Belt-and-braces dev hint: when SES isn't wired up locally an operator
  // running the API in dev can still complete the flow by reading the
  // log line. NEVER surface this URL in HTTP responses.
  if (process.env.NODE_ENV !== 'production') {
    logger.info(
      { userId, email, verificationUrl, expiresAt },
      'dev-only: verification URL (also delivered by SES)',
    );
  }

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

  // Fire welcome email AFTER the transaction commits so a failed send
  // never blocks the verification. The lookup pulls the user's name +
  // org membership + any active coupon trial so the welcome email can
  // surface a "trial active" card when relevant.
  await sendWelcomeEmailBestEffort(row.userId, row.email);

  return {
    userId: row.userId,
    email: row.email,
    verifiedAt: now,
    alreadyVerified: false,
  };
}

/**
 * Best-effort welcome email send. Looks up the user + first org + any
 * active coupon redemption to populate the trial card. NEVER throws.
 */
async function sendWelcomeEmailBestEffort(
  userId: string,
  email: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        orgMembers: {
          where: { isActive: true },
          take: 1,
          include: { org: { select: { name: true } } },
        },
      },
    });

    const recipientName = user?.name ?? email;
    const orgName = user?.orgMembers?.[0]?.org?.name;

    // Pull the most recent ACTIVE redemption for this user's email so
    // we can render the trial card. If there are no redemptions or the
    // table is missing (older migrations) we just skip.
    let trialActiveCoupon:
      | { couponCode: string; trialEndLabel: string; trialTier: string }
      | undefined;
    try {
      const redemption = await prisma.couponRedemption.findFirst({
        where: { userEmail: email, trialStatus: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: { coupon: { select: { couponCode: true, trialTier: true } } },
      });
      if (redemption) {
        trialActiveCoupon = {
          couponCode: redemption.coupon.couponCode,
          trialEndLabel: redemption.trialEnd.toISOString().slice(0, 10),
          trialTier: redemption.coupon.trialTier,
        };
      }
    } catch (err) {
      logger.debug({ err, userId }, 'No coupon redemption lookup for welcome email');
    }

    const rendered = renderWelcomeEmail({
      recipientName,
      ...(orgName ? { orgName } : {}),
      ...(trialActiveCoupon ? { trialActiveCoupon } : {}),
    });

    const result = await emailService.sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'welcome',
    });
    if (!result.ok) {
      logger.warn({ userId, email, error: result.error }, 'Welcome email failed to send');
    }
  } catch (err) {
    // Never throw — verification was already committed above.
    logger.error({ err, userId }, 'Welcome email send threw unexpectedly');
  }
}

/**
 * Invalidate all prior tokens for the user (set expiresAt = now()) and
 * issue a fresh one. The plaintext is NEVER returned to HTTP callers —
 * delivery happens via emailService.sendEmail.
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
