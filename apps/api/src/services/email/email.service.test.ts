/**
 * AAT-EMAIL / Wave 8b: tests for the SES outbound email façade.
 *
 * The SDK is mocked with vi.mock so tests never reach AWS even when
 * AWS_SES_MOCK_MODE is unset. We exercise:
 *   - Test mode: pushes onto _testEmailQueue, returns synthetic MessageId
 *   - Live mode (with mocked SDK): calls SendEmailCommand correctly
 *   - Persistence: writes OutboundEmail row PENDING → SENT on success
 *   - Persistence: writes OutboundEmail row PENDING → FAILED on send error
 *   - Best-effort: failures NEVER throw — return { ok: false }
 *   - Reply-to: surfaced from AURIGRAPH_EMAIL_REPLY_TO env when set
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-sesv2', () => {
  class SESv2Client {
    constructor(public cfg: unknown) {}
    send(cmd: unknown) {
      return sendMock(cmd);
    }
  }
  class SendEmailCommand {
    constructor(public input: unknown) {}
  }
  return { SESv2Client, SendEmailCommand };
});

const { mockPrisma } = vi.hoisted(() => {
  const mock = {
    outboundEmail: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockPrisma: mock };
});

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import {
  sendEmail,
  _testEmailQueue,
  _resetTestEmailQueue,
  _resetSesClientForTests,
} from './email.service.js';

const SAVED_ENV: Record<string, string | undefined> = {};
const TRACKED_KEYS = [
  'NODE_ENV',
  'AWS_REGION',
  'AURIGRAPH_EMAIL_FROM',
  'AURIGRAPH_EMAIL_REPLY_TO',
  'AWS_SES_MOCK_MODE',
  // AAT-MANDRILL — multi-provider façade.
  'EMAIL_TRANSPORT',
  'MANDRILL_API_KEY',
  'MANDRILL_MOCK_MODE',
] as const;

beforeEach(() => {
  for (const k of TRACKED_KEYS) {
    SAVED_ENV[k] = process.env[k];
  }
  vi.clearAllMocks();
  sendMock.mockReset();
  _resetTestEmailQueue();
  _resetSesClientForTests();
  mockPrisma.outboundEmail.create.mockResolvedValue({ id: 'oe-1' });
  mockPrisma.outboundEmail.update.mockResolvedValue({ id: 'oe-1' });
});

afterEach(() => {
  for (const k of TRACKED_KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

// ─── Test-mode (NODE_ENV=test or AWS_SES_MOCK_MODE=1) ──────────────────

describe('sendEmail — test mode', () => {
  it('queues the email locally and returns a synthetic messageId without calling SES', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.AWS_SES_MOCK_MODE;

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>hello</p>',
      text: 'hello',
      templateKey: 'verification',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.messageId).toMatch(/^mock-/);
    expect(sendMock).not.toHaveBeenCalled();

    expect(_testEmailQueue).toHaveLength(1);
    const queued = _testEmailQueue[0]!;
    expect(queued.to).toBe('user@example.com');
    expect(queued.subject).toBe('Hi');
    expect(queued.html).toBe('<p>hello</p>');
    expect(queued.templateKey).toBe('verification');
  });

  it('AWS_SES_MOCK_MODE=1 forces test mode even when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AWS_SES_MOCK_MODE = '1';

    const result = await sendEmail({
      to: 'staging@example.com',
      subject: 'Staging',
      html: '<p>x</p>',
      templateKey: 'welcome',
    });

    expect(result.ok).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
    expect(_testEmailQueue).toHaveLength(1);
  });

  it('persists OutboundEmail row PENDING → SENT in test mode', async () => {
    process.env.NODE_ENV = 'test';

    await sendEmail({
      to: 'audit@example.com',
      subject: 'Audit',
      html: '<p>row</p>',
      templateKey: 'verification',
    });

    expect(mockPrisma.outboundEmail.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.outboundEmail.create.mock.calls[0]![0];
    expect(createArg.data.status).toBe('PENDING');
    expect(createArg.data.templateKey).toBe('verification');

    expect(mockPrisma.outboundEmail.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.outboundEmail.update.mock.calls[0]![0];
    expect(updateArg.data.status).toBe('SENT');
    expect(updateArg.data.messageId).toMatch(/^mock-/);
  });
});

// ─── Live mode (mocked SDK) ────────────────────────────────────────────

describe('sendEmail — live mode (SDK mocked)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.AWS_SES_MOCK_MODE;
  });

  it('builds SendEmailCommand with the right To/From/Subject/Body and returns the SES messageId', async () => {
    process.env.AURIGRAPH_EMAIL_FROM = 'noreply@aurex.in';
    process.env.AURIGRAPH_EMAIL_REPLY_TO = 'contact@aurex.in';
    process.env.AWS_REGION = 'ap-south-1';

    sendMock.mockResolvedValueOnce({ MessageId: 'ses-msg-1234' });

    const result = await sendEmail({
      to: 'recipient@example.com',
      subject: 'Live subject',
      html: '<h1>live html</h1>',
      text: 'live text',
      templateKey: 'payment-receipt',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentCmd = sendMock.mock.calls[0]![0] as { input: unknown };
    const sentInput = sentCmd.input as Record<string, unknown>;

    expect(sentInput.FromEmailAddress).toBe('noreply@aurex.in');
    expect((sentInput.Destination as { ToAddresses: string[] }).ToAddresses).toEqual([
      'recipient@example.com',
    ]);
    expect(sentInput.ReplyToAddresses).toEqual(['contact@aurex.in']);

    const content = sentInput.Content as {
      Simple: {
        Subject: { Data: string };
        Body: {
          Html: { Data: string };
          Text?: { Data: string };
        };
      };
    };
    expect(content.Simple.Subject.Data).toBe('Live subject');
    expect(content.Simple.Body.Html.Data).toBe('<h1>live html</h1>');
    expect(content.Simple.Body.Text?.Data).toBe('live text');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.messageId).toBe('ses-msg-1234');
  });

  it('persists OutboundEmail row PENDING → SENT and includes the SES messageId', async () => {
    sendMock.mockResolvedValueOnce({ MessageId: 'ses-row-id' });

    await sendEmail({
      to: 'live@example.com',
      subject: 'subj',
      html: '<p>hi</p>',
      templateKey: 'welcome',
    });

    expect(mockPrisma.outboundEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SENT',
          messageId: 'ses-row-id',
        }),
      }),
    );
  });

  it('SES error → persists FAILED, returns ok:false, does NOT throw', async () => {
    sendMock.mockRejectedValueOnce(new Error('throttled'));

    const result = await sendEmail({
      to: 'fail@example.com',
      subject: 'subj',
      html: '<p>hi</p>',
      templateKey: 'verification',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toContain('throttled');

    expect(mockPrisma.outboundEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: expect.stringContaining('throttled'),
        }),
      }),
    );
  });

  it('SES 200 with empty MessageId → persists FAILED, returns ok:false', async () => {
    sendMock.mockResolvedValueOnce({}); // no MessageId

    const result = await sendEmail({
      to: 'noid@example.com',
      subject: 'subj',
      html: '<p>hi</p>',
      templateKey: 'welcome',
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.outboundEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('uses default region/from when env unset (ap-south-1, noreply@aurex.in)', async () => {
    delete process.env.AWS_REGION;
    delete process.env.AURIGRAPH_EMAIL_FROM;
    delete process.env.AURIGRAPH_EMAIL_REPLY_TO;

    sendMock.mockResolvedValueOnce({ MessageId: 'ses-defaults' });

    await sendEmail({
      to: 'defaults@example.com',
      subject: 'd',
      html: '<p>x</p>',
      templateKey: 'verification',
    });

    const sentCmd = sendMock.mock.calls[0]![0] as { input: { FromEmailAddress: string } };
    expect(sentCmd.input.FromEmailAddress).toBe('noreply@aurex.in');
  });

  it('SES success result carries provider="ses"', async () => {
    sendMock.mockResolvedValueOnce({ MessageId: 'ses-provider-tag' });
    const result = await sendEmail({
      to: 'tag@example.com',
      subject: 's',
      html: '<p>x</p>',
      templateKey: 'verification',
    });
    expect(result.provider).toBe('ses');
  });
});

// ─── AAT-MANDRILL: routing through the Mandrill transport ──────────────
//
// We rely on `MANDRILL_MOCK_MODE=1` (or NODE_ENV=test) so the transport
// short-circuits HTTP and pushes onto `_mandrillTestQueue`. No global
// fetch mock needed for these tests — the email.service test-mode
// short-circuit captures the email on `_testEmailQueue` and tags it
// with `provider: 'mandrill'`.

describe('sendEmail — Mandrill routing (AAT-MANDRILL)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test'; // satisfies Mandrill mock-mode
    process.env.EMAIL_TRANSPORT = 'mandrill';
  });

  it('routes through Mandrill when EMAIL_TRANSPORT=mandrill', async () => {
    const result = await sendEmail({
      to: 'm@example.com',
      subject: 'mandrill subject',
      html: '<p>m</p>',
      templateKey: 'welcome',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.provider).toBe('mandrill');
    // Mandrill mock-mode messageIds are `mandrill-mock-…`; SES is `mock-…`.
    expect(result.messageId).toMatch(/^mandrill-mock-/);
    // SES SDK must NOT have been touched.
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('records the provider on the in-memory test queue (no schema column)', async () => {
    await sendEmail({
      to: 'qrec@example.com',
      subject: 'q',
      html: '<p>q</p>',
      templateKey: 'verification',
    });

    expect(_testEmailQueue).toHaveLength(1);
    const queued = _testEmailQueue[0]!;
    expect(queued.provider).toBe('mandrill');
    expect(queued.templateKey).toBe('verification');
  });

  it('persists OutboundEmail row PENDING → SENT (no provider column writes)', async () => {
    await sendEmail({
      to: 'persist@example.com',
      subject: 'p',
      html: '<p>p</p>',
      templateKey: 'payment-receipt',
    });

    // Audit row written exactly as in the SES path — no `provider` field
    // because we deliberately avoided a schema migration. The provider
    // is recovered from the runtime EMAIL_TRANSPORT env + log fields.
    const createArg = mockPrisma.outboundEmail.create.mock.calls[0]![0];
    expect(createArg.data.templateKey).toBe('payment-receipt');
    expect(createArg.data.status).toBe('PENDING');
    expect(createArg.data).not.toHaveProperty('provider');

    const updateArg = mockPrisma.outboundEmail.update.mock.calls[0]![0];
    expect(updateArg.data.status).toBe('SENT');
    expect(updateArg.data.messageId).toMatch(/^mandrill-mock-/);
  });

  it('default (no EMAIL_TRANSPORT set) still routes through SES — no behaviour change', async () => {
    delete process.env.EMAIL_TRANSPORT;
    process.env.NODE_ENV = 'test';

    const result = await sendEmail({
      to: 'default@example.com',
      subject: 'd',
      html: '<p>d</p>',
      templateKey: 'verification',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.provider).toBe('ses');
    expect(result.messageId).toMatch(/^mock-/);
  });
});
