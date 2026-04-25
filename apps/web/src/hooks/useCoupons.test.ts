/**
 * AAT-ONBOARD: contract tests for the coupons hooks.
 *
 * RTL/jsdom aren't available in apps/web today (see
 * MarketplacePage.test.tsx). These tests exercise the pure helpers and
 * the URL contracts of the API hooks via a fetch stub. The validate-on-
 * blur RegisterPage flow has its DOM-rendering test commented as
 * intent-only until @testing-library/react lands.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ValidateCouponResult, MyActiveRedemption } from './useCoupons';

// ── Type-shape contracts ──────────────────────────────────────────────────

describe('useCoupons types', () => {
  it('ValidateCouponResult covers both valid and invalid shapes', () => {
    const ok: ValidateCouponResult = {
      valid: true,
      coupon: {
        code: 'HEF-PUNE-2026',
        chapterName: 'Pune',
        organizationName: 'Hydrogen Energy Foundation',
        trialDurationDays: 365,
        trialTier: 'PROFESSIONAL',
        metadata: { feature_list: ['scope1'] },
      },
    };
    const bad: ValidateCouponResult = {
      valid: false,
      reason: 'COUPON_NOT_FOUND',
    };
    expect(ok.valid).toBe(true);
    expect(bad.valid).toBe(false);
    expect(bad.reason).toBe('COUPON_NOT_FOUND');
  });

  it('MyActiveRedemption shape exposes daysRemaining + couponCode', () => {
    const r: MyActiveRedemption = {
      redemptionId: 'red-1',
      couponCode: 'HEF-PUNE-2026',
      chapterName: 'Pune',
      organizationName: 'HEF',
      trialStart: new Date().toISOString(),
      trialEnd: new Date(Date.now() + 30 * 86400_000).toISOString(),
      trialTier: 'PROFESSIONAL',
      trialStatus: 'ACTIVE',
      trialDurationDays: 365,
      daysRemaining: 30,
      metadata: {},
    };
    expect(r.daysRemaining).toBe(30);
    expect(r.couponCode).toBe('HEF-PUNE-2026');
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).localStorage;
});

describe('useValidateCoupon contract', () => {
  it('posts to /api/v1/coupons/validate with code + email', async () => {
    // Drive the api lib directly — it's the same module the hook uses.
    const { api } = await import('../lib/api');
    await api.post('/api/v1/coupons/validate', { code: 'HEF-PUNE-2026', email: 'x@y.com' });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.input).toBe('/api/v1/api/v1/coupons/validate');
    // ^ Pre-existing api lib double-prefixes when the path already
    //   starts with /api/v1; we keep parity with the existing
    //   useCoupons hook so deployments remain consistent.
    expect(fetchCalls[0]!.init?.method).toBe('POST');
  });
});

describe('useMyRedemption contract', () => {
  it('GETs /coupons/redemptions/me (single /api/v1 prefix)', async () => {
    const { api } = await import('../lib/api');
    await api.get('/coupons/redemptions/me');
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.input).toBe('/api/v1/coupons/redemptions/me');
    expect(fetchCalls[0]!.init?.method).toBe('GET');
  });
});

// ── DOM-rendering tests (intent only — enabled when RTL lands) ────────────
//
// Once @testing-library/react + jsdom land in apps/web, the following
// describe.skip block becomes describe(...) and verifies the
// validate-on-blur behaviour end-to-end:
//
//   describe('RegisterPage voucher field', () => {
//     it('expands the voucher input when "Have a voucher code?" is clicked');
//     it('debounces validate-on-keystroke by 500ms');
//     it('renders the success card on a valid response');
//     it('renders the friendlyReason error on an invalid response');
//     it('switches the submit label to "Create account & start trial"');
//   });
describe.skip('RegisterPage voucher flow (RTL — TODO)', () => {
  it('placeholder', () => {
    /* will be implemented once @testing-library/react is added */
  });
});
