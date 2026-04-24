import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { retentionReport } from '../services/archival.service.js';

/**
 * AV4-338: Admin retention report.
 *
 * SUPER_ADMIN-only. Returns every MonitoringPeriod tagged with its retention
 * state (ACTIVE / ELIGIBLE / ARCHIVED / RESTORED) so compliance + legal can
 * audit the ≥ 2yr retention rule (A6.4-PROC-AC-002).
 *
 * No org-scope middleware here on purpose — this is a cross-org operator
 * view and the caller must already be a SUPER_ADMIN global role.
 */
export const adminRetentionRouter: IRouter = Router();

adminRetentionRouter.use(requireAuth, requireRole('SUPER_ADMIN'));

adminRetentionRouter.get('/report', async (_req, res, next) => {
  try {
    const rows = await retentionReport();
    const summary = rows.reduce(
      (acc, r) => {
        acc[r.state] = (acc[r.state] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    res.json({ data: rows, summary });
  } catch (err) {
    next(err);
  }
});
