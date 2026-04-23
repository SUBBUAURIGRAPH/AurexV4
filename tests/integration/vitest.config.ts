import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * AV4-295: In-process integration-test harness.
 * - Loads the Express app via supertest (NODE_ENV=test disables app.listen).
 * - Aliases @aurex/database to a local stub so the app can boot without a
 *   live Postgres (or even the database package being built). DB-backed
 *   flows get a real fixture in a follow-up story.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Stub @aurex/database so the app can boot without a live Postgres.
      '@aurex/database': fileURLToPath(
        new URL('./src/fixtures/prisma-stub.ts', import.meta.url),
      ),
      // Point @aurex/shared at its TS source so we don't require a prior build.
      '@aurex/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
    },
  },
});
