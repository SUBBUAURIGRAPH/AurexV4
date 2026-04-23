import { z } from 'zod';

export const createEmissionSchema = z.object({
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']),
  category: z.string().min(1).max(100),
  source: z.string().min(1).max(255),
  value: z.number().positive(),
  unit: z.string().max(20).default('tCO2e'),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const updateEmissionSchema = z.object({
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']).optional(),
  category: z.string().min(1).max(100).optional(),
  source: z.string().min(1).max(255).optional(),
  value: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  periodStart: z.string().min(1).optional(),
  periodEnd: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateEmissionStatusSchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
});

export const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.enum(['VERIFIED', 'REJECTED']),
});

export type CreateEmissionInput = z.infer<typeof createEmissionSchema>;
export type UpdateEmissionInput = z.infer<typeof updateEmissionSchema>;
export type UpdateEmissionStatusInput = z.infer<typeof updateEmissionStatusSchema>;
export type BulkStatusInput = z.infer<typeof bulkStatusSchema>;
