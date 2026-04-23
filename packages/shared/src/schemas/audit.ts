import { z } from 'zod';

/**
 * Audit log list query schema.
 * All params are optional; `page` and `pageSize` default to 1 and 20 and are
 * clamped to [1, 100]. Dates (`dateFrom`/`dateTo`) accept ISO strings and are
 * validated by attempting to coerce to a Date.
 */
export const listAuditLogsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().min(1).max(100).optional(),
  resource: z.string().min(1).max(100).optional(),
  resourceId: z.string().uuid().optional(),
  dateFrom: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  dateTo: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('1'),
  pageSize: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('20'),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
