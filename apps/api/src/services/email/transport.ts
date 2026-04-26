/**
 * AAT-MANDRILL: Email transport abstraction.
 *
 * The platform supports two interchangeable outbound transports:
 *
 *   - SES v2 (default; AAT-EMAIL / Wave 8b)
 *   - Mandrill / Mailchimp Transactional (AAT-MANDRILL)
 *
 * The high-level façade (`email.service.sendEmail`) keeps its existing
 * signature; it picks the active transport via `getTransport()`. Switch
 * providers per-deployment with `EMAIL_TRANSPORT=ses|mandrill`. Default
 * stays `ses` so existing deployments are unaffected.
 *
 * Each transport reports its own `providerName` so the audit log lines
 * and the `/health/email` endpoint can surface which provider actually
 * shipped a given message. Per the AAT-MANDRILL brief we do NOT add a
 * `provider` column on the `OutboundEmail` audit row — the schema is
 * unchanged and the provider is recovered from the deployment-time env
 * variable + structured log fields. See `docs/biocarbon/10-email-transport-runbook.md`.
 */

import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
  type SendEmailCommandOutput,
} from '@aws-sdk/client-sesv2';
import { logger } from '../../lib/logger.js';
import { MandrillTransport } from './mandrill-transport.js';

// ─── Public surface ────────────────────────────────────────────────────

export type EmailProvider = 'ses' | 'mandrill';

export interface TransportSendInput {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface TransportSendResult {
  messageId: string;
}

export interface EmailTransport {
  readonly providerName: EmailProvider;
  send(args: TransportSendInput): Promise<TransportSendResult>;
}

// ─── SES transport (extracted from email.service.ts) ───────────────────

let cachedSesClient: SESv2Client | null = null;
let cachedSesRegion: string | null = null;

function getSesClient(region: string): SESv2Client {
  if (cachedSesClient && cachedSesRegion === region) return cachedSesClient;
  cachedSesClient = new SESv2Client({ region });
  cachedSesRegion = region;
  return cachedSesClient;
}

/**
 * Test-only: drop the cached SES client so a subsequent test can rebuild
 * it with a fresh mock or a different region.
 */
export function _resetSesClientForTests(): void {
  cachedSesClient = null;
  cachedSesRegion = null;
}

/**
 * SES v2 transport. Mirrors the original Wave 8b SES send logic verbatim
 * — the only behavioural change is that it is now invoked through the
 * `EmailTransport` interface.
 */
export class SesTransport implements EmailTransport {
  readonly providerName: EmailProvider = 'ses';

  async send(args: TransportSendInput): Promise<TransportSendResult> {
    const region = process.env.AWS_REGION ?? 'ap-south-1';
    const client = getSesClient(region);

    const sesInput: SendEmailCommandInput = {
      FromEmailAddress: args.from,
      Destination: { ToAddresses: [args.to] },
      Content: {
        Simple: {
          Subject: { Data: args.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: args.html, Charset: 'UTF-8' },
            ...(args.text
              ? { Text: { Data: args.text, Charset: 'UTF-8' } }
              : {}),
          },
        },
      },
      ...(args.replyTo ? { ReplyToAddresses: [args.replyTo] } : {}),
    };

    const out: SendEmailCommandOutput = await client.send(
      new SendEmailCommand(sesInput),
    );
    const messageId = out.MessageId ?? '';
    if (!messageId) {
      // SES occasionally returns 200 with no MessageId — treat as a
      // soft failure so the audit row records it. The façade maps this
      // to `{ ok: false }`.
      throw new Error('SES SendEmail succeeded without MessageId');
    }
    return { messageId };
  }
}

// ─── Factory ───────────────────────────────────────────────────────────

/**
 * Resolve the active email transport.
 *
 * Resolution order:
 *   1. Explicit `override` argument (used by tests).
 *   2. `EMAIL_TRANSPORT` env var (`ses` | `mandrill`).
 *   3. Default: `ses`.
 */
export function getTransport(override?: EmailProvider): EmailTransport {
  const envChoice = process.env.EMAIL_TRANSPORT;
  const choice: EmailProvider =
    override ??
    (envChoice === 'mandrill' || envChoice === 'ses' ? envChoice : 'ses');
  if (choice === 'mandrill') {
    logger.debug({ provider: 'mandrill' }, 'Email transport resolved');
    return new MandrillTransport();
  }
  logger.debug({ provider: 'ses' }, 'Email transport resolved');
  return new SesTransport();
}
