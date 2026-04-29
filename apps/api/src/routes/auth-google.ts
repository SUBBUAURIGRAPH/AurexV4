/**
 * Google Sign-In routes (mounted under /api/v1/auth/google).
 *
 * GET /start    — 302 to Google's authorization endpoint.
 * GET /callback — Google redirects here; we exchange the code, issue
 *                 Aurex JWTs, and 302 the browser to the web app's
 *                 /auth/google/callback#access_token=...&refresh_token=...
 *                 fragment so the SPA can pick up the tokens without
 *                 them ever hitting a server log.
 */
import { Router, type IRouter } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import * as googleOauth from '../services/google-oauth.service.js';

export const authGoogleRouter: IRouter = Router();

function getClientIP(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function getWebBaseUrl(): string {
  return process.env.WEB_BASE_URL ?? 'https://aurex.in';
}

authGoogleRouter.get('/start', (req, res, next) => {
  try {
    const redirect =
      typeof req.query.redirect === 'string' ? req.query.redirect : undefined;
    const url = googleOauth.buildAuthorizationUrl({ redirect });
    res.redirect(302, url);
  } catch (err) {
    next(err);
  }
});

authGoogleRouter.get('/callback', async (req, res, next) => {
  const webBase = getWebBaseUrl();
  try {
    // Google may surface the user-cancelled / consent-denied path as
    // ?error=access_denied with no code. Bounce those to the SPA with
    // a friendly query so the login page can show a toast.
    if (typeof req.query.error === 'string') {
      logger.info({ error: req.query.error }, 'google-oauth: user denied consent');
      return res.redirect(302, `${webBase}/login?google_error=${encodeURIComponent(req.query.error)}`);
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
      throw new AppError(400, 'Bad Request', 'Missing code or state');
    }

    const result = await googleOauth.handleCallback({
      code,
      state,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
    });

    // Hand tokens to the SPA via URL fragment. Fragments are NOT sent in
    // HTTP requests, so the access_token never appears in our (or any
    // upstream proxy's) access logs. The SPA reads window.location.hash,
    // stores the tokens in localStorage to match the existing /login
    // pattern, then `history.replaceState`s the fragment away.
    const fragment = new URLSearchParams({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user_id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      redirect: result.redirect,
    });
    return res.redirect(302, `${webBase}/auth/google/callback#${fragment.toString()}`);
  } catch (err) {
    if (err instanceof AppError) {
      // Soft-fail to the SPA so users see a clean error page rather than
      // the API JSON Problem Detail.
      return res.redirect(
        302,
        `${webBase}/login?google_error=${encodeURIComponent(err.message)}`,
      );
    }
    next(err);
  }
});
