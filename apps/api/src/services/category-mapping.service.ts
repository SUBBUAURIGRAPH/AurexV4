import { prisma } from '@aurex/database';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

/**
 * Category → Framework indicator mapping service.
 *
 * Lookup semantics: for a given (orgId, scope, category), the org override
 * wins if present; otherwise fall back to the platform default (orgId=null).
 * This lets an org customise how, say, "Stationary Combustion" rolls up
 * (maybe they also count it against a custom KPI code) without touching the
 * global defaults used by every other tenant.
 */

export interface CategoryMappingResult {
  id: string;
  orgId: string | null;
  scope: string;
  category: string;
  esgIndicatorCodes: string[];
  brsrIndicatorCodes: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function resolveMapping(
  orgId: string,
  scope: string,
  category: string,
): Promise<CategoryMappingResult | null> {
  // Try org-scoped override first, then platform default.
  const override = await prisma.categoryMapping.findUnique({
    where: { orgId_scope_category: { orgId, scope: scope as never, category } },
  });
  if (override) return override as unknown as CategoryMappingResult;

  const fallback = await prisma.categoryMapping.findFirst({
    where: { orgId: null, scope: scope as never, category },
  });
  return (fallback as unknown as CategoryMappingResult | null) ?? null;
}

export async function listMappings(params: {
  orgId: string;
  scope?: string;
  includeDefaults?: boolean;
}): Promise<CategoryMappingResult[]> {
  const where: Record<string, unknown> = {};
  if (params.scope) where.scope = params.scope;

  // By default: org overrides + platform defaults (so the UI can show both
  // and let the user choose). Toggle off with includeDefaults=false.
  if (params.includeDefaults !== false) {
    where.OR = [{ orgId: params.orgId }, { orgId: null }];
  } else {
    where.orgId = params.orgId;
  }

  const rows = await prisma.categoryMapping.findMany({
    where,
    orderBy: [{ scope: 'asc' }, { category: 'asc' }, { orgId: 'desc' }],
  });
  return rows as unknown as CategoryMappingResult[];
}

export interface UpsertMappingInput {
  scope: 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';
  category: string;
  esgIndicatorCodes: string[];
  brsrIndicatorCodes: string[];
}

export async function upsertOrgMapping(
  orgId: string,
  data: UpsertMappingInput,
): Promise<CategoryMappingResult> {
  const row = await prisma.categoryMapping.upsert({
    where: {
      orgId_scope_category: { orgId, scope: data.scope as never, category: data.category },
    },
    create: {
      orgId,
      scope: data.scope as never,
      category: data.category,
      esgIndicatorCodes: data.esgIndicatorCodes,
      brsrIndicatorCodes: data.brsrIndicatorCodes,
      isDefault: false,
    },
    update: {
      esgIndicatorCodes: data.esgIndicatorCodes,
      brsrIndicatorCodes: data.brsrIndicatorCodes,
    },
  });
  logger.info(
    { orgId, scope: data.scope, category: data.category },
    'Category mapping upserted',
  );
  return row as unknown as CategoryMappingResult;
}

export async function deleteOrgMapping(
  orgId: string,
  scope: string,
  category: string,
): Promise<void> {
  const existing = await prisma.categoryMapping.findUnique({
    where: { orgId_scope_category: { orgId, scope: scope as never, category } },
  });
  if (!existing) {
    throw new AppError(404, 'Not Found', 'No org override exists for this category');
  }
  await prisma.categoryMapping.delete({
    where: { orgId_scope_category: { orgId, scope: scope as never, category } },
  });
  logger.info({ orgId, scope, category }, 'Category mapping deleted');
}
