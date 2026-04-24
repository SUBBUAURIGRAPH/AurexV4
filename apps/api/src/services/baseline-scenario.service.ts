import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';

/**
 * A6.4 BaselineScenario (AV4-336, per A6.4-STAN-METH-004).
 *
 * Structured, versioned baseline per activity with per-year emissions and
 * downward-adjustment factor. Supersedes the flat numeric `baselineEmissions`
 * stored on VerificationReport for activities that have an APPROVED scenario.
 *
 * Lifecycle: DRAFT → SUBMITTED → APPROVED (DOE-gated)
 *                              → REJECTED (DOE-gated)
 *                APPROVED → SUPERSEDED (when a later version is APPROVED)
 */

export interface EmissionInput {
  year: number;
  emissionsTco2e: number;
  downwardAdjustmentFactor?: number;
  notes?: string;
}

export interface CreateScenarioInput {
  narrative: string;
  methodologyVersion: string;
  ndcAlignmentJustification?: string;
  ltLedsReference?: string;
  suppressedDemandFlag?: boolean;
  suppressedDemandNotes?: string;
  emissions: EmissionInput[];
}

// ─── Create / version ──────────────────────────────────────────────────

export async function createScenario(
  activityId: string,
  orgId: string,
  userId: string,
  data: CreateScenarioInput,
) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');

  // Determine next version — bump from the highest existing version for this activity.
  const latest = await prisma.baselineScenario.findFirst({
    where: { activityId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const scenario = await prisma.baselineScenario.create({
    data: {
      activityId,
      version: nextVersion,
      status: 'DRAFT' as never,
      narrative: data.narrative,
      methodologyVersion: data.methodologyVersion,
      ndcAlignmentJustification: data.ndcAlignmentJustification,
      ltLedsReference: data.ltLedsReference,
      suppressedDemandFlag: data.suppressedDemandFlag ?? false,
      suppressedDemandNotes: data.suppressedDemandNotes,
      createdBy: userId,
      emissions: data.emissions.length
        ? {
            create: data.emissions.map((e) => ({
              year: e.year,
              emissionsTco2e: e.emissionsTco2e,
              downwardAdjustmentFactor: e.downwardAdjustmentFactor ?? 1.0,
              notes: e.notes,
            })),
          }
        : undefined,
    },
    include: { emissions: { orderBy: { year: 'asc' } } },
  });

  await recordAudit({
    orgId,
    userId,
    action: 'baseline_scenario.created',
    resource: 'baseline_scenario',
    resourceId: scenario.id,
    newValue: {
      activityId,
      version: nextVersion,
      methodologyVersion: data.methodologyVersion,
      emissionYears: data.emissions.map((e) => e.year),
    },
  });

  return scenario;
}

// ─── Submit (DRAFT → SUBMITTED) ────────────────────────────────────────

export async function submitScenario(id: string, orgId: string, userId: string) {
  const scenario = await prisma.baselineScenario.findUnique({
    where: { id },
    include: { activity: { select: { orgId: true } }, emissions: true },
  });
  if (!scenario || scenario.activity.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'BaselineScenario not found');
  }
  if (scenario.status !== 'DRAFT') {
    throw new AppError(
      409,
      'Conflict',
      `Scenario status is ${scenario.status}; expected DRAFT`,
    );
  }
  if (!scenario.emissions.length) {
    throw new AppError(
      400,
      'Bad Request',
      'Cannot submit scenario without at least one BaselineEmission entry',
    );
  }

  const updated = await prisma.baselineScenario.update({
    where: { id },
    data: { status: 'SUBMITTED' as never },
    include: { emissions: { orderBy: { year: 'asc' } } },
  });

  await recordAudit({
    orgId,
    userId,
    action: 'baseline_scenario.submitted',
    resource: 'baseline_scenario',
    resourceId: id,
    newValue: { status: 'SUBMITTED' },
  });

  return updated;
}

// ─── Approve (SUBMITTED → APPROVED — DOE only) ─────────────────────────

export async function approveByDoe(id: string, userId: string) {
  const scenario = await prisma.baselineScenario.findUnique({
    where: { id },
    include: { activity: { select: { id: true, orgId: true } } },
  });
  if (!scenario) throw new AppError(404, 'Not Found', 'BaselineScenario not found');
  if (scenario.status !== 'SUBMITTED') {
    throw new AppError(
      409,
      'Conflict',
      `Scenario status is ${scenario.status}; expected SUBMITTED`,
    );
  }

  const activityId = scenario.activity.id;
  const orgId = scenario.activity.orgId;

  // If another APPROVED scenario exists for this activity, mark it SUPERSEDED.
  const now = new Date();
  await prisma.baselineScenario.updateMany({
    where: { activityId, status: 'APPROVED' as never, id: { not: id } },
    data: { status: 'SUPERSEDED' as never, supersededAt: now },
  });

  const updated = await prisma.baselineScenario.update({
    where: { id },
    data: {
      status: 'APPROVED' as never,
      approvedBy: userId,
      approvedAt: now,
    },
    include: { emissions: { orderBy: { year: 'asc' } } },
  });

  await recordAudit({
    orgId,
    userId,
    action: 'baseline_scenario.approved',
    resource: 'baseline_scenario',
    resourceId: id,
    newValue: { status: 'APPROVED', approvedAt: now.toISOString() },
  });

  return updated;
}

// ─── Reject (SUBMITTED → REJECTED — DOE only) ──────────────────────────

export async function rejectByDoe(id: string, userId: string, reason: string) {
  const scenario = await prisma.baselineScenario.findUnique({
    where: { id },
    include: { activity: { select: { orgId: true } } },
  });
  if (!scenario) throw new AppError(404, 'Not Found', 'BaselineScenario not found');
  if (scenario.status !== 'SUBMITTED') {
    throw new AppError(
      409,
      'Conflict',
      `Scenario status is ${scenario.status}; expected SUBMITTED`,
    );
  }

  const updated = await prisma.baselineScenario.update({
    where: { id },
    data: { status: 'REJECTED' as never },
    include: { emissions: { orderBy: { year: 'asc' } } },
  });

  await recordAudit({
    orgId: scenario.activity.orgId,
    userId,
    action: 'baseline_scenario.rejected',
    resource: 'baseline_scenario',
    resourceId: id,
    newValue: { status: 'REJECTED', reason },
  });

  return updated;
}

// ─── Queries ───────────────────────────────────────────────────────────

export async function listByActivity(activityId: string, orgId: string) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');

  return prisma.baselineScenario.findMany({
    where: { activityId },
    include: { emissions: { orderBy: { year: 'asc' } } },
    orderBy: { version: 'desc' },
  });
}

export async function getScenario(id: string, orgId: string) {
  const scenario = await prisma.baselineScenario.findUnique({
    where: { id },
    include: {
      activity: { select: { orgId: true } },
      emissions: { orderBy: { year: 'asc' } },
    },
  });
  if (!scenario || scenario.activity.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'BaselineScenario not found');
  }
  return scenario;
}

/**
 * Fetch the currently APPROVED scenario for an activity, or null if none.
 * Used by verification.service to read structured baseline when available.
 * NOTE: no org scoping — verification service is already org-scoped via the
 * monitoring period it operates on.
 */
export async function getActiveForActivity(activityId: string) {
  return prisma.baselineScenario.findFirst({
    where: { activityId, status: 'APPROVED' as never },
    include: { emissions: true },
  });
}

/**
 * Compute baseline emissions for a given calendar year from an APPROVED scenario.
 * Returns `emissionsTco2e × downwardAdjustmentFactor`. Throws 400 if the scenario
 * has no entry for that year.
 */
export async function computeForYear(scenarioId: string, year: number): Promise<number> {
  const entry = await prisma.baselineEmission.findUnique({
    where: { scenarioId_year: { scenarioId, year } },
  });
  if (!entry) {
    throw new AppError(
      400,
      'Bad Request',
      `BaselineScenario has no emission entry for year ${year}`,
    );
  }
  // Prisma Decimal → number via toString() to avoid precision loss on conversion.
  const emissions = Number(entry.emissionsTco2e.toString());
  const factor = Number(entry.downwardAdjustmentFactor.toString());
  return emissions * factor;
}
