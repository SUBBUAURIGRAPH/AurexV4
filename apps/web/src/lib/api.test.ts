import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import {
  maybeHandleOnboardingIncomplete,
  maybeHandleQuotaExceeded,
  setOnboardingIncompleteHandler,
  setQuotaExceededHandler,
  ONBOARDING_INCOMPLETE_TYPE,
  QUOTA_EXCEEDED_TYPE,
} from './api';

/**
 * AAT-WORKFLOW (Wave 9a): tests for the onboarding-incomplete interceptor
 * helper in api.ts. We don't drive a real fetch round-trip here — we
 * exercise the pure helper that the interceptor delegates to.
 */

describe('maybeHandleOnboardingIncomplete', () => {
  beforeEach(() => {
    setOnboardingIncompleteHandler(null);
  });

  afterEach(() => {
    setOnboardingIncompleteHandler(null);
  });

  it('ignores non-412 responses', () => {
    const handler = vi.fn();
    setOnboardingIncompleteHandler(handler);

    const result = maybeHandleOnboardingIncomplete(500, {
      type: ONBOARDING_INCOMPLETE_TYPE,
      detail: 'irrelevant',
    });

    expect(result.handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores 412 responses with a different problem type', () => {
    const handler = vi.fn();
    setOnboardingIncompleteHandler(handler);

    const result = maybeHandleOnboardingIncomplete(412, {
      type: 'https://aurex.in/errors/something-else',
      detail: 'foo',
    });

    expect(result.handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('invokes the handler with detail + nextStep on a matching 412', () => {
    const handler = vi.fn();
    setOnboardingIncompleteHandler(handler);

    const result = maybeHandleOnboardingIncomplete(412, {
      type: ONBOARDING_INCOMPLETE_TYPE,
      title: 'Complete onboarding',
      status: 412,
      detail: 'Please finish onboarding before adding emissions.',
      instance: '/api/v1/emissions',
      nextStep: '/onboarding',
    });

    expect(result.handled).toBe(true);
    expect(result.nextStep).toBe('/onboarding');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      detail: 'Please finish onboarding before adding emissions.',
      nextStep: '/onboarding',
    });
  });

  it('falls back to /onboarding when nextStep is missing from the body', () => {
    const handler = vi.fn();
    setOnboardingIncompleteHandler(handler);

    const result = maybeHandleOnboardingIncomplete(412, {
      type: ONBOARDING_INCOMPLETE_TYPE,
    });

    expect(result.handled).toBe(true);
    expect(result.nextStep).toBe('/onboarding');
    expect(handler).toHaveBeenCalledWith({
      detail: 'Please complete onboarding first',
      nextStep: '/onboarding',
    });
  });

  it('handles bodies that are not plain objects without throwing', () => {
    const handler = vi.fn();
    setOnboardingIncompleteHandler(handler);

    expect(maybeHandleOnboardingIncomplete(412, null).handled).toBe(false);
    expect(maybeHandleOnboardingIncomplete(412, 'not-json').handled).toBe(false);
    expect(maybeHandleOnboardingIncomplete(412, undefined).handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('lets the handler be cleared by passing null', () => {
    const handler = vi.fn();
    setOnboardingIncompleteHandler(handler);
    setOnboardingIncompleteHandler(null);

    // No window.location available in test env — the helper should just
    // mark the response as handled and not crash.
    const original = (globalThis as { window?: unknown }).window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
    });

    try {
      const result = maybeHandleOnboardingIncomplete(412, {
        type: ONBOARDING_INCOMPLETE_TYPE,
      });
      expect(result.handled).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: original,
        configurable: true,
      });
    }
  });
});

/**
 * AAT-378 / AV4-378 — 429 quota-exceeded interceptor. Same shape as
 * the onboarding-incomplete tests above.
 */
describe('maybeHandleQuotaExceeded', () => {
  beforeEach(() => {
    setQuotaExceededHandler(null);
  });

  afterEach(() => {
    setQuotaExceededHandler(null);
  });

  it('ignores non-429 responses', () => {
    const handler = vi.fn();
    setQuotaExceededHandler(handler);

    const result = maybeHandleQuotaExceeded(500, {
      type: QUOTA_EXCEEDED_TYPE,
      detail: 'irrelevant',
    });

    expect(result.handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores 429 responses with a different problem type', () => {
    const handler = vi.fn();
    setQuotaExceededHandler(handler);

    const result = maybeHandleQuotaExceeded(429, {
      type: 'https://aurex.in/errors/rate-limited',
      detail: 'foo',
    });

    expect(result.handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('invokes the handler with full context on a matching 429', () => {
    const handler = vi.fn();
    setQuotaExceededHandler(handler);

    const result = maybeHandleQuotaExceeded(429, {
      type: QUOTA_EXCEEDED_TYPE,
      title: 'Quota Exceeded',
      status: 429,
      detail: 'Your monthly emission entries quota for this billing cycle is full.',
      instance: '/api/v1/emissions',
      resource: 'monthlyEmissionEntries',
      used: 1000,
      limit: 1000,
      nextStep: '/billing/manage',
    });

    expect(result.handled).toBe(true);
    expect(result.nextStep).toBe('/billing/manage');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      detail: 'Your monthly emission entries quota for this billing cycle is full.',
      resource: 'monthlyEmissionEntries',
      used: 1000,
      limit: 1000,
      nextStep: '/billing/manage',
    });
  });

  it('falls back to a generated upgrade-CTA when detail is missing', () => {
    const handler = vi.fn();
    setQuotaExceededHandler(handler);

    const result = maybeHandleQuotaExceeded(429, {
      type: QUOTA_EXCEEDED_TYPE,
      resource: 'reportsPerYear',
    });

    expect(result.handled).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    const arg = handler.mock.calls[0]?.[0] as { detail: string };
    expect(arg.detail).toContain('reportsPerYear');
    expect(arg.detail).toContain('Upgrade');
  });

  it('handles bodies that are not plain objects without throwing', () => {
    const handler = vi.fn();
    setQuotaExceededHandler(handler);

    expect(maybeHandleQuotaExceeded(429, null).handled).toBe(false);
    expect(maybeHandleQuotaExceeded(429, 'not-json').handled).toBe(false);
    expect(maybeHandleQuotaExceeded(429, undefined).handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});
