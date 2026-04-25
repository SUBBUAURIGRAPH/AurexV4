/**
 * AAT-EMAIL / Wave 8b: SES v2 outbound email façade.
 *
 * One entry point — `sendEmail({ to, subject, html, text? })` — used by
 * the auth + billing services. Two execution modes:
 *
 *   1. Live mode (default in dev/staging/prod):
 *      Constructs a memoised `SESv2Client` against AWS_REGION, builds a
 *      `SendEmailCommand`, fires it, persists the OutboundEmail audit
 *      row, returns `{ ok: true, messageId, recordId }`.
 *
 *   2. Test mode (NODE_ENV === 'test' OR AWS_SES_MOCK_MODE=1):
 *      Pushes the email onto the in-memory `_testEmailQueue` and returns
 *      a synthetic messageId (`mock-<uuid>`) without touching SES. Tests
 *      assert against the queue.
 *
 * Failure semantics: this is a "best effort" surface. A failed send must
 * never bubble up and break the calling flow (signup, payment) — we
 * persist FAILED + return `{ ok: false }`. Callers may log/alert; they
 * MUST NOT roll back the parent transaction.
 *
 * Credentials: inherited from the standard AWS SDK env-var chain
 * (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY OR an instance profile).
 * NEVER hard-code credentials here.
 */

import { prisma, type EmailStatus } from '@aurex/database';
import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
  type SendEmailCommandOutput,
} from '@aws-sdk/client-sesv2';
import { logger } from '../../lib/logger.js';

// ─── Types ─────────────────────────────────────────────────────────────

export type EmailTemplateKey = 'verification' | 'welcome' | 'payment-receipt';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Tag persisted on the OutboundEmail audit row. */
  templateKey: EmailTemplateKey;
}

export interface SendEmailSuccess {
  ok: true;
  messageId: string;
  /** OutboundEmail.id — null when persistence itself failed. */
  recordId: string | null;
}

export interface SendEmailFailure {
  ok: false;
  error: string;
  recordId: string | null;
}

export type SendEmailResult = SendEmailSuccess | SendEmailFailure;

/**
 * Test-mode in-memory queue. Each entry mirrors what would have been
 * sent to SES so tests can assert on To/From/Subject/Body. Cleared
 * between tests via `_resetTestEmailQueue()`.
 */
export interface QueuedTestEmail {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  templateKey: EmailTemplateKey;
  messageId: string;
  sentAt: Date;
}

export const _testEmailQueue: QueuedTestEmail[] = [];

export function _resetTestEmailQueue(): void {
  _testEmailQueue.length = 0;
}

/**
 * Typed error so callers (or future retry workers) can pattern-match on
 * the failure mode without parsing the message.
 */
export class EmailSendError extends Error {
  readonly code: string;
  readonly cause?: unknown;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'EmailSendError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

// ─── Config resolution ─────────────────────────────────────────────────

interface ResolvedConfig {
  region: string;
  from: string;
  replyTo: string | null;
  testMode: boolean;
}

function resolveConfig(): ResolvedConfig {
  const region = process.env.AWS_REGION ?? 'ap-south-1';
  const from = process.env.AURIGRAPH_EMAIL_FROM ?? 'noreply@aurex.in';
  const replyTo = process.env.AURIGRAPH_EMAIL_REPLY_TO ?? 'contact@aurex.in';
  const testMode =
    process.env.NODE_ENV === 'test' || process.env.AWS_SES_MOCK_MODE === '1';
  return { region, from, replyTo: replyTo === '' ? null : replyTo, testMode };
}

// ─── Client memoisation ────────────────────────────────────────────────

let cachedClient: SESv2Client | null = null;
let cachedRegion: string | null = null;

function getSesClient(region: string): SESv2Client {
  if (cachedClient && cachedRegion === region) return cachedClient;
  cachedClient = new SESv2Client({ region });
  cachedRegion = region;
  return cachedClient;
}

/**
 * Test-only: drop the cached client so a subsequent test can rebuild it
 * with a fresh mock or a different region. Not exported as part of the
 * public surface.
 */
export function _resetSesClientForTests(): void {
  cachedClient = null;
  cachedRegion = null;
}

// ─── Persistence helpers ───────────────────────────────────────────────

async function persistInitialRow(input: SendEmailInput): Promise<string | null> {
  try {
    const row = await prisma.outboundEmail.create({
      data: {
        to: input.to,
        subject: input.subject,
        templateKey: input.templateKey,
        status: 'PENDING' as EmailStatus,
        attemptCount: 1,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    // If we can't even write the audit row, log and continue — the user
    // experience must not depend on the email-audit table.
    logger.warn({ err, to: input.to }, 'OutboundEmail audit row create failed');
    return null;
  }
}

async function markRowSent(
  recordId: string | null,
  messageId: string,
): Promise<void> {
  if (!recordId) return;
  try {
    await prisma.outboundEmail.update({
      where: { id: recordId },
      data: {
        status: 'SENT' as EmailStatus,
        messageId,
        sentAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn({ err, recordId }, 'OutboundEmail mark-sent failed (non-fatal)');
  }
}

async function markRowFailed(
  recordId: string | null,
  errorMessage: string,
): Promise<void> {
  if (!recordId) return;
  try {
    await prisma.outboundEmail.update({
      where: { id: recordId },
      data: {
        status: 'FAILED' as EmailStatus,
        errorMessage: errorMessage.slice(0, 4000),
      },
    });
  } catch (err) {
    logger.warn({ err, recordId }, 'OutboundEmail mark-failed failed (non-fatal)');
  }
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Send a transactional email. Best-effort — failures are persisted to
 * the OutboundEmail audit table but never thrown to the caller.
 *
 * Returns:
 *   { ok: true,  messageId, recordId } on success.
 *   { ok: false, error,     recordId } on failure (no exception).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = resolveConfig();
  const recordId = await persistInitialRow(input);

  // ── Test mode short-circuit ─────────────────────────────────────────
  if (cfg.testMode) {
    const messageId = `mock-${Math.random().toString(36).slice(2, 12)}-${Date.now()}`;
    const queued: QueuedTestEmail = {
      to: input.to,
      from: cfg.from,
      ...(cfg.replyTo ? { replyTo: cfg.replyTo } : {}),
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      templateKey: input.templateKey,
      messageId,
      sentAt: new Date(),
    };
    _testEmailQueue.push(queued);
    await markRowSent(recordId, messageId);
    logger.debug(
      { to: input.to, templateKey: input.templateKey, messageId },
      'Email queued in test mode (no SES call)',
    );
    return { ok: true, messageId, recordId };
  }

  // ── Live mode: send via SES v2 ──────────────────────────────────────
  const client = getSesClient(cfg.region);

  const sesInput: SendEmailCommandInput = {
    FromEmailAddress: cfg.from,
    Destination: { ToAddresses: [input.to] },
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: input.html, Charset: 'UTF-8' },
          ...(input.text
            ? { Text: { Data: input.text, Charset: 'UTF-8' } }
            : {}),
        },
      },
    },
    ...(cfg.replyTo ? { ReplyToAddresses: [cfg.replyTo] } : {}),
  };

  try {
    const out: SendEmailCommandOutput = await client.send(
      new SendEmailCommand(sesInput),
    );
    const messageId = out.MessageId ?? '';
    if (!messageId) {
      // SES returned 200 but no MessageId — treat as soft failure so
      // ops can investigate via the audit row.
      const errMsg = 'SES SendEmail succeeded without MessageId';
      await markRowFailed(recordId, errMsg);
      logger.warn({ to: input.to, templateKey: input.templateKey }, errMsg);
      return { ok: false, error: errMsg, recordId };
    }
    await markRowSent(recordId, messageId);
    logger.info(
      { to: input.to, templateKey: input.templateKey, messageId },
      'Email sent via SES',
    );
    return { ok: true, messageId, recordId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await markRowFailed(recordId, errMsg);
    logger.warn(
      { err, to: input.to, templateKey: input.templateKey },
      'Email send failed (best-effort — caller continues)',
    );
    return { ok: false, error: errMsg, recordId };
  }
}
