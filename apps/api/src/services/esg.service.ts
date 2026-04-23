import { prisma } from '@aurex/database';
import type { PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

export interface FrameworkResult {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndicatorResult {
  id: string;
  frameworkId: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface ListFrameworksParams {
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export async function listFrameworks(
  params: ListFrameworksParams,
): Promise<PaginatedResponse<FrameworkResult>> {
  const where: Record<string, unknown> = {};
  if (typeof params.isActive === 'boolean') where.isActive = params.isActive;
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.esgFramework.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { code: 'asc' },
    }),
    prisma.esgFramework.count({ where }),
  ]);

  return {
    data: rows as unknown as FrameworkResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getFramework(id: string): Promise<FrameworkResult & { indicators: IndicatorResult[] }> {
  const row = await prisma.esgFramework.findUnique({
    where: { id },
    include: { indicators: { where: { isActive: true }, orderBy: { code: 'asc' } } },
  });
  if (!row) throw new AppError(404, 'Not Found', 'Framework not found');
  return row as unknown as FrameworkResult & { indicators: IndicatorResult[] };
}

export interface CreateFrameworkParams {
  code: string;
  name: string;
  description?: string;
  version?: string;
  isActive?: boolean;
}

export async function createFramework(data: CreateFrameworkParams): Promise<FrameworkResult> {
  const existing = await prisma.esgFramework.findUnique({ where: { code: data.code } });
  if (existing) throw new AppError(409, 'Conflict', 'Framework with this code already exists');

  const row = await prisma.esgFramework.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      version: data.version ?? null,
      isActive: data.isActive ?? true,
    },
  });
  logger.info({ frameworkId: row.id, code: row.code }, 'ESG framework created');
  return row as unknown as FrameworkResult;
}

export interface UpdateFrameworkParams {
  name?: string;
  description?: string;
  version?: string;
  isActive?: boolean;
}

export async function updateFramework(id: string, data: UpdateFrameworkParams): Promise<FrameworkResult> {
  const existing = await prisma.esgFramework.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Not Found', 'Framework not found');

  const row = await prisma.esgFramework.update({ where: { id }, data });
  return row as unknown as FrameworkResult;
}

export interface ListIndicatorsParams {
  frameworkId?: string;
  category?: string;
  page: number;
  pageSize: number;
}

export async function listIndicators(
  params: ListIndicatorsParams,
): Promise<PaginatedResponse<IndicatorResult>> {
  const where: Record<string, unknown> = { isActive: true };
  if (params.frameworkId) where.frameworkId = params.frameworkId;
  if (params.category) where.category = params.category;
  const skip = (params.page - 1) * params.pageSize;

  const [rows, total] = await Promise.all([
    prisma.esgIndicator.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { code: 'asc' },
    }),
    prisma.esgIndicator.count({ where }),
  ]);

  return {
    data: rows as unknown as IndicatorResult[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getOrgFrameworks(orgId: string): Promise<FrameworkResult[]> {
  const rows = await prisma.orgFrameworkMapping.findMany({
    where: { orgId, isActive: true },
    include: { framework: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => r.framework as unknown as FrameworkResult);
}

export async function mapFramework(orgId: string, frameworkId: string): Promise<void> {
  const fw = await prisma.esgFramework.findUnique({ where: { id: frameworkId } });
  if (!fw) throw new AppError(404, 'Not Found', 'Framework not found');

  await prisma.orgFrameworkMapping.upsert({
    where: { orgId_frameworkId: { orgId, frameworkId } },
    create: { orgId, frameworkId, isActive: true },
    update: { isActive: true },
  });
  logger.info({ orgId, frameworkId }, 'Org mapped to framework');
}

export async function unmapFramework(orgId: string, frameworkId: string): Promise<void> {
  const existing = await prisma.orgFrameworkMapping.findUnique({
    where: { orgId_frameworkId: { orgId, frameworkId } },
  });
  if (!existing) throw new AppError(404, 'Not Found', 'Framework mapping not found');

  await prisma.orgFrameworkMapping.delete({
    where: { orgId_frameworkId: { orgId, frameworkId } },
  });
  logger.info({ orgId, frameworkId }, 'Org unmapped from framework');
}
