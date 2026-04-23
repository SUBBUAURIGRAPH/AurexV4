import { defineConfig } from 'vitest/config';

/**
 * AV4-295: Vitest config for ADM-057 nginx/HTTPS post-deployment tests.
 * These tests hit a live URL (FRONTEND_URL / API_URL env) and verify TLS,
 * security headers, proxy routing, and response latency.
 */
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
    environment: 'node',
  },
});
