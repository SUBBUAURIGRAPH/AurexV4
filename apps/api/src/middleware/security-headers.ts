import type { Request, Response, NextFunction } from 'express';

/**
 * ADM-052 Phase 1: Security Headers Middleware
 * ADM-054: HSTS for HTTPS enforcement
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy — restrict sensitive APIs
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );

  // HSTS — 1 year, include subdomains (ADM-054)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Remove server fingerprint
  res.removeHeader('X-Powered-By');

  next();
}
