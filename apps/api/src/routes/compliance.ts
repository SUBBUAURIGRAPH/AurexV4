/**
 * Compliance attestation routes — read + submit attestations against the
 * Aurigraph DLT compliance namespace. AAT-ρ / AV4-376.
 *
 * Mounted at `/api/v1/compliance` from `index.ts`.
 *
 *   GET  /attestations/:id                       single read
 *   GET  /attestations?orgId=&since=&limit=      org-scoped list
 *   POST /attestations                           submit new attestation
 *
 * Auth: every route requires JWT + an org scope; mutating + read routes are
 * gated to ORG_ADMIN / AUDITOR / APPROVER (mirrors the approval inbox gate).
 */

import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as complianceService from '../services/compliance.service.js';

export const complianceRouter: IRouter = Router();

complianceRouter.use(requireAuth, requireOrgScope);

const COMPLIANCE_ROLES = ['ORG_ADMIN', 'AUDITOR', 'APPROVER', 'SUPER_ADMIN'];

// ── Schemas ────────────────────────────────────────────────────────────────

const listSchema = z.object({
  orgId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const submitSchema = z.object({
  activityId: z.string().uuid(),
  kind: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────

/** GET /attestations/:id — fetch a single compliance attestation. */
complianceRouter.get(
  '/attestations/:id',
  requireOrgRole(...COMPLIANCE_ROLES),
  async (req, res, next) => {
    try {
      const row = await complianceService.getAttestation(req.params.id as string);
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /attestations?orgId=&since=&limit= — list attestations for an org. */
complianceRouter.get(
  '/attestations',
  requireOrgRole(...COMPLIANCE_ROLES),
  async (req, res, next) => {
    try {
      const q = listSchema.parse(req.query);
      const targetOrgId = q.orgId ?? req.orgId!;
      const rows = await complianceService.listAttestationsForOrg(targetOrgId, {
        since: q.since ? new Date(q.since) : undefined,
        limit: q.limit,
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /attestations — submit a new attestation for an activity. */
complianceRouter.post(
  '/attestations',
  requireOrgRole(...COMPLIANCE_ROLES),
  async (req, res, next) => {
    try {
      const body = submitSchema.parse(req.body);
      const result = await complianceService.submitAttestationForActivity(
        body.activityId,
        body.kind,
        body.payload ?? {},
      );
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * AAT-FLOW6 — GET /posture
 *
 * High-level compliance-readiness aggregate for the caller's org. Wraps:
 *   • BRSR Core: response count + assurance breakdown
 *   • DPDP: org-member consent rows (granted vs withdrawn)
 *   • Retention: active retention policies (global, not org-scoped, but
 *     surfaces operator intent for the audit trail)
 *   • Regulatory research: last 5 successful runs (admin-driven scans —
 *     org members get a read-only timeline so they know the regulatory
 *     landscape is being monitored)
 *
 * Read-only; any org member can call. Returns shape:
 *   { brsr: {...}, dpdp: {...}, retention: {...}, research: { runs: [...] } }
 */
complianceRouter.get('/posture', async (req, res, next) => {
  try {
    const orgId = req.orgId!;

    // ── BRSR Core posture ───────────────────────────────────────────────
    const brsrRows = await prisma.brsrResponse.findMany({
      where: { orgId },
      select: {
        id: true,
        fiscalYear: true,
        assuranceStatus: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 1000,
    });
    const brsrAssurance: Record<string, number> = {};
    for (const r of brsrRows) {
      brsrAssurance[r.assuranceStatus] =
        (brsrAssurance[r.assuranceStatus] ?? 0) + 1;
    }
    const fiscalYears = Array.from(new Set(brsrRows.map((r) => r.fiscalYear)));

    // ── DPDP consent posture ────────────────────────────────────────────
    // DPDP consent is per-user, not per-org; we scope by the org's members
    // so every org sees a consent-coverage signal that's meaningful to it.
    const memberIds = await prisma.orgMember
      .findMany({
        where: { orgId, isActive: true },
        select: { userId: true },
      })
      .then((rows) => rows.map((r) => r.userId));

    const memberCount = memberIds.length;
    let consentGranted = 0;
    let consentWithdrawn = 0;
    if (memberCount > 0) {
      const [granted, withdrawn] = await Promise.all([
        prisma.consentRecord.count({
          where: { userId: { in: memberIds }, granted: true, withdrawnAt: null },
        }),
        prisma.consentRecord.count({
          where: { userId: { in: memberIds }, withdrawnAt: { not: null } },
        }),
      ]);
      consentGranted = granted;
      consentWithdrawn = withdrawn;
    }

    // ── Retention posture (global policies, surfaced for visibility) ────
    const retentionPolicies = await prisma.retentionPolicy.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        minRetentionYears: true,
        isDefault: true,
      },
      orderBy: { isDefault: 'desc' },
      take: 10,
    });

    // ── Regulatory research timeline ────────────────────────────────────
    const researchRuns = await prisma.regulatoryResearchRun.findMany({
      where: { status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        topic: true,
        depth: true,
        summary: true,
        createdAt: true,
      },
    });

    res.json({
      data: {
        brsr: {
          responseCount: brsrRows.length,
          assuranceBreakdown: brsrAssurance,
          fiscalYearsCovered: fiscalYears,
        },
        dpdp: {
          orgMemberCount: memberCount,
          consentGranted,
          consentWithdrawn,
        },
        retention: {
          activePolicies: retentionPolicies,
        },
        research: {
          runs: researchRuns.map((r) => ({
            id: r.id,
            topic: r.topic,
            depth: r.depth,
            summary: r.summary,
            createdAt: r.createdAt.toISOString(),
          })),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});
