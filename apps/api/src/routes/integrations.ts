/**
 * AAT-FLOW6 — integrations status read endpoint.
 *
 * Mounted at `/api/v1/integrations/status`. Read-only aggregate so the
 * frontend Operations → Integrations page has something honest to show
 * before a full integration-marketplace lands.
 *
 * Composes two views:
 *   1. `federationPartners` — public-key trust roster from FederationKey
 *      (publicKeyPem deliberately omitted; we surface partner code, keyId,
 *      isActive, expiresAt). Org members read this so they can confirm
 *      whether AWD2 / HCE2 / Aurigraph DLT are wired.
 *   2. `services` — env-var presence checks for the three external SaaS
 *      vendors we depend on (Razorpay, email transport, Sumsub KYC). We
 *      do not call upstream — just check the config flag — to keep this
 *      endpoint cheap and side-effect-free.
 *
 * Auth: requires JWT + an org scope. Any org member can read; the data
 * is non-sensitive (no secrets — just partner codes + boolean status
 * flags).
 */

import { Router, type IRouter } from 'express';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';

export const integrationsRouter: IRouter = Router();

integrationsRouter.use(requireAuth, requireOrgScope);

interface FederationPartnerRow {
  partner: 'AWD2' | 'HCE2' | 'AURIGRAPH';
  keyId: string;
  isActive: boolean;
  expiresAt: string | null;
  rotatedAt: string | null;
}

interface ServiceStatus {
  code: 'razorpay' | 'email' | 'sumsub';
  name: string;
  category: string;
  configured: boolean;
  detail: string;
}

interface IntegrationsStatusResponse {
  federationPartners: FederationPartnerRow[];
  services: ServiceStatus[];
}

function emailTransportDetail(): { configured: boolean; detail: string } {
  const transport = (process.env.EMAIL_TRANSPORT ?? 'ses').toLowerCase();
  const sesMock = process.env.AWS_SES_MOCK_MODE === '1';
  const mandrillMock = process.env.MANDRILL_MOCK_MODE === '1';
  if (transport === 'mandrill') {
    const hasKey = Boolean(process.env.MANDRILL_API_KEY);
    if (mandrillMock) return { configured: true, detail: 'Mandrill (mock mode)' };
    return {
      configured: hasKey,
      detail: hasKey ? 'Mandrill Transactional' : 'Mandrill (key missing)',
    };
  }
  // default: ses
  if (sesMock) return { configured: true, detail: 'AWS SES (mock mode)' };
  const region = process.env.AWS_REGION ?? 'ap-south-1';
  const hasAwsCreds =
    Boolean(process.env.AWS_ACCESS_KEY_ID) || Boolean(process.env.AWS_PROFILE);
  return {
    configured: hasAwsCreds,
    detail: hasAwsCreds ? `AWS SES (${region})` : 'AWS SES (creds missing)',
  };
}

integrationsRouter.get('/status', async (_req, res, next) => {
  try {
    const keys = await prisma.federationKey.findMany({
      where: { isActive: true },
      orderBy: [{ partner: 'asc' }, { createdAt: 'desc' }],
      select: {
        partner: true,
        keyId: true,
        isActive: true,
        expiresAt: true,
        rotatedAt: true,
      },
    });

    const federationPartners: FederationPartnerRow[] = keys.map((k) => ({
      partner: k.partner as 'AWD2' | 'HCE2' | 'AURIGRAPH',
      keyId: k.keyId,
      isActive: k.isActive,
      expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
      rotatedAt: k.rotatedAt ? k.rotatedAt.toISOString() : null,
    }));

    const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID);
    const email = emailTransportDetail();
    const sumsubConfigured = Boolean(
      process.env.SUMSUB_APP_TOKEN || process.env.SUMSUB_SECRET_KEY,
    );

    const services: ServiceStatus[] = [
      {
        code: 'razorpay',
        name: 'Razorpay',
        category: 'Payments',
        configured: razorpayConfigured,
        detail: razorpayConfigured
          ? 'Razorpay Checkout + Subscriptions'
          : 'RAZORPAY_KEY_ID not set',
      },
      {
        code: 'email',
        name: 'Email transport',
        category: 'Notifications',
        ...email,
      },
      {
        code: 'sumsub',
        name: 'Sumsub',
        category: 'KYC / AML',
        configured: sumsubConfigured,
        detail: sumsubConfigured
          ? 'Sumsub KYC / sanctions screening'
          : 'SUMSUB_APP_TOKEN not set',
      },
    ];

    const body: IntegrationsStatusResponse = {
      federationPartners,
      services,
    };
    res.json({ data: body });
  } catch (err) {
    next(err);
  }
});
