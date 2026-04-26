import { Router, type IRouter, type Request } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../services/audit-log.service.js';
import * as consentService from '../services/dpdp/consent.service.js';
import * as dsarService from '../services/dpdp/dsar.service.js';
import * as breachService from '../services/dpdp/breach-reminder.service.js';

/**
 * AAT-R3 — India DPDP Act 2023 routes.
 *
 *   AV4-428 (consent):
 *     POST   /api/v1/me/consent              record a consent decision
 *     POST   /api/v1/me/consent/withdraw     withdraw a consent
 *     GET    /api/v1/me/consent              list this user's consent history
 *
 *   AV4-430 (data principal rights):
 *     POST   /api/v1/me/data-export                create access DSAR + return inline export
 *     POST   /api/v1/me/data-erasure-request       create erasure DSAR
 *     POST   /api/v1/me/data-correction-request    create correction DSAR
 *     GET    /api/v1/me/data-requests              list this user's DSARs
 *     GET    /api/v1/admin/dpdp/requests           SUPER_ADMIN — list all DSARs
 *     POST   /api/v1/admin/dpdp/requests/:id/complete  SUPER_ADMIN — mark complete
 *     POST   /api/v1/admin/dpdp/requests/:id/reject    SUPER_ADMIN — reject
 *
 *   AV4-432 (breach notification):
 *     POST   /api/v1/admin/dpdp/breach              SUPER_ADMIN — log incident
 *     PATCH  /api/v1/admin/dpdp/breach/:id          SUPER_ADMIN — update / mark reported
 *     GET    /api/v1/admin/dpdp/breach              SUPER_ADMIN — list
 *     GET    /api/v1/admin/dpdp/breach/overdue      SUPER_ADMIN — overdue (>72h, unreported)
 *
 * Mounted in src/index.ts as a single `dpdpRouter` under `/api/v1` so the
 * route file owns the `/me/...` and `/admin/dpdp/...` paths.
 */

export const dpdpRouter: IRouter = Router();

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// ─── AV4-428: consent capture (data principal self-service) ────────────────

const recordConsentSchema = z.object({
  purpose: z.string().min(1).max(100),
  granted: z.boolean(),
  consentText: z.string().min(1).max(10_000),
  consentVersion: z.string().min(1).max(20),
});

dpdpRouter.post('/me/consent', requireAuth, async (req, res, next) => {
  try {
    const body = recordConsentSchema.parse(req.body);
    const userId = req.user!.sub;

    const record = await consentService.recordConsent({
      userId,
      purpose: body.purpose,
      granted: body.granted,
      consentText: body.consentText,
      consentVersion: body.consentVersion,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] ?? null,
    });

    await recordAudit({
      userId,
      action: body.granted ? 'dpdp.consent.grant' : 'dpdp.consent.deny',
      resource: 'ConsentRecord',
      resourceId: record.id,
      newValue: { purpose: body.purpose, version: body.consentVersion },
      ipAddress: getClientIP(req),
    });

    res.status(201).json({ data: record });
  } catch (err) {
    next(err);
  }
});

const withdrawConsentSchema = z.object({
  purpose: z.string().min(1).max(100),
});

dpdpRouter.post('/me/consent/withdraw', requireAuth, async (req, res, next) => {
  try {
    const body = withdrawConsentSchema.parse(req.body);
    const userId = req.user!.sub;
    const result = await consentService.withdrawConsent({
      userId,
      purpose: body.purpose,
    });

    if (result.withdrawn && result.record) {
      await recordAudit({
        userId,
        action: 'dpdp.consent.withdraw',
        resource: 'ConsentRecord',
        resourceId: result.record.id,
        newValue: { purpose: body.purpose },
        ipAddress: getClientIP(req),
      });
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

dpdpRouter.get('/me/consent', requireAuth, async (req, res, next) => {
  try {
    const records = await consentService.listForUser(req.user!.sub);
    res.json({ data: records });
  } catch (err) {
    next(err);
  }
});

// ─── AV4-430: Data Principal rights (DSAR) — self-service ──────────────────

dpdpRouter.post('/me/data-export', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const dsar = await dsarService.createRequest({
      userId,
      requestType: 'access',
      requestNotes:
        typeof req.body?.requestNotes === 'string'
          ? req.body.requestNotes.slice(0, 5_000)
          : null,
    });

    // Inline basic export — see dsar.service.buildDataExport for scope.
    const exportPayload = await dsarService.buildDataExport(userId);

    await recordAudit({
      userId,
      action: 'dpdp.dsar.access.create',
      resource: 'DataPrincipalRequest',
      resourceId: dsar.id,
      ipAddress: getClientIP(req),
    });

    res.status(201).json({ data: { request: dsar, export: exportPayload } });
  } catch (err) {
    next(err);
  }
});

const dsarNotesSchema = z.object({
  requestNotes: z.string().max(5_000).optional(),
});

dpdpRouter.post(
  '/me/data-erasure-request',
  requireAuth,
  async (req, res, next) => {
    try {
      const body = dsarNotesSchema.parse(req.body ?? {});
      const userId = req.user!.sub;
      const dsar = await dsarService.createRequest({
        userId,
        requestType: 'erasure',
        requestNotes: body.requestNotes ?? null,
      });

      await recordAudit({
        userId,
        action: 'dpdp.dsar.erasure.create',
        resource: 'DataPrincipalRequest',
        resourceId: dsar.id,
        ipAddress: getClientIP(req),
      });

      res.status(201).json({ data: dsar });
    } catch (err) {
      next(err);
    }
  },
);

dpdpRouter.post(
  '/me/data-correction-request',
  requireAuth,
  async (req, res, next) => {
    try {
      const body = dsarNotesSchema.parse(req.body ?? {});
      const userId = req.user!.sub;
      const dsar = await dsarService.createRequest({
        userId,
        requestType: 'correction',
        requestNotes: body.requestNotes ?? null,
      });

      await recordAudit({
        userId,
        action: 'dpdp.dsar.correction.create',
        resource: 'DataPrincipalRequest',
        resourceId: dsar.id,
        ipAddress: getClientIP(req),
      });

      res.status(201).json({ data: dsar });
    } catch (err) {
      next(err);
    }
  },
);

dpdpRouter.get('/me/data-requests', requireAuth, async (req, res, next) => {
  try {
    const items = await dsarService.listForUser(req.user!.sub);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// ─── AV4-430: admin DSAR queue (SUPER_ADMIN) ───────────────────────────────

const adminListDsarSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

dpdpRouter.get(
  '/admin/dpdp/requests',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const q = adminListDsarSchema.parse(req.query);
      const result = await dsarService.listAll({
        status: q.status,
        page: q.page,
        pageSize: q.pageSize,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

const completeDsarSchema = z.object({
  responseUrl: z.string().url().max(500).optional(),
  responseNotes: z.string().max(10_000).optional(),
});

dpdpRouter.post(
  '/admin/dpdp/requests/:id/complete',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const body = completeDsarSchema.parse(req.body ?? {});
      const updated = await dsarService.completeRequest({
        requestId: req.params.id as string,
        handlerUserId: req.user!.sub,
        responseUrl: body.responseUrl ?? null,
        responseNotes: body.responseNotes ?? null,
      });
      if (!updated) {
        res.status(404).json({
          type: 'https://aurex.in/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'DataPrincipalRequest not found',
          instance: req.originalUrl,
        });
        return;
      }

      await recordAudit({
        userId: req.user!.sub,
        action: 'dpdp.dsar.complete',
        resource: 'DataPrincipalRequest',
        resourceId: updated.id,
        newValue: {
          responseUrl: body.responseUrl ?? null,
          notesLen: body.responseNotes?.length ?? 0,
        },
        ipAddress: getClientIP(req),
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

const rejectDsarSchema = z.object({
  rejectedReason: z.string().min(1).max(10_000),
});

dpdpRouter.post(
  '/admin/dpdp/requests/:id/reject',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const body = rejectDsarSchema.parse(req.body);
      const updated = await dsarService.rejectRequest({
        requestId: req.params.id as string,
        handlerUserId: req.user!.sub,
        rejectedReason: body.rejectedReason,
      });
      if (!updated) {
        res.status(404).json({
          type: 'https://aurex.in/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'DataPrincipalRequest not found',
          instance: req.originalUrl,
        });
        return;
      }

      await recordAudit({
        userId: req.user!.sub,
        action: 'dpdp.dsar.reject',
        resource: 'DataPrincipalRequest',
        resourceId: updated.id,
        newValue: { rejectedReason: body.rejectedReason.slice(0, 200) },
        ipAddress: getClientIP(req),
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// ─── AV4-432: breach incidents (SUPER_ADMIN) ───────────────────────────────

const createBreachSchema = z.object({
  detectedAt: z
    .string()
    .datetime()
    .optional()
    .transform((s) => (s ? new Date(s) : new Date())),
  affectedUserCount: z.number().int().min(0).default(0),
  affectedDataTypes: z.array(z.string().min(1).max(100)).default([]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1).max(20_000),
  containmentNotes: z.string().max(20_000).optional(),
});

dpdpRouter.post(
  '/admin/dpdp/breach',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const body = createBreachSchema.parse(req.body);
      const incident = await breachService.createBreach({
        detectedAt: body.detectedAt,
        affectedUserCount: body.affectedUserCount,
        affectedDataTypes: body.affectedDataTypes,
        severity: body.severity,
        description: body.description,
        containmentNotes: body.containmentNotes ?? null,
        reportedByUserId: req.user!.sub,
      });

      await recordAudit({
        userId: req.user!.sub,
        action: 'dpdp.breach.create',
        resource: 'DataBreachIncident',
        resourceId: incident.id,
        newValue: {
          severity: incident.severity,
          affectedUserCount: incident.affectedUserCount,
          reportingDeadline: incident.reportingDeadline,
        },
        ipAddress: getClientIP(req),
      });

      res.status(201).json({ data: incident });
    } catch (err) {
      next(err);
    }
  },
);

const updateBreachSchema = z.object({
  status: z.enum(['open', 'contained', 'resolved', 'reported']).optional(),
  containmentNotes: z.string().max(20_000).optional(),
  remediationNotes: z.string().max(20_000).optional(),
  reportedToDpb: z.boolean().optional(),
  dpbReferenceId: z.string().max(100).optional(),
  affectedUserCount: z.number().int().min(0).optional(),
});

dpdpRouter.patch(
  '/admin/dpdp/breach/:id',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const body = updateBreachSchema.parse(req.body ?? {});
      const updated = await breachService.updateBreach(
        req.params.id as string,
        body,
      );
      if (!updated) {
        res.status(404).json({
          type: 'https://aurex.in/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'DataBreachIncident not found',
          instance: req.originalUrl,
        });
        return;
      }

      await recordAudit({
        userId: req.user!.sub,
        action: body.reportedToDpb
          ? 'dpdp.breach.report'
          : 'dpdp.breach.update',
        resource: 'DataBreachIncident',
        resourceId: updated.id,
        newValue: {
          status: updated.status,
          reportedToDpb: updated.reportedToDpb,
          dpbReferenceId: updated.dpbReferenceId,
        },
        ipAddress: getClientIP(req),
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

const listBreachesSchema = z.object({
  status: z.enum(['open', 'contained', 'resolved', 'reported']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

dpdpRouter.get(
  '/admin/dpdp/breach',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const q = listBreachesSchema.parse(req.query);
      const result = await breachService.listBreaches(q);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

dpdpRouter.get(
  '/admin/dpdp/breach/overdue',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (_req, res, next) => {
    try {
      const items = await breachService.getOverdueBreaches();
      res.json({ data: { items, total: items.length } });
    } catch (err) {
      next(err);
    }
  },
);
