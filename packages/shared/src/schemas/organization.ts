import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  parentOrgId: z.string().uuid().nullish(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  isActive: z.boolean().optional(),
  parentOrgId: z.string().uuid().nullish(),
});

export const addMemberSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['super_admin', 'org_admin', 'manager', 'analyst', 'viewer', 'maker', 'checker', 'approver', 'auditor']).default('viewer'),
});

export const updateMemberSchema = z.object({
  role: z.enum(['super_admin', 'org_admin', 'manager', 'analyst', 'viewer', 'maker', 'checker', 'approver', 'auditor']),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
