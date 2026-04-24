import { Router, type IRouter } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as pddService from '../services/pdd.service.js';

/**
 * AV4-335: PDD (Project Design Document) routes.
 *
 * Layout:
 *   GET  /pdds/:activityId                      → fetch current PDD
 *   PUT  /pdds/:activityId                      → upsert content (MANAGER+); 409 if locked
 *   GET  /pdds/:activityId/versions             → version history
 *   POST /pdds/:activityId/submit               → lock the current version
 *   POST /pdds/:activityId/attachments/sign     → stub pre-signed URL for attachments
 */
export const pddsRouter: IRouter = Router();

pddsRouter.use(requireAuth, requireOrgScope);

const WRITE_ROLES = ['ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN'];

const upsertSchema = z.object({
  content: z.unknown(),
});

const attachmentSignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128).optional(),
  sizeBytes: z.number().int().positive().max(500 * 1024 * 1024).optional(),
});

pddsRouter.get('/:activityId', async (req, res, next) => {
  try {
    const pdd = await pddService.getPdd(req.params.activityId as string, req.orgId!);
    res.json({ data: pdd });
  } catch (err) {
    next(err);
  }
});

pddsRouter.get('/:activityId/versions', async (req, res, next) => {
  try {
    const versions = await pddService.listPddVersions(
      req.params.activityId as string,
      req.orgId!,
    );
    res.json({ data: versions });
  } catch (err) {
    next(err);
  }
});

pddsRouter.put('/:activityId', requireOrgRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const body = upsertSchema.parse(req.body);
    const pdd = await pddService.upsertPdd({
      activityId: req.params.activityId as string,
      orgId: req.orgId!,
      content: body.content,
      userId: req.user!.sub,
    });
    res.json({ data: pdd });
  } catch (err) {
    next(err);
  }
});

pddsRouter.post(
  '/:activityId/submit',
  requireOrgRole(...WRITE_ROLES),
  async (req, res, next) => {
    try {
      const pdd = await pddService.submitPdd(
        req.params.activityId as string,
        req.orgId!,
        req.user!.sub,
      );
      res.json({ data: pdd });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /:activityId/attachments/sign — stub pre-signed upload URL.
 *
 * AV4-335 ships the PDD Tab 9 attachments UI against this shim. The real
 * blob store (S3 / Backblaze B2) lands in AV4-338 — at which point this
 * handler gets swapped for an actual AWS SDK `createPresignedPost` /
 * Backblaze `getUploadUrl` call. Until then we return a deterministic
 * `file://` placeholder + a fresh UUID so the frontend can persist the
 * attachment metadata row in `content.attachments`.
 */
pddsRouter.post(
  '/:activityId/attachments/sign',
  requireOrgRole(...WRITE_ROLES),
  async (req, res, next) => {
    try {
      // Validate activity belongs to the caller's org — reuse getPdd guard.
      await pddService.getPdd(req.params.activityId as string, req.orgId!);
      const body = attachmentSignSchema.parse(req.body);
      const attachmentId = randomUUID();
      const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      res.json({
        data: {
          attachmentId,
          uploadUrl: `file:///stub/pdd-attachments/${attachmentId}/${safeName}`,
          method: 'PUT',
          headers: { 'Content-Type': body.contentType ?? 'application/octet-stream' },
          note: 'upload stub — replace with pre-signed S3/Backblaze URL when AV4-338 blob store is provisioned',
          expiresIn: 900,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
