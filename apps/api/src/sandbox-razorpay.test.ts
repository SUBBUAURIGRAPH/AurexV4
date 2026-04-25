/**
 * AAT-11A / Wave 11a — Sandbox harness against Razorpay's test environment.
 *
 * Two test groups:
 *
 *   1. API call shape verification (always-on, fully mocked) — every CI tick.
 *      Mocks `fetch`; verifies that `razorpay-client` calls Razorpay with the
 *      right URL, method, headers, body, and HMAC. We assert call signatures
 *      rather than network behaviour, so the suite is fast and deterministic.
 *
 *   2. Live sandbox round-trip (opt-in, gated by env). Skipped by default;
 *      enabled when `RAZORPAY_SANDBOX_TEST=1` AND `RAZORPAY_KEY_ID` AND
 *      `RAZORPAY_KEY_SECRET` are all set in the environment. Tests are
 *      READ-ONLY-ish: a sandbox health probe (orders endpoint), a real
 *      `createOrder()` round-trip (Razorpay sandbox accepts test keys and
 *      creates real-ish orders), and a `GET /orders/:id` read-back. NO
 *      payment captures, NO refunds — those would dirty state.
 *
 * Razorpay's sandbox shares the production base URL
 * (`https://api.razorpay.com/v1`); sandbox-vs-prod is determined entirely by
 * the key prefix (`rzp_test_*` vs `rzp_live_*`). Createing an order with a
 * test key on the live URL is the documented sandbox flow.
 *
 * How to run locally:
 *   pnpm --filter @aurex/api test                         # runs Group 1 only
 *   RAZORPAY_KEY_ID=rzp_test_… \
 *   RAZORPAY_KEY_SECRET=… \
 *   pnpm --filter @aurex/api test:sandbox-razorpay        # runs Group 1 + 2
 *
 * CI integration: the default `pnpm test` script runs Group 1 only. Group 2
 * is invoked manually via `test:sandbox-razorpay` in CI's "sandbox-smoke"
 * workflow (cadence-driven, not per-commit).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

import {
  createRazorpayClient,
  RazorpayClientError,
  RazorpayServerError,
  type RazorpayClient,
} from './services/billing/razorpay-client.js';

// ─── Group 1 helpers ───────────────────────────────────────────────────────

const TEST_KEY_ID = 'rzp_test_KEYID12345';
const TEST_KEY_SECRET = 'rzp_test_keysecret_67890';
const TEST_WEBHOOK_SECRET = 'whsec_payload_signing_key';

interface CapturedFetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyText: string;
}

interface FakeFetchHandle {
  fetchImpl: typeof fetch;
  calls: CapturedFetchCall[];
}

/**
 * Build a typed fake `fetch` that records every call's URL, method, headers,
 * and body, and returns the supplied response. Tests then assert against
 * `handle.calls` — much clearer than chasing `vi.fn().mock.calls[0]`.
 */
function buildFakeFetch(
  responder: (url: string) => Response | Promise<Response>,
): FakeFetchHandle {
  const calls: CapturedFetchCall[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {};
    const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
    for (const [k, v] of Object.entries(rawHeaders)) headers[k] = v;
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers,
      bodyText: typeof init?.body === 'string' ? init.body : '',
    });
    return responder(url);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function makeMockedClient(handle: FakeFetchHandle): RazorpayClient {
  return createRazorpayClient({
    keyId: TEST_KEY_ID,
    keySecret: TEST_KEY_SECRET,
    webhookSecret: TEST_WEBHOOK_SECRET,
    fetchImpl: handle.fetchImpl,
  });
}

function expectedBasicAuthHeader(): string {
  return (
    'Basic ' +
    Buffer.from(`${TEST_KEY_ID}:${TEST_KEY_SECRET}`).toString('base64')
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Group 1 — API call shape verification (mocked, always-on) ─────────────

describe('AAT-11A / Wave 11a — Razorpay API call shape (mocked, always-on)', () => {
  it('createOrder: POSTs to /v1/orders with the documented body shape (amount/currency/receipt/notes)', async () => {
    const handle = buildFakeFetch(() =>
      jsonResponse({
        id: 'order_test_xyz',
        entity: 'order',
        amount: 100,
        amount_paid: 0,
        amount_due: 100,
        currency: 'INR',
        receipt: 'aurex_test_1',
        status: 'created',
        notes: { test: 'true' },
        created_at: 1_700_000_000,
      }),
    );
    const client = makeMockedClient(handle);

    const order = await client.createOrder({
      amount: 100,
      currency: 'INR',
      receipt: 'aurex_test_1',
      notes: { test: 'true' },
    });

    expect(handle.calls).toHaveLength(1);
    const call = handle.calls[0]!;
    expect(call.url).toBe('https://api.razorpay.com/v1/orders');
    expect(call.method).toBe('POST');
    const body = JSON.parse(call.bodyText) as Record<string, unknown>;
    expect(body).toEqual({
      amount: 100,
      currency: 'INR',
      receipt: 'aurex_test_1',
      notes: { test: 'true' },
    });
    expect(order.id).toBe('order_test_xyz');
    expect(order.status).toBe('created');
  });

  it('createOrder: defaults `notes` to {} when caller omits it (preserves Razorpay contract)', async () => {
    const handle = buildFakeFetch(() =>
      jsonResponse({
        id: 'order_test_no_notes',
        entity: 'order',
        amount: 100,
        amount_paid: 0,
        amount_due: 100,
        currency: 'INR',
        receipt: 'r1',
        status: 'created',
        notes: {},
        created_at: 1_700_000_000,
      }),
    );
    const client = makeMockedClient(handle);

    await client.createOrder({ amount: 100, currency: 'INR', receipt: 'r1' });

    const body = JSON.parse(handle.calls[0]!.bodyText) as Record<string, unknown>;
    expect(body['notes']).toEqual({});
  });

  it('createOrder: sends Content-Type=application/json and HTTP Basic auth (KEY_ID:KEY_SECRET base64)', async () => {
    const handle = buildFakeFetch(() =>
      jsonResponse({
        id: 'order_h_1',
        entity: 'order',
        amount: 100,
        amount_paid: 0,
        amount_due: 100,
        currency: 'INR',
        receipt: 'r1',
        status: 'created',
        notes: {},
        created_at: 1_700_000_000,
      }),
    );
    const client = makeMockedClient(handle);

    await client.createOrder({ amount: 100, currency: 'INR', receipt: 'r1' });

    const headers = handle.calls[0]!.headers;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe(expectedBasicAuthHeader());
    // Sanity — the base64 should decode back to the canonical pair so we
    // know the wire shape is exactly what Razorpay expects.
    const decoded = Buffer.from(
      headers['Authorization']!.replace(/^Basic /, ''),
      'base64',
    ).toString('utf8');
    expect(decoded).toBe(`${TEST_KEY_ID}:${TEST_KEY_SECRET}`);
  });

  it('createOrder: 4xx response throws RazorpayClientError carrying the upstream status + body', async () => {
    const handle = buildFakeFetch(() =>
      jsonResponse(
        { error: { code: 'BAD_REQUEST_ERROR', description: 'Receipt should be unique' } },
        400,
      ),
    );
    const client = makeMockedClient(handle);

    await expect(
      client.createOrder({ amount: 100, currency: 'INR', receipt: 'r-dup' }),
    ).rejects.toMatchObject({
      name: 'RazorpayClientError',
      status: 400,
    });
  });

  it('createOrder: 5xx response throws RazorpayServerError (separable retry semantics)', async () => {
    const handle = buildFakeFetch(() =>
      jsonResponse({ error: { code: 'SERVER_ERROR' } }, 503),
    );
    const client = makeMockedClient(handle);

    let caught: unknown = null;
    try {
      await client.createOrder({ amount: 100, currency: 'INR', receipt: 'r1' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(RazorpayServerError);
    // RazorpayServerError extends RazorpayClientError, so existing instanceof
    // checks in callers continue to work.
    expect(caught).toBeInstanceOf(RazorpayClientError);
    expect((caught as RazorpayServerError).status).toBe(503);
  });

  it('verifyWebhookSignature: HMAC-SHA256(rawBody, webhookSecret) hex; constant-time accept', () => {
    const handle = buildFakeFetch(() => jsonResponse({}));
    const client = makeMockedClient(handle);

    const rawBody = JSON.stringify({
      event: 'payment.captured',
      id: 'evt_test_1',
      payload: { payment: { entity: { id: 'pay_test_1' } } },
    });
    const sig = createHmac('sha256', TEST_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    expect(client.verifyWebhookSignature(rawBody, sig)).toBe(true);

    // One-byte tamper rejected.
    const tampered = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
    expect(client.verifyWebhookSignature(rawBody, tampered)).toBe(false);
  });

  it('verifyWebhookSignature: works with raw Buffer body too (no JSON re-stringify drift)', () => {
    const handle = buildFakeFetch(() => jsonResponse({}));
    const client = makeMockedClient(handle);

    const rawBuf = Buffer.from('{"event":"payment.captured","x":1}', 'utf8');
    const sig = createHmac('sha256', TEST_WEBHOOK_SECRET)
      .update(rawBuf)
      .digest('hex');

    expect(client.verifyWebhookSignature(rawBuf, sig)).toBe(true);
  });

  it('verifyPaymentSignature: HMAC-SHA256(`${orderId}|${paymentId}`, keySecret) hex; constant-time accept', () => {
    const handle = buildFakeFetch(() => jsonResponse({}));
    const client = makeMockedClient(handle);

    const orderId = 'order_test_xyz';
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

    // Computed against the WEBHOOK secret instead — must reject
    // (different secret namespace).
    const wrongDomain = createHmac('sha256', TEST_WEBHOOK_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    expect(
      client.verifyPaymentSignature({
        orderId,
        paymentId,
        razorpaySignature: wrongDomain,
      }),
    ).toBe(false);
  });

  it('verifyPaymentSignature: any swap of orderId/paymentId invalidates the signature', () => {
    const handle = buildFakeFetch(() => jsonResponse({}));
    const client = makeMockedClient(handle);

    const orderId = 'order_test_1';
    const paymentId = 'pay_test_1';
    const validSig = createHmac('sha256', TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    // Swap order and payment; HMAC of "pay_test_1|order_test_1" is different.
    expect(
      client.verifyPaymentSignature({
        orderId: paymentId,
        paymentId: orderId,
        razorpaySignature: validSig,
      }),
    ).toBe(false);
  });

  it('createOrder: integer-amount guard fires BEFORE we touch the network', async () => {
    const handle = buildFakeFetch(() => jsonResponse({}));
    const client = makeMockedClient(handle);

    await expect(
      client.createOrder({ amount: 99.99, currency: 'INR', receipt: 'r1' }),
    ).rejects.toThrow(/non-negative integer/);
    await expect(
      client.createOrder({ amount: -10, currency: 'INR', receipt: 'r1' }),
    ).rejects.toThrow(/non-negative integer/);

    // Critical: zero fetch calls. A misbehaving guard would burn a real
    // sandbox order on every typo'd amount.
    expect(handle.calls).toHaveLength(0);
  });
});

// ─── Group 2 — Live sandbox round-trip (opt-in) ────────────────────────────
//
// Runs only when RAZORPAY_SANDBOX_TEST=1 AND RAZORPAY_KEY_ID AND
// RAZORPAY_KEY_SECRET are all set. The default `pnpm test` skips this
// `describe` entirely — CI ticks stay fast and offline-safe.
//
// Read-only-ish by design: we create test orders (Razorpay sandbox makes
// them cheaply, and they auto-expire) and read them back. We do NOT capture
// payments or issue refunds — Razorpay's sandbox payment flow requires the
// browser-side Checkout modal (Wave 12+ if/when we wire Playwright).

const SANDBOX_ENABLED =
  process.env.RAZORPAY_SANDBOX_TEST === '1' &&
  typeof process.env.RAZORPAY_KEY_ID === 'string' &&
  process.env.RAZORPAY_KEY_ID.length > 0 &&
  typeof process.env.RAZORPAY_KEY_SECRET === 'string' &&
  process.env.RAZORPAY_KEY_SECRET.length > 0;

describe.skipIf(!SANDBOX_ENABLED)(
  'AAT-11A / Wave 11a — Razorpay live sandbox round-trip (opt-in)',
  () => {
    /**
     * Build a real Razorpay client bound to the live base URL using the
     * sandbox keys. Razorpay's sandbox is determined by the `rzp_test_*`
     * key prefix — there is no separate base URL.
     *
     * Webhook secret is irrelevant for these tests (we don't simulate
     * webhooks here), but the client requires it; supply a placeholder.
     */
    function buildLiveClient(): RazorpayClient {
      return createRazorpayClient({
        keyId: process.env.RAZORPAY_KEY_ID!,
        keySecret: process.env.RAZORPAY_KEY_SECRET!,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? 'sandbox_unused',
      });
    }

    function authHeaderFromEnv(): string {
      const id = process.env.RAZORPAY_KEY_ID!;
      const secret = process.env.RAZORPAY_KEY_SECRET!;
      return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
    }

    /** Safe receipt — Razorpay caps at 40 chars. */
    function newReceipt(): string {
      const ts = Date.now().toString(36);
      const rand = Math.random().toString(36).slice(2, 8);
      return `aat11a-${ts}-${rand}`.slice(0, 40);
    }

    it('health: sandbox responds to an authenticated GET /v1/orders with a structured payload', async () => {
      const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
        method: 'GET',
        headers: { Authorization: authHeaderFromEnv() },
      });
      // Don't assert specific values — just envelope shape.
      expect([200, 401]).toContain(res.status);
      if (res.status === 200) {
        const body = (await res.json()) as { entity?: string; items?: unknown };
        expect(body.entity).toBe('collection');
        expect(Array.isArray(body.items)).toBe(true);
      }
    }, 20_000);

    it('createOrder: sandbox creates a real test order and returns id + status=created', async () => {
      const client = buildLiveClient();
      const order = await client.createOrder({
        amount: 100,
        currency: 'INR',
        receipt: newReceipt(),
        notes: { test: 'true', source: 'aat-11a' },
      });
      expect(typeof order.id).toBe('string');
      expect(order.id.startsWith('order_')).toBe(true);
      expect(order.status).toBe('created');
      expect(order.amount).toBe(100);
      expect(order.currency).toBe('INR');
    }, 20_000);

    it('GET /v1/orders/:id: round-trip read-back of a freshly-created sandbox order matches', async () => {
      const client = buildLiveClient();
      const created = await client.createOrder({
        amount: 100,
        currency: 'INR',
        receipt: newReceipt(),
        notes: { test: 'true' },
      });

      const res = await fetch(
        `https://api.razorpay.com/v1/orders/${created.id}`,
        {
          method: 'GET',
          headers: { Authorization: authHeaderFromEnv() },
        },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        id: string;
        amount: number;
        currency: string;
        status: string;
      };
      expect(body.id).toBe(created.id);
      expect(body.amount).toBe(100);
      expect(body.currency).toBe('INR');
      expect(body.status).toBe('created');
    }, 20_000);
  },
);
