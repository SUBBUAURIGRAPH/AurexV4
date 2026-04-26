/**
 * AAT-367 / AV4-367 — admin operational endpoints for federation key
 * management. SUPER_ADMIN only.
 *
 *   POST   /api/v1/admin/federation/keys                   — register key
 *   GET    /api/v1/admin/federation/keys                   — list (any status)
 *   POST   /api/v1/admin/federation/keys/:id/rotate        — flip isActive=false + rotatedAt=now
 *   POST   /api/v1/admin/federation/keys/:id/deactivate    — soft delete
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { recordAudit } from '../services/audit-log.service.js';

export const adminFederationRouter: IRouter = Router();

adminFederationRouter.use(requireAuth, requireRole('SUPER_ADMIN'));

// ── Schemas ──────────────────────────────────────────────────────────────

const partnerSchema = z.enum(['AWD2', 'HCE2', 'AURIGRAPH']);

const createKeySchema = z.object({
  partner: partnerSchema,
  keyId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_.\-:]+$/, 'keyId must be [A-Za-z0-9_.:-]'),
  publicKeyPem: z
    .string()
    .min(50)
    .max(8192)
    .refine(
      (v) =>
        v.includes('BEGIN PUBLIC KEY') ||
        v.includes('BEGIN RSA PUBLIC KEY') ||
        v.includes('BEGIN CERTIFICATE'),
      { message: 'publicKeyPem must be a PEM-encoded public key' },
    ),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(2000).optional(),
});

// ── POST /keys (register) ────────────────────────────────────────────────

adminFederationRouter.post(
  '/keys',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createKeySchema.parse(req.body);

      const existing = await prisma.federationKey.findUnique({
        where: { keyId: body.keyId },
        select: { id: true },
      });
      if (existing) {
        throw new AppError(
          409,
          'Conflict',
          `Federation key with keyId ${body.keyId} already exists`,
        );
      }

      const created = await prisma.federationKey.create({
        data: {
          partner: body.partner,
          keyId: body.keyId,
          publicKeyPem: body.publicKeyPem,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          notes: body.notes ?? null,
        },
        select: {
          id: true,
          partner: true,
          keyId: true,
          algorithm: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      await recordAudit({
        userId: req.user?.sub ?? null,
        action: 'federation.key.create',
        resource: 'FederationKey',
        resourceId: created.id,
        newValue: { partner: created.partner, keyId: created.keyId },
      });

      res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /keys ────────────────────────────────────────────────────────────

adminFederationRouter.get(
  '/keys',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rows = await prisma.federationKey.findMany({
        orderBy: [{ partner: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          partner: true,
          keyId: true,
          algorithm: true,
          isActive: true,
          rotatedAt: true,
          expiresAt: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          // publicKeyPem deliberately omitted from listings to keep the
          // row payload small. Fetch a single row by id if you need
          // the PEM (not implemented — operators install via POST).
        },
      });
      res.status(200).json({ data: rows, count: rows.length });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /keys/:id/rotate ────────────────────────────────────────────────

const idParamSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});

adminFederationRouter.post(
  '/keys/:id/rotate',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);

      const existing = await prisma.federationKey.findUnique({
        where: { id },
        select: { id: true, isActive: true, partner: true, keyId: true },
      });
      if (!existing) {
        throw new AppError(404, 'Not Found', `Federation key ${id} not found`);
      }

      const updated = await prisma.federationKey.update({
        where: { id },
        data: {
          isActive: false,
          rotatedAt: new Date(),
        },
        select: {
          id: true,
          partner: true,
          keyId: true,
          isActive: true,
          rotatedAt: true,
        },
      });

      await recordAudit({
        userId: req.user?.sub ?? null,
        action: 'federation.key.rotate',
        resource: 'FederationKey',
        resourceId: id,
        oldValue: { isActive: existing.isActive },
        newValue: { isActive: false, rotatedAt: updated.rotatedAt?.toISOString() ?? null },
      });

      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /keys/:id/deactivate ────────────────────────────────────────────

adminFederationRouter.post(
  '/keys/:id/deactivate',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const existing = await prisma.federationKey.findUnique({
        where: { id },
        select: { id: true, isActive: true },
      });
      if (!existing) {
        throw new AppError(404, 'Not Found', `Federation key ${id} not found`);
      }

      const updated = await prisma.federationKey.update({
        where: { id },
        data: { isActive: false },
        select: { id: true, partner: true, keyId: true, isActive: true },
      });

      await recordAudit({
        userId: req.user?.sub ?? null,
        action: 'federation.key.deactivate',
        resource: 'FederationKey',
        resourceId: id,
        oldValue: { isActive: existing.isActive },
        newValue: { isActive: false },
      });

      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);
