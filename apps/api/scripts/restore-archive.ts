#!/usr/bin/env tsx
/**
 * AV4-338 — Restore CLI.
 *
 * Usage:
 *   pnpm --filter @aurex/api run restore-archive <periodId>
 *
 * Looks up the DatapointArchive by `periodId` and calls
 * `archival.service.restorePeriod(archiveId)`. SHA-256 is verified by the
 * service before any Postgres write — on mismatch the call throws and we
 * exit 1. Not-found also exits 1. Success writes row-count + checksum
 * status to stdout and exits 0.
 *
 * Env:
 *   BLOB_STORE            defaults to `local`; set `backblaze-b2` in prod.
 *   BACKBLAZE_B2_*        required when BLOB_STORE=backblaze-b2.
 *   DATABASE_URL          Postgres connection for the Prisma client.
 */

import { prisma } from '@aurex/database';
import { restorePeriod } from '../src/services/archival.service.js';

async function main(): Promise<number> {
  const periodId = process.argv[2];
  if (!periodId) {
    console.error('Usage: restore-archive <periodId>');
    return 1;
  }

  const archive = await prisma.datapointArchive.findUnique({ where: { periodId } });
  if (!archive) {
    console.error(`No DatapointArchive found for periodId=${periodId}`);
    return 1;
  }

  console.log(
    `Restoring archive ${archive.id} (periodId=${periodId}, rows=${archive.rowCount}, bytes=${archive.bytes})`,
  );

  try {
    const res = await restorePeriod(archive.id, { userId: null });
    console.log(
      JSON.stringify(
        {
          ok: true,
          periodId: res.periodId,
          rowsRestored: res.rowsRestored,
          expectedRows: archive.rowCount,
          checksumVerified: true,
          checksumSha256: archive.checksumSha256,
        },
        null,
        2,
      ),
    );
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isChecksumError = /SHA-256 verification/.test(message);
    console.error(
      JSON.stringify(
        {
          ok: false,
          periodId,
          archiveId: archive.id,
          checksumVerified: !isChecksumError,
          error: message,
        },
        null,
        2,
      ),
    );
    return 1;
  }
}

main()
  .then(async (code) => {
    await prisma.$disconnect().catch(() => {});
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
