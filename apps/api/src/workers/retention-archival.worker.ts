import { Queue, Worker, type Processor, type ConnectionOptions } from 'bullmq';
import { identifyEligible, archivePeriod } from '../services/archival.service.js';
import { recordAudit } from '../services/audit-log.service.js';
import { logger } from '../lib/logger.js';

/**
 * AV4-338 — Nightly retention archival worker.
 *
 * BullMQ repeatable job scheduled at 02:00 UTC. On each tick:
 *   1. `identifyEligible()` returns MonitoringPeriods past the ≥ 2yr horizon
 *      with no `DatapointArchive` row yet.
 *   2. For each period, call `archivePeriod()`. Failures on a single period
 *      are logged + audit-logged, but the loop continues so one bad period
 *      can't stop the whole run.
 *   3. After the loop, emit a summary `retention.archival.nightly_run` audit
 *      row with attempted / ok / failed counts.
 *
 * Safety: disabled by default. Operator must set
 *   RETENTION_WORKER_ENABLED=1
 * to opt in. `index.ts` also guards on `NODE_ENV !== 'test'`. This keeps CI,
 * local dev, and e2e runs from accidentally firing the job.
 *
 * Redis: uses the existing `REDIS_URL` env (e.g. `redis://localhost:6379`).
 * Keeping the BullMQ Queue + Worker in the same process is fine for this
 * cadence (one job/night, idempotent archive-per-period).
 */

export const RETENTION_QUEUE_NAME = 'retention-archival';
export const NIGHTLY_JOB_NAME = 'nightly-archive';
/** 02:00 UTC nightly (standard cron: `m h dom mon dow`). */
export const NIGHTLY_CRON = '0 2 * * *';

let workerHandle: Worker | null = null;
let queueHandle: Queue | null = null;

function connection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      'RETENTION_WORKER_ENABLED=1 requires REDIS_URL to be set (e.g. redis://localhost:6379).',
    );
  }
  // BullMQ accepts a URL directly via the `ConnectionOptions` shape used here.
  // `IORedis` under the hood parses it.
  return { url } as ConnectionOptions;
}

/**
 * Job handler. Exported for direct testing and for manual one-shot runs.
 * Returns attempted / ok / failed counts.
 */
export const runNightlyArchival: Processor<unknown, { attempted: number; ok: number; failed: number }> =
  async () => {
    const eligible = await identifyEligible();
    let ok = 0;
    let failed = 0;
    const failures: Array<{ periodId: string; error: string }> = [];

    for (const p of eligible) {
      try {
        await archivePeriod(p.id, { userId: null });
        ok += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ periodId: p.id, error: message });
        logger.error({ err, periodId: p.id }, 'Retention archival failed for period');
      }
    }

    const summary = { attempted: eligible.length, ok, failed };

    await recordAudit({
      userId: null,
      action: 'retention.archival.nightly_run',
      resource: 'monitoring_period',
      newValue: { ...summary, failures },
    });

    logger.info(summary, 'Retention nightly archival complete');
    return summary;
  };

/**
 * Bootstrap: creates the queue, registers the repeatable job (idempotent),
 * and starts the worker. Called from `apps/api/src/index.ts` when the
 * `RETENTION_WORKER_ENABLED` gate is on.
 */
export async function startRetentionWorker(): Promise<void> {
  if (workerHandle || queueHandle) {
    logger.warn('Retention worker already started — skipping');
    return;
  }
  const conn = connection();

  const queue = new Queue(RETENTION_QUEUE_NAME, { connection: conn });
  const worker = new Worker(RETENTION_QUEUE_NAME, runNightlyArchival, {
    connection: conn,
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, name: job?.name, err },
      'Retention worker job failed',
    );
  });
  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, name: job.name, result }, 'Retention worker job completed');
  });

  // Idempotent repeatable: BullMQ dedupes on name+pattern+timezone.
  await queue.add(
    NIGHTLY_JOB_NAME,
    {},
    {
      repeat: { pattern: NIGHTLY_CRON, tz: 'UTC' },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 30 },
    },
  );

  queueHandle = queue;
  workerHandle = worker;
  logger.info(
    { queue: RETENTION_QUEUE_NAME, cron: NIGHTLY_CRON },
    'Retention archival worker started',
  );
}

/**
 * Graceful shutdown — closes Worker + Queue. Used for tests and shutdown
 * hooks; safe to call when the worker was never started.
 */
export async function stopRetentionWorker(): Promise<void> {
  if (workerHandle) {
    await workerHandle.close();
    workerHandle = null;
  }
  if (queueHandle) {
    await queueHandle.close();
    queueHandle = null;
  }
}
