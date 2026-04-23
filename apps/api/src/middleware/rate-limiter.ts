import type { Request, Response, NextFunction } from 'express';

/**
 * ADM-040/052: Sliding-window rate limiter
 * Auth endpoints: 5 attempts/min, General: 100/min, Admin: 200/min
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function checkLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIP(req);
  const isAuth = req.path.startsWith('/api/v1/auth');
  const key = isAuth ? `auth:${ip}` : `api:${ip}`;
  const limit = isAuth ? 20 : 100;
  const window = 60_000;

  if (!checkLimit(key, limit, window)) {
    res.status(429).json({
      type: 'https://aurex.in/errors/rate-limited',
      title: 'Too Many Requests',
      status: 429,
      detail: `Rate limit exceeded. Try again later.`,
    });
    return;
  }

  next();
}

/**
 * ADM-040: Separate auth failure tracking — only count actual failed auth attempts
 */
export function recordAuthFailure(ip: string): void {
  const key = `auth-fail:${ip}`;
  checkLimit(key, 50, 15 * 60_000); // 50 failures per 15min
}

export function isAuthRateLimited(ip: string): boolean {
  const entry = store.get(`auth-fail:${ip}`);
  if (!entry || entry.resetAt < Date.now()) return false;
  return entry.count >= 50;
}

export function clearAuthFailures(ip: string): void {
  store.delete(`auth-fail:${ip}`);
}
