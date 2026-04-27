/**
 * AAT-CHECKOUT / Wave 8a: contract tests for the billing hooks.
 *
 * Mirrors `useCoupons.test.ts`: jsdom + RTL aren't wired up in apps/web
 * yet, so we exercise the URL contracts via a stubbed fetch and the
 * pure-type shapes inline. Component-level (RTL) coverage of the wizard
 * checkout flow is parked behind the existing skip-gated convention
 * until @testing-library/react lands.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CheckoutInitResponse,
  FinaliseCheckoutResponse,
  MySubscription,
  StartCheckoutInput,
} from './useBilling';

// ── Type-shape contracts ──────────────────────────────────────────────────

describe('useBilling types', () => {
  it('StartCheckoutInput accepts plan + optional perSiteCount + couponCode', () => {
    const minimal: StartCheckoutInput = { plan: 'MSME_INDIA' };
    const full: StartCheckoutInput = {
      plan: 'ENTERPRISE_INDIA',
      perSiteCount: 5,
      couponCode: 'HEF-PUNE-2026',
    };
    expect(minimal.plan).toBe('MSME_INDIA');
    expect(full.perSiteCount).toBe(5);
    expect(full.couponCode).toBe('HEF-PUNE-2026');
  });

  it('CheckoutInitResponse covers both Razorpay + skipped paths', () => {
    const live: CheckoutInitResponse = {
      subscriptionId: 'sub_1',
      orderId: 'order_OXKoAh',
      keyId: 'rzp_test_xxx',
      amount: 589882,
      currency: 'INR',
      subtotalMinor: 499900,
      discountMinor: 0,
      taxMinor: 89982,
      skippedRazorpay: false,
      status: 'PENDING',
      appliedCouponCode: null,
    };
    const skipped: CheckoutInitResponse = {
      subscriptionId: 'sub_2',
      orderId: null,
      keyId: null,
      amount: 0,
      currency: 'INR',
      subtotalMinor: 499900,
      discountMinor: 499900,
      taxMinor: 0,
      skippedRazorpay: true,
      status: 'ACTIVE',
      appliedCouponCode: 'HEF-PUNE-2026',
    };
    expect(live.skippedRazorpay).toBe(false);
    expect(live.orderId).toBe('order_OXKoAh');
    expect(skipped.skippedRazorpay).toBe(true);
    expect(skipped.orderId).toBeNull();
    expect(skipped.appliedCouponCode).toBe('HEF-PUNE-2026');
  });

  it('FinaliseCheckoutResponse exposes invoiceNumber + alreadyActive', () => {
    const r: FinaliseCheckoutResponse = {
      subscriptionId: 'sub_1',
      status: 'ACTIVE',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 365 * 86400_000).toISOString(),
      invoiceNumber: 'INV-2026-000123',
      alreadyActive: false,
    };
    expect(r.status).toBe('ACTIVE');
    expect(r.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
  });

  it('MySubscription preserves currency + perSiteCount', () => {
    const sub: MySubscription = {
      id: 'sub_1',
      organizationId: 'org_1',
      plan: 'ENTERPRISE_INDIA',
      region: 'INDIA',
      status: 'ACTIVE',
      currency: 'INR',
      amountMinor: 999900,
      perSiteCount: 3,
      totalAmountMinor: 3539646,
      startsAt: null,
      endsAt: null,
      appliedCouponCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(sub.perSiteCount).toBe(3);
    expect(sub.currency).toBe('INR');
  });
});

// ── Fetch URL contracts (stubbed fetch) ───────────────────────────────────

interface FetchCall {
  input: string;
  init: RequestInit | undefined;
}

let fetchCalls: FetchCall[] = [];

beforeEach(() => {
  fetchCalls = [];
  // Stub localStorage — apps/web tests run in node, no jsdom yet.
  const store = new Map<string, string>();
   
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ input: String(input), init });
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: null }),
      text: async () => '',
    } as unknown as Response;
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.unstubAllGlobals();
   
  delete (globalThis as any).localStorage;
});

describe('useStartCheckout contract', () => {
  it('POSTs to /billing/checkout with plan + perSiteCount (single /api/v1 prefix)', async () => {
    const { api } = await import('../lib/api');
    await api.post('/billing/checkout', { plan: 'ENTERPRISE_INDIA', perSiteCount: 3 });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.input).toBe('/api/v1/billing/checkout');
    expect(fetchCalls[0]!.init?.method).toBe('POST');
    const body = JSON.parse(String(fetchCalls[0]!.init?.body ?? '{}')) as Record<string, unknown>;
    expect(body.plan).toBe('ENTERPRISE_INDIA');
    expect(body.perSiteCount).toBe(3);
  });

  it('forwards couponCode when supplied', async () => {
    const { api } = await import('../lib/api');
    await api.post('/billing/checkout', {
      plan: 'MSME_INDIA',
      couponCode: 'HEF-PUNE-2026',
    });
    expect(fetchCalls).toHaveLength(1);
    const body = JSON.parse(String(fetchCalls[0]!.init?.body ?? '{}')) as Record<string, unknown>;
    expect(body.couponCode).toBe('HEF-PUNE-2026');
  });
});

describe('useFinaliseCheckout contract', () => {
  it('POSTs to /billing/checkout/success with the three Razorpay fields', async () => {
    const { api } = await import('../lib/api');
    await api.post('/billing/checkout/success', {
      razorpayOrderId: 'order_OXKoAh',
      razorpayPaymentId: 'pay_OXKoBC',
      razorpaySignature: 'abc123sig',
    });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.input).toBe('/api/v1/billing/checkout/success');
    expect(fetchCalls[0]!.init?.method).toBe('POST');
    const body = JSON.parse(String(fetchCalls[0]!.init?.body ?? '{}')) as Record<string, unknown>;
    expect(body.razorpayOrderId).toBe('order_OXKoAh');
    expect(body.razorpayPaymentId).toBe('pay_OXKoBC');
    expect(body.razorpaySignature).toBe('abc123sig');
  });
});

describe('useMySubscription contract', () => {
  it('GETs /billing/subscriptions/me (single /api/v1 prefix)', async () => {
    const { api } = await import('../lib/api');
    await api.get('/billing/subscriptions/me');
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.input).toBe('/api/v1/billing/subscriptions/me');
    expect(fetchCalls[0]!.init?.method).toBe('GET');
  });
});

// ── Razorpay loader behaviour ─────────────────────────────────────────────
//
// The loader reaches for `document` / `window` so it can't run end-to-end
// without jsdom. We at least cover the SSR-safety rejection path so a
// future server-rendered route doesn't crash on import.

describe('loadRazorpayCheckout SSR safety', () => {
  it('rejects when window is undefined', async () => {
    const original = globalThis.window;
     
    (globalThis as any).window = undefined;
    try {
      const { loadRazorpayCheckout } = await import('../lib/razorpay');
      await expect(loadRazorpayCheckout()).rejects.toThrow(/browser/i);
    } finally {
       
      (globalThis as any).window = original;
    }
  });
});

// ── DOM-rendering tests (intent only — enabled when RTL lands) ────────────
//
// Once @testing-library/react + jsdom land in apps/web, the following
// describe.skip block becomes describe(...) and verifies the wizard
// plan-picker → Razorpay flow end-to-end:
//
//   describe('OnboardingPage step 2 → Razorpay', () => {
//     it('renders 4 enabled "Continue" buttons when no trial is active');
//     it('opens the Razorpay modal on Continue with the returned keyId/orderId');
//     it('skips the modal when skippedRazorpay=true and advances to step 3');
//     it('shows a "Payment cancelled" toast on modal dismiss and stays on step 2');
//     it('shows a per-site qty input only on ENTERPRISE plans, multiplies the preview total');
//   });
describe.skip('OnboardingPage step 2 (RTL — TODO)', () => {
  it('placeholder', () => {
    /* implemented once @testing-library/react is added */
  });
});
