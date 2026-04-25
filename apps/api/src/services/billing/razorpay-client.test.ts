/**
 * AAT-RZP / Wave 7: razorpay-client tests.
 *
 * Pure unit tests — no DB dependency. Verifies HMAC math, fetch contract,
 * and env-var startup behaviour.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  createRazorpayClient,
  resolveRazorpayConfigFromEnv,
  RazorpayClientError,
} from './razorpay-client.js';

const TEST_KEY_ID = 'rzp_test_KEYID12345';
const TEST_KEY_SECRET = 'rzp_test_keysecret_67890';
const TEST_WEBHOOK_SECRET = 'whsec_payload_signing_key';

function makeClient(opts: { fetchImpl?: typeof fetch } = {}) {
  return createRazorpayClient({
    keyId: TEST_KEY_ID,
    keySecret: TEST_KEY_SECRET,
    webhookSecret: TEST_WEBHOOK_SECRET,
    fetchImpl: opts.fetchImpl,
  });
}

describe('createRazorpayClient', () => {
  it('throws when any required key is missing', () => {
    expect(() =>
      createRazorpayClient({ keyId: '', keySecret: 'x', webhookSecret: 'x' }),
    ).toThrow(/keyId, keySecret, and webhookSecret/);
    expect(() =>
      createRazorpayClient({ keyId: 'x', keySecret: '', webhookSecret: 'x' }),
    ).toThrow(/keyId, keySecret, and webhookSecret/);
    expect(() =>
      createRazorpayClient({ keyId: 'x', keySecret: 'x', webhookSecret: '' }),
    ).toThrow(/keyId, keySecret, and webhookSecret/);
  });

  it('exposes publicKeyId without the secret', () => {
    const client = makeClient();
    expect(client.publicKeyId).toBe(TEST_KEY_ID);
    // No secret leak (sanity).
    expect(JSON.stringify(client)).not.toContain(TEST_KEY_SECRET);
  });
});

// ─── createOrder ───────────────────────────────────────────────────────

describe('createOrder', () => {
  it('POSTs to /orders with HTTP Basic auth + integer amount + returns parsed body', async () => {
    const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.razorpay.com/v1/orders');
      expect(init?.method).toBe('POST');
      // Basic auth header check.
      const auth = (init?.headers as Record<string, string>)['Authorization'];
      const expected =
        'Basic ' + Buffer.from(`${TEST_KEY_ID}:${TEST_KEY_SECRET}`).toString('base64');
      expect(auth).toBe(expected);
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        amount: 499900,
        currency: 'INR',
        receipt: 'aurex_abcd_1',
        notes: { tier: 'msme' },
      });
      return new Response(
        JSON.stringify({
          id: 'order_test_xyz',
          entity: 'order',
          amount: 499900,
          amount_paid: 0,
          amount_due: 499900,
          currency: 'INR',
          receipt: 'aurex_abcd_1',
          status: 'created',
          notes: { tier: 'msme' },
          created_at: 1234567890,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const client = makeClient({ fetchImpl: fakeFetch });
    const order = await client.createOrder({
      amount: 499900,
      currency: 'INR',
      receipt: 'aurex_abcd_1',
      notes: { tier: 'msme' },
    });

    expect(order.id).toBe('order_test_xyz');
    expect(order.status).toBe('created');
    expect(order.amount).toBe(499900);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects non-integer amounts before hitting the network', async () => {
    const fakeFetch = vi.fn() as unknown as typeof fetch;
    const client = makeClient({ fetchImpl: fakeFetch });
    await expect(
      client.createOrder({ amount: 100.5, currency: 'INR', receipt: 'r1' }),
    ).rejects.toThrow(/non-negative integer/);
    await expect(
      client.createOrder({ amount: -1, currency: 'INR', receipt: 'r1' }),
    ).rejects.toThrow(/non-negative integer/);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('throws RazorpayClientError on non-2xx', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { description: 'bad request' } }), { status: 400 }),
    ) as unknown as typeof fetch;
    const client = makeClient({ fetchImpl: fakeFetch });
    await expect(
      client.createOrder({ amount: 100, currency: 'INR', receipt: 'r1' }),
    ).rejects.toBeInstanceOf(RazorpayClientError);
  });

  it('throws when Razorpay returns malformed JSON (no id field)', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify({ entity: 'order' /* no id */ }), { status: 200 }),
    ) as unknown as typeof fetch;
    const client = makeClient({ fetchImpl: fakeFetch });
    await expect(
      client.createOrder({ amount: 100, currency: 'INR', receipt: 'r1' }),
    ).rejects.toThrow(/malformed response/);
  });
});

// ─── verifyWebhookSignature ────────────────────────────────────────────

describe('verifyWebhookSignature', () => {
  it('accepts a signature computed from the same secret + raw body', () => {
    const client = makeClient();
    const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_1' });
    const sig = createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawBody).digest('hex');
    expect(client.verifyWebhookSignature(rawBody, sig)).toBe(true);
  });

  it('rejects a signature with one byte tampered', () => {
    const client = makeClient();
    const rawBody = '{"event":"payment.captured"}';
    const valid = createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawBody).digest('hex');
    const tampered = valid.slice(0, -2) + (valid.endsWith('00') ? '11' : '00');
    expect(client.verifyWebhookSignature(rawBody, tampered)).toBe(false);
  });

  it('rejects missing / empty signatures', () => {
    const client = makeClient();
    expect(client.verifyWebhookSignature('body', '')).toBe(false);
    // @ts-expect-error testing runtime safety against bad input
    expect(client.verifyWebhookSignature('body', undefined)).toBe(false);
  });

  it('rejects signatures of the wrong length (different hash output)', () => {
    const client = makeClient();
    expect(client.verifyWebhookSignature('body', 'deadbeef')).toBe(false);
  });
});

// ─── verifyPaymentSignature ────────────────────────────────────────────

describe('verifyPaymentSignature', () => {
  it('accepts a signature computed as HMAC(keySecret, "orderId|paymentId")', () => {
    const client = makeClient();
    const orderId = 'order_test_123';
    const paymentId = 'pay_test_abc';
    const sig = createHmac('sha256', TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    expect(
      client.verifyPaymentSignature({
        orderId,
        paymentId,
        razorpaySignature: sig,
      }),
    ).toBe(true);
  });

  it('rejects a forged signature (wrong secret)', () => {
    const client = makeClient();
    const orderId = 'order_test_123';
    const paymentId = 'pay_test_abc';
    const wrongSig = createHmac('sha256', 'wrong_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    expect(
      client.verifyPaymentSignature({
        orderId,
        paymentId,
        razorpaySignature: wrongSig,
      }),
    ).toBe(false);
  });

  it('rejects when any of order id / payment id / signature is missing', () => {
    const client = makeClient();
    expect(
      client.verifyPaymentSignature({ orderId: '', paymentId: 'p', razorpaySignature: 's' }),
    ).toBe(false);
    expect(
      client.verifyPaymentSignature({ orderId: 'o', paymentId: '', razorpaySignature: 's' }),
    ).toBe(false);
    expect(
      client.verifyPaymentSignature({ orderId: 'o', paymentId: 'p', razorpaySignature: '' }),
    ).toBe(false);
  });
});

// ─── env resolution ────────────────────────────────────────────────────

describe('resolveRazorpayConfigFromEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it('returns placeholders in test env when keys are missing', () => {
    process.env.NODE_ENV = 'test';
    const cfg = resolveRazorpayConfigFromEnv();
    expect(cfg.keyId).toBeTruthy();
    expect(cfg.keySecret).toBeTruthy();
    expect(cfg.webhookSecret).toBeTruthy();
  });

  it('throws in non-test env when any key is missing', () => {
    const oldNode = process.env.NODE_ENV;
    const oldVitest = process.env.VITEST;
    delete process.env.VITEST;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => resolveRazorpayConfigFromEnv()).toThrow(/RAZORPAY_KEY_ID/);
    } finally {
      process.env.NODE_ENV = oldNode;
      if (oldVitest !== undefined) process.env.VITEST = oldVitest;
      // Restore other keys we cleared.
      Object.assign(process.env, originalEnv);
    }
  });

  it('reads provided env values when present', () => {
    process.env.NODE_ENV = 'test';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_real';
    process.env.RAZORPAY_KEY_SECRET = 'real_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'real_webhook';
    const cfg = resolveRazorpayConfigFromEnv();
    expect(cfg.keyId).toBe('rzp_test_real');
    expect(cfg.keySecret).toBe('real_secret');
    expect(cfg.webhookSecret).toBe('real_webhook');
  });
});
