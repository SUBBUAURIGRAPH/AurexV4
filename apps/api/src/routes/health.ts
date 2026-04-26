import { Router, type IRouter } from 'express';
import { prisma } from '@aurex/database';
import {
  SESv2Client,
  GetEmailIdentityCommand,
} from '@aws-sdk/client-sesv2';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import {
  MandrillTransport,
  MandrillKeyMissingError,
} from '../services/email/mandrill-transport.js';
import type { EmailProvider } from '../services/email/transport.js';

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
  /** Active outbound transport — driven by `EMAIL_TRANSPORT` (default `ses`). */
  provider: EmailProvider;
  from: string;
  replyTo: string;
  region: string;
  awsCredentialsResolved: boolean;
  sesIdentityVerified: boolean | 'unknown';
  /** AAT-MANDRILL: whether `MANDRILL_API_KEY` is present in the runtime env. */
  mandrillKeyResolved: boolean;
  /** AAT-MANDRILL: whether the `users/ping.json` probe succeeded ('PONG!'). */
  mandrillIdentityVerified: boolean | 'unknown';
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

/**
 * Resolve which transport is "active" for this runtime. Mirrors
 * `transport.getTransport()` resolution but is duplicated here so the
 * route module doesn't need to instantiate either client just to read
 * the env var.
 */
function resolveActiveProvider(): EmailProvider {
  const raw = process.env.EMAIL_TRANSPORT;
  return raw === 'mandrill' ? 'mandrill' : 'ses';
}

/**
 * AAT-MANDRILL: probe the Mandrill `users/ping.json` endpoint when the
 * key is present. Returns three states identical to `probeSesIdentity`:
 *   - true       : key valid, ping returned 'PONG!'.
 *   - false      : key invalid (4xx) or response not 'PONG!'.
 *   - 'unknown'  : network failure / can't reach Mandrill.
 *
 * Returns 'unknown' (rather than throwing) if the key is missing — the
 * caller surfaces that separately via `mandrillKeyResolved`.
 */
async function probeMandrillIdentity(): Promise<boolean | 'unknown'> {
  if (!process.env.MANDRILL_API_KEY) return 'unknown';
  try {
    const transport = new MandrillTransport();
    return await transport.ping();
  } catch (err) {
    if (err instanceof MandrillKeyMissingError) return 'unknown';
    logger.debug({ err }, 'Mandrill ping probe failed');
    return 'unknown';
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
    const provider = resolveActiveProvider();
    const mandrillKeyResolved = Boolean(process.env.MANDRILL_API_KEY);

    // Test-mode stub — keeps unit tests deterministic and offline.
    // Either SES or Mandrill mock mode produces a deterministic payload.
    if (
      process.env.AWS_SES_MOCK_MODE === '1' ||
      process.env.MANDRILL_MOCK_MODE === '1'
    ) {
      const stub: EmailHealthResponse = {
        provider,
        from,
        replyTo,
        region,
        awsCredentialsResolved: true,
        sesIdentityVerified: true,
        mandrillKeyResolved,
        mandrillIdentityVerified:
          process.env.MANDRILL_MOCK_MODE === '1' ? true : 'unknown',
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

    // Identity probes — only run the active transport's probe with full
    // weight. The inactive transport's status is reported best-effort
    // (so a Mandrill-only deployment still gets visibility into AWS
    // creds and vice-versa) but failure of the inactive probe must NOT
    // fail the endpoint.
    const safeUnknown = (): boolean | 'unknown' => 'unknown';
    const sesIdentityVerified: boolean | 'unknown' =
      provider === 'ses'
        ? awsCredentialsResolved
          ? await probeSesIdentity(region, from)
          : 'unknown'
        : awsCredentialsResolved
          ? await probeSesIdentity(region, from).catch(safeUnknown)
          : 'unknown';

    const mandrillIdentityVerified: boolean | 'unknown' =
      provider === 'mandrill'
        ? await probeMandrillIdentity()
        : mandrillKeyResolved
          ? await probeMandrillIdentity().catch(safeUnknown)
          : 'unknown';

    const body: EmailHealthResponse = {
      provider,
      from,
      replyTo,
      region,
      awsCredentialsResolved,
      sesIdentityVerified,
      mandrillKeyResolved,
      mandrillIdentityVerified,
      lastSendOk: summary.lastSendOk,
      lastSendError: summary.lastSendError,
      outboundQueue24h: summary.outboundQueue24h,
    };
    return res.json(body);
  },
);
