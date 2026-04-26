#!/usr/bin/env tsx
/**
 * AAT-11C / Wave 11c — SES connectivity smoke test.
 *
 * Sends ONE minimal "Aurex SES connectivity test" email through the
 * production email.service so ops can verify that:
 *   - AWS credentials are present in the runtime environment
 *   - AWS_REGION / AURIGRAPH_EMAIL_FROM / AURIGRAPH_EMAIL_REPLY_TO
 *     resolve to the values we expect
 *   - The sender identity (`AURIGRAPH_EMAIL_FROM`) is verified in SES
 *   - The OutboundEmail audit row is written PENDING → SENT
 *
 * Usage:
 *   AURIGRAPH_TEST_EMAIL_TO=ops@aurex.in \
 *     pnpm --filter @aurex/api tsx scripts/email/send-test.ts
 *
 * The script prints either the SES MessageId + OutboundEmail.id on
 * success, or the error message on failure, then exits 0/1.
 *
 * Safety: this calls real SES — DO NOT run with a test recipient that
 * isn't verified in the SES account when SES is in sandbox mode.
 */

import { sendEmail } from '../../src/services/email/email.service.js';

async function main(): Promise<number> {
  // Minimal `any` — env access only, per the slice C constraint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = process.env as any;
  const to: string | undefined = env.AURIGRAPH_TEST_EMAIL_TO;
  if (!to) {
    console.error('AURIGRAPH_TEST_EMAIL_TO env var is required.');
    console.error(
      'Example: AURIGRAPH_TEST_EMAIL_TO=ops@aurex.in pnpm --filter @aurex/api tsx scripts/email/send-test.ts',
    );
    return 1;
  }

  const region: string = env.AWS_REGION ?? 'ap-south-1';
  const from: string = env.AURIGRAPH_EMAIL_FROM ?? 'noreply@aurex.in';
  const replyTo: string =
    env.AURIGRAPH_EMAIL_REPLY_TO ?? 'contact@aurex.in';

  console.log('Aurex SES connectivity test');
  console.log(`  region:  ${region}`);
  console.log(`  from:    ${from}`);
  console.log(`  replyTo: ${replyTo}`);
  console.log(`  to:      ${to}`);

  const stamp = new Date().toISOString();
  const subject = 'Aurex SES connectivity test';
  const text = [
    'This is the Aurex SES connectivity smoke test.',
    '',
    `Sent at: ${stamp}`,
    `From:    ${from}`,
    `Region:  ${region}`,
    '',
    'If you received this, the outbound transport is healthy.',
  ].join('\n');
  const html = [
    `<p>This is the <strong>Aurex SES connectivity smoke test</strong>.</p>`,
    `<ul>`,
    `<li><strong>Sent at:</strong> ${stamp}</li>`,
    `<li><strong>From:</strong> ${from}</li>`,
    `<li><strong>Region:</strong> ${region}</li>`,
    `</ul>`,
    `<p>If you received this, the outbound transport is healthy.</p>`,
  ].join('');

  const result = await sendEmail({
    to,
    subject,
    html,
    text,
    // The audit row uses templateKey for filtering; "verification"
    // is the closest existing key — the smoke test isn't a real
    // template and we don't want a new enum value just for ops.
    templateKey: 'verification',
  });

  if (result.ok) {
    console.log(`OK  messageId=${result.messageId} recordId=${result.recordId}`);
    return 0;
  }
  console.error(`FAIL  error=${result.error} recordId=${result.recordId}`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
