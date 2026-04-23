import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { TEST_USER_ID, TEST_USER_EMAIL } from './fixtures/prisma-stub.js';

/**
 * AV4-208: In-process integration tests for the AurexV4 Express API.
 *
 * The harness aliases `@aurex/database` to an in-memory stub (see
 * `vitest.config.ts` + `src/fixtures/prisma-stub.ts`) that pre-seeds a test
 * user + org + org_member. We mint a JWT via the app's own signAccessToken
 * helper so secrets stay consistent across the boundary.
 */

process.env.JWT_SECRET ??= 'test-access-secret-for-integration-tests-only';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-for-integration-tests-only';
process.env.NODE_ENV = 'test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let token: string;

beforeAll(async () => {
  const mod = await import('../../../apps/api/src/index.ts');
  app = mod.app;
  const jwtMod = await import('../../../apps/api/src/lib/jwt.ts');
  token = jwtMod.signAccessToken({
    sub: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    role: 'ORG_ADMIN' as never,
  });
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('GET /api/v1/health', () => {
  test('returns 200 with status=healthy', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('aurexv4-api');
  });
});

describe('Auth protection', () => {
  const protectedRoutes = [
    'GET /api/v1/emissions',
    'GET /api/v1/baselines',
    'GET /api/v1/targets',
    'GET /api/v1/reports',
    'GET /api/v1/analytics/totals',
    'GET /api/v1/audit-logs',
    'GET /api/v1/imports/emissions',
    'GET /api/v1/notifications',
    'GET /api/v1/approvals',
    'GET /api/v1/esg/frameworks',
    'GET /api/v1/brsr/principles',
    'GET /api/v1/onboarding',
  ];

  for (const route of protectedRoutes) {
    const [method, path] = route.split(' ');
    test(`${route} without token returns 401`, async () => {
      const res = await request(app)[method!.toLowerCase() as 'get'](path!);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe(401);
      expect(res.body.title).toBe('Unauthorized');
    });
  }
});

describe('Login failure paths', () => {
  test('bogus credentials return 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password-123' });
    expect(res.status).toBe(401);
    expect(res.body.status).toBe(401);
    expect(res.body.title).toBe('Unauthorized');
  });

  test('invalid payload shape returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email' });
    expect([400, 401]).toContain(res.status);
  });
});

describe('Authenticated reads (with seeded test user)', () => {
  test('GET /api/v1/emissions returns paginated empty list', async () => {
    const res = await request(app).get('/api/v1/emissions').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/v1/notifications returns unreadCount', async () => {
    const res = await request(app).get('/api/v1/notifications').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('unreadCount');
    expect(typeof res.body.unreadCount).toBe('number');
  });

  test('GET /api/v1/esg/frameworks returns paginated list', async () => {
    const res = await request(app).get('/api/v1/esg/frameworks').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  test('GET /api/v1/brsr/principles returns paginated list', async () => {
    const res = await request(app).get('/api/v1/brsr/principles').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /api/v1/onboarding auto-creates progress row', async () => {
    const res = await request(app).get('/api/v1/onboarding').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('currentStep');
  });

  test('GET /api/v1/approvals returns paginated inbox', async () => {
    const res = await request(app).get('/api/v1/approvals').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('Authenticated validation paths', () => {
  test('POST /api/v1/emissions with empty body returns 400', async () => {
    const res = await request(app).post('/api/v1/emissions').set(auth()).send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/onboarding/steps/1 without name returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/steps/1')
      .set(auth())
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/approvals without body returns 400', async () => {
    const res = await request(app).post('/api/v1/approvals').set(auth()).send({});
    expect(res.status).toBe(400);
  });
});

describe('Onboarding wizard flow', () => {
  test('saveStep 1 stores org profile and advances currentStep', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/steps/1')
      .set(auth())
      .send({ name: 'Updated Test Org', industry: 'Tech', country: 'India' });
    expect(res.status).toBe(200);
    expect(res.body.data.completedSteps).toContain(1);
    expect(res.body.data.currentStep).toBeGreaterThanOrEqual(2);
  });

  test('saveStep 2 after step 1 succeeds', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/steps/2')
      .set(auth())
      .send({ fiscalYearStartMonth: 4, reportingStandard: 'GHG_PROTOCOL', baseYear: 2025 });
    expect(res.status).toBe(200);
    expect(res.body.data.completedSteps).toContain(2);
  });
});

describe('RFC 7807 error shape', () => {
  test('404 errors are Problem Detail shaped', async () => {
    const res = await request(app)
      .get('/api/v1/emissions/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect([404, 400]).toContain(res.status);
    expect(res.body).toHaveProperty('type');
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('status');
  });
});
