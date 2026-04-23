import { Router, type IRouter } from 'express';
import {
  submitApprovalSchema,
  decideApprovalSchema,
  listApprovalsQuerySchema,
  addApprovalCommentSchema,
} from '@aurex/shared';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as approvalService from '../services/approval.service.js';

/**
 * Approval Workflow API (AV4-219).
 *
 * Generic approval queue that sits on top of per-resource status workflows.
 * Routes:
 *   POST   /                 submit (any authenticated org member)
 *   GET    /                 list inbox (APPROVER, AUDITOR, ORG_ADMIN, SUPER_ADMIN)
 *   GET    /:id              get single (same gate as list)
 *   PATCH  /:id/decide       approve / reject (APPROVER, ORG_ADMIN, SUPER_ADMIN)
 *   POST   /:id/comments     attach a comment (any org member)
 */
export const approvalsRouter: IRouter = Router();

approvalsRouter.use(requireAuth, requireOrgScope);

const INBOX_ROLES = ['APPROVER', 'AUDITOR', 'ORG_ADMIN', 'SUPER_ADMIN'];
const DECIDE_ROLES = ['APPROVER', 'ORG_ADMIN', 'SUPER_ADMIN'];

/**
 * POST / — submit a new approval request.
 */
approvalsRouter.post('/', async (req, res, next) => {
  try {
    const data = submitApprovalSchema.parse(req.body);

    const row = await approvalService.submitApproval({
      orgId: req.orgId!,
      requestedBy: req.user!.sub,
      resource: data.resource,
      resourceId: data.resourceId,
      payload: data.payload,
      ipAddress: req.ip,
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

/**
 * GET / — list approval requests in the caller's org.
 */
approvalsRouter.get(
  '/',
  requireOrgRole(...INBOX_ROLES),
  async (req, res, next) => {
    try {
      const parsed = listApprovalsQuerySchema.parse(req.query);

      const result = await approvalService.listApprovals({
        orgId: req.orgId!,
        status: parsed.status,
        resource: parsed.resource,
        requestedBy: parsed.requestedBy,
        page: parsed.page,
        pageSize: parsed.pageSize,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /:id — full approval record with comments.
 */
approvalsRouter.get(
  '/:id',
  requireOrgRole(...INBOX_ROLES),
  async (req, res, next) => {
    try {
      const id = req.params.id as string;
      const row = await approvalService.getApproval(id, req.orgId!);
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /:id/decide — approve or reject. One-way transition from PENDING.
 * Returns 409 if the request is not pending.
 */
approvalsRouter.patch(
  '/:id/decide',
  requireOrgRole(...DECIDE_ROLES),
  async (req, res, next) => {
    try {
      const id = req.params.id as string;
      const body = decideApprovalSchema.parse(req.body);

      const row = await approvalService.decideApproval({
        id,
        orgId: req.orgId!,
        deciderId: req.user!.sub,
        status: body.status,
        reason: body.reason,
        ipAddress: req.ip,
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /:id/comments — attach a comment. Available to any org member.
 */
approvalsRouter.post('/:id/comments', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = addApprovalCommentSchema.parse(req.body);

    const row = await approvalService.addComment({
      requestId: id,
      orgId: req.orgId!,
      userId: req.user!.sub,
      body: body.body,
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});
