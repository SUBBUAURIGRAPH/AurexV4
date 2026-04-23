import { Router, type IRouter } from 'express';
import { listAuditLogsQuerySchema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as auditLogService from '../services/audit-log.service.js';

export const auditLogRouter: IRouter = Router();

/**
 * GET / — List audit log entries, scoped to the caller's org.
 * Filters: userId, action, resource, resourceId, dateFrom, dateTo.
 * Pagination: page (1-100), pageSize (1-100); defaults 1 / 20.
 */
auditLogRouter.get(
  '/',
  requireAuth,
  requireOrgScope,
  requireRole('org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const parsed = listAuditLogsQuerySchema.parse(req.query);

      const result = await auditLogService.listAudit({
        orgId: req.orgId!,
        userId: parsed.userId,
        action: parsed.action,
        resource: parsed.resource,
        resourceId: parsed.resourceId,
        dateFrom: parsed.dateFrom,
        dateTo: parsed.dateTo,
        page: parsed.page,
        pageSize: parsed.pageSize,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
