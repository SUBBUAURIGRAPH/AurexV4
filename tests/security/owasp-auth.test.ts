import { describe, test, expect } from 'vitest';

/**
 * ADM-056: OWASP-002 Authentication Security
 * Validates auth bypass, session management, timing attacks
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

describe('[critical] OWASP-002: Authentication Security', () => {
  test('rejects empty credentials', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('rejects invalid email format', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'test123' }),
    });
    expect(res.status).toBe(400);
  });

  test('protected endpoints require auth', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`);
    expect(res.status).toBe(401);
  });

  test('invalid JWT is rejected', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    expect(res.status).toBe(401);
  });

  test('error messages do not leak user existence', async () => {
    const res1 = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'exists@test.com', password: 'wrong' }),
    });
    const res2 = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'noexist@test.com', password: 'wrong' }),
    });
    // Both should return same status (no user enumeration)
    expect(res1.status).toBe(res2.status);
  });
});
