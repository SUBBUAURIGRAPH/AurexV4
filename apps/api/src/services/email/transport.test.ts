/**
 * AAT-MANDRILL: tests for `getTransport()` resolution.
 *
 *   - Default (no env, no override) → SesTransport.
 *   - EMAIL_TRANSPORT=mandrill        → MandrillTransport.
 *   - EMAIL_TRANSPORT=ses             → SesTransport.
 *   - Unknown EMAIL_TRANSPORT value   → falls back to SES (logged but not fatal).
 *   - override='mandrill' beats env='ses' (and vice versa).
 *
 * NODE_ENV='test' is set automatically by vitest, which also satisfies
 * MandrillTransport's mock-mode constructor — so we can instantiate it
 * without setting MANDRILL_API_KEY.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTransport } from './transport.js';

const SAVED_ENV: Record<string, string | undefined> = {};
const KEYS = ['EMAIL_TRANSPORT', 'MANDRILL_API_KEY', 'MANDRILL_MOCK_MODE'] as const;

beforeEach(() => {
  for (const k of KEYS) SAVED_ENV[k] = process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

describe('getTransport — resolution', () => {
  it('default is SES when no env var and no override are set', () => {
    delete process.env.EMAIL_TRANSPORT;
    const t = getTransport();
    expect(t.providerName).toBe('ses');
  });

  it('EMAIL_TRANSPORT=mandrill returns the Mandrill transport', () => {
    process.env.EMAIL_TRANSPORT = 'mandrill';
    const t = getTransport();
    expect(t.providerName).toBe('mandrill');
  });

  it('EMAIL_TRANSPORT=ses returns the SES transport', () => {
    process.env.EMAIL_TRANSPORT = 'ses';
    const t = getTransport();
    expect(t.providerName).toBe('ses');
  });

  it('unknown EMAIL_TRANSPORT value falls back to SES (default)', () => {
    process.env.EMAIL_TRANSPORT = 'sendgrid'; // not supported
    const t = getTransport();
    expect(t.providerName).toBe('ses');
  });

  it('override="mandrill" beats EMAIL_TRANSPORT=ses', () => {
    process.env.EMAIL_TRANSPORT = 'ses';
    const t = getTransport('mandrill');
    expect(t.providerName).toBe('mandrill');
  });

  it('override="ses" beats EMAIL_TRANSPORT=mandrill', () => {
    process.env.EMAIL_TRANSPORT = 'mandrill';
    const t = getTransport('ses');
    expect(t.providerName).toBe('ses');
  });
});
