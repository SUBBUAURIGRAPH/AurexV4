import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

export interface BrsrPrincipleResult {
  id: string;
  number: number;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  indicatorCount?: number;
}

export interface BrsrIndicatorResult {
  id: string;
  principleId: string | null;
  section: string;
  indicatorType: string;
  code: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface BrsrResponseResult {
  id: string;
  orgId: string;
  indicatorId: string;
  fiscalYear: string;
  value: unknown;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  indicator?: BrsrIndicatorResult;
}

export async function listPrinciples(params: {
  page: number;
  pageSize: number;
}): Promise<PaginatedResponse<BrsrPrincipleResult>> {
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.brsrPrinciple.findMany({
      where: { isActive: true },
      include: { _count: { select: { indicators: true } } },
      skip,
      take: params.pageSize,
      orderBy: { number: 'asc' },
    }),
    prisma.brsrPrinciple.count({ where: { isActive: true } }),
  ]);

  const data = rows.map((r) => {
    const row = r as unknown as BrsrPrincipleResult & { _count?: { indicators: number } };
    return {
      id: row.id,
      number: row.number,
      title: row.title,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt,
      indicatorCount: row._count?.indicators ?? 0,
    };
  });

  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getPrinciple(id: string): Promise<BrsrPrincipleResult & { indicators: BrsrIndicatorResult[] }> {
  const row = await prisma.brsrPrinciple.findUnique({
    where: { id },
    include: { indicators: { where: { isActive: true }, orderBy: { code: 'asc' } } },
  });
  if (!row) throw new AppError(404, 'Not Found', 'Principle not found');
  return row as unknown as BrsrPrincipleResult & { indicators: BrsrIndicatorResult[] };
}

export async function listIndicators(params: {
  principleId?: string;
  section?: 'SECTION_A' | 'SECTION_B' | 'SECTION_C';
  indicatorType?: 'ESSENTIAL' | 'LEADERSHIP';
  page: number;
  pageSize: number;
}): Promise<PaginatedResponse<BrsrIndicatorResult>> {
  const where: Record<string, unknown> = { isActive: true };
  if (params.principleId) where.principleId = params.principleId;
  if (params.section) where.section = params.section;
  if (params.indicatorType) where.indicatorType = params.indicatorType;
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.brsrIndicator.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { code: 'asc' },
    }),
    prisma.brsrIndicator.count({ where }),
  ]);

  return {
    data: rows as unknown as BrsrIndicatorResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getIndicator(id: string): Promise<BrsrIndicatorResult> {
  const row = await prisma.brsrIndicator.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Not Found', 'Indicator not found');
  return row as unknown as BrsrIndicatorResult;
}

export async function upsertResponse(
  orgId: string,
  createdBy: string,
  data: { indicatorId: string; fiscalYear: string; value?: unknown; notes?: string },
): Promise<BrsrResponseResult> {
  const indicator = await prisma.brsrIndicator.findUnique({ where: { id: data.indicatorId } });
  if (!indicator) throw new AppError(404, 'Not Found', 'Indicator not found');

  const row = await prisma.brsrResponse.upsert({
    where: {
      orgId_indicatorId_fiscalYear: {
        orgId,
        indicatorId: data.indicatorId,
        fiscalYear: data.fiscalYear,
      },
    },
    create: {
      orgId,
      indicatorId: data.indicatorId,
      fiscalYear: data.fiscalYear,
      value: data.value as never,
      notes: data.notes ?? null,
      createdBy,
    },
    update: {
      value: data.value as never,
      notes: data.notes ?? null,
    },
  });
  logger.info({ orgId, indicatorId: data.indicatorId, fiscalYear: data.fiscalYear }, 'BRSR response upserted');
  return row as unknown as BrsrResponseResult;
}

export async function listResponses(
  orgId: string,
  params: { fiscalYear?: string; principleId?: string; page: number; pageSize: number },
): Promise<PaginatedResponse<BrsrResponseResult>> {
  const where: Record<string, unknown> = { orgId };
  if (params.fiscalYear) where.fiscalYear = params.fiscalYear;
  if (params.principleId) {
    where.indicator = { principleId: params.principleId };
  }
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.brsrResponse.findMany({
      where,
      include: { indicator: true },
      skip,
      take: params.pageSize,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.brsrResponse.count({ where }),
  ]);

  return {
    data: rows as unknown as BrsrResponseResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getResponse(
  orgId: string,
  indicatorId: string,
  fiscalYear: string,
): Promise<BrsrResponseResult> {
  const row = await prisma.brsrResponse.findUnique({
    where: { orgId_indicatorId_fiscalYear: { orgId, indicatorId, fiscalYear } },
    include: { indicator: true },
  });
  if (!row) throw new AppError(404, 'Not Found', 'Response not found');
  return row as unknown as BrsrResponseResult;
}
