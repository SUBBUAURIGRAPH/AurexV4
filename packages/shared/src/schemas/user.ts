import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(['super_admin', 'org_admin', 'manager', 'analyst', 'viewer']).optional(),
  isActive: z.boolean().optional(),
});

export const listUsersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  role: z.enum(['super_admin', 'org_admin', 'manager', 'analyst', 'viewer']).optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default('1'),
  pageSize: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('20'),
  sort: z.enum(['name', 'email', 'role', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
