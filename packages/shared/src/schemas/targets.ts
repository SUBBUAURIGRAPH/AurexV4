import { z } from 'zod';

export const createTargetSchema = z.object({
  name: z.string().min(1).max(255),
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']),
  targetYear: z.number().int().min(2020).max(2100),
  reduction: z.number().min(0).max(100),
  pathway: z.enum(['CELSIUS_1_5', 'WELL_BELOW_2', 'CELSIUS_2']).optional(),
});

export const updateTargetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']).optional(),
  targetYear: z.number().int().min(2020).max(2100).optional(),
  reduction: z.number().min(0).max(100).optional(),
  pathway: z.enum(['CELSIUS_1_5', 'WELL_BELOW_2', 'CELSIUS_2']).nullish(),
});

export const recordProgressSchema = z.object({
  year: z.number().int().min(1990).max(2100),
  actual: z.number(),
  projected: z.number().optional(),
});

export type CreateTargetInput = z.infer<typeof createTargetSchema>;
export type UpdateTargetInput = z.infer<typeof updateTargetSchema>;
export type RecordProgressInput = z.infer<typeof recordProgressSchema>;
