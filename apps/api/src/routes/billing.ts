/**
 * AAT-RZP / Wave 7: Razorpay billing routes.
 *
 *   POST /api/v1/billing/checkout                — auth + ORG_ADMIN, returns checkout config
 *   POST /api/v1/billing/checkout/success        — auth, verifies sig + activates (belt-and-braces)
 *   POST /api/v1/billing/webhook/razorpay        — public, signed by Razorpay
 *   GET  /api/v1/billing/subscriptions/me        — auth, returns caller-org's active sub
 *   GET  /api/v1/billing/invoices                — auth, returns caller-org's invoices
 *
 * Webhook is public (no JWT) — Razorpay signs the body with HMAC-SHA256.
 * The route swaps the global `express.json` parser for `express.raw` so
 * we have the exact bytes Razorpay signed; tampered or re-serialised
 * JSON would break the signature.
 *
 * The frontend success callback is BELT-AND-BRACES — the webhook is the
 * authoritative source of truth (Razorpay retries for up to 24h on
 * non-2xx). The success endpoint exists only so the user sees an
 * immediate confirmation rather than waiting for the webhook to land.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import { z } from 'zod';
import { prisma, type SubscriptionPlan } from '@aurex/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import * as subscriptionService from '../services/billing/subscription.service.js';
import { logger } from '../lib/logger.js';

export const billingRouter: IRouter = Router();

// ─── Schemas ───────────────────────────────────────────────────────────

const checkoutSchema = z.object({
  plan: z.enum([
    'MSME_INDIA',
    'ENTERPRISE_INDIA',
    'SME_INTERNATIONAL',
    'ENTERPRISE_INTL',
  ]),
  perSiteCount: z.number().int().min(1).max(10000).optional(),
  couponCode: z.string().trim().min(1).max(64).optional(),
});

const successSchema = z.object({
  razorpayOrderId: z.string().trim().min(1).max(128),
  razorpayPaymentId: z.string().trim().min(1).max(128),
  razorpaySignature: z.string().trim().min(1).max(256),
});

// ─── Helpers ───────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

function requireOrgId(req: Request): string {
  const orgId = req.user?.orgId;
  if (!orgId) {
    throw new AppError(
      403,
      'Forbidden',
      'Caller is not associated with an organization',
    );
  }
  return orgId;
}

// ─── POST /checkout ────────────────────────────────────────────────────

billingRouter.post(
  '/checkout',
  requireAuth,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = checkoutSchema.parse(req.body ?? {});
      const orgId = requireOrgId(req);
      const result = await subscriptionService.startCheckout({
        organizationId: orgId,
        userId: req.user!.sub,
        userEmail: req.user!.email,
        plan: body.plan as SubscriptionPlan,
        perSiteCount: body.perSiteCount,
        couponCode: body.couponCode,
        ipAddress: getClientIp(req),
      });
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /checkout/success ────────────────────────────────────────────

billingRouter.post(
  '/checkout/success',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = successSchema.parse(req.body ?? {});
      const result = await subscriptionService.processPaymentSuccess({
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        razorpaySignature: body.razorpaySignature,
      });
      res.status(200).json({
        data: {
          subscriptionId: result.subscription.id,
          status: result.subscription.status,
          startsAt: result.subscription.startsAt,
          endsAt: result.subscription.endsAt,
          invoiceNumber: result.invoice.invoiceNumber,
          alreadyActive: result.alreadyActive,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /webhook/razorpay ────────────────────────────────────────────
// Public endpoint — the request is signed by Razorpay's webhook secret.
// We override the global express.json parser with express.raw so we have
// the exact bytes that were signed; verifying against a re-serialised
// JSON body would break the HMAC.

billingRouter.post(
  '/webhook/razorpay',
  express.raw({ type: '*/*', limit: '5mb' }),
  async (req: Request, res: Response) => {
    const signature = req.header('x-razorpay-signature') ?? '';
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from('');

    let payload: subscriptionService.RazorpayWebhookPayload | null = null;
    try {
      const parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as { id?: unknown }).id !== 'string' ||
        typeof (parsed as { event?: unknown }).event !== 'string'
      ) {
        throw new Error('malformed webhook payload');
      }
      payload = parsed as subscriptionService.RazorpayWebhookPayload;
    } catch (err) {
      logger.warn({ err }, 'Razorpay webhook body parse failed — acking 200');
      // Razorpay retries on non-2xx for up to 24h; ack and persist nothing
      // for this case (the signature will obviously be invalid for garbage
      // bodies, so there's no real audit value either).
      res.status(200).json({ received: false, error: 'malformed body' });
      return;
    }

    try {
      const result = await subscriptionService.processWebhook({
        rawBody,
        signature,
        payload,
      });

      // ALWAYS 200 to prevent Razorpay retries on app-level errors. Per
      // the Razorpay docs, retries on 5xx will hammer the endpoint for up
      // to 24h. We persisted the event + the processing error already.
      res.status(200).json({
        received: true,
        signatureValid: result.signatureValid,
        duplicate: result.duplicate,
        processed: result.processed,
      });
    } catch (err) {
      logger.error({ err }, 'Razorpay webhook handler crashed — still acking 200');
      res.status(200).json({ received: true, processed: false });
    }
  },
);

// ─── GET /subscriptions/me ─────────────────────────────────────────────

billingRouter.get(
  '/subscriptions/me',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const sub = await subscriptionService.getActiveSubscriptionForOrg(orgId);
      res.json({ data: sub });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /invoices ─────────────────────────────────────────────────────

billingRouter.get(
  '/invoices',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const invoices = await subscriptionService.listInvoicesForOrg(orgId);
      res.json({ data: invoices });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /invoices/:id (AAT-9C / Wave 9c) ──────────────────────────────
// Persistence-audit P0 fix: list endpoint exists but no individual GET,
// so the "Download invoice" button has nothing to call.

async function findInvoiceForOrg(
  invoiceId: string,
  orgId: string,
): Promise<NonNullable<Awaited<ReturnType<typeof prisma.invoice.findFirst>>>> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, subscription: { organizationId: orgId } },
  });
  if (!invoice) {
    throw new AppError(404, 'Not Found', 'Invoice not found');
  }
  return invoice;
}

billingRouter.get(
  '/invoices/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const invoice = await findInvoiceForOrg(req.params.id as string, orgId);
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /invoices/:id/download (AAT-9C / Wave 9c) ─────────────────────
// Mirrors the report-download pattern (commit 2a06d69): JSON envelope +
// Content-Disposition: attachment so the browser triggers a real
// download dialog instead of rendering inline. CSV/PDF formats are a
// Wave 11 follow-up.

billingRouter.get(
  '/invoices/:id/download',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const invoice = await findInvoiceForOrg(req.params.id as string, orgId);
      const filename = `invoice-${invoice.invoiceNumber}.json`;
      const payload = JSON.stringify(
        {
          invoice: {
            id: invoice.id,
            subscriptionId: invoice.subscriptionId,
            invoiceNumber: invoice.invoiceNumber,
            currency: invoice.currency,
            subtotalMinor: invoice.subtotalMinor,
            discountMinor: invoice.discountMinor,
            taxMinor: invoice.taxMinor,
            totalMinor: invoice.totalMinor,
            status: invoice.status,
            issuedAt: invoice.issuedAt,
            paidAt: invoice.paidAt,
            metadata: invoice.metadata,
          },
          exportedAt: new Date().toISOString(),
        },
        null,
        2,
      );
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(payload, 'utf-8').toString());
      res.send(payload);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /renewal-attempts (AAT-9C / Wave 9c) ──────────────────────────
// Persistence-audit P1: admin-only list with optional status filter.
// Org-scoped via the parent Subscription's organizationId.

const renewalAttemptStatusSchema = z.enum([
  'PENDING',
  'EMAIL_SENT',
  'PAID',
  'FAILED',
  'CANCELLED',
]);

const renewalAttemptsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: renewalAttemptStatusSchema.optional(),
});

billingRouter.get(
  '/renewal-attempts',
  requireAuth,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const { page, pageSize, status } = renewalAttemptsQuerySchema.parse(req.query);
      const where = {
        subscription: { organizationId: orgId },
        ...(status ? { status } : {}),
      };
      const skip = (page - 1) * pageSize;

      const [items, total] = await Promise.all([
        prisma.renewalAttempt.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.renewalAttempt.count({ where }),
      ]);

      res.json({ data: { items, total, page, pageSize } });
    } catch (err) {
      next(err);
    }
  },
);
