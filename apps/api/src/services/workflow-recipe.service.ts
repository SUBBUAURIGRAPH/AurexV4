import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from './audit-log.service.js';

/**
 * Workflow recipe service (Phase C).
 *
 * A "recipe" is a named quorum policy (single-approver, dual-approval,
 * triple-approval, …). Each org enables a recipe per resource type
 * (emissions_record, report, brsr_response, supplier_data_request). When an
 * approval request is submitted, the service stamps the active recipe's
 * required-approvers count onto the row so approval decisions can be
 * tallied against a fixed quorum even if the recipe is changed later.
 */

export interface WorkflowRecipeResult {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requiredApprovers: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgEnablementResult {
  id: string;
  orgId: string;
  resourceType: string;
  recipeId: string;
  recipeCode: string;
  recipeName: string;
  requiredApprovers: number;
  enabledAt: Date;
  enabledBy: string;
}

/**
 * List all active WorkflowRecipe rows ordered by required-approvers count so
 * UI dropdowns present the lowest-quorum option first.
 */
export async function listRecipes(): Promise<WorkflowRecipeResult[]> {
  const rows = await prisma.workflowRecipe.findMany({
    where: { isActive: true },
    orderBy: [{ requiredApprovers: 'asc' }, { code: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    requiredApprovers: r.requiredApprovers,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * List the recipes enabled for a single org. Joins to WorkflowRecipe so the
 * caller can render the recipe name/quorum without a second round-trip.
 */
export async function listOrgEnablements(
  orgId: string,
): Promise<OrgEnablementResult[]> {
  const rows = await prisma.orgWorkflowEnablement.findMany({
    where: { orgId },
    include: { recipe: true },
    orderBy: { resourceType: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    resourceType: r.resourceType,
    recipeId: r.recipeId,
    recipeCode: r.recipe.code,
    recipeName: r.recipe.name,
    requiredApprovers: r.recipe.requiredApprovers,
    enabledAt: r.enabledAt,
    enabledBy: r.enabledBy,
  }));
}

/**
 * Upsert an OrgWorkflowEnablement row. Looks up the recipe by its `code`
 * (not its id) so callers can enable recipes via human-friendly identifiers.
 * Returns 404 when the recipe code doesn't exist.
 */
export async function enableRecipe(params: {
  orgId: string;
  userId: string;
  resourceType: string;
  recipeCode: string;
  ipAddress?: string;
}): Promise<OrgEnablementResult> {
  const recipe = await prisma.workflowRecipe.findUnique({
    where: { code: params.recipeCode },
  });
  if (!recipe || !recipe.isActive) {
    throw new AppError(404, 'Not Found', `Workflow recipe '${params.recipeCode}' not found`);
  }

  const existing = await prisma.orgWorkflowEnablement.findUnique({
    where: {
      orgId_resourceType: {
        orgId: params.orgId,
        resourceType: params.resourceType,
      },
    },
  });

  const row = await prisma.orgWorkflowEnablement.upsert({
    where: {
      orgId_resourceType: {
        orgId: params.orgId,
        resourceType: params.resourceType,
      },
    },
    update: {
      recipeId: recipe.id,
      enabledBy: params.userId,
      enabledAt: new Date(),
    },
    create: {
      orgId: params.orgId,
      resourceType: params.resourceType,
      recipeId: recipe.id,
      enabledBy: params.userId,
    },
    include: { recipe: true },
  });

  await recordAudit({
    orgId: params.orgId,
    userId: params.userId,
    action: existing ? 'workflow.recipe.updated' : 'workflow.recipe.enabled',
    resource: 'org_workflow_enablement',
    resourceId: row.id,
    oldValue: existing
      ? { recipeId: existing.recipeId, resourceType: existing.resourceType }
      : null,
    newValue: {
      resourceType: row.resourceType,
      recipeId: row.recipeId,
      recipeCode: row.recipe.code,
    },
    ipAddress: params.ipAddress,
  });

  logger.info(
    {
      orgId: params.orgId,
      resourceType: params.resourceType,
      recipeCode: params.recipeCode,
    },
    'Workflow recipe enabled',
  );

  return {
    id: row.id,
    orgId: row.orgId,
    resourceType: row.resourceType,
    recipeId: row.recipeId,
    recipeCode: row.recipe.code,
    recipeName: row.recipe.name,
    requiredApprovers: row.recipe.requiredApprovers,
    enabledAt: row.enabledAt,
    enabledBy: row.enabledBy,
  };
}

/**
 * Remove an enablement — resource type falls back to the platform default
 * (requiredApprovers=1). Idempotent; returns 404 only if the row doesn't
 * exist so callers can distinguish "already gone" from "never existed".
 */
export async function disableRecipe(params: {
  orgId: string;
  userId: string;
  resourceType: string;
  ipAddress?: string;
}): Promise<void> {
  const existing = await prisma.orgWorkflowEnablement.findUnique({
    where: {
      orgId_resourceType: {
        orgId: params.orgId,
        resourceType: params.resourceType,
      },
    },
  });
  if (!existing) {
    throw new AppError(
      404,
      'Not Found',
      `No workflow recipe enabled for resource type '${params.resourceType}'`,
    );
  }

  await prisma.orgWorkflowEnablement.delete({
    where: { id: existing.id },
  });

  await recordAudit({
    orgId: params.orgId,
    userId: params.userId,
    action: 'workflow.recipe.disabled',
    resource: 'org_workflow_enablement',
    resourceId: existing.id,
    oldValue: {
      resourceType: existing.resourceType,
      recipeId: existing.recipeId,
    },
    newValue: null,
    ipAddress: params.ipAddress,
  });

  logger.info(
    { orgId: params.orgId, resourceType: params.resourceType },
    'Workflow recipe disabled (falls back to default quorum of 1)',
  );
}

export interface ResolvedQuorum {
  recipeId: string | null;
  requiredApprovers: number;
}

/**
 * Resolve the active quorum for (orgId, resourceType). Returns the platform
 * default (1 required approver, null recipeId) when no enablement is set so
 * callers can treat the return as authoritative without branching.
 */
export async function resolveRequiredApprovers(
  orgId: string,
  resourceType: string,
): Promise<ResolvedQuorum> {
  const enablement = await prisma.orgWorkflowEnablement.findUnique({
    where: {
      orgId_resourceType: { orgId, resourceType },
    },
    include: { recipe: true },
  });

  if (!enablement) {
    return { recipeId: null, requiredApprovers: 1 };
  }

  return {
    recipeId: enablement.recipeId,
    requiredApprovers: enablement.recipe.requiredApprovers,
  };
}
