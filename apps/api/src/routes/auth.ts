import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { isValidEmail, sanitizeInput } from '../lib/security.js';
import * as authService from '../services/auth.service.js';
import * as emailVerificationService from '../services/email-verification.service.js';
import * as passwordResetService from '../services/password-reset.service.js';

export const authRouter: IRouter = Router();

/**
 * ADM-036/037: Modular auth routes with real JWT + bcrypt
 * ADM-040: Auth failure tracking via service layer
 * ADM-052: Input validation & sanitization
 */

function getClientIP(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      throw new AppError(400, 'Bad Request', 'Email and password are required');
    }
    if (!isValidEmail(email)) {
      throw new AppError(400, 'Bad Request', 'Invalid email format');
    }

    const result = await authService.login(
      sanitizeInput(email, 254),
      password,
      getClientIP(req),
      req.headers['user-agent'],
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Coupon code: 4–64 chars, alphanumeric + hyphens only, normalised to
// uppercase. Tighter than the public /coupons/validate schema because
// /register is also creating a User row and we want a clean audit trail.
const couponCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, 'Coupon code must be alphanumeric (with hyphens)')
  .transform((s) => s.toUpperCase());

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, couponCode } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      couponCode?: string;
    };

    if (!email || !password || !name) {
      throw new AppError(400, 'Bad Request', 'Email, password, and name are required');
    }
    if (!isValidEmail(email)) {
      throw new AppError(400, 'Bad Request', 'Invalid email format');
    }
    if (password.length < 8) {
      throw new AppError(400, 'Bad Request', 'Password must be at least 8 characters');
    }

    let normalisedCoupon: string | undefined;
    if (couponCode !== undefined && couponCode !== null && couponCode !== '') {
      const parsed = couponCodeSchema.safeParse(couponCode);
      if (!parsed.success) {
        throw new AppError(400, 'Bad Request', 'Invalid coupon code format');
      }
      normalisedCoupon = parsed.data;
    }

    const result = await authService.register(
      sanitizeInput(email, 254),
      password,
      sanitizeInput(name, 200),
      {
        couponCode: normalisedCoupon,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
      },
    );

    // The frontend keys on `data` for the user shape; trial / coupon
    // fields ride alongside. Tokens are top-level so AuthContext.register
    // can pick them up from the same shape as /login (auto-login per UX
    // directive 2026-05-01: no duplicate logins in workflow).
    const payload: Record<string, unknown> = {
      data: {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
    if (result.trial) {
      payload.trial = {
        ...result.trial,
        trialStart: result.trial.trialStart.toISOString(),
        trialEnd: result.trial.trialEnd.toISOString(),
      };
    }
    if (result.couponWarning) payload.couponWarning = result.couponWarning;

    // AAT-EMAIL: the plaintext verification token is NEVER returned in
    // the API response. It is delivered to the user via SES; operators
    // running the API in dev can read it from the structured log line
    // emitted by email-verification.service when NODE_ENV !== 'production'.

    res.status(201).json(payload);
  } catch (err) {
    next(err);
  }
});

// ─── Email verification ────────────────────────────────────────────────

const verifyEmailSchema = z.object({
  token: z.string().trim().min(16).max(256),
});

authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body ?? {});
    const result = await emailVerificationService.verifyToken(token);
    res.json({
      data: {
        verifiedAt: result.verifiedAt.toISOString(),
        alreadyVerified: result.alreadyVerified,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/resend-verification', requireAuth, async (req, res, next) => {
  try {
    const issued = await emailVerificationService.resendForUser(req.user!.sub);
    await authService.logAuthEvent(
      req.user!.sub,
      'EMAIL_VERIFY_RESEND',
      getClientIP(req),
      req.headers['user-agent'],
    );
    // AAT-EMAIL: the plaintext token is delivered via SES — never
    // returned in this response, even in dev.
    res.json({ data: { expiresAt: issued.expiresAt.toISOString() } });
  } catch (err) {
    next(err);
  }
});

// ─── Password reset (forgot-password flow) ────────────────────────────

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1).max(254).email(),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(16).max(256),
  newPassword: z.string().min(8).max(128),
});

/**
 * Always returns 202 — never reveals whether the email matched a user
 * (ADM-052: no enumeration). The dev-only `_devResetUrl` field is
 * surfaced when NODE_ENV !== 'production' so an operator running
 * locally can complete the flow without a real email round-trip.
 */
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body ?? {});
    const result = await passwordResetService.requestReset(
      sanitizeInput(email, 254),
      getClientIP(req),
      req.headers['user-agent'],
    );
    const payload: Record<string, unknown> = {
      message: 'If that email is registered, a password-reset link is on its way.',
    };
    if (process.env.NODE_ENV !== 'production' && result._devResetUrl) {
      payload._devResetUrl = result._devResetUrl;
    }
    res.status(202).json(payload);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body ?? {});
    const result = await passwordResetService.consumeToken(
      token,
      newPassword,
      getClientIP(req),
      req.headers['user-agent'],
    );
    // Same shape as /login so AuthContext can store the tokens directly.
    // Auto-login on reset eliminates the manual re-login step (UX
    // directive 2026-05-01: no duplicate logins in workflow).
    res.json({
      message: 'Password reset complete.',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.userId,
        email: result.email,
        name: result.name,
        role: result.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      throw new AppError(400, 'Bad Request', 'Refresh token required');
    }

    const tokens = await authService.refreshTokens(
      refreshToken,
      getClientIP(req),
      req.headers['user-agent'],
    );

    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    await authService.logout(refreshToken ?? '', req.user?.sub);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user!.sub);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

authRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, email } = req.body as { name?: string; email?: string };
    const payload: { name?: string; email?: string } = {};

    if (name !== undefined) {
      const sanitizedName = sanitizeInput(name, 200);
      if (!sanitizedName) {
        throw new AppError(400, 'Bad Request', 'Name cannot be empty');
      }
      payload.name = sanitizedName;
    }

    if (email !== undefined) {
      if (!isValidEmail(email)) {
        throw new AppError(400, 'Bad Request', 'Invalid email format');
      }
      payload.email = sanitizeInput(email, 254);
    }

    if (!payload.name && !payload.email) {
      throw new AppError(400, 'Bad Request', 'No profile fields provided');
    }

    const updated = await authService.updateCurrentUser(req.user!.sub, payload);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
