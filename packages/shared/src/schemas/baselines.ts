import { z } from 'zod';

export const createBaselineSchema = z.object({
  name: z.string().min(1).max(255),
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']),
  baseYear: z.number().int().min(1990).max(2050),
  value: z.number().positive(),
  unit: z.string().max(20).default('tCO2e'),
  methodology: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
});

export const updateBaselineSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']).optional(),
  baseYear: z.number().int().min(1990).max(2050).optional(),
  value: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  methodology: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});

export type CreateBaselineInput = z.infer<typeof createBaselineSchema>;
export type UpdateBaselineInput = z.infer<typeof updateBaselineSchema>;
