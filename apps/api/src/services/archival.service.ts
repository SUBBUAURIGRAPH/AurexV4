import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from './audit-log.service.js';
import { BackblazeB2BlobStore } from './blob-stores/backblaze-b2.js';

/**
 * AV4-338: Raw monitoring-data retention + archival service.
 *
 * A6.4-PROC-AC-002 + Decision 3/CMA.3 mandate raw MRV data retention of
 * ≥ 2 years **after** the end of the activity's crediting period. We move
 * cold datapoints to blob storage (Backblaze B2 planned, local-dir stub
 * today) rather than delete — A6.4 never permits data purge.
 *
 * Archive format (this pass): JSON-lines gzipped. Each line is a single
 * `MonitoringDatapoint` serialised via JSON. This is intentionally simple
 * (no Parquet dependency) so the stub is trivially restorable even without
 * the codebase — a consumer only needs `gunzip` + any JSON parser. Parquet
 * can be added later as a secondary format without breaking this one.
 *
 * Round-trip contract: `restorePeriod(archive)` produces Postgres rows
 * byte-for-byte matching the JSON we serialised. Checksum (SHA-256 over
 * the **compressed** payload) is verified before we re-hydrate.
 */

// ─── Blob store interface ──────────────────────────────────────────────

export interface BlobPutResult {
  url: string;
  bytes: number;
}

export interface BlobStore {
  put(key: string, bytes: Buffer): Promise<BlobPutResult>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
}

/**
 * Local-directory blob store. Writes bytes to `<BLOB_STORE_PATH>/<key>`.
 * Used for dev + the stub period before Backblaze B2 is provisioned.
 */
export class LocalDirBlobStore implements BlobStore {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    // Prevent path traversal. Keys come from internal code (archives/<uuid>-…)
    // but we still guard in case a future caller passes user input.
    if (key.includes('..')) {
      throw new Error('Invalid blob key: traversal not allowed');
    }
    return join(this.root, key);
  }

  async put(key: string, bytes: Buffer): Promise<BlobPutResult> {
    const full = this.resolve(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return { url: `file://${full}`, bytes: bytes.length };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Factory: returns a `BlobStore` based on `BLOB_STORE` env var.
 * - unset / "local"   → LocalDirBlobStore at BLOB_STORE_PATH (default /tmp/aurex-blob-store)
 * - "backblaze-b2"    → BackblazeB2BlobStore (requires BACKBLAZE_B2_* env vars)
 * - "backblaze"       → alias of "backblaze-b2"
 */
export function defaultBlobStore(): BlobStore {
  const provider = (process.env.BLOB_STORE ?? 'local').toLowerCase();
  if (provider === 'backblaze-b2' || provider === 'backblaze') {
    return new BackblazeB2BlobStore();
  }
  const root = process.env.BLOB_STORE_PATH ?? '/tmp/aurex-blob-store';
  return new LocalDirBlobStore(root);
}

// ─── Eligibility + archival ────────────────────────────────────────────

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/**
 * Return MonitoringPeriods whose activity crediting period ended ≥ 2yr ago
 * AND whose datapoints haven't already been archived.
 *
 * NB: in a single-tenant stub we scan all orgs. For multi-tenant deploys the
 * caller should narrow by org.
 */
export async function identifyEligible(): Promise<
  Array<{ id: string; activityId: string; periodEnd: Date; creditingPeriodEnd: Date | null }>
> {
  const cutoff = new Date(Date.now() - TWO_YEARS_MS);
  const periods = await prisma.monitoringPeriod.findMany({
    include: { activity: { select: { creditingPeriodEnd: true } } },
  });
  // Filter in JS — Prisma can't join-compare `activity.creditingPeriodEnd`
  // directly in `findMany` `where`. This list is small (one row per period).
  const eligible: Array<{
    id: string;
    activityId: string;
    periodEnd: Date;
    creditingPeriodEnd: Date | null;
  }> = [];
  for (const p of periods) {
    const cpEnd = p.activity.creditingPeriodEnd;
    if (!cpEnd) continue;
    if (cpEnd > cutoff) continue; // not yet past horizon

    const already = await prisma.datapointArchive.findUnique({ where: { periodId: p.id } });
    if (already) continue;

    eligible.push({
      id: p.id,
      activityId: p.activityId,
      periodEnd: p.periodEnd,
      creditingPeriodEnd: cpEnd,
    });
  }
  return eligible;
}

export interface ArchiveResult {
  archive: {
    id: string;
    periodId: string;
    archiveUrl: string;
    archiveFormat: string;
    rowCount: number;
    checksumSha256: string;
    bytes: number;
    archivedAt: Date;
  };
}

/**
 * Archive a single monitoring period:
 *   1. read datapoints
 *   2. JSONL → gzip → SHA-256
 *   3. upload blob via the configured store
 *   4. within a single prisma $transaction, write DatapointArchive + delete datapoints
 *
 * Idempotent: if a DatapointArchive row already exists, throws 409.
 */
export async function archivePeriod(
  periodId: string,
  opts: { blobStore?: BlobStore; userId?: string | null } = {},
): Promise<ArchiveResult> {
  const store = opts.blobStore ?? defaultBlobStore();

  const existingArchive = await prisma.datapointArchive.findUnique({ where: { periodId } });
  if (existingArchive) {
    throw new AppError(409, 'Conflict', 'Monitoring period already archived');
  }

  const period = await prisma.monitoringPeriod.findUnique({
    where: { id: periodId },
    include: { datapoints: { orderBy: { timestamp: 'asc' } } },
  });
  if (!period) {
    throw new AppError(404, 'Not Found', 'Monitoring period not found');
  }

  // Serialise datapoints to JSON-lines. Prisma Decimal values serialise via
  // `.toString()` — fine for our round-trip because restore parses via the
  // same representation.
  const lines = period.datapoints.map((d) =>
    JSON.stringify({
      id: d.id,
      periodId: d.periodId,
      parameterId: d.parameterId,
      timestamp: d.timestamp.toISOString(),
      rawValue: d.rawValue.toString(),
      adjustedValue: d.adjustedValue ? d.adjustedValue.toString() : null,
      provenance: d.provenance,
      sourceRef: d.sourceRef,
      uncertaintyPct: d.uncertaintyPct ? d.uncertaintyPct.toString() : null,
      notes: d.notes,
      createdAt: d.createdAt.toISOString(),
    }),
  );
  const payload = Buffer.from(lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  const gz = gzipSync(payload);
  const checksum = createHash('sha256').update(gz).digest('hex');
  const key = `archives/${periodId}-${Date.now()}.jsonl.gz`;

  const { url, bytes } = await store.put(key, gz);

  // Prisma $transaction: write archive row + delete datapoints atomically.
  // We store both the full URL (operator-visible) and the blob key (used at
  // restore). The key is appended to the URL as a fragment so we can keep
  // the `archiveUrl` column single-field and stay schema-compatible.
  const archive = await prisma.$transaction(async (tx) => {
    const row = await tx.datapointArchive.create({
      data: {
        periodId,
        archiveUrl: `${url}#key=${encodeURIComponent(key)}`,
        archiveFormat: 'jsonl.gz',
        rowCount: period.datapoints.length,
        checksumSha256: checksum,
        bytes,
      },
    });
    await tx.monitoringDatapoint.deleteMany({ where: { periodId } });
    return row;
  });

  await recordAudit({
    userId: opts.userId ?? null,
    action: 'retention.archive',
    resource: 'monitoring_period',
    resourceId: periodId,
    newValue: {
      archiveId: archive.id,
      rowCount: archive.rowCount,
      checksum,
      bytes,
    },
  });

  logger.info(
    { periodId, archiveId: archive.id, rows: archive.rowCount, bytes },
    'MonitoringPeriod archived',
  );

  return { archive };
}

/**
 * Restore a monitoring period from its archive. Verifies SHA-256 before
 * re-hydrating. Increments restoreCount on the DatapointArchive row.
 */
export async function restorePeriod(
  archiveId: string,
  opts: { blobStore?: BlobStore; userId?: string | null } = {},
): Promise<{ rowsRestored: number; periodId: string }> {
  const store = opts.blobStore ?? defaultBlobStore();

  const archive = await prisma.datapointArchive.findUnique({ where: { id: archiveId } });
  if (!archive) {
    throw new AppError(404, 'Not Found', 'Archive not found');
  }

  // Extract the blob key from the URL fragment written at archive time
  // (`…#key=archives/<periodId>-<ts>.jsonl.gz`). Fragment is resilient to
  // BLOB_STORE_PATH env drift between archive and restore.
  const fragMatch = /#key=([^&]+)$/.exec(archive.archiveUrl);
  const key = fragMatch
    ? decodeURIComponent(fragMatch[1] as string)
    : archive.archiveUrl; // legacy fallback — raw key stored directly

  const gz = await store.get(key);
  const actual = createHash('sha256').update(gz).digest('hex');
  if (actual !== archive.checksumSha256) {
    throw new AppError(
      500,
      'Checksum mismatch',
      `Archive ${archiveId} failed SHA-256 verification — refusing to restore`,
    );
  }

  const payload = gunzipSync(gz).toString('utf8');
  const lines = payload ? payload.trimEnd().split('\n') : [];

  type Row = {
    id: string;
    periodId: string;
    parameterId: string;
    timestamp: string;
    rawValue: string;
    adjustedValue: string | null;
    provenance: string;
    sourceRef: string | null;
    uncertaintyPct: string | null;
    notes: string | null;
    createdAt: string;
  };

  const rows: Row[] = lines.map((l) => JSON.parse(l) as Row);

  // Re-hydrate in a transaction. Use createMany so restore is cheap on large
  // periods; skipDuplicates protects against double-restore.
  await prisma.$transaction(async (tx) => {
    if (rows.length > 0) {
      await tx.monitoringDatapoint.createMany({
        data: rows.map((r) => ({
          id: r.id,
          periodId: r.periodId,
          parameterId: r.parameterId,
          timestamp: new Date(r.timestamp),
          rawValue: r.rawValue,
          adjustedValue: r.adjustedValue,
          provenance: r.provenance as never,
          sourceRef: r.sourceRef,
          uncertaintyPct: r.uncertaintyPct,
          notes: r.notes,
          createdAt: new Date(r.createdAt),
        })),
        skipDuplicates: true,
      });
    }
    await tx.datapointArchive.update({
      where: { id: archiveId },
      data: { restoreCount: { increment: 1 } },
    });
  });

  await recordAudit({
    userId: opts.userId ?? null,
    action: 'retention.restore',
    resource: 'monitoring_period',
    resourceId: archive.periodId,
    newValue: { archiveId, rowsRestored: rows.length },
  });

  logger.info({ archiveId, rowsRestored: rows.length }, 'DatapointArchive restored');
  return { rowsRestored: rows.length, periodId: archive.periodId };
}

// ─── Retention report ──────────────────────────────────────────────────

export type RetentionState = 'ACTIVE' | 'ELIGIBLE' | 'ARCHIVED' | 'RESTORED';

export interface RetentionReportRow {
  periodId: string;
  activityId: string;
  activityTitle: string;
  periodStart: Date;
  periodEnd: Date;
  creditingPeriodEnd: Date | null;
  retainUntil: Date | null;
  state: RetentionState;
  archive: {
    id: string;
    archivedAt: Date;
    rowCount: number;
    bytes: number;
    restoreCount: number;
  } | null;
}

/**
 * Derive retention state for every MonitoringPeriod. Used by
 * `/admin/retention/report` for SUPER_ADMIN compliance audit.
 */
export async function retentionReport(): Promise<RetentionReportRow[]> {
  const periods = await prisma.monitoringPeriod.findMany({
    include: {
      activity: { select: { id: true, title: true, creditingPeriodEnd: true } },
    },
    orderBy: { periodStart: 'asc' },
  });

  const archives = await prisma.datapointArchive.findMany({
    where: { periodId: { in: periods.map((p) => p.id) } },
  });
  const archiveByPeriod = new Map(archives.map((a) => [a.periodId, a]));
  const cutoff = new Date(Date.now() - TWO_YEARS_MS);

  return periods.map((p) => {
    const cpEnd = p.activity.creditingPeriodEnd;
    const retainUntil = cpEnd ? new Date(cpEnd.getTime() + TWO_YEARS_MS) : null;
    const archive = archiveByPeriod.get(p.id);
    let state: RetentionState;
    if (archive) {
      state = archive.restoreCount > 0 ? 'RESTORED' : 'ARCHIVED';
    } else if (cpEnd && cpEnd <= cutoff) {
      state = 'ELIGIBLE';
    } else {
      state = 'ACTIVE';
    }
    return {
      periodId: p.id,
      activityId: p.activityId,
      activityTitle: p.activity.title,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      creditingPeriodEnd: cpEnd,
      retainUntil,
      state,
      archive: archive
        ? {
            id: archive.id,
            archivedAt: archive.archivedAt,
            rowCount: archive.rowCount,
            bytes: archive.bytes,
            restoreCount: archive.restoreCount,
          }
        : null,
    };
  });
}
