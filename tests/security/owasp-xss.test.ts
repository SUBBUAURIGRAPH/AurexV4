import { describe, test, expect } from 'vitest';

/**
 * ADM-056: OWASP-007 Cross-Site Scripting Prevention
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '<svg onload=alert(1)>',
  '"><script>alert(1)</script>',
  "'-alert(1)-'",
  '<iframe src="javascript:alert(1)">',
  '<body onload=alert(1)>',
  '<input onfocus=alert(1) autofocus>',
  '<details open ontoggle=alert(1)>',
];

describe('[critical] OWASP-007: XSS Prevention', () => {
  test.each(XSS_PAYLOADS)(
    'sanitizes XSS payload: %s',
    async (payload) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.com',
          password: 'Test@123456',
          name: payload,
        }),
      });

      const body = await res.text();
      // Response should never contain unescaped script tags
      expect(body).not.toContain('<script>');
      expect(body).not.toContain('onerror=');
      expect(body).not.toContain('onload=');
    },
  );

  test('API responses are JSON, not HTML', async () => {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    const ct = res.headers.get('content-type');
    expect(ct).toContain('application/json');
  });
});
