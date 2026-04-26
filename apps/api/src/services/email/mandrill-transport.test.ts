/**
 * AAT-MANDRILL: tests for the Mandrill (Mailchimp Transactional)
 * transport. We mock `global.fetch` so the suite never touches the
 * network. Coverage:
 *
 *   - Constructor:
 *       · throws MandrillKeyMissingError in non-test env without key
 *       · accepts mock-mode fixture key in test env
 *       · accepts MANDRILL_API_KEY when set
 *
 *   - send():
 *       · posts to https://mandrillapp.com/api/1.0/messages/send.json
 *       · request body shape (key, message.from_email, message.to,
 *         tags=['aurex'], headers.Reply-To, html, text)
 *       · extracts `_id` from the response array
 *       · maps status='rejected' to MandrillSendError(REJECTED)
 *       · maps status='invalid' to MandrillSendError(REJECTED)
 *       · network error → MandrillSendError(NETWORK)
 *       · HTTP 5xx → MandrillSendError(NETWORK) (no retry — mirrors SES)
 *       · empty array response → MandrillSendError(BAD_RESPONSE)
 *       · mock-mode short-circuits HTTP and pushes onto the queue
 *
 *   - ping():
 *       · 'PONG!' string response → true
 *       · non-200 → false
 *       · network failure → 'unknown'
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = global.fetch;
const fetchMock = vi.fn();

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.fetch = fetchMock as any;
  fetchMock.mockReset();
});

afterEach(() => {
  global.fetch = originalFetch;
});

import {
  MandrillTransport,
  MandrillKeyMissingError,
  MandrillSendError,
  _mandrillTestQueue,
  _resetMandrillTestQueue,
} from './mandrill-transport.js';

const SAVED_ENV: Record<string, string | undefined> = {};
const TRACKED_KEYS = ['NODE_ENV', 'MANDRILL_API_KEY', 'MANDRILL_MOCK_MODE'] as const;

beforeEach(() => {
  for (const k of TRACKED_KEYS) SAVED_ENV[k] = process.env[k];
  _resetMandrillTestQueue();
});

afterEach(() => {
  for (const k of TRACKED_KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ─── Constructor ───────────────────────────────────────────────────────

describe('MandrillTransport — constructor', () => {
  it('throws MandrillKeyMissingError when MANDRILL_API_KEY is unset in non-test env', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MANDRILL_API_KEY;
    delete process.env.MANDRILL_MOCK_MODE;
    expect(() => new MandrillTransport()).toThrow(MandrillKeyMissingError);
  });

  it('accepts a fixture key when NODE_ENV=test (no env var required)', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MANDRILL_API_KEY;
    delete process.env.MANDRILL_MOCK_MODE;
    expect(() => new MandrillTransport()).not.toThrow();
  });

  it('accepts a fixture key when MANDRILL_MOCK_MODE=1 (no env var required)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MANDRILL_API_KEY;
    process.env.MANDRILL_MOCK_MODE = '1';
    expect(() => new MandrillTransport()).not.toThrow();
  });

  it('accepts a real-looking MANDRILL_API_KEY in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MANDRILL_API_KEY = 'md-real-looking-key-1234';
    delete process.env.MANDRILL_MOCK_MODE;
    expect(() => new MandrillTransport()).not.toThrow();
  });
});

// ─── send() ────────────────────────────────────────────────────────────

describe('MandrillTransport — send (mock mode)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('mock mode pushes onto the in-memory queue without calling fetch', async () => {
    const t = new MandrillTransport();
    const result = await t.send({
      to: 'qa@example.com',
      from: 'noreply@aurex.in',
      replyTo: 'contact@aurex.in',
      subject: 'mock subject',
      html: '<p>mock html</p>',
      text: 'mock text',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.messageId).toMatch(/^mandrill-mock-/);
    expect(_mandrillTestQueue).toHaveLength(1);
    const queued = _mandrillTestQueue[0]!;
    expect(queued.to).toBe('qa@example.com');
    expect(queued.subject).toBe('mock subject');
    expect(queued.html).toBe('<p>mock html</p>');
    expect(queued.replyTo).toBe('contact@aurex.in');
  });
});

describe('MandrillTransport — send (live mode)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.MANDRILL_API_KEY = 'md-live-test-key';
    delete process.env.MANDRILL_MOCK_MODE;
  });

  it('POSTs to messages/send.json with the documented request body shape', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [{ _id: 'msg-1', email: 'r@x.com', status: 'sent' }]),
    );

    const t = new MandrillTransport();
    await t.send({
      to: 'recipient@example.com',
      from: 'noreply@aurex.in',
      replyTo: 'contact@aurex.in',
      subject: 'Subject',
      html: '<h1>html</h1>',
      text: 'plain',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://mandrillapp.com/api/1.0/messages/send.json');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.key).toBe('md-live-test-key');
    expect(body.message.from_email).toBe('noreply@aurex.in');
    expect(body.message.from_name).toBe('Aurex');
    expect(body.message.to).toEqual([
      { email: 'recipient@example.com', type: 'to' },
    ]);
    expect(body.message.subject).toBe('Subject');
    expect(body.message.html).toBe('<h1>html</h1>');
    expect(body.message.text).toBe('plain');
    expect(body.message.headers).toEqual({ 'Reply-To': 'contact@aurex.in' });
    expect(body.message.tags).toEqual(['aurex']);
  });

  it('extracts _id from the Mandrill response array as the messageId', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        { _id: 'mandrill-id-abc-123', email: 'r@x.com', status: 'sent' },
      ]),
    );

    const t = new MandrillTransport();
    const out = await t.send({
      to: 'r@x.com',
      from: 'noreply@aurex.in',
      subject: 's',
      html: '<p>h</p>',
    });

    expect(out.messageId).toBe('mandrill-id-abc-123');
  });

  it('maps status="rejected" to MandrillSendError(REJECTED) carrying the reject_reason', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        {
          _id: 'msg-x',
          email: 'r@x.com',
          status: 'rejected',
          reject_reason: 'hard-bounce',
        },
      ]),
    );

    const t = new MandrillTransport();
    await expect(
      t.send({
        to: 'r@x.com',
        from: 'noreply@aurex.in',
        subject: 's',
        html: '<p>h</p>',
      }),
    ).rejects.toMatchObject({
      name: 'MandrillSendError',
      code: 'REJECTED',
      rejectReason: 'hard-bounce',
      status: 'rejected',
    });
  });

  it('maps status="invalid" to MandrillSendError(REJECTED)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [{ _id: 'msg-x', email: 'r@x.com', status: 'invalid' }]),
    );

    const t = new MandrillTransport();
    const err = await t
      .send({
        to: 'r@x.com',
        from: 'noreply@aurex.in',
        subject: 's',
        html: '<p>h</p>',
      })
      .catch(e => e);

    expect(err).toBeInstanceOf(MandrillSendError);
    expect((err as MandrillSendError).code).toBe('REJECTED');
  });

  it('network failure → MandrillSendError(NETWORK)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection reset'));

    const t = new MandrillTransport();
    const err = await t
      .send({
        to: 'r@x.com',
        from: 'noreply@aurex.in',
        subject: 's',
        html: '<p>h</p>',
      })
      .catch(e => e);

    expect(err).toBeInstanceOf(MandrillSendError);
    expect((err as MandrillSendError).code).toBe('NETWORK');
    expect((err as Error).message).toMatch(/connection reset/);
  });

  it('HTTP 5xx → MandrillSendError(NETWORK) and does NOT retry (mirrors SES behaviour)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { name: 'ServiceUnavailable', message: 'busy' }),
    );

    const t = new MandrillTransport();
    const err = await t
      .send({
        to: 'r@x.com',
        from: 'noreply@aurex.in',
        subject: 's',
        html: '<p>h</p>',
      })
      .catch(e => e);

    expect(err).toBeInstanceOf(MandrillSendError);
    expect((err as MandrillSendError).code).toBe('NETWORK');
    expect((err as MandrillSendError).httpStatus).toBe(503);
    // Critical — no retry. The SES path doesn't retry either.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('empty array response → MandrillSendError(BAD_RESPONSE)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    const t = new MandrillTransport();
    const err = await t
      .send({
        to: 'r@x.com',
        from: 'noreply@aurex.in',
        subject: 's',
        html: '<p>h</p>',
      })
      .catch(e => e);

    expect(err).toBeInstanceOf(MandrillSendError);
    expect((err as MandrillSendError).code).toBe('BAD_RESPONSE');
  });
});

// ─── ping() ────────────────────────────────────────────────────────────

describe('MandrillTransport — ping', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.MANDRILL_API_KEY = 'md-ping-test-key';
    delete process.env.MANDRILL_MOCK_MODE;
  });

  it("returns true when Mandrill answers with 'PONG!'", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, 'PONG!'));
    const t = new MandrillTransport();
    expect(await t.ping()).toBe(true);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://mandrillapp.com/api/1.0/users/ping.json');
  });

  it('returns false when Mandrill returns non-200', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { name: 'Invalid_Key', message: 'Invalid API key' }),
    );
    const t = new MandrillTransport();
    expect(await t.ping()).toBe(false);
  });

  it("returns 'unknown' on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error('ENOTFOUND'));
    const t = new MandrillTransport();
    expect(await t.ping()).toBe('unknown');
  });
});
