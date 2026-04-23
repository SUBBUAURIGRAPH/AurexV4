import { describe, test, expect } from 'vitest';

/**
 * ADM-052/056: OWASP-006 Security Misconfiguration
 * ADM-057: Security headers validation
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

describe('[critical] OWASP-006: Security Headers', () => {
  test('X-Content-Type-Options: nosniff', async () => {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('X-Frame-Options: DENY', async () => {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  test('X-XSS-Protection enabled', async () => {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    expect(res.headers.get('x-xss-protection')).toContain('1');
  });

  test('Referrer-Policy set', async () => {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    expect(res.headers.get('referrer-policy')).toBeTruthy();
  });

  test('HSTS header present', async () => {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    const hsts = res.headers.get('strict-transport-security');
    expect(hsts).toContain('max-age=');
  });

  test('No X-Powered-By header', async () => {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  test('Permissions-Policy set', async () => {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    expect(res.headers.get('permissions-policy')).toBeTruthy();
  });
});
