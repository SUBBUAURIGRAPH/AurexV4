/**
 * FLOW-REWORK / Sprint 5 — admin org-approval route.
 *
 * SUPER_ADMIN-only:
 *   GET    /api/v1/admin/org-approvals          — list (default: pending)
 *   POST   /api/v1/admin/org-approvals/:id/approve
 *   POST   /api/v1/admin/org-approvals/:id/reject  { reason }
 */
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as approvalService from '../services/org-approval.service.js';

export const adminOrgApprovalsRouter: IRouter = Router();

adminOrgApprovalsRouter.use(requireAuth, requireRole('super_admin'));

adminOrgApprovalsRouter.get('/', async (req, res, next) => {
  try {
    const all = String(req.query.all ?? '').toLowerCase() === 'true';
    const data = all ? await approvalService.listAll() : await approvalService.listPending();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminOrgApprovalsRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const orgId = String(req.params.id);
    const data = await approvalService.approve(orgId, req.user!.sub);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

const rejectSchema = z.object({ reason: z.string().min(1).max(1000) });

adminOrgApprovalsRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const orgId = String(req.params.id);
    const { reason } = rejectSchema.parse(req.body ?? {});
    const data = await approvalService.reject(orgId, req.user!.sub, reason);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * Public-to-org-members endpoint: lets the org's own users see their
 * approval state without needing SUPER_ADMIN.
 */
export const orgApprovalStatusRouter: IRouter = Router();
orgApprovalStatusRouter.use(requireAuth);
orgApprovalStatusRouter.get('/', async (req, res, next) => {
  try {
    // Use req.user.organization (resolved on token payload) — fall back
    // to looking up the user's first membership.
    const orgId = (req as unknown as { orgId?: string }).orgId ?? null;
    if (!orgId) {
      res.json({ data: null });
      return;
    }
    const status = await approvalService.getApprovalStatus(orgId);
    res.json({ data: { orgId, approvalStatus: status } });
  } catch (err) {
    next(err);
  }
});
