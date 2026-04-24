import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';
import { calculateEr } from './er-calc.service.js';
import * as activityService from './activity.service.js';
import * as baselineScenarioService from './baseline-scenario.service.js';

/**
 * DOE verification + validation.
 * - ValidationReport  = ex-ante (once per activity, before registration)
 * - VerificationReport = ex-post (one per MonitoringPeriod, before issuance)
 */

export async function submitValidationReport(
  activityId: string,
  orgId: string,
  doeUserId: string,
  data: {
    doeOrgName: string;
    doeAccreditationId?: string;
    opinion: 'POSITIVE' | 'NEGATIVE' | 'CONDITIONAL';
    findings?: unknown;
    documentUrl?: string;
  },
) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  if (activity.status !== 'VALIDATING') {
    throw new AppError(
      409,
      'Conflict',
      `Activity status is ${activity.status}; expected VALIDATING`,
    );
  }

  const existing = await prisma.validationReport.findUnique({ where: { activityId } });
  if (existing) {
    throw new AppError(409, 'Conflict', 'ValidationReport already submitted');
  }

  const report = await prisma.validationReport.create({
    data: {
      activityId,
      doeUserId,
      doeOrgName: data.doeOrgName,
      doeAccreditationId: data.doeAccreditationId,
      opinion: data.opinion as never,
      findings: (data.findings ?? undefined) as never,
      documentUrl: data.documentUrl,
      validatedAt: new Date(),
    },
  });

  await recordAudit({
    orgId,
    userId: doeUserId,
    action: 'activity.validation_report.submitted',
    resource: 'activity',
    resourceId: activityId,
    newValue: { opinion: data.opinion, doeOrgName: data.doeOrgName },
  });

  // Positive → transition to AWAITING_HOST automatically.
  // Negative / Conditional → reject the activity.
  if (data.opinion === 'POSITIVE') {
    await activityService.markValidated(activityId, orgId, doeUserId);
  } else {
    await activityService.rejectActivity(
      activityId,
      orgId,
      doeUserId,
      `Validation opinion ${data.opinion}`,
    );
  }
  return report;
}

export async function submitVerificationReport(
  periodId: string,
  orgId: string,
  doeUserId: string,
  data: {
    doeOrgName: string;
    doeAccreditationId?: string;
    methodologyVersion: string;
    baselineEmissions: number;
    projectEmissions: number;
    leakageEmissions: number;
    conservativenessPct?: number;
    opinion: 'POSITIVE' | 'NEGATIVE' | 'CONDITIONAL';
    findings?: unknown;
    documentUrl?: string;
  },
) {
  const period = await prisma.monitoringPeriod.findUnique({
    where: { id: periodId },
    include: { activity: true },
  });
  if (!period || period.activity.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Monitoring period not found');
  }
  if (period.status !== 'VERIFYING' && period.status !== 'SUBMITTED') {
    throw new AppError(
      409,
      'Conflict',
      `Period status is ${period.status}; expected SUBMITTED or VERIFYING`,
    );
  }

  const existing = await prisma.verificationReport.findUnique({ where: { periodId } });
  if (existing) {
    throw new AppError(409, 'Conflict', 'VerificationReport already submitted');
  }

  // Prefer a structured APPROVED BaselineScenario over the raw input when available.
  // Keeps backward compatibility: legacy callers without a scenario continue to work,
  // scenarios that don't cover the period's year also fall back with an audit note.
  const periodYear = period.periodEnd.getUTCFullYear();
  let effectiveBaseline = data.baselineEmissions;
  let baselineSource: 'scenario' | 'input' | 'fallback_to_input_baseline' = 'input';
  let scenarioIdUsed: string | null = null;

  const approvedScenario = await baselineScenarioService.getActiveForActivity(
    period.activityId,
  );
  if (approvedScenario) {
    try {
      effectiveBaseline = await baselineScenarioService.computeForYear(
        approvedScenario.id,
        periodYear,
      );
      baselineSource = 'scenario';
      scenarioIdUsed = approvedScenario.id;
    } catch {
      // Scenario exists but no entry for the period's year → fall back to input.
      baselineSource = 'fallback_to_input_baseline';
      scenarioIdUsed = approvedScenario.id;
    }
  }

  const er = calculateEr({
    baselineEmissions: effectiveBaseline,
    projectEmissions: data.projectEmissions,
    leakageEmissions: data.leakageEmissions,
    conservativenessPct: data.conservativenessPct,
    isRemoval: period.activity.isRemoval,
  });

  const report = await prisma.verificationReport.create({
    data: {
      periodId,
      doeUserId,
      doeOrgName: data.doeOrgName,
      doeAccreditationId: data.doeAccreditationId,
      methodologyVersion: data.methodologyVersion,
      baselineEmissions: effectiveBaseline,
      projectEmissions: data.projectEmissions,
      leakageEmissions: data.leakageEmissions,
      verifiedEr: er.netEr,
      conservativeness: data.conservativenessPct,
      opinion: data.opinion as never,
      findings: (data.findings ?? undefined) as never,
      documentUrl: data.documentUrl,
      verifiedAt: new Date(),
    },
  });

  // Advance period status based on opinion
  const nextStatus = data.opinion === 'POSITIVE' ? 'VERIFIED' : 'REJECTED';
  await prisma.monitoringPeriod.update({
    where: { id: periodId },
    data: { status: nextStatus as never },
  });

  await recordAudit({
    orgId,
    userId: doeUserId,
    action: 'verification.submitted',
    resource: 'monitoring_period',
    resourceId: periodId,
    newValue: {
      opinion: data.opinion,
      verifiedEr: er.netEr,
      grossEr: er.grossEr,
      conservativenessDiscount: er.conservativenessDiscount,
      baselineSource,
      scenarioId: scenarioIdUsed,
      periodYear,
      inputBaseline: data.baselineEmissions,
      appliedBaseline: effectiveBaseline,
    },
  });

  return { report, erCalculation: er };
}
