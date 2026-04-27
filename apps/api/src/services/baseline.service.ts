import { prisma, type EmissionScope } from '@aurex/database';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

export interface CreateBaselineData {
  orgId: string;
  name: string;
  scope: string;
  baseYear: number;
  value: number;
  unit: string;
  methodology?: string;
  isActive?: boolean;
}

export async function createBaseline(data: CreateBaselineData) {
  const baseline = await prisma.emissionsBaseline.create({
    data: {
      orgId: data.orgId,
      name: data.name,
      scope: data.scope as EmissionScope,
      baseYear: data.baseYear,
      value: data.value,
      unit: data.unit,
      methodology: data.methodology ?? null,
      isActive: data.isActive ?? true,
    },
  });

  logger.info({ baselineId: baseline.id, orgId: data.orgId }, 'Baseline created');
  return baseline;
}

export interface ListBaselinesParams {
  orgId: string;
  scope?: string;
}

export async function listBaselines(params: ListBaselinesParams) {
  const where: Record<string, unknown> = { orgId: params.orgId };
  if (params.scope) {
    where.scope = params.scope;
  }

  return prisma.emissionsBaseline.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getBaselineById(id: string, orgId: string) {
  const baseline = await prisma.emissionsBaseline.findFirst({
    where: { id, orgId },
  });

  if (!baseline) {
    throw new AppError(404, 'Not Found', 'Baseline not found');
  }

  return baseline;
}

export async function updateBaseline(
  id: string,
  orgId: string,
  data: Record<string, unknown>,
) {
  const baseline = await prisma.emissionsBaseline.findFirst({
    where: { id, orgId },
  });

  if (!baseline) {
    throw new AppError(404, 'Not Found', 'Baseline not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.baseYear !== undefined) updateData.baseYear = data.baseYear;
  if (data.value !== undefined) updateData.value = data.value;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.methodology !== undefined) updateData.methodology = data.methodology;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.emissionsBaseline.update({
    where: { id },
    data: updateData,
  });

  logger.info({ baselineId: id, orgId }, 'Baseline updated');
  return updated;
}

export async function deleteBaseline(id: string, orgId: string): Promise<void> {
  const baseline = await prisma.emissionsBaseline.findFirst({
    where: { id, orgId },
  });

  if (!baseline) {
    throw new AppError(404, 'Not Found', 'Baseline not found');
  }

  await prisma.emissionsBaseline.delete({ where: { id } });
  logger.info({ baselineId: id, orgId }, 'Baseline deleted');
}
