import { z } from 'zod';

const pageParams = {
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(10000))
    .default('1'),
  pageSize: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('20'),
};

export const listFrameworksQuerySchema = z.object({
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  ...pageParams,
});

export const listIndicatorsQuerySchema = z.object({
  frameworkId: z.string().uuid().optional(),
  category: z.string().min(1).max(100).optional(),
  ...pageParams,
});

export const createFrameworkSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  version: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
});

export const updateFrameworkSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional(),
  version: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
});

export const createIndicatorSchema = z.object({
  frameworkId: z.string().uuid(),
  code: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

export const mapFrameworkSchema = z.object({
  frameworkId: z.string().uuid(),
});

export type ListFrameworksQuery = z.infer<typeof listFrameworksQuerySchema>;
export type ListIndicatorsQuery = z.infer<typeof listIndicatorsQuerySchema>;
export type CreateFrameworkInput = z.infer<typeof createFrameworkSchema>;
export type UpdateFrameworkInput = z.infer<typeof updateFrameworkSchema>;
export type CreateIndicatorInput = z.infer<typeof createIndicatorSchema>;
export type MapFrameworkInput = z.infer<typeof mapFrameworkSchema>;
