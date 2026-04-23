import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

export interface EmissionRecordResult {
  id: string;
  orgId: string;
  scope: string;
  category: string;
  source: string;
  value: unknown;
  unit: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  metadata: unknown;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmissionData {
  orgId: string;
  createdBy: string;
  scope: string;
  category: string;
  source: string;
  value: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  metadata?: Record<string, unknown>;
}

export async function createEmission(data: CreateEmissionData): Promise<EmissionRecordResult> {
  const record = await prisma.emissionsRecord.create({
    data: {
      orgId: data.orgId,
      createdBy: data.createdBy,
      scope: data.scope as any,
      category: data.category,
      source: data.source,
      value: data.value,
      unit: data.unit,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      metadata: data.metadata ?? undefined,
    },
  });

  logger.info({ recordId: record.id, orgId: data.orgId, scope: data.scope }, 'Emission record created');
  return record as unknown as EmissionRecordResult;
}

export interface ListEmissionsParams {
  orgId: string;
  scope?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
  sort: string;
  order: 'asc' | 'desc';
}

export async function listEmissions(params: ListEmissionsParams): Promise<PaginatedResponse<EmissionRecordResult>> {
  const { orgId, scope, status, dateFrom, dateTo, page, pageSize, sort, order } = params;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { orgId };

  if (scope) {
    where.scope = scope;
  }

  if (status) {
    where.status = status.toUpperCase();
  }

  if (dateFrom || dateTo) {
    const periodFilter: Record<string, unknown> = {};
    if (dateFrom) periodFilter.gte = new Date(dateFrom);
    if (dateTo) periodFilter.lte = new Date(dateTo);
    where.periodStart = periodFilter;
  }

  const [records, total] = await Promise.all([
    prisma.emissionsRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sort]: order },
    }),
    prisma.emissionsRecord.count({ where }),
  ]);

  return {
    data: records as unknown as EmissionRecordResult[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getEmissionById(id: string, orgId: string): Promise<EmissionRecordResult> {
  const record = await prisma.emissionsRecord.findFirst({
    where: { id, orgId },
  });

  if (!record) {
    throw new AppError(404, 'Not Found', 'Emission record not found');
  }

  return record as unknown as EmissionRecordResult;
}

export async function updateEmission(
  id: string,
  orgId: string,
  data: Record<string, unknown>,
): Promise<EmissionRecordResult> {
  const record = await prisma.emissionsRecord.findFirst({
    where: { id, orgId },
  });

  if (!record) {
    throw new AppError(404, 'Not Found', 'Emission record not found');
  }

  if (record.status !== 'DRAFT' && record.status !== 'REJECTED') {
    throw new AppError(400, 'Bad Request', 'Can only update records in DRAFT or REJECTED status');
  }

  const updateData: Record<string, unknown> = {};
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.value !== undefined) updateData.value = data.value;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.periodStart !== undefined) updateData.periodStart = new Date(data.periodStart as string);
  if (data.periodEnd !== undefined) updateData.periodEnd = new Date(data.periodEnd as string);
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  // Reset to DRAFT if it was REJECTED
  if (record.status === 'REJECTED') {
    updateData.status = 'DRAFT';
  }

  const updated = await prisma.emissionsRecord.update({
    where: { id },
    data: updateData,
  });

  logger.info({ recordId: id, orgId }, 'Emission record updated');
  return updated as unknown as EmissionRecordResult;
}

export async function deleteEmission(id: string, orgId: string): Promise<void> {
  const record = await prisma.emissionsRecord.findFirst({
    where: { id, orgId },
  });

  if (!record) {
    throw new AppError(404, 'Not Found', 'Emission record not found');
  }

  if (record.status !== 'DRAFT') {
    throw new AppError(400, 'Bad Request', 'Can only delete records in DRAFT status');
  }

  await prisma.emissionsRecord.delete({ where: { id } });
  logger.info({ recordId: id, orgId }, 'Emission record deleted');
}

export async function updateEmissionStatus(
  id: string,
  orgId: string,
  status: string,
): Promise<EmissionRecordResult> {
  const record = await prisma.emissionsRecord.findFirst({
    where: { id, orgId },
  });

  if (!record) {
    throw new AppError(404, 'Not Found', 'Emission record not found');
  }

  const prismaStatus = status.toUpperCase() as any;

  const updated = await prisma.emissionsRecord.update({
    where: { id },
    data: { status: prismaStatus },
  });

  logger.info({ recordId: id, orgId, status }, 'Emission record status updated');
  return updated as unknown as EmissionRecordResult;
}

export async function bulkUpdateStatus(
  ids: string[],
  orgId: string,
  status: string,
): Promise<{ updated: number }> {
  const prismaStatus = status.toUpperCase() as any;

  const result = await prisma.emissionsRecord.updateMany({
    where: {
      id: { in: ids },
      orgId,
    },
    data: { status: prismaStatus },
  });

  logger.info({ orgId, status, count: result.count }, 'Bulk emission status update');
  return { updated: result.count };
}

export async function listEmissionSources(scope?: string, category?: string) {
  const where: Record<string, unknown> = { isActive: true };
  if (scope) where.scope = scope;
  if (category) where.category = category;

  return prisma.emissionSource.findMany({
    where,
    orderBy: [{ scope: 'asc' }, { category: 'asc' }, { name: 'asc' }],
  });
}

export async function listEmissionFactors(scope?: string, category?: string, source?: string) {
  const where: Record<string, unknown> = {};
  if (scope) where.scope = scope;
  if (category) where.category = category;
  if (source) where.source = source;

  return prisma.emissionFactor.findMany({
    where,
    orderBy: [{ scope: 'asc' }, { category: 'asc' }, { source: 'asc' }],
  });
}
