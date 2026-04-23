import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';

/**
 * AV4-295: In-process integration tests for the AurexV4 Express API.
 *
 * The harness aliases `@aurex/database` to a local stub (see
 * `vitest.config.ts` + `src/fixtures/prisma-stub.ts`) so the app boots
 * without a live Postgres. Current coverage intentionally sticks to routes
 * whose assertion is satisfiable under the stub (null user -> 401, no auth
 * header -> 401, static /health). DB-backed flows land in a follow-up.
 */

// JWT secrets must be present before the app is imported.
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-for-integration-tests-only';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-for-integration-tests-only';
process.env.NODE_ENV = 'test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeAll(async () => {
  // Use a .ts specifier — vitest resolves TS source directly; aliasing
  // @aurex/database happens via vite resolve.alias before this import lands.
  const mod = await import('../../../apps/api/src/index.ts');
  app = mod.app;
});

describe('GET /api/v1/health', () => {
  test('returns 200 with status=healthy', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('aurexv4-api');
  });
});

describe('POST /api/v1/auth/login', () => {
  test('bogus credentials return 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password-123' });
    expect(res.status).toBe(401);
    // RFC 7807 problem detail shape
    expect(res.body.status).toBe(401);
    expect(res.body.title).toBe('Unauthorized');
  });
});

describe('GET /api/v1/emissions', () => {
  test('without auth returns 401', async () => {
    const res = await request(app).get('/api/v1/emissions');
    expect(res.status).toBe(401);
    expect(res.body.status).toBe(401);
    expect(res.body.title).toBe('Unauthorized');
  });
});
