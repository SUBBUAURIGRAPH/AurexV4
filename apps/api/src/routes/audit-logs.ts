import { Router, type IRouter } from 'express';
import { listAuditLogsQuerySchema } from '@aurex/shared';
import { prisma } from '@aurex/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as auditLogService from '../services/audit-log.service.js';
import {
  buildAuditCsv,
  AUDIT_CSV_HEADER,
  AUDIT_CSV_ROW_CAP,
} from '../services/audit-log-csv.js';

export const auditLogRouter: IRouter = Router();

/**
 * GET / — List audit log entries, scoped to the caller's org.
 *
 * Default response: paginated JSON.
 *
 * AAT-10A (Wave 10a): When `?format=csv` is supplied (or the `Accept`
 * header prefers `text/csv` over JSON), the same filters are applied,
 * pagination is bypassed, and a single CSV file is returned with
 * `Content-Disposition: attachment` so the browser triggers a download.
 *
 * Filters: userId, action, resource, resourceId, dateFrom, dateTo.
 * Pagination (JSON only): page (1-100), pageSize (1-100); defaults 1 / 20.
 *
 * CSV row cap: AUDIT_CSV_ROW_CAP. Exceeding this returns 413 (RFC 7807) so
 * the UI can prompt the user to narrow filters rather than streaming an
 * enormous file.
 */
auditLogRouter.get(
  '/',
  requireAuth,
  requireOrgScope,
  requireRole('org_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const parsed = listAuditLogsQuerySchema.parse(req.query);

      // Decide whether the caller wants CSV. Explicit `?format=csv` wins;
      // otherwise we look at the Accept header. JSON remains the default
      // for backward compatibility with any other clients that use this
      // endpoint without sending an Accept header.
      const explicitFormat = typeof req.query.format === 'string'
        ? req.query.format.toLowerCase()
        : undefined;
      const accept = (req.headers.accept ?? '').toLowerCase();
      const wantsCsv =
        explicitFormat === 'csv' ||
        (explicitFormat === undefined &&
          accept.includes('text/csv') &&
          !accept.includes('application/json'));

      if (wantsCsv) {
        // Probe the row count under the same where-clause first so we can
        // return a clean RFC 7807 over-cap error before pulling 10k rows
        // into memory.
        const where = auditLogService.buildAuditWhere({
          orgId: req.orgId!,
          userId: parsed.userId,
          action: parsed.action,
          resource: parsed.resource,
          resourceId: parsed.resourceId,
          dateFrom: parsed.dateFrom,
          dateTo: parsed.dateTo,
          page: 1,
          pageSize: 1,
        });
        const total = await prisma.auditLog.count({ where });
        if (total > AUDIT_CSV_ROW_CAP) {
          res
            .status(413)
            .setHeader('Content-Type', 'application/problem+json; charset=utf-8')
            .json({
              type: 'https://aurex.in/errors/payload-too-large',
              title: 'Payload Too Large',
              status: 413,
              detail: `Audit-log CSV export is capped at ${AUDIT_CSV_ROW_CAP.toLocaleString()} rows (matched ${total.toLocaleString()}). Narrow your filters and try again.`,
              instance: req.originalUrl,
              cap: AUDIT_CSV_ROW_CAP,
              matched: total,
            });
          return;
        }

        // Pull the rows (capped) and stream the CSV. We cap at
        // AUDIT_CSV_ROW_CAP to mirror the 413 path above and to bound
        // memory/RAM cost; row count is small enough that an in-memory
        // buffer is fine.
        const result = await auditLogService.listAudit({
          orgId: req.orgId!,
          userId: parsed.userId,
          action: parsed.action,
          resource: parsed.resource,
          resourceId: parsed.resourceId,
          dateFrom: parsed.dateFrom,
          dateTo: parsed.dateTo,
          page: 1,
          pageSize: AUDIT_CSV_ROW_CAP,
        });

        // Resolve org slug for the filename. Falls back to the orgId
        // prefix if for some reason the membership lookup misses.
        const org = await prisma.organization.findUnique({
          where: { id: req.orgId! },
          select: { slug: true },
        });
        const orgSlug = org?.slug ?? `org-${req.orgId!.slice(0, 8)}`;
        const isoDate = new Date().toISOString().slice(0, 10);
        const filename = `audit-logs-${orgSlug}-${isoDate}.csv`;

        const csv = buildAuditCsv(result.data);
        const buf = Buffer.from(csv, 'utf-8');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`,
        );
        res.setHeader('Content-Length', buf.byteLength.toString());
        res.send(buf);
        return;
      }

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

// Re-export CSV constants for tests that want to verify the header
// contract or row-cap policy without importing from the service module.
export { AUDIT_CSV_HEADER, AUDIT_CSV_ROW_CAP };
