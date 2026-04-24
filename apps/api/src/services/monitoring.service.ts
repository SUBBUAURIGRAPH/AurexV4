import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from './audit-log.service.js';

/**
 * A6.4 monitoring — plan + parameters + periods + datapoints.
 * Evidence layer for Verification Reports.
 */

export async function upsertMonitoringPlan(
  activityId: string,
  orgId: string,
  data: {
    qaqcNotes?: string;
    parameters: Array<{
      code: string;
      name: string;
      unit: string;
      measurementMethod: 'DIRECT' | 'CALCULATED' | 'DEFAULT' | 'ESTIMATED';
      frequency: string;
      equipment?: string;
      uncertaintyPct?: number;
    }>;
  },
  userId: string,
) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');

  const existing = await prisma.monitoringPlan.findUnique({ where: { activityId } });
  const plan = existing
    ? await prisma.monitoringPlan.update({
        where: { id: existing.id },
        data: { qaqcNotes: data.qaqcNotes, version: { increment: 1 } },
      })
    : await prisma.monitoringPlan.create({
        data: { activityId, qaqcNotes: data.qaqcNotes },
      });

  // Replace parameters — simpler than diffing. Cascade delete then create.
  await prisma.monitoringParameter.deleteMany({ where: { planId: plan.id } });
  await prisma.monitoringParameter.createMany({
    data: data.parameters.map((p) => ({
      planId: plan.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      measurementMethod: p.measurementMethod as never,
      frequency: p.frequency,
      equipment: p.equipment,
      uncertaintyPct: p.uncertaintyPct,
    })),
  });

  await recordAudit({
    orgId,
    userId,
    action: 'monitoring.plan.upserted',
    resource: 'monitoring_plan',
    resourceId: plan.id,
    newValue: { parameterCount: data.parameters.length, version: plan.version },
  });
  return prisma.monitoringPlan.findUnique({ where: { id: plan.id }, include: { parameters: true } });
}

export async function createMonitoringPeriod(
  activityId: string,
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
  userId: string,
) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  if (periodStart >= periodEnd) {
    throw new AppError(400, 'Bad Request', 'periodEnd must be after periodStart');
  }
  const period = await prisma.monitoringPeriod.create({
    data: { activityId, periodStart, periodEnd },
  });
  await recordAudit({
    orgId,
    userId,
    action: 'monitoring.period.created',
    resource: 'monitoring_period',
    resourceId: period.id,
    newValue: { activityId, periodStart, periodEnd },
  });
  return period;
}

export async function listMonitoringPeriods(activityId: string, orgId: string) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, orgId } });
  if (!activity) throw new AppError(404, 'Not Found', 'Activity not found');
  return prisma.monitoringPeriod.findMany({
    where: { activityId },
    include: { verificationReport: true, issuance: true },
    orderBy: { periodStart: 'asc' },
  });
}

export async function submitMonitoringPeriod(
  periodId: string,
  orgId: string,
  userId: string,
) {
  const period = await prisma.monitoringPeriod.findUnique({
    where: { id: periodId },
    include: { activity: true },
  });
  if (!period || period.activity.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Monitoring period not found');
  }
  if (period.status !== 'OPEN') {
    throw new AppError(409, 'Conflict', `Period status is ${period.status}; expected OPEN`);
  }
  const updated = await prisma.monitoringPeriod.update({
    where: { id: periodId },
    data: { status: 'SUBMITTED' as never, submittedAt: new Date(), submittedBy: userId },
  });
  await recordAudit({
    orgId,
    userId,
    action: 'monitoring.period.submitted',
    resource: 'monitoring_period',
    resourceId: periodId,
    newValue: { status: 'SUBMITTED' },
  });
  return updated;
}

export async function addDatapoints(
  periodId: string,
  orgId: string,
  datapoints: Array<{
    parameterCode: string;
    timestamp: Date;
    rawValue: number;
    adjustedValue?: number;
    provenance: 'METER' | 'INVOICE' | 'SATELLITE' | 'SURVEY' | 'LABORATORY' | 'CALCULATED';
    sourceRef?: string;
    uncertaintyPct?: number;
    notes?: string;
  }>,
  userId: string,
) {
  const period = await prisma.monitoringPeriod.findUnique({
    where: { id: periodId },
    include: { activity: { include: { monitoringPlan: { include: { parameters: true } } } } },
  });
  if (!period || period.activity.orgId !== orgId) {
    throw new AppError(404, 'Not Found', 'Monitoring period not found');
  }
  if (!period.activity.monitoringPlan) {
    throw new AppError(400, 'Bad Request', 'Activity has no monitoring plan');
  }
  if (period.status !== 'OPEN') {
    throw new AppError(409, 'Conflict', `Period is ${period.status}; datapoints only accepted on OPEN periods`);
  }

  const paramByCode = new Map(
    period.activity.monitoringPlan.parameters.map((p) => [p.code, p]),
  );
  const rows = datapoints.map((d) => {
    const param = paramByCode.get(d.parameterCode);
    if (!param) {
      throw new AppError(400, 'Bad Request', `Unknown parameter code: ${d.parameterCode}`);
    }
    return {
      periodId,
      parameterId: param.id,
      timestamp: d.timestamp,
      rawValue: d.rawValue,
      adjustedValue: d.adjustedValue,
      provenance: d.provenance as never,
      sourceRef: d.sourceRef,
      uncertaintyPct: d.uncertaintyPct,
      notes: d.notes,
    };
  });
  const result = await prisma.monitoringDatapoint.createMany({ data: rows });
  await recordAudit({
    orgId,
    userId,
    action: 'monitoring.datapoints.added',
    resource: 'monitoring_period',
    resourceId: periodId,
    newValue: { count: result.count },
  });
  return { inserted: result.count };
}
