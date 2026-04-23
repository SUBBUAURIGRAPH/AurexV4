import { describe, test, expect } from 'vitest';

/**
 * ADM-057: NGINX/HTTPS Post-Deployment Testing
 * Validates SSL, security headers, proxy routing, performance
 */

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://aurex.in';
const API_URL = process.env.API_URL ?? 'https://api.aurex.in';

describe('[SSL] Certificate Validation', () => {
  test('frontend serves over HTTPS', async () => {
    const res = await fetch(FRONTEND_URL);
    expect(res.ok).toBe(true);
  });

  test('API serves over HTTPS', async () => {
    const res = await fetch(`${API_URL}/api/v1/health`);
    expect(res.ok).toBe(true);
  });

  test('HTTP redirects to HTTPS', async () => {
    const httpUrl = FRONTEND_URL.replace('https://', 'http://');
    const res = await fetch(httpUrl, { redirect: 'manual' });
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toMatch(/^https:/);
  });
});

describe('[headers] Security Headers', () => {
  test('HSTS header with long max-age', async () => {
    const res = await fetch(FRONTEND_URL);
    const hsts = res.headers.get('strict-transport-security');
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  test('Content-Security-Policy present', async () => {
    const res = await fetch(FRONTEND_URL);
    const csp = res.headers.get('content-security-policy');
    expect(csp).toContain("default-src 'self'");
  });

  test('X-Frame-Options DENY', async () => {
    const res = await fetch(FRONTEND_URL);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  test('No server version exposed', async () => {
    const res = await fetch(FRONTEND_URL);
    const server = res.headers.get('server');
    // nginx should not expose version
    if (server) expect(server).not.toMatch(/\d+\.\d+/);
  });
});

describe('[routing] Proxy Routing', () => {
  test('API endpoints return JSON', async () => {
    const res = await fetch(`${API_URL}/api/v1/health`);
    const ct = res.headers.get('content-type');
    expect(ct).toContain('application/json');
  });

  test('Frontend serves HTML', async () => {
    const res = await fetch(FRONTEND_URL);
    const ct = res.headers.get('content-type');
    expect(ct).toContain('text/html');
  });

  test('SPA fallback serves index.html for unknown routes', async () => {
    const res = await fetch(`${FRONTEND_URL}/nonexistent-route`);
    expect(res.ok).toBe(true);
    const html = await res.text();
    expect(html).toContain('Aurex');
  });
});

describe('[performance] HTTPS Performance', () => {
  test('API health responds within 500ms', async () => {
    const start = Date.now();
    await fetch(`${API_URL}/api/v1/health`);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  test('Frontend loads within 2000ms', async () => {
    const start = Date.now();
    await fetch(FRONTEND_URL);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
