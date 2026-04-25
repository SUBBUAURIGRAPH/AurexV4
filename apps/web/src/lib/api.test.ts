import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import {
  maybeHandleOnboardingIncomplete,
  setOnboardingIncompleteHandler,
  ONBOARDING_INCOMPLETE_TYPE,
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
