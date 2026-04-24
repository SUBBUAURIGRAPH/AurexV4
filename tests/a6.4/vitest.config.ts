import { defineConfig } from 'vitest/config';

/**
 * AV4-339: Vitest config for the A6.4 full-lifecycle E2E harness.
 * Runs against a live deployed API URL (E2E_BASE_URL env, default
 * https://aurex.in). Tests are long-running by nature — we bump the
 * per-test timeout to 120s to absorb rate-limit pacing + deploy cold
 * starts.
 */
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    environment: 'node',
  },
});
