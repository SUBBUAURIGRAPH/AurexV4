import { z } from 'zod';

/**
 * Approval workflow schemas (AV4-219).
 *
 * The approval model is a generic queue layered on top of per-resource status
 * workflows: any MAKER+ user can submit a request for a resource, any
 * APPROVER+ can decide it, and anyone in the org can attach comments.
 */

export const submitApprovalSchema = z.object({
  resource: z.string().min(1).max(100),
  resourceId: z.string().uuid(),
  payload: z.record(z.unknown()).optional(),
});

export const decideApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().max(2000).optional(),
});

/**
 * List-inbox filters. Status accepts any ApprovalStatus; `requestedBy` is a
 * UUID so we can show "my submissions" for a given user.
 */
export const listApprovalsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  resource: z.string().min(1).max(100).optional(),
  requestedBy: z.string().uuid().optional(),
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
});

export const addApprovalCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export type SubmitApprovalInput = z.infer<typeof submitApprovalSchema>;
export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;
export type ListApprovalsQuery = z.infer<typeof listApprovalsQuerySchema>;
export type AddApprovalCommentInput = z.infer<typeof addApprovalCommentSchema>;
