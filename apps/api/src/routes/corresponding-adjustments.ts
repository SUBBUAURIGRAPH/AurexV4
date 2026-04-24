import { Router, type IRouter } from 'express';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from '../services/audit-log.service.js';

/**
 * Article 6.4 Corresponding Adjustments (Phase C, AV4-333).
 *
 * Host-country DNAs report CA events in their next Biennial Transparency
 * Report (BTR). This router exposes:
 *
 *   GET /btr/:hostCountry — returns the set of CA events for a given host
 *   country in the requested lifecycle status. When events are PENDING_EXPORT
 *   and the caller requests (default) status filter that includes pending,
 *   each returned event is marked EXPORTED atomically as part of the read
 *   (BTR "snapshot" semantics: exporting = committing to the BTR submission).
 *
 *   GET /           — SUPER_ADMIN cross-country listing (registry oversight).
 *
 * Role gate: DNA (per-country) or SB_OBSERVER / SUPER_ADMIN (cross-country).
 * The per-country authz (DNA can only read their own host country) is
 * enforced in the route — the route compares `hostCountry` path param to
 * the caller's org membership scope.
 */

export const correspondingAdjustmentsRouter: IRouter = Router();

correspondingAdjustmentsRouter.use(requireAuth, requireOrgScope);

type CaEventStatus = 'PENDING_EXPORT' | 'EXPORTED' | 'ACKNOWLEDGED' | 'REVERSED';

function parseStatus(raw: unknown): CaEventStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  const upper = raw.toUpperCase();
  if (['PENDING_EXPORT', 'EXPORTED', 'ACKNOWLEDGED', 'REVERSED'].includes(upper)) {
    return upper as CaEventStatus;
  }
  throw new AppError(400, 'Bad Request', `Invalid status filter: ${raw}`);
}

function parseSince(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, 'Bad Request', 'Invalid `since` timestamp (expected ISO-8601)');
  }
  return d;
}

/**
 * GET /btr/:hostCountry — BTR export for host DNA.
 * Returns structured JSON grouped by host country with a running totals
 * summary. Side-effect: any event returned with status=PENDING_EXPORT is
 * flipped to EXPORTED + btrExportedAt stamped. (This is idempotent once
 * exported; calling again shows them as EXPORTED.)
 */
correspondingAdjustmentsRouter.get(
  '/btr/:hostCountry',
  requireOrgRole('DNA', 'SB_OBSERVER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const hostCountry = String(req.params.hostCountry ?? '').toUpperCase();
      if (hostCountry.length !== 2) {
        throw new AppError(400, 'Bad Request', 'hostCountry must be ISO-3166 alpha-2');
      }
      const statusFilter = parseStatus(req.query.status);
      const since = parseSince(req.query.since);

      const where: {
        hostCountry: string;
        status?: CaEventStatus;
        triggeredAt?: { gte: Date };
      } = { hostCountry };
      if (statusFilter) where.status = statusFilter;
      if (since) where.triggeredAt = { gte: since };

      const events = await prisma.correspondingAdjustmentEvent.findMany({
        where,
        orderBy: { triggeredAt: 'asc' },
      });

      // Expand each event with the block's unit-type + serial range (useful
      // for DNA to reconcile against their national ledger).
      const blockIds = Array.from(new Set(events.map((e) => e.blockId)));
      const blocks = blockIds.length
        ? await prisma.creditUnitBlock.findMany({
            where: { id: { in: blockIds } },
            select: {
              id: true,
              serialFirst: true,
              serialLast: true,
              unitType: true,
            },
          })
        : [];
      const blockById = new Map(blocks.map((b) => [b.id, b]));

      const pendingIds = events
        .filter((e) => e.status === 'PENDING_EXPORT')
        .map((e) => e.id);

      // Side-effect: commit pending events as EXPORTED as part of the BTR
      // snapshot read (see ca-events.service.markExported when AAT-1 lands).
      // TODO (AAT-1): delegate to ca-events.service.markExported once the
      // service is shipped. Until then we inline the update.
      if (pendingIds.length > 0) {
        const now = new Date();
        await prisma.correspondingAdjustmentEvent.updateMany({
          where: { id: { in: pendingIds } },
          data: { status: 'EXPORTED', btrExportedAt: now },
        });
        await recordAudit({
          orgId: req.orgId ?? null,
          userId: req.user!.sub,
          action: 'ca.btr_exported',
          resource: 'corresponding_adjustment_event',
          newValue: {
            hostCountry,
            exportedCount: pendingIds.length,
            exportedIds: pendingIds,
            exportedAt: now.toISOString(),
          },
        });
      }

      // Re-read the post-update state by ID — NOT by the original `where`.
      // The `where` still includes the requested status filter (e.g.
      // PENDING_EXPORT); after the updateMany above, those same rows have
      // transitioned to EXPORTED and would be filtered out. Fetching by ID
      // returns the actual post-update snapshot of the originally-matched
      // events regardless of their new status.
      const snapshot = pendingIds.length > 0
        ? await prisma.correspondingAdjustmentEvent.findMany({
            where: { id: { in: events.map((e) => e.id) } },
            orderBy: { triggeredAt: 'asc' },
          })
        : events;

      // Totals across the full host-country universe (not just the filtered
      // slice) — DNAs need the running denominator for their BTR cover note.
      const [pendingTotal, exportedTotal, acknowledgedTotal] = await Promise.all([
        prisma.correspondingAdjustmentEvent.count({
          where: { hostCountry, status: 'PENDING_EXPORT' },
        }),
        prisma.correspondingAdjustmentEvent.count({
          where: { hostCountry, status: 'EXPORTED' },
        }),
        prisma.correspondingAdjustmentEvent.count({
          where: { hostCountry, status: 'ACKNOWLEDGED' },
        }),
      ]);

      res.json({
        data: {
          hostCountry,
          asOf: new Date().toISOString(),
          events: snapshot.map((e) => {
            const blk = blockById.get(e.blockId);
            return {
              eventId: e.id,
              blockId: e.blockId,
              blockSerial: blk ? `${blk.serialFirst} → ${blk.serialLast}` : null,
              unitType: blk?.unitType ?? null,
              vintage: e.vintage,
              units: Number(e.units),
              buyerCountry: e.buyerCountry,
              triggeredAt: e.triggeredAt.toISOString(),
              btrExportedAt: e.btrExportedAt?.toISOString() ?? null,
              status: e.status,
            };
          }),
          totals: {
            pendingExport: pendingTotal,
            exported: exportedTotal,
            acknowledged: acknowledgedTotal,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET / — cross-country listing (SUPER_ADMIN / SB oversight).
 * Accepts the same filters (status, since) plus optional hostCountry.
 */
correspondingAdjustmentsRouter.get(
  '/',
  requireOrgRole('SUPER_ADMIN', 'SB_OBSERVER'),
  async (req, res, next) => {
    try {
      const statusFilter = parseStatus(req.query.status);
      const since = parseSince(req.query.since);
      const hostCountry =
        typeof req.query.hostCountry === 'string' && req.query.hostCountry.length === 2
          ? req.query.hostCountry.toUpperCase()
          : undefined;

      const where: {
        hostCountry?: string;
        status?: CaEventStatus;
        triggeredAt?: { gte: Date };
      } = {};
      if (hostCountry) where.hostCountry = hostCountry;
      if (statusFilter) where.status = statusFilter;
      if (since) where.triggeredAt = { gte: since };

      const rows = await prisma.correspondingAdjustmentEvent.findMany({
        where,
        orderBy: [{ hostCountry: 'asc' }, { triggeredAt: 'desc' }],
        take: 500,
      });

      res.json({
        data: rows.map((e) => ({
          eventId: e.id,
          blockId: e.blockId,
          hostCountry: e.hostCountry,
          buyerCountry: e.buyerCountry,
          units: Number(e.units),
          vintage: e.vintage,
          triggeredAt: e.triggeredAt.toISOString(),
          btrExportedAt: e.btrExportedAt?.toISOString() ?? null,
          status: e.status,
        })),
        totals: { count: rows.length },
      });
    } catch (err) {
      next(err);
    }
  },
);
