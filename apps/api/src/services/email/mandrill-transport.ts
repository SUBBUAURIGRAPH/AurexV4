/**
 * AAT-MANDRILL: Mandrill (Mailchimp Transactional) transport.
 *
 * Sibling to the SES transport. Direct `fetch` against the documented
 * REST surface (https://mailchimp.com/developer/transactional/api/) —
 * we deliberately do NOT take a dependency on
 * `@mailchimp/mailchimp_transactional`; the wire protocol is small and
 * the SDK adds no value beyond a typed wrapper.
 *
 * Endpoints used:
 *   POST https://mandrillapp.com/api/1.0/messages/send.json   (send)
 *   POST https://mandrillapp.com/api/1.0/users/ping.json      (health)
 *
 * Failure semantics — match the SES transport so the façade stays
 * uniform:
 *   - Network / 5xx errors  → throw `MandrillSendError(code: 'NETWORK')`.
 *     We do NOT retry inside the transport. The SES path doesn't retry
 *     either; retrying happens (today) at the worker layer outside the
 *     scope of AAT-MANDRILL.
 *   - HTTP 200 with `status === 'rejected'` or `'invalid'`
 *                            → throw `MandrillSendError(code: 'REJECTED')`
 *     including the `reject_reason` Mandrill returned.
 *   - HTTP 200 with `status === 'sent'` or `'queued'`
 *                            → resolve with `_id` as messageId.
 *
 * Mock mode: `MANDRILL_MOCK_MODE=1` (or `NODE_ENV==='test'`) skips the
 * HTTP call and pushes onto an in-memory queue, mirroring the SES
 * `_testEmailQueue` behaviour. Used by the route tests + by local dev
 * environments without a Mailchimp Transactional API key.
 */

import { logger } from '../../lib/logger.js';
import type {
  EmailProvider,
  EmailTransport,
  TransportSendInput,
  TransportSendResult,
} from './transport.js';

// ─── Mock-mode queue ───────────────────────────────────────────────────

export interface QueuedMandrillEmail {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  messageId: string;
  sentAt: Date;
}

export const _mandrillTestQueue: QueuedMandrillEmail[] = [];

export function _resetMandrillTestQueue(): void {
  _mandrillTestQueue.length = 0;
}

// ─── Errors ────────────────────────────────────────────────────────────

export class MandrillKeyMissingError extends Error {
  readonly code = 'MANDRILL_KEY_MISSING';
  constructor() {
    super(
      'MANDRILL_API_KEY is not set. Either provide a Mailchimp Transactional ' +
        'API key, set MANDRILL_MOCK_MODE=1 for local/test envs, or run with ' +
        'EMAIL_TRANSPORT=ses (the default).',
    );
    this.name = 'MandrillKeyMissingError';
  }
}

export type MandrillSendErrorCode = 'NETWORK' | 'REJECTED' | 'BAD_RESPONSE';

export class MandrillSendError extends Error {
  readonly code: MandrillSendErrorCode;
  readonly status?: string;
  readonly rejectReason?: string;
  readonly httpStatus?: number;
  constructor(
    code: MandrillSendErrorCode,
    message: string,
    extra?: { status?: string; rejectReason?: string; httpStatus?: number },
  ) {
    super(message);
    this.name = 'MandrillSendError';
    this.code = code;
    if (extra?.status !== undefined) this.status = extra.status;
    if (extra?.rejectReason !== undefined) this.rejectReason = extra.rejectReason;
    if (extra?.httpStatus !== undefined) this.httpStatus = extra.httpStatus;
  }
}

// ─── Constants ─────────────────────────────────────────────────────────

const MANDRILL_BASE_URL = 'https://mandrillapp.com/api/1.0';
const MANDRILL_FROM_NAME = 'Aurex';
const MANDRILL_TAG = 'aurex';

// ─── Internal helpers ──────────────────────────────────────────────────

interface MandrillSendResponseItem {
  email?: string;
  status?: 'sent' | 'queued' | 'rejected' | 'invalid' | string;
  reject_reason?: string | null;
  _id?: string;
}

function isMockMode(): boolean {
  return (
    process.env.NODE_ENV === 'test' || process.env.MANDRILL_MOCK_MODE === '1'
  );
}

function resolveApiKey(): string {
  const key = process.env.MANDRILL_API_KEY;
  if (key && key.length > 0) return key;
  if (isMockMode()) return 'md-mock-fixture-key';
  throw new MandrillKeyMissingError();
}

// ─── Transport ─────────────────────────────────────────────────────────

export class MandrillTransport implements EmailTransport {
  readonly providerName: EmailProvider = 'mandrill';
  private readonly apiKey: string;

  constructor() {
    // Resolve once at construction. Throws `MandrillKeyMissingError` in
    // non-test, non-mock environments when the env var is unset — the
    // façade lets that bubble so deployments fail loudly rather than
    // silently dropping mail.
    this.apiKey = resolveApiKey();
  }

  async send(args: TransportSendInput): Promise<TransportSendResult> {
    // Mock-mode short-circuit — mirrors SES `_testEmailQueue`.
    if (isMockMode()) {
      const messageId = `mandrill-mock-${Math.random()
        .toString(36)
        .slice(2, 12)}-${Date.now()}`;
      const queued: QueuedMandrillEmail = {
        to: args.to,
        from: args.from,
        ...(args.replyTo ? { replyTo: args.replyTo } : {}),
        subject: args.subject,
        html: args.html,
        ...(args.text ? { text: args.text } : {}),
        messageId,
        sentAt: new Date(),
      };
      _mandrillTestQueue.push(queued);
      logger.debug(
        { to: args.to, messageId },
        'Mandrill send mock-mode (no HTTP call)',
      );
      return { messageId };
    }

    const body = {
      key: this.apiKey,
      message: {
        from_email: args.from,
        from_name: MANDRILL_FROM_NAME,
        to: [{ email: args.to, type: 'to' as const }],
        subject: args.subject,
        html: args.html,
        ...(args.text ? { text: args.text } : {}),
        ...(args.replyTo ? { headers: { 'Reply-To': args.replyTo } } : {}),
        tags: [MANDRILL_TAG],
      },
    };

    let httpResponse: Response;
    try {
      httpResponse = await fetch(`${MANDRILL_BASE_URL}/messages/send.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new MandrillSendError(
        'NETWORK',
        `Mandrill network error: ${cause}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = await httpResponse.json();
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new MandrillSendError(
        'BAD_RESPONSE',
        `Mandrill returned non-JSON response (HTTP ${httpResponse.status}): ${cause}`,
        { httpStatus: httpResponse.status },
      );
    }

    if (!httpResponse.ok) {
      // Mandrill returns an object (not array) with name+message on errors.
      const err = parsed as { name?: string; message?: string };
      throw new MandrillSendError(
        'NETWORK',
        `Mandrill API error (HTTP ${httpResponse.status}): ${err.name ?? 'Error'} — ${
          err.message ?? 'unknown'
        }`,
        { httpStatus: httpResponse.status },
      );
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new MandrillSendError(
        'BAD_RESPONSE',
        'Mandrill returned an empty / non-array response body',
      );
    }

    const first = parsed[0] as MandrillSendResponseItem;
    const status = first.status ?? 'unknown';

    if (status === 'rejected' || status === 'invalid') {
      const reason = first.reject_reason ?? 'unknown';
      throw new MandrillSendError(
        'REJECTED',
        `Mandrill rejected the message (status=${status}, reason=${reason})`,
        { status, rejectReason: reason },
      );
    }

    const messageId = first._id ?? '';
    if (!messageId) {
      throw new MandrillSendError(
        'BAD_RESPONSE',
        `Mandrill response missing _id (status=${status})`,
        { status },
      );
    }

    return { messageId };
  }

  /**
   * Health probe — POST /users/ping.json. Returns:
   *   - true  : PING returned 'PONG!' (key is valid).
   *   - false : key invalid or HTTP error.
   *   - 'unknown' : network failure / can't reach Mandrill.
   *
   * Mirrors the SES `probeSesIdentity` semantics in `routes/health.ts`.
   */
  async ping(): Promise<boolean | 'unknown'> {
    if (isMockMode()) return true;
    try {
      const res = await fetch(`${MANDRILL_BASE_URL}/users/ping.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: this.apiKey }),
      });
      if (!res.ok) return false;
      // /users/ping.json returns the literal string `"PONG!"` (JSON-encoded).
      const data = (await res.json()) as unknown;
      if (typeof data === 'string') return data === 'PONG!';
      // /users/ping2.json returns { PING: 'PONG!' }; tolerate both.
      if (data && typeof data === 'object' && 'PING' in data) {
        return (data as { PING?: string }).PING === 'PONG!';
      }
      return false;
    } catch {
      return 'unknown';
    }
  }
}
