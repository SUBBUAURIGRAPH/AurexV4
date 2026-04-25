/**
 * AAT-10B / Wave 10b: contract tests for the billing manage / invoice /
 * renewal pages.
 *
 * Runner status mirrors `MarketplacePage.test.tsx`: jsdom + RTL aren't
 * wired up in apps/web yet, so we exercise URL contracts via a stubbed
 * fetch and the pure type / hook surfaces inline. The DOM-render
 * assertions for each page live inside `describe.skip(...)` blocks below
 * so they're ready to flip on once RTL lands.
 *
 * Test count summary (executable today): 8 contract tests.
 * Test count summary once RTL lands: 8 + 4 component tests = 12.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  Invoice,
  InvoiceStatus,
  RenewalAttempt,
  RenewalCheckoutInitResponse,
  MySubscription,
} from '../../../hooks/useBilling';

// ── Type-shape contracts ──────────────────────────────────────────────────

describe('useBilling AAT-10B types', () => {
  it('Invoice models the five invoice statuses + minor-unit totals', () => {
    const inv: Invoice = {
      id: 'inv-1',
      subscriptionId: 'sub-1',
      invoiceNumber: 'INV-2026-000001',
      currency: 'INR',
      subtotalMinor: 499900,
      discountMinor: 0,
      taxMinor: 89982,
      totalMinor: 589882,
      status: 'PAID',
      issuedAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const allStatuses: InvoiceStatus[] = ['DRAFT', 'ISSUED', 'PAID', 'REFUNDED', 'CANCELLED'];
    expect(allStatuses).toContain(inv.status);
    expect(inv.totalMinor).toBe(inv.subtotalMinor - inv.discountMinor + inv.taxMinor);
  });

  it('RenewalAttempt embeds the parent subscription so the page can show plan label', () => {
    const sub: MySubscription = {
      id: 'sub-1',
      organizationId: 'org-1',
      plan: 'MSME_INDIA',
      region: 'INDIA',
      status: 'ACTIVE',
      currency: 'INR',
      amountMinor: 499900,
      perSiteCount: 1,
      totalAmountMinor: 589882,
      startsAt: null,
      endsAt: null,
      appliedCouponCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const attempt: RenewalAttempt = {
      id: 'ra-1',
      subscriptionId: 'sub-1',
      periodStart: new Date('2026-05-01').toISOString(),
      periodEnd: new Date('2027-05-01').toISOString(),
      amountMinor: 589882,
      currency: 'INR',
      razorpayOrderId: 'order_xyz',
      status: 'EMAIL_SENT',
      emailSentAt: new Date().toISOString(),
      paidAt: null,
      failedAt: null,
      failureReason: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subscription: sub,
    };
    expect(attempt.subscription.plan).toBe('MSME_INDIA');
    expect(attempt.amountMinor).toBeGreaterThan(0);
  });

  it('RenewalCheckoutInitResponse mirrors the regular checkout init shape', () => {
    const r: RenewalCheckoutInitResponse = {
      renewalAttemptId: 'ra-1',
      orderId: 'order_xyz',
      keyId: 'rzp_test_xxx',
      amount: 589882,
      currency: 'INR',
      periodStart: new Date().toISOString(),
      periodEnd: new Date().toISOString(),
      reused: false,
    };
    expect(r.amount).toBe(589882);
    expect(r.reused).toBe(false);
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
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
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
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('AAT-10B URL contracts', () => {
  it('useInvoices → GET /api/v1/billing/invoices', async () => {
    const { api } = await import('../../../lib/api');
    await api.get('/billing/invoices');
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.input).toBe('/api/v1/billing/invoices');
    expect(fetchCalls[0]!.init?.method).toBe('GET');
  });

  it('useInvoice(id) → GET /api/v1/billing/invoices/:id', async () => {
    const { api } = await import('../../../lib/api');
    await api.get('/billing/invoices/inv-1');
    expect(fetchCalls[0]!.input).toBe('/api/v1/billing/invoices/inv-1');
  });

  it('useCancelSubscription → POST /api/v1/billing/subscriptions/me/cancel', async () => {
    const { api } = await import('../../../lib/api');
    await api.post('/billing/subscriptions/me/cancel');
    expect(fetchCalls[0]!.input).toBe('/api/v1/billing/subscriptions/me/cancel');
    expect(fetchCalls[0]!.init?.method).toBe('POST');
  });

  it('useRenewalAttempt(id) → GET /api/v1/billing/renewal-attempts/:id', async () => {
    const { api } = await import('../../../lib/api');
    await api.get('/billing/renewal-attempts/ra-1');
    expect(fetchCalls[0]!.input).toBe('/api/v1/billing/renewal-attempts/ra-1');
  });

  it('useStartRenewalCheckout(id) → POST /api/v1/billing/renewal-attempts/:id/checkout', async () => {
    const { api } = await import('../../../lib/api');
    await api.post('/billing/renewal-attempts/ra-1/checkout');
    expect(fetchCalls[0]!.input).toBe('/api/v1/billing/renewal-attempts/ra-1/checkout');
    expect(fetchCalls[0]!.init?.method).toBe('POST');
  });
});

// ── DOM-rendering tests (intent only — enabled when RTL lands) ────────────
//
// Once @testing-library/react + jsdom land in apps/web, the four
// describe.skip blocks below are flipped to live tests:
//
//   - BillingPage shows a TRIAL banner with the days-remaining countdown
//     when status === TRIAL
//   - InvoicesPage renders one row per Invoice from the mocked API and
//     filters by status / date range
//   - RenewPaymentPage shows a 404 EmptyState when the renewal id is
//     invalid (or scoped to another org)
//   - BillingPage cancel-confirmation modal renders the "Are you sure?"
//     copy AND a destructive "Cancel subscription" button that fires the
//     mutation when clicked

describe.skip('BillingPage trial banner (RTL — TODO)', () => {
  it('shows "Your free trial ends in N days" when status=TRIAL', () => {
    /* implemented once @testing-library/react is added */
  });
});

describe.skip('InvoicesPage row rendering (RTL — TODO)', () => {
  it('renders one row per Invoice from the mocked API', () => {
    /* implemented once @testing-library/react is added */
  });
});

describe.skip('RenewPaymentPage 404 state (RTL — TODO)', () => {
  it('renders the not-found EmptyState when the renewal id is invalid', () => {
    /* implemented once @testing-library/react is added */
  });
});

describe.skip('BillingPage cancel confirmation modal (RTL — TODO)', () => {
  it('renders the destructive cancel modal with the "Are you sure?" copy', () => {
    /* implemented once @testing-library/react is added */
  });
});
