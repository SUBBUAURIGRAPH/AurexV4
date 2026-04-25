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
