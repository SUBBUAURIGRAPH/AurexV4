import { Router, type IRouter } from 'express';
import { listAuditLogsQuerySchema } from '@aurex/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as auditLogService from '../services/audit-log.service.js';

export const auditLogRouter: IRouter = Router();

/**
 * GET / — List audit log entries (admin only).
 * Filters: userId, action, resource, resourceId, dateFrom, dateTo
 * Pagination: page (1-100), pageSize (1-100); defaults 1 / 20.
 *
 * Note: the AuditLog model has no orgId column, so currently all rows are
 * visible to org admins. This matches the current scope of AV4-223; when
 * the schema gains an orgId it should be added to `buildAuditWhere`.
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
