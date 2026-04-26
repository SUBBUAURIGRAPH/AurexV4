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
import {
  getAurigraphAdapter,
  type AurigraphDltAdapter,
} from '../services/chains/aurigraph-dlt-adapter.js';
import { getAurigraphClient } from '../lib/aurigraph-client.js';
import type { CapabilitiesResponse, MintQuota } from '@aurigraph/dlt-sdk';
// AAT-DEEPRESEARCH — Google Deep Research (Gemini) health probe.
import { getProvider as getResearchProvider } from '../services/research/research.service.js';
import {
  loadLastRunSummary as loadResearchLastRunSummary,
  loadRunsLast24h as loadResearchRunsLast24h,
} from '../services/research/research.service.js';

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

// ───────────────────────────────────────────────────────────────────────
// AAT-371 / AV4-371 — /health/aurigraph
//
// Diagnostic endpoint for the Aurigraph DLT tenant connection. Auth-gated
// to SUPER_ADMIN because the response leaks tenant + quota metadata. Same
// shape as /health/email (Wave 11c) so ops can dashboard both with the
// same poller.
//
// Five things we probe:
//   1. apiKeyResolved : `AURIGRAPH_API_KEY` non-empty in the runtime env.
//   2. tenantId       : `AURIGRAPH_TENANT_ID` env var (operational only —
//                       the SDK 1.2.0 transport itself does not yet pin a
//                       tenant header beyond the api key, so this exists
//                       for operator visibility + the onboarding script).
//   3. tierQuota      : `aurigraphAdapter.getQuota()` (calls
//                       `client.tier.getQuota()`). Maps the SDK's MintQuota
//                       shape onto a {monthlyCalls, used, remaining,
//                       resetAt} envelope ops can dashboard.
//   4. ucCarbonCapability : Calls `client.sdk.capabilities()` — the SDK
//                       handshake surface that returns the app's approved
//                       scopes + endpoint allow-list. We treat UC_CARBON
//                       as enabled when EITHER `approvedScopes` contains
//                       a UC_CARBON-prefixed scope OR any endpoint path
//                       contains `UC_CARBON`. Returns 'unknown' if the
//                       handshake call fails (no creds, network) so ops
//                       can distinguish "not enabled" from "we don't
//                       know".
//   5. lastCallOk / lastCallError / callsLast24h: aggregated from the
//      `aurigraph_call_logs` audit table (Wave 1 / AAT-β).
//
// Test-mode short-circuit: AURIGRAPH_MOCK_MODE=1 returns a fully-populated
// stub so route tests don't need network or real credentials.
// ───────────────────────────────────────────────────────────────────────

interface AurigraphTierQuota {
  monthlyCalls: number;
  used: number;
  remaining: number;
  resetAt: string | null;
}

interface AurigraphHealthResponse {
  baseUrl: string;
  tenantId: string | null;
  apiKeyResolved: boolean;
  channelId: string;
  tierQuota: AurigraphTierQuota | null;
  ucCarbonCapability: boolean | 'unknown';
  ucCarbonChainId: string | null;
  lastCallOk: string | null;
  lastCallError: string | null;
  callsLast24h: {
    success: number;
    failed: number;
    retried: number;
    pending: number;
  };
}

const DEFAULT_AURIGRAPH_BASE_URL = 'https://dlt.aurigraph.io';
const DEFAULT_AURIGRAPH_CHANNEL_ID = 'marketplace-channel';

/**
 * Map the SDK's MintQuota shape onto the operational envelope. The SDK
 * exposes monthly mint limits + remaining (no reset timestamp yet — the
 * V11 quota endpoint resets on calendar-month boundaries server-side, so
 * we surface `null` until the SDK adds it).
 */
function tierQuotaFromMintQuota(q: MintQuota): AurigraphTierQuota {
  return {
    monthlyCalls: q.mintMonthlyLimit,
    used: q.mintMonthlyUsed,
    remaining: q.mintMonthlyRemaining,
    resetAt: null,
  };
}

/**
 * Inspect an SDK CapabilitiesResponse and decide whether UC_CARBON is in
 * the app's approved surface. Two signals — either is sufficient:
 *   1. Any approved scope contains the literal `UC_CARBON` (e.g.
 *      `UC_CARBON.contracts.deploy` in the V11 scope grammar).
 *   2. Any endpoint path or description contains `UC_CARBON`.
 */
function detectUcCarbonInCapabilities(caps: CapabilitiesResponse): boolean {
  for (const scope of caps.approvedScopes ?? []) {
    if (scope.includes('UC_CARBON')) return true;
  }
  for (const ep of caps.endpoints ?? []) {
    if (ep.path?.includes('UC_CARBON')) return true;
    if (ep.description?.includes('UC_CARBON')) return true;
    if (ep.requiredScope?.includes('UC_CARBON')) return true;
  }
  return false;
}

/**
 * Best-effort UC_CARBON capability probe. Returns:
 *   - true       : capability detected in the SDK's handshake surface.
 *   - false      : handshake succeeded but UC_CARBON not present.
 *   - 'unknown'  : handshake threw (no creds, network failure, or the
 *                  V11 server rejected the call).
 *
 * We deliberately do NOT do a `contracts.deploy({ dryRun: true })` probe
 * — the 1.2.0 SDK does not expose `dryRun`, and a real deploy would
 * consume mint quota. The handshake `capabilities` call is read-only
 * and quota-free.
 */
async function probeUcCarbonCapability(): Promise<boolean | 'unknown'> {
  try {
    const client = getAurigraphClient();
    const caps = await client.sdk.capabilities();
    return detectUcCarbonInCapabilities(caps);
  } catch (err) {
    logger.debug({ err }, 'Aurigraph capabilities probe failed');
    return 'unknown';
  }
}

/**
 * Best-effort tier-quota probe. Adapter call already swallows audit-log
 * failures and surfaces SDK errors; we just translate "any throw" into
 * `null` so the response envelope stays a valid health document.
 */
async function probeTierQuota(
  adapter: AurigraphDltAdapter,
): Promise<AurigraphTierQuota | null> {
  try {
    const q = await adapter.getQuota();
    return tierQuotaFromMintQuota(q);
  } catch (err) {
    logger.debug({ err }, 'Aurigraph getQuota probe failed');
    return null;
  }
}

/**
 * Aggregate the 24h call-log summary. Mirrors the email transport's
 * Outbound24h pattern — best-effort, swallowed on DB failure.
 */
async function loadAurigraphCallSummary(): Promise<{
  lastCallOk: string | null;
  lastCallError: string | null;
  callsLast24h: {
    success: number;
    failed: number;
    retried: number;
    pending: number;
  };
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const [lastSuccess, lastFailure, success, failed, retried, pending] =
      await Promise.all([
        prisma.aurigraphCallLog.findFirst({
          where: { status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        prisma.aurigraphCallLog.findFirst({
          where: { status: 'FAILED' },
          orderBy: { createdAt: 'desc' },
          select: { errorMsg: true },
        }),
        prisma.aurigraphCallLog.count({
          where: { status: 'SUCCESS', createdAt: { gte: since } },
        }),
        prisma.aurigraphCallLog.count({
          where: { status: 'FAILED', createdAt: { gte: since } },
        }),
        prisma.aurigraphCallLog.count({
          where: { status: 'RETRIED', createdAt: { gte: since } },
        }),
        prisma.aurigraphCallLog.count({
          where: { status: 'PENDING', createdAt: { gte: since } },
        }),
      ]);
    return {
      lastCallOk: lastSuccess?.createdAt?.toISOString() ?? null,
      lastCallError: lastFailure?.errorMsg ?? null,
      callsLast24h: { success, failed, retried, pending },
    };
  } catch (err) {
    logger.warn({ err }, '/health/aurigraph — call-log summary failed');
    return {
      lastCallOk: null,
      lastCallError: null,
      callsLast24h: { success: 0, failed: 0, retried: 0, pending: 0 },
    };
  }
}

healthRouter.get(
  '/aurigraph',
  requireAuth,
  requireRole('super_admin'),
  async (_req, res) => {
    const baseUrl = (
      process.env.AURIGRAPH_BASE_URL ?? DEFAULT_AURIGRAPH_BASE_URL
    ).replace(/\/+$/, '');
    const tenantId = process.env.AURIGRAPH_TENANT_ID ?? null;
    const apiKeyResolved = Boolean(process.env.AURIGRAPH_API_KEY);
    const channelId =
      process.env.AURIGRAPH_CHANNEL_ID ?? DEFAULT_AURIGRAPH_CHANNEL_ID;
    const ucCarbonChainId = process.env.AURIGRAPH_UC_CARBON_CHAIN_ID ?? null;

    // Test-mode stub — keeps unit tests deterministic and offline. Mirrors
    // the AWS_SES_MOCK_MODE pattern in /health/email.
    if (process.env.AURIGRAPH_MOCK_MODE === '1') {
      const stub: AurigraphHealthResponse = {
        baseUrl,
        tenantId,
        apiKeyResolved,
        channelId,
        tierQuota: {
          monthlyCalls: 10000,
          used: 12,
          remaining: 9988,
          resetAt: null,
        },
        ucCarbonCapability: true,
        ucCarbonChainId,
        lastCallOk: new Date().toISOString(),
        lastCallError: null,
        callsLast24h: { success: 1, failed: 0, retried: 0, pending: 0 },
      };
      return res.json(stub);
    }

    // Live mode. Run probes in parallel — they're all independent I/O.
    let adapter: AurigraphDltAdapter | null = null;
    try {
      adapter = getAurigraphAdapter();
    } catch (err) {
      // Adapter construction itself can throw (e.g. AURIGRAPH_API_KEY
      // missing in non-test env). Surface that as "unknown" everywhere.
      logger.warn({ err }, '/health/aurigraph — adapter unavailable');
    }

    const [tierQuota, ucCarbonCapability, summary] = await Promise.all([
      adapter ? probeTierQuota(adapter) : Promise.resolve(null),
      adapter ? probeUcCarbonCapability() : Promise.resolve('unknown' as const),
      loadAurigraphCallSummary(),
    ]);

    const body: AurigraphHealthResponse = {
      baseUrl,
      tenantId,
      apiKeyResolved,
      channelId,
      tierQuota,
      ucCarbonCapability,
      ucCarbonChainId,
      lastCallOk: summary.lastCallOk,
      lastCallError: summary.lastCallError,
      callsLast24h: summary.callsLast24h,
    };
    return res.json(body);
  },
);

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

// ───────────────────────────────────────────────────────────────────────
// AAT-DEEPRESEARCH — /health/research
//
// Diagnostic endpoint for the Google Deep Research (Gemini) adapter.
// Auth-gated to SUPER_ADMIN — same posture as /health/email + /health/aurigraph.
//
// Probes:
//   1. apiKeyResolved   : GOOGLE_AI_API_KEY (or GEMINI_API_KEY) present
//      in the runtime env. The adapter uses lazy resolution, so the API
//      can boot without the key — this flag tells ops whether the
//      feature is "armed" on this deployment.
//   2. providerPingOk   : `provider.ping()` — calls Gemini's `models?key=…`
//      listing endpoint. Cheap, read-only, doesn't consume the heavy
//      research budget.
//   3. lastRunOk / lastRunFailed / runsLast24h: aggregated from the
//      `regulatory_research_runs` audit table.
//
// Test-mode short-circuit: GEMINI_MOCK_MODE=1 (or NODE_ENV=test) returns
// a deterministic stub so the route tests don't need network or a real
// API key.
// ───────────────────────────────────────────────────────────────────────

interface ResearchHealthResponse {
  provider: string;
  modelDefault: string;
  apiKeyResolved: boolean;
  providerPingOk: boolean | 'unknown';
  providerPingReason: string | null;
  lastRunOk: string | null;
  lastRunFailed: string | null;
  runsLast24h: { success: number; failed: number };
}

healthRouter.get(
  '/research',
  requireAuth,
  requireRole('super_admin'),
  async (_req, res) => {
    const apiKeyResolved = Boolean(
      process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY,
    );
    const modelDefault =
      process.env.GEMINI_DEEP_RESEARCH_MODEL ?? 'gemini-2.5-pro-deep-research';

    // Test-mode stub — keeps unit tests deterministic and offline.
    if (
      process.env.GEMINI_MOCK_MODE === '1' ||
      process.env.NODE_ENV === 'test'
    ) {
      const stub: ResearchHealthResponse = {
        provider: 'gemini-deep-research',
        modelDefault,
        apiKeyResolved,
        providerPingOk: true,
        providerPingReason: null,
        lastRunOk: null,
        lastRunFailed: null,
        runsLast24h: { success: 0, failed: 0 },
      };
      // Allow tests to assert against persisted data when present.
      try {
        const [last, rollup] = await Promise.all([
          loadResearchLastRunSummary(),
          loadResearchRunsLast24h(),
        ]);
        stub.lastRunOk = last.lastRunOk;
        stub.lastRunFailed = last.lastRunFailed;
        stub.runsLast24h = rollup;
      } catch {
        // best-effort
      }
      return res.json(stub);
    }

    const provider = getResearchProvider();
    const [pingResult, last, rollup] = await Promise.all([
      provider.ping().catch((err: unknown) => ({
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      })),
      loadResearchLastRunSummary(),
      loadResearchRunsLast24h(),
    ]);

    const body: ResearchHealthResponse = {
      provider: provider.providerName,
      modelDefault,
      apiKeyResolved,
      providerPingOk: pingResult.ok,
      providerPingReason: pingResult.ok ? null : (pingResult.reason ?? null),
      lastRunOk: last.lastRunOk,
      lastRunFailed: last.lastRunFailed,
      runsLast24h: rollup,
    };
    return res.json(body);
  },
);
