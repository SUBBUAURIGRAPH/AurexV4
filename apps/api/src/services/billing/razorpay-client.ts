/**
 * AAT-RZP / Wave 7: thin Razorpay HTTP client.
 *
 * Wraps the three Razorpay calls we need: order creation, webhook
 * signature verification, and payment-success signature verification.
 * We deliberately AVOID the `razorpay` npm package — a direct fetch
 * wrapper is ~80 lines vs. dragging in a heavy dep, and lets us do the
 * HMAC verification with Node's built-in `crypto` module.
 *
 * Auth: Razorpay uses HTTP Basic with `KEY_ID:KEY_SECRET` base64-encoded.
 * Keys are read from env at module load:
 *   RAZORPAY_KEY_ID         → server-side key
 *   RAZORPAY_KEY_SECRET     → server-side secret
 *   RAZORPAY_WEBHOOK_SECRET → webhook HMAC secret
 *
 * Test injection: `createRazorpayClient({...})` lets tests pass keys
 * directly without setting env vars. The default `razorpayClient` export
 * is built from env at module load (lazy via getter so tests can override
 * env before first use).
 *
 * Money: amounts are integer subunit (paise/cents) — Razorpay requires
 * this and rejects floats.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '../../lib/logger.js';

// ─── Public types ──────────────────────────────────────────────────────

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  /** Override base URL — used in tests / staging. */
  baseUrl?: string;
  /** Inject fetch — defaults to globalThis.fetch. Useful for tests. */
  fetchImpl?: typeof fetch;
}

export interface CreateOrderInput {
  /** Amount in minor units (paise/cents). Razorpay rejects non-integers. */
  amount: number;
  /** ISO 4217 currency code, e.g. 'INR', 'USD'. */
  currency: string;
  /** Receipt — opaque, max 40 chars per Razorpay. */
  receipt: string;
  /** Optional notes, surfaced back on the order webhook payload. */
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: 'order';
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: 'created' | 'attempted' | 'paid';
  notes: Record<string, string>;
  created_at: number;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  razorpaySignature: string;
}

// ─── Errors ────────────────────────────────────────────────────────────

export class RazorpayClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'RazorpayClientError';
  }
}

// ─── Utils ─────────────────────────────────────────────────────────────

function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Constant-time hex compare. Razorpay returns hex-encoded HMACs; we use
 * `timingSafeEqual` so signature checks don't leak information through
 * micro-timing differences.
 */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// ─── Client ────────────────────────────────────────────────────────────

export interface RazorpayClient {
  createOrder(input: CreateOrderInput): Promise<RazorpayOrderResponse>;
  /**
   * Verify a Razorpay webhook delivery. The `rawBody` MUST be the raw
   * bytes of the request body — JSON.parse + JSON.stringify will likely
   * reorder keys and break the HMAC.
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
  /**
   * Verify the payment-success signature returned to the frontend by
   * Razorpay's Checkout modal. HMAC is computed over `${orderId}|${paymentId}`
   * with the merchant `keySecret` (NOT the webhook secret).
   */
  verifyPaymentSignature(input: VerifyPaymentInput): boolean;
  readonly publicKeyId: string;
}

export function createRazorpayClient(config: RazorpayConfig): RazorpayClient {
  if (!config.keyId || !config.keySecret || !config.webhookSecret) {
    throw new Error('Razorpay: keyId, keySecret, and webhookSecret are all required');
  }

  const baseUrl = config.baseUrl ?? 'https://api.razorpay.com/v1';
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Razorpay: no fetch implementation available (Node 18+ required)');
  }

  const authHeader = 'Basic ' + Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');

  return {
    publicKeyId: config.keyId,

    async createOrder(input: CreateOrderInput): Promise<RazorpayOrderResponse> {
      if (!Number.isInteger(input.amount) || input.amount < 0) {
        throw new Error(`Razorpay: createOrder amount must be a non-negative integer (got ${input.amount})`);
      }

      const body = {
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes ?? {},
      };

      const res = await fetchImpl(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text.length > 0 ? JSON.parse(text) : {};
      } catch {
        parsed = { raw: text };
      }

      if (!res.ok) {
        logger.error(
          { status: res.status, body: parsed, receipt: input.receipt },
          'Razorpay createOrder failed',
        );
        throw new RazorpayClientError(res.status, `Razorpay createOrder failed: ${res.status}`, parsed);
      }

      // Validate the shape we depend on. Razorpay returns more fields, but
      // we only use these and want to fail loud if the contract changes.
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as { id?: unknown }).id !== 'string'
      ) {
        throw new RazorpayClientError(502, 'Razorpay createOrder returned malformed response', parsed);
      }

      return parsed as RazorpayOrderResponse;
    },

    verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
      if (!signature || typeof signature !== 'string') return false;
      const expected = hmacSha256Hex(config.webhookSecret, rawBody);
      return safeEqualHex(expected, signature);
    },

    verifyPaymentSignature(input: VerifyPaymentInput): boolean {
      if (!input.orderId || !input.paymentId || !input.razorpaySignature) return false;
      const payload = `${input.orderId}|${input.paymentId}`;
      const expected = hmacSha256Hex(config.keySecret, payload);
      return safeEqualHex(expected, input.razorpaySignature);
    },
  };
}

// ─── Default singleton, env-driven ─────────────────────────────────────

/**
 * Resolve env config. In test env we permit missing keys (tests inject
 * the client explicitly). Anywhere else we throw at startup if the
 * required keys aren't set — billing routes must not silently launch
 * with empty creds.
 */
export function resolveRazorpayConfigFromEnv(): RazorpayConfig {
  const keyId = process.env.RAZORPAY_KEY_ID ?? '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

  if ((!keyId || !keySecret || !webhookSecret) && !isTest) {
    const missing = [
      !keyId && 'RAZORPAY_KEY_ID',
      !keySecret && 'RAZORPAY_KEY_SECRET',
      !webhookSecret && 'RAZORPAY_WEBHOOK_SECRET',
    ]
      .filter(Boolean)
      .join(', ');
    throw new Error(`Razorpay env vars missing: ${missing}`);
  }

  return {
    keyId: keyId || 'rzp_test_placeholder',
    keySecret: keySecret || 'placeholder_secret',
    webhookSecret: webhookSecret || 'placeholder_webhook',
  };
}

let _defaultClient: RazorpayClient | null = null;

/** Lazily construct the default singleton — env is read at first use. */
export function getRazorpayClient(): RazorpayClient {
  if (_defaultClient === null) {
    _defaultClient = createRazorpayClient(resolveRazorpayConfigFromEnv());
  }
  return _defaultClient;
}

/** Test-only: allow tests to inject a fake client. */
export function _setRazorpayClientForTests(client: RazorpayClient | null): void {
  _defaultClient = client;
}
