import { z } from 'zod';

const pageParams = {
  page: z.string().transform(Number).pipe(z.number().int().min(1).max(10000)).default('1'),
  pageSize: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
};

export const listBrsrPrinciplesQuerySchema = z.object({
  ...pageParams,
});

export const listBrsrIndicatorsQuerySchema = z.object({
  principleId: z.string().uuid().optional(),
  section: z.enum(['SECTION_A', 'SECTION_B', 'SECTION_C']).optional(),
  indicatorType: z.enum(['ESSENTIAL', 'LEADERSHIP']).optional(),
  ...pageParams,
});

export const upsertBrsrResponseSchema = z.object({
  indicatorId: z.string().uuid(),
  fiscalYear: z.string().min(4).max(10),
  value: z.unknown(),
  notes: z.string().max(5000).optional(),
});

export const listBrsrResponsesQuerySchema = z.object({
  fiscalYear: z.string().min(4).max(10).optional(),
  principleId: z.string().uuid().optional(),
  ...pageParams,
});

export type ListBrsrPrinciplesQuery = z.infer<typeof listBrsrPrinciplesQuerySchema>;
export type ListBrsrIndicatorsQuery = z.infer<typeof listBrsrIndicatorsQuerySchema>;
export type UpsertBrsrResponseInput = z.infer<typeof upsertBrsrResponseSchema>;
export type ListBrsrResponsesQuery = z.infer<typeof listBrsrResponsesQuerySchema>;
