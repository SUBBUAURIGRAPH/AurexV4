import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from './audit-log.service.js';

/**
 * Article 6.4 Activity service.
 * An Activity is a project-level (or PoA) mitigation activity under PACM.
 * Lifecycle: DRAFT → SUBMITTED → VALIDATING → VALIDATED → AWAITING_HOST →
 *            REGISTERED → ISSUING → CLOSED  (REJECTED at any stage).
 */

export interface CreateActivityInput {
  orgId: string;
  methodologyId: string;
  title: string;
  description?: string;
  hostCountry: string;            // ISO-3166 alpha-2
  sectoralScope: number;          // 1-15
  technologyType: string;
  geoBoundary?: unknown;          // GeoJSON — Prisma Json field
  gasesCovered: string[];         // ["CO2", "CH4", ...]
  creditingPeriodType: 'RENEWABLE_5YR' | 'FIXED_10YR' | 'REMOVAL_15YR';
  creditingPeriodStart?: Date;
  creditingPeriodEnd?: Date;
  expectedAnnualEr?: number;
  isRemoval?: boolean;
  cdmTransition?: boolean;
  cdmReference?: string;
  createdBy: string;
}

export async function createActivity(data: CreateActivityInput) {
  // Validate methodology exists + active
  const methodology = await prisma.methodology.findUnique({
    where: { id: data.methodologyId },
  });
  if (!methodology || !methodology.isActive) {
    throw new AppError(400, 'Bad Request', 'Methodology not found or inactive');
  }

  // Removal activities must use REMOVAL_15YR crediting and a REMOVAL methodology
  if (data.isRemoval && data.creditingPeriodType !== 'REMOVAL_15YR') {
    throw new AppError(
      400,
      'Bad Request',
      'Removal activities require crediting period REMOVAL_15YR',
    );
  }

  const activity = await prisma.activity.create({
    data: {
      orgId: data.orgId,
      methodologyId: data.methodologyId,
      title: data.title,
      description: data.description,
      hostCountry: data.hostCountry.toUpperCase(),
      sectoralScope: data.sectoralScope,
      technologyType: data.technologyType,
      geoBoundary: (data.geoBoundary ?? undefined) as never,
      gasesCovered: data.gasesCovered,
      creditingPeriodType: data.creditingPeriodType as never,
      creditingPeriodStart: data.creditingPeriodStart,
      creditingPeriodEnd: data.creditingPeriodEnd,
      expectedAnnualEr: data.expectedAnnualEr,
      isRemoval: data.isRemoval ?? false,
      cdmTransition: data.cdmTransition ?? false,
      cdmReference: data.cdmReference,
      createdBy: data.createdBy,
      status: 'DRAFT' as never,
    },
  });

  // Each activity gets a dedicated ACTIVITY_PARTICIPANT credit account.
  await prisma.creditAccount.create({
    data: {
      accountType: 'ACTIVITY_PARTICIPANT' as never,
      name: `${activity.title} — participant account`,
      orgId: data.orgId,
      activityId: activity.id,
      hostCountry: activity.hostCountry,
    },
  });

  await recordAudit({
    orgId: data.orgId,
    userId: data.createdBy,
    action: 'activity.created',
    resource: 'activity',
    resourceId: activity.id,
    newValue: { status: activity.status, methodology: methodology.code },
  });

  logger.info({ activityId: activity.id, orgId: data.orgId }, 'A6.4 activity created');
  return activity;
}

export async function listActivities(filter: { orgId: string; status?: string }) {
  const where: Record<string, unknown> = { orgId: filter.orgId };
  if (filter.status) where.status = filter.status;
  return prisma.activity.findMany({
    where,
    include: {
      methodology: { select: { code: true, name: true, category: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getActivity(id: string, orgId: string) {
  const activity = await prisma.activity.findFirst({
    where: { id, orgId },
    include: {
      methodology: true,
      pdd: true,
      hostAuthorization: true,
      validationReport: true,
      monitoringPlan: { include: { parameters: true } },
      monitoringPeriods: { orderBy: { periodStart: 'asc' } },
      issuances: true,
      creditAccount: true,
    },
  });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  return activity;
}

export async function updateActivity(
  id: string,
  orgId: string,
  data: Partial<CreateActivityInput>,
  userId: string,
) {
  const existing = await prisma.activity.findFirst({ where: { id, orgId } });
  if (!existing) throw new AppError(404, 'Not Found', 'Activity not found');

  // Once validated, design fields are locked — only status transitions allowed
  // through the dedicated transition endpoints below.
  if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
    throw new AppError(
      409,
      'Conflict',
      'Activity is past DRAFT; fields are locked. Use status transition endpoints.',
    );
  }

  const updated = await prisma.activity.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      technologyType: data.technologyType,
      geoBoundary: data.geoBoundary as never,
      gasesCovered: data.gasesCovered,
      expectedAnnualEr: data.expectedAnnualEr,
      creditingPeriodType: data.creditingPeriodType as never,
      creditingPeriodStart: data.creditingPeriodStart,
      creditingPeriodEnd: data.creditingPeriodEnd,
    },
  });

  await recordAudit({
    orgId,
    userId,
    action: 'activity.updated',
    resource: 'activity',
    resourceId: id,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: updated as unknown as Record<string, unknown>,
  });

  return updated;
}

// ─── Lifecycle transitions ─────────────────────────────────────────────

/**
 * DRAFT → SUBMITTED (by activity org_admin / manager).
 * Requires PDD and MonitoringPlan to exist.
 */
export async function submitActivity(id: string, orgId: string, userId: string) {
  const activity = await prisma.activity.findFirst({
    where: { id, orgId },
    include: { pdd: true, monitoringPlan: true },
  });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  assertStatus(activity.status, ['DRAFT']);
  if (!activity.pdd) {
    throw new AppError(400, 'Bad Request', 'PDD is required before submission');
  }
  if (!activity.monitoringPlan) {
    throw new AppError(400, 'Bad Request', 'Monitoring plan is required before submission');
  }

  return transition(activity.id, orgId, userId, 'SUBMITTED', 'activity.submitted', {
    submittedAt: new Date(),
  });
}

/**
 * SUBMITTED → VALIDATING (DOE starts validation).
 */
export async function startValidation(id: string, orgId: string, userId: string) {
  const activity = await prisma.activity.findFirst({ where: { id, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  assertStatus(activity.status, ['SUBMITTED']);
  return transition(activity.id, orgId, userId, 'VALIDATING', 'activity.validating', {});
}

/**
 * VALIDATING → VALIDATED (DOE publishes positive ValidationReport).
 * Triggered by verification.service after the ValidationReport is written.
 */
export async function markValidated(id: string, orgId: string, userId: string) {
  const activity = await prisma.activity.findFirst({ where: { id, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  assertStatus(activity.status, ['VALIDATING']);
  return transition(activity.id, orgId, userId, 'AWAITING_HOST', 'activity.validated', {});
}

/**
 * AWAITING_HOST → REGISTERED (host-country DNA issues LoA → SB registers).
 * Triggered by host-authorization service after LoA ISSUED.
 */
export async function markRegistered(id: string, orgId: string, userId: string) {
  const activity = await prisma.activity.findFirst({
    where: { id, orgId },
    include: { hostAuthorization: true },
  });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  assertStatus(activity.status, ['AWAITING_HOST']);
  if (!activity.hostAuthorization || activity.hostAuthorization.status !== 'ISSUED') {
    throw new AppError(400, 'Bad Request', 'Host LoA must be ISSUED before registration');
  }
  return transition(activity.id, orgId, userId, 'REGISTERED', 'activity.registered', {
    registeredAt: new Date(),
  });
}

/**
 * REGISTERED → ISSUING (first issuance approved).
 */
export async function markIssuing(id: string, orgId: string, userId: string) {
  const activity = await prisma.activity.findFirst({ where: { id, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  assertStatus(activity.status, ['REGISTERED', 'ISSUING']);
  if (activity.status === 'ISSUING') return activity; // idempotent
  return transition(activity.id, orgId, userId, 'ISSUING', 'activity.issuing', {});
}

export async function closeActivity(id: string, orgId: string, userId: string) {
  const activity = await prisma.activity.findFirst({ where: { id, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  return transition(activity.id, orgId, userId, 'CLOSED', 'activity.closed', {
    closedAt: new Date(),
  });
}

export async function rejectActivity(
  id: string,
  orgId: string,
  userId: string,
  reason: string,
) {
  const activity = await prisma.activity.findFirst({ where: { id, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  return transition(activity.id, orgId, userId, 'REJECTED', 'activity.rejected', {}, { reason });
}

// ─── helpers ───────────────────────────────────────────────────────────

function assertStatus(current: string, allowed: string[]) {
  if (!allowed.includes(current)) {
    throw new AppError(
      409,
      'Conflict',
      `Activity status is ${current}; expected one of ${allowed.join(', ')}`,
    );
  }
}

async function transition(
  id: string,
  orgId: string,
  userId: string,
  nextStatus: string,
  action: string,
  extraFields: Record<string, unknown>,
  auditExtra: Record<string, unknown> = {},
) {
  const before = await prisma.activity.findUnique({ where: { id } });
  const updated = await prisma.activity.update({
    where: { id },
    data: { status: nextStatus as never, ...extraFields },
  });
  await recordAudit({
    orgId,
    userId,
    action,
    resource: 'activity',
    resourceId: id,
    oldValue: { status: before?.status },
    newValue: { status: updated.status, ...auditExtra },
  });
  return updated;
}
