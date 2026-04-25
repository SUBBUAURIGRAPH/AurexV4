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
import type { SubscriptionPlan } from '@aurex/database';
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

// ─── GET /invoices/:id ─────────────────────────────────────────────────
// AAT-10B / Wave 10b: single invoice scoped to the caller's org. We surface
// cross-org access as 404 to avoid leaking existence across tenants.

billingRouter.get(
  '/invoices/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const invoiceId = String(req.params.id ?? '');
      if (!invoiceId) {
        throw new AppError(400, 'Bad Request', 'Missing invoice id');
      }
      const invoice = await subscriptionService.getInvoiceForOrg(orgId, invoiceId);
      if (!invoice) {
        throw new AppError(404, 'Not Found', `Invoice ${invoiceId} not found`);
      }
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /invoices/:id/download ────────────────────────────────────────
// AAT-10B / Wave 10b: invoice download. MVP serves the invoice JSON as a
// downloadable file (Content-Disposition: attachment) so the operator's
// downstream PDF tooling has a single, stable contract to bind to. A PDF
// renderer is a follow-up.

billingRouter.get(
  '/invoices/:id/download',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const invoiceId = String(req.params.id ?? '');
      if (!invoiceId) {
        throw new AppError(400, 'Bad Request', 'Missing invoice id');
      }
      const invoice = await subscriptionService.getInvoiceForOrg(orgId, invoiceId);
      if (!invoice) {
        throw new AppError(404, 'Not Found', `Invoice ${invoiceId} not found`);
      }
      const filename = `${invoice.invoiceNumber}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      // Use res.end() rather than res.send() so Express does not re-set the
      // Content-Type header to text/html behind our back when the body is a
      // plain string.
      res.status(200).end(JSON.stringify(invoice, null, 2));
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /subscriptions/me/cancel ─────────────────────────────────────
// AAT-10B / Wave 10b: operator-initiated cancellation. Idempotent — a
// second call against an already-CANCELLED sub returns 200 with the same
// row. Caller's current paid period continues until `endsAt`; no refund.

billingRouter.post(
  '/subscriptions/me/cancel',
  requireAuth,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const sub = await subscriptionService.cancelSubscriptionForOrg(orgId);
      if (!sub) {
        throw new AppError(
          404,
          'Not Found',
          'No subscription found for this organization',
        );
      }
      res.status(200).json({ data: sub });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /renewal-attempts/:id ─────────────────────────────────────────
// AAT-10B / Wave 10b: single renewal attempt scoped to the caller's org.
// Used by the renewal-payment landing page that the renewal email links to.

billingRouter.get(
  '/renewal-attempts/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const renewalAttemptId = String(req.params.id ?? '');
      if (!renewalAttemptId) {
        throw new AppError(400, 'Bad Request', 'Missing renewal-attempt id');
      }
      const attempt = await subscriptionService.getRenewalAttemptForOrg(
        orgId,
        renewalAttemptId,
      );
      if (!attempt) {
        throw new AppError(
          404,
          'Not Found',
          `Renewal attempt ${renewalAttemptId} not found`,
        );
      }
      res.json({ data: attempt });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /renewal-attempts/:id/checkout ───────────────────────────────
// AAT-10B / Wave 10b: re-mint (or re-use) the Razorpay order for an
// existing renewal attempt. The frontend renewal-payment page calls this
// when the customer clicks "Renew now". Idempotent: if the existing
// `renewalAttempt.razorpayOrderId` still resolves to a CREATED order we
// return its config; otherwise we let `startRenewalCheckout` mint a fresh
// order on the same row.

billingRouter.post(
  '/renewal-attempts/:id/checkout',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = requireOrgId(req);
      const renewalAttemptId = String(req.params.id ?? '');
      if (!renewalAttemptId) {
        throw new AppError(400, 'Bad Request', 'Missing renewal-attempt id');
      }
      const attempt = await subscriptionService.getRenewalAttemptForOrg(
        orgId,
        renewalAttemptId,
      );
      if (!attempt) {
        throw new AppError(
          404,
          'Not Found',
          `Renewal attempt ${renewalAttemptId} not found`,
        );
      }
      // Mint (or re-use) a Razorpay order for the parent subscription. The
      // service throws RenewalInFlightError when an in-flight order exists
      // for the same window; we recover by surfacing the existing order
      // shape so the customer can complete payment without a 409.
      let result: subscriptionService.StartRenewalCheckoutResult;
      try {
        result = await subscriptionService.startRenewalCheckout(
          attempt.subscriptionId,
        );
      } catch (err) {
        if (err instanceof subscriptionService.RenewalInFlightError) {
          // Re-use existing order. This branch fires when this attempt is
          // already PENDING/EMAIL_SENT — we just return the existing order
          // metadata so the SDK modal can open against it.
          if (!attempt.razorpayOrderId) throw err;
          // Public key id comes from the live Razorpay client (server-side
          // single source of truth).
          const { getRazorpayClient } = await import(
            '../services/billing/razorpay-client.js'
          );
          const client = getRazorpayClient();
          res.status(200).json({
            data: {
              renewalAttemptId: attempt.id,
              orderId: attempt.razorpayOrderId,
              keyId: client.publicKeyId,
              amount: attempt.amountMinor,
              currency: attempt.currency,
              periodStart: attempt.periodStart,
              periodEnd: attempt.periodEnd,
              reused: true,
            },
          });
          return;
        }
        throw err;
      }
      const { getRazorpayClient } = await import(
        '../services/billing/razorpay-client.js'
      );
      const client = getRazorpayClient();
      res.status(200).json({
        data: {
          renewalAttemptId: result.renewalAttemptId,
          orderId: result.razorpayOrderId,
          keyId: client.publicKeyId,
          amount: result.amount,
          currency: result.currency,
          periodStart: result.periodStart,
          periodEnd: result.periodEnd,
          reused: false,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
