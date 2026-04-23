import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

export interface CreateTargetData {
  orgId: string;
  name: string;
  scope: string;
  targetYear: number;
  reduction: number;
  pathway?: string;
}

export async function createTarget(data: CreateTargetData) {
  const target = await prisma.emissionsTarget.create({
    data: {
      orgId: data.orgId,
      name: data.name,
      scope: data.scope as any,
      targetYear: data.targetYear,
      reduction: data.reduction,
      pathway: data.pathway ? (data.pathway as any) : null,
    },
  });

  logger.info({ targetId: target.id, orgId: data.orgId }, 'Target created');
  return target;
}

export interface ListTargetsParams {
  orgId: string;
  scope?: string;
}

export async function listTargets(params: ListTargetsParams) {
  const where: Record<string, unknown> = { orgId: params.orgId };
  if (params.scope) {
    where.scope = params.scope;
  }

  return prisma.emissionsTarget.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTarget(id: string, orgId: string) {
  const target = await prisma.emissionsTarget.findFirst({
    where: { id, orgId },
    include: {
      progress: {
        orderBy: { year: 'asc' },
      },
    },
  });

  if (!target) {
    throw new AppError(404, 'Not Found', 'Target not found');
  }

  return target;
}

export async function updateTarget(
  id: string,
  orgId: string,
  data: Record<string, unknown>,
) {
  const target = await prisma.emissionsTarget.findFirst({
    where: { id, orgId },
  });

  if (!target) {
    throw new AppError(404, 'Not Found', 'Target not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.targetYear !== undefined) updateData.targetYear = data.targetYear;
  if (data.reduction !== undefined) updateData.reduction = data.reduction;
  if (data.pathway !== undefined) updateData.pathway = data.pathway;
  // Allow explicitly setting pathway to null
  if (data.pathway === null) updateData.pathway = null;

  const updated = await prisma.emissionsTarget.update({
    where: { id },
    data: updateData,
  });

  logger.info({ targetId: id, orgId }, 'Target updated');
  return updated;
}

export async function approveTarget(id: string, orgId: string) {
  const target = await prisma.emissionsTarget.findFirst({
    where: { id, orgId },
  });

  if (!target) {
    throw new AppError(404, 'Not Found', 'Target not found');
  }

  if (target.isApproved) {
    throw new AppError(400, 'Bad Request', 'Target is already approved');
  }

  const updated = await prisma.emissionsTarget.update({
    where: { id },
    data: { isApproved: true },
  });

  logger.info({ targetId: id, orgId }, 'Target approved');
  return updated;
}

export interface RecordProgressData {
  targetId: string;
  orgId: string;
  year: number;
  actual: number;
  projected?: number;
}

export async function recordProgress(data: RecordProgressData) {
  // Verify the target exists and belongs to the org
  const target = await prisma.emissionsTarget.findFirst({
    where: { id: data.targetId, orgId: data.orgId },
  });

  if (!target) {
    throw new AppError(404, 'Not Found', 'Target not found');
  }

  // Check year uniqueness
  const existing = await prisma.targetProgress.findUnique({
    where: {
      targetId_year: {
        targetId: data.targetId,
        year: data.year,
      },
    },
  });

  if (existing) {
    throw new AppError(
      409,
      'Conflict',
      `Progress for year ${data.year} already recorded for this target`,
    );
  }

  // Find the baseline for variance calculation
  const baseline = await prisma.emissionsBaseline.findFirst({
    where: {
      orgId: data.orgId,
      scope: target.scope,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  let variance: number | null = null;

  if (baseline) {
    const baselineValue = Number(baseline.value);
    const reductionPct = Number(target.reduction);
    const totalYears = target.targetYear - baseline.baseYear;
    const yearsElapsed = data.year - baseline.baseYear;

    if (totalYears > 0) {
      // Expected value at this year based on linear reduction pathway
      const expectedValue = baselineValue * (1 - (reductionPct / 100) * (yearsElapsed / totalYears));
      variance = data.actual - expectedValue;
    }
  }

  const progress = await prisma.targetProgress.create({
    data: {
      targetId: data.targetId,
      year: data.year,
      actual: data.actual,
      projected: data.projected ?? null,
      variance,
    },
  });

  logger.info(
    { targetId: data.targetId, year: data.year, variance },
    'Target progress recorded',
  );
  return progress;
}

export async function getProgress(targetId: string, orgId: string) {
  // Verify the target exists and belongs to the org
  const target = await prisma.emissionsTarget.findFirst({
    where: { id: targetId, orgId },
  });

  if (!target) {
    throw new AppError(404, 'Not Found', 'Target not found');
  }

  return prisma.targetProgress.findMany({
    where: { targetId },
    orderBy: { year: 'asc' },
  });
}
