import { z } from 'zod';

const pageParams = {
  page: z.string().transform(Number).pipe(z.number().int().min(1).max(10000)).default('1'),
  pageSize: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
};

const STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED'] as const;
const REQUEST_STATUSES = ['PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED'] as const;

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  contactPerson: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  externalId: z.string().max(100).optional(),
  status: z.enum(STATUSES).optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  contactPerson: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  externalId: z.string().max(100).optional(),
  status: z.enum(STATUSES).optional(),
});

export const listSuppliersQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.string().max(100).optional(),
  search: z.string().max(100).optional(),
  ...pageParams,
});

export const createSupplierRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  dataScope: z.string().min(1).max(100),
  periodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  periodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  dueBy: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
});

export const submitSupplierRequestSchema = z.object({
  submittedValue: z.unknown(),
});

export const decideSupplierRequestSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'CANCELLED']),
  reviewNotes: z.string().max(2000).optional(),
});

export const listSupplierRequestsQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  supplierId: z.string().uuid().optional(),
  ...pageParams,
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
export type CreateSupplierRequestInput = z.infer<typeof createSupplierRequestSchema>;
export type SubmitSupplierRequestInput = z.infer<typeof submitSupplierRequestSchema>;
export type DecideSupplierRequestInput = z.infer<typeof decideSupplierRequestSchema>;
export type ListSupplierRequestsQuery = z.infer<typeof listSupplierRequestsQuerySchema>;
