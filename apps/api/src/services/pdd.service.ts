import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';

/**
 * AV4-335: Project Design Document (PDD) service.
 *
 * A PDD is the authoring artefact an activity submits for DOE validation
 * under A6.4-PROC-AC-002. One PDD per Activity (1:1) with version
 * auto-increment: `content` is free-form JSON until the full wizard lands
 * (tabs 4-9 in a follow-up), but submission **locks the current version**
 * — further edits bump `version + 1` and create a new row? No — we keep
 * the 1:1 invariant and track versions by bumping `version` on the same
 * row. `submittedAt` is the lock flag.
 *
 * Lock semantics:
 *   - If `submittedAt != null`, the PDD is locked. Subsequent upsert calls
 *     will refuse with 409 unless the activity returns to DRAFT / REJECTED
 *     (which unsets submittedAt and bumps version).
 */

export interface UpsertPddInput {
  activityId: string;
  orgId: string;
  content: unknown;
  userId: string;
}

export async function upsertPdd(input: UpsertPddInput) {
  const activity = await prisma.activity.findFirst({
    where: { id: input.activityId, orgId: input.orgId },
    include: { pdd: true },
  });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');

  const existing = activity.pdd;
  if (existing?.submittedAt) {
    throw new AppError(
      409,
      'Conflict',
      'PDD is locked after submission — revert activity to DRAFT to edit',
    );
  }

  if (!existing) {
    const created = await prisma.pdd.create({
      data: {
        activityId: activity.id,
        version: 1,
        content: (input.content ?? {}) as never,
      },
    });
    await recordAudit({
      orgId: input.orgId,
      userId: input.userId,
      action: 'pdd.created',
      resource: 'pdd',
      resourceId: created.id,
      newValue: { version: created.version },
    });
    return created;
  }

  const updated = await prisma.pdd.update({
    where: { id: existing.id },
    data: { content: (input.content ?? {}) as never },
  });
  await recordAudit({
    orgId: input.orgId,
    userId: input.userId,
    action: 'pdd.updated',
    resource: 'pdd',
    resourceId: updated.id,
    oldValue: { version: existing.version },
    newValue: { version: updated.version },
  });
  return updated;
}

export async function getPdd(activityId: string, orgId: string) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  const pdd = await prisma.pdd.findUnique({ where: { activityId } });
  return pdd;
}

/**
 * Submit (lock) the current PDD version. Idempotent — if already submitted
 * at this version, returns the existing row.
 */
export async function submitPdd(activityId: string, orgId: string, userId: string) {
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, orgId },
    include: { pdd: true },
  });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  if (!activity.pdd) {
    throw new AppError(400, 'Bad Request', 'PDD not found — create a draft first');
  }
  if (activity.pdd.submittedAt) return activity.pdd;

  const submitted = await prisma.pdd.update({
    where: { id: activity.pdd.id },
    data: { submittedAt: new Date(), submittedBy: userId },
  });
  await recordAudit({
    orgId,
    userId,
    action: 'pdd.submitted',
    resource: 'pdd',
    resourceId: submitted.id,
    newValue: { version: submitted.version, submittedAt: submitted.submittedAt },
  });
  return submitted;
}

/**
 * Version listing. Today the schema carries a single row per activity with
 * `version` incrementing — so this returns at most one row. It's exposed as
 * a list endpoint to future-proof the move to a dedicated `PddVersion`
 * history table in AV4-335 completion.
 */
export async function listPddVersions(activityId: string, orgId: string) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  const current = await prisma.pdd.findUnique({
    where: { activityId },
    select: {
      id: true,
      version: true,
      submittedAt: true,
      submittedBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return current ? [current] : [];
}
