import { Router, type IRouter } from 'express';
import { prisma } from '@aurex/database';
import {
  SESv2Client,
  GetEmailIdentityCommand,
} from '@aws-sdk/client-sesv2';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

export const healthRouter: IRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'aurexv4-api',
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get('/ready', async (_req, res) => {
  let dbReady = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }

  const checks = {
    database: dbReady ? 'up' : 'down',
    cache: process.env.REDIS_URL ? 'configured_not_checked' : 'disabled',
  };

  if (!dbReady) {
    return res.status(503).json({
      ready: false,
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    ready: true,
    checks,
    timestamp: new Date().toISOString(),
  });
});

// ───────────────────────────────────────────────────────────────────────
// AAT-11C / Wave 11c — /health/email
//
// Diagnostic endpoint for the SES outbound transport. Auth-gated to
// SUPER_ADMIN because the response leaks operational metadata (sender
// address, region, recent failure messages) that we don't want
// crawler-visible.
//
// Three things we probe:
//   1. AWS credentials resolvable via the standard provider chain?
//      We invoke @aws-sdk/credential-provider-node `defaultProvider`
//      and treat any throw as "unresolved" (sandbox / unset env).
//   2. Sender identity verified in SES?
//      Call SESv2 GetEmailIdentity for AURIGRAPH_EMAIL_FROM. If we
//      can't reach SES at all (no creds, network), surface 'unknown'
//      so ops can distinguish "not verified" from "we don't know".
//   3. OutboundEmail audit table — last SENT, last FAILED, plus
//      24h sent/failed/pending counts so ops have a quick dashboard.
//
// Test-mode short-circuit: AWS_SES_MOCK_MODE=1 returns a fully-populated
// stub so route tests don't need network or real credentials.
// ───────────────────────────────────────────────────────────────────────

interface EmailHealthResponse {
  from: string;
  replyTo: string;
  region: string;
  awsCredentialsResolved: boolean;
  sesIdentityVerified: boolean | 'unknown';
  lastSendOk: string | null;
  lastSendError: string | null;
  outboundQueue24h: { sent: number; failed: number; pending: number };
}

async function probeAwsCredentials(): Promise<boolean> {
  try {
    const provider = defaultProvider();
    const creds = await provider();
    return Boolean(creds?.accessKeyId);
  } catch {
    return false;
  }
}

async function probeSesIdentity(
  region: string,
  identity: string,
): Promise<boolean | 'unknown'> {
  try {
    const client = new SESv2Client({ region });
    const out = await client.send(
      new GetEmailIdentityCommand({ EmailIdentity: identity }),
    );
    // SES surfaces a boolean on the v2 response. Treat anything other
    // than an explicit `true` as "not verified".
    return out.VerifiedForSendingStatus === true;
  } catch (err) {
    // No creds, network failure, or SES throttling → ops can't act on
    // this without more context, so return 'unknown' rather than
    // pretending the identity is broken.
    logger.debug({ err, identity }, 'SES GetEmailIdentity probe failed');
    return 'unknown';
  }
}

async function loadOutboundSummary(): Promise<{
  lastSendOk: string | null;
  lastSendError: string | null;
  outboundQueue24h: { sent: number; failed: number; pending: number };
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const [lastSent, lastFailed, sent, failed, pending] = await Promise.all([
      prisma.outboundEmail.findFirst({
        where: { status: 'SENT' },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
      }),
      prisma.outboundEmail.findFirst({
        where: { status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        select: { errorMessage: true },
      }),
      prisma.outboundEmail.count({
        where: { status: 'SENT', createdAt: { gte: since } },
      }),
      prisma.outboundEmail.count({
        where: { status: 'FAILED', createdAt: { gte: since } },
      }),
      prisma.outboundEmail.count({
        where: { status: 'PENDING', createdAt: { gte: since } },
      }),
    ]);
    return {
      lastSendOk: lastSent?.sentAt?.toISOString() ?? null,
      lastSendError: lastFailed?.errorMessage ?? null,
      outboundQueue24h: { sent, failed, pending },
    };
  } catch (err) {
    logger.warn({ err }, '/health/email — OutboundEmail summary failed');
    return {
      lastSendOk: null,
      lastSendError: null,
      outboundQueue24h: { sent: 0, failed: 0, pending: 0 },
    };
  }
}

healthRouter.get(
  '/email',
  requireAuth,
  requireRole('super_admin'),
  async (_req, res) => {
    const region = process.env.AWS_REGION ?? 'ap-south-1';
    const from = process.env.AURIGRAPH_EMAIL_FROM ?? 'noreply@aurex.in';
    const replyTo =
      process.env.AURIGRAPH_EMAIL_REPLY_TO ?? 'contact@aurex.in';

    // Test-mode stub — keeps unit tests deterministic and offline.
    if (process.env.AWS_SES_MOCK_MODE === '1') {
      const stub: EmailHealthResponse = {
        from,
        replyTo,
        region,
        awsCredentialsResolved: true,
        sesIdentityVerified: true,
        lastSendOk: new Date().toISOString(),
        lastSendError: null,
        outboundQueue24h: { sent: 1, failed: 0, pending: 0 },
      };
      return res.json(stub);
    }

    // Run probes in parallel — they're all I/O and independent.
    const [awsCredentialsResolved, summary] = await Promise.all([
      probeAwsCredentials(),
      loadOutboundSummary(),
    ]);

    // Identity probe needs creds to be useful; if creds unresolved we
    // skip the SES call and report 'unknown' without burning a request.
    const sesIdentityVerified: boolean | 'unknown' = awsCredentialsResolved
      ? await probeSesIdentity(region, from)
      : 'unknown';

    const body: EmailHealthResponse = {
      from,
      replyTo,
      region,
      awsCredentialsResolved,
      sesIdentityVerified,
      lastSendOk: summary.lastSendOk,
      lastSendError: summary.lastSendError,
      outboundQueue24h: summary.outboundQueue24h,
    };
    return res.json(body);
  },
);
