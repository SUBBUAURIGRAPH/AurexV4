import { z } from 'zod';

/**
 * Configurable approval workflow recipe schemas (Phase C).
 *
 * Each org can pick a quorum policy per resource type (emissions_record,
 * report, brsr_response, supplier_data_request). If no enablement row exists
 * for a resource type, the platform default (requiredApprovers=1) applies.
 */

export const enableRecipeSchema = z.object({
  resourceType: z.enum([
    'emissions_record',
    'report',
    'brsr_response',
    'supplier_data_request',
  ]),
  recipeCode: z.string().min(1).max(50),
});

export type EnableRecipeInput = z.infer<typeof enableRecipeSchema>;
