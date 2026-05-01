/**
 * AAT-EMAIL / Wave 8b + AAT-MANDRILL: outbound email façade.
 *
 * One entry point — `sendEmail({ to, subject, html, text? })` — used by
 * the auth + billing services. Behaviour:
 *
 *   1. The active transport is resolved at call time via
 *      `getTransport()` (see `transport.ts`):
 *        - `EMAIL_TRANSPORT=ses`      → SES v2 (default)
 *        - `EMAIL_TRANSPORT=mandrill` → Mandrill / Mailchimp Transactional
 *      Default is SES so existing deployments are unchanged.
 *
 *   2. Test / mock modes (per-transport):
 *        - SES: `NODE_ENV==='test'` or `AWS_SES_MOCK_MODE=1`
 *               → push onto `_testEmailQueue`, synthetic `mock-…` id.
 *        - Mandrill: `NODE_ENV==='test'` or `MANDRILL_MOCK_MODE=1`
 *               → push onto `_mandrillTestQueue`, synthetic `mandrill-mock-…` id.
 *
 *   3. Audit row: written on every call regardless of transport. We do
 *      NOT store the provider name on `OutboundEmail` (no schema change
 *      under AAT-MANDRILL — see runbook §"Provider switching"). The
 *      provider is recovered from the `EMAIL_TRANSPORT` env var of the
 *      runtime that produced the row, plus the structured logger fields
 *      emitted alongside each send.
 *
 *   4. Failure semantics: best-effort. A failed send must never bubble
 *      up and break the calling flow (signup, payment) — we persist
 *      FAILED + return `{ ok: false }`. Callers may log/alert; they
 *      MUST NOT roll back the parent transaction.
 *
 * Credentials:
 *   - SES: standard AWS SDK env-var chain.
 *   - Mandrill: `MANDRILL_API_KEY` env var.
 *   NEVER hard-code credentials here.
 */

import { prisma, type EmailStatus } from '@aurex/database';
import { logger } from '../../lib/logger.js';
import {
  getTransport,
  type EmailProvider,
  _resetSesClientForTests,
} from './transport.js';
import {
  _resetMandrillTestQueue,
  MandrillKeyMissingError,
  MandrillSendError,
} from './mandrill-transport.js';

// ─── Types ─────────────────────────────────────────────────────────────

export type EmailTemplateKey =
  | 'verification'
  | 'welcome'
  | 'payment-receipt'
  | 'password-reset';

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
  /** Which transport actually shipped the message. */
  provider: EmailProvider;
}

export interface SendEmailFailure {
  ok: false;
  error: string;
  recordId: string | null;
  /** Which transport was attempted. */
  provider: EmailProvider;
}

export type SendEmailResult = SendEmailSuccess | SendEmailFailure;

/**
 * Test-mode in-memory queue (SES path). Each entry mirrors what would
 * have been sent to SES so tests can assert on To/From/Subject/Body.
 * Cleared between tests via `_resetTestEmailQueue()`.
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
  provider: EmailProvider;
}

export const _testEmailQueue: QueuedTestEmail[] = [];

export function _resetTestEmailQueue(): void {
  _testEmailQueue.length = 0;
  _resetMandrillTestQueue();
}

// Re-export transport-reset helper for tests that previously imported it
// from email.service directly.
export { _resetSesClientForTests };

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
  from: string;
  replyTo: string | null;
  testMode: boolean;
}

function resolveConfig(provider: EmailProvider): ResolvedConfig {
  const from = process.env.AURIGRAPH_EMAIL_FROM ?? 'noreply@aurex.in';
  const replyTo = process.env.AURIGRAPH_EMAIL_REPLY_TO ?? 'contact@aurex.in';
  // Per-provider mock-mode short-circuit. Each transport also checks
  // mock-mode internally (so callers can use the transport directly),
  // but we mirror the test-mode book-keeping here so the audit row is
  // marked SENT immediately and the test queue receives an entry that
  // includes `templateKey`.
  const testMode =
    process.env.NODE_ENV === 'test' ||
    (provider === 'ses' && process.env.AWS_SES_MOCK_MODE === '1') ||
    (provider === 'mandrill' && process.env.MANDRILL_MOCK_MODE === '1');
  return { from, replyTo: replyTo === '' ? null : replyTo, testMode };
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
 *   { ok: true,  messageId, recordId, provider } on success.
 *   { ok: false, error,     recordId, provider } on failure (no exception).
 *
 * Backward-compatible with callers that only inspect `.ok` / `.messageId` /
 * `.recordId` — `.provider` is additive.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  // Resolve transport — may throw MandrillKeyMissingError if EMAIL_TRANSPORT=
  // mandrill and the API key is missing in a non-test env. Catch it here
  // so the calling flow never sees an exception.
  let transport;
  try {
    transport = getTransport();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const provider: EmailProvider =
      err instanceof MandrillKeyMissingError ? 'mandrill' : 'ses';
    logger.warn(
      { err, to: input.to, templateKey: input.templateKey, provider },
      'Email transport resolution failed (best-effort — caller continues)',
    );
    // We can't write a meaningful audit row without a transport; still
    // attempt one so ops can see the failure.
    const recordId = await persistInitialRow(input);
    await markRowFailed(recordId, errMsg);
    return { ok: false, error: errMsg, recordId, provider };
  }

  const provider = transport.providerName;
  const cfg = resolveConfig(provider);
  const recordId = await persistInitialRow(input);

  // ── Test-mode short-circuit (mirrors original Wave 8b behaviour) ────
  if (cfg.testMode) {
    const messageId =
      provider === 'mandrill'
        ? `mandrill-mock-${Math.random().toString(36).slice(2, 12)}-${Date.now()}`
        : `mock-${Math.random().toString(36).slice(2, 12)}-${Date.now()}`;
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
      provider,
    };
    _testEmailQueue.push(queued);
    await markRowSent(recordId, messageId);
    logger.debug(
      { to: input.to, templateKey: input.templateKey, messageId, provider },
      'Email queued in test mode (no provider call)',
    );
    return { ok: true, messageId, recordId, provider };
  }

  // ── Live mode: delegate to the active transport ─────────────────────
  try {
    const sent = await transport.send({
      to: input.to,
      from: cfg.from,
      ...(cfg.replyTo ? { replyTo: cfg.replyTo } : {}),
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    });
    await markRowSent(recordId, sent.messageId);
    logger.info(
      {
        to: input.to,
        templateKey: input.templateKey,
        messageId: sent.messageId,
        provider,
      },
      'Email sent',
    );
    return { ok: true, messageId: sent.messageId, recordId, provider };
  } catch (err) {
    // Map provider-specific errors to a single string for the audit row.
    let errMsg: string;
    if (err instanceof MandrillSendError) {
      errMsg = `[mandrill:${err.code}] ${err.message}`;
    } else {
      errMsg = err instanceof Error ? err.message : String(err);
    }
    await markRowFailed(recordId, errMsg);
    logger.warn(
      { err, to: input.to, templateKey: input.templateKey, provider },
      'Email send failed (best-effort — caller continues)',
    );
    return { ok: false, error: errMsg, recordId, provider };
  }
}
