/**
 * AAT-EMAIL / Wave 8b: template renderer tests.
 *
 * One test per template — verification, welcome, payment-receipt — to
 * lock down the surface the calling services depend on (the verification
 * URL appears in the body, the trial card is conditionally rendered, the
 * currency is formatted in major units, etc).
 */

import { describe, expect, it } from 'vitest';
import { renderVerificationEmail } from './verification.js';
import { renderWelcomeEmail } from './welcome.js';
import { renderPaymentReceiptEmail, formatMinor } from './payment-receipt.js';

describe('renderVerificationEmail', () => {
  it('puts the verification URL and TTL into both html and text bodies', () => {
    const url = 'https://aurex.in/verify-email?token=abcd1234';
    const out = renderVerificationEmail({
      recipientName: 'Alice',
      verificationUrl: url,
      expiresInHours: 24,
    });

    expect(out.subject).toMatch(/verify/i);
    expect(out.html).toContain(url);
    expect(out.text).toContain(url);
    expect(out.html).toContain('24 hour');
    expect(out.text).toContain('24 hour');
    expect(out.html).toContain('Alice');
    // Aurex footer surfaces the brand contact.
    expect(out.html).toContain('contact@aurex.in');
    expect(out.text).toContain('contact@aurex.in');
  });

  it('escapes HTML in the recipient name to defeat injection', () => {
    const out = renderVerificationEmail({
      recipientName: '<script>alert(1)</script>',
      verificationUrl: 'https://aurex.in/verify-email?token=x',
      expiresInHours: 24,
    });
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('singularises "1 hour" vs "N hours"', () => {
    const single = renderVerificationEmail({
      recipientName: 'Alice',
      verificationUrl: 'https://aurex.in/v?t=x',
      expiresInHours: 1,
    });
    expect(single.html).toContain('1 hour.');
    expect(single.html).not.toContain('1 hours');

    const plural = renderVerificationEmail({
      recipientName: 'Alice',
      verificationUrl: 'https://aurex.in/v?t=x',
      expiresInHours: 24,
    });
    expect(plural.html).toContain('24 hours.');
  });
});

describe('renderWelcomeEmail', () => {
  it('renders the trial card iff trialActiveCoupon is supplied', () => {
    const without = renderWelcomeEmail({ recipientName: 'Bob' });
    expect(without.html).not.toContain('Trial active');
    expect(without.html).not.toContain('Coupon:');

    const withTrial = renderWelcomeEmail({
      recipientName: 'Bob',
      trialActiveCoupon: {
        couponCode: 'HEF-PUNE-2026',
        trialEndLabel: '2027-04-25',
        trialTier: 'PROFESSIONAL',
      },
    });
    expect(withTrial.html).toContain('Trial active');
    expect(withTrial.html).toContain('HEF-PUNE-2026');
    expect(withTrial.html).toContain('PROFESSIONAL');
    expect(withTrial.html).toContain('2027-04-25');
    // text fallback shows the same data
    expect(withTrial.text).toContain('HEF-PUNE-2026');
    expect(withTrial.text).toContain('PROFESSIONAL');
  });

  it('personalises the subject + body when orgName is supplied', () => {
    const out = renderWelcomeEmail({ recipientName: 'Bob', orgName: 'Acme Corp' });
    expect(out.subject).toContain('Acme Corp');
    expect(out.html).toContain('Acme Corp');
  });
});

describe('formatMinor + renderPaymentReceiptEmail', () => {
  it('formatMinor renders INR with the rupee symbol and grouping', () => {
    expect(formatMinor(499900, 'INR')).toBe('₹4,999.00');
  });

  it('formatMinor renders USD with the dollar symbol', () => {
    expect(formatMinor(99900, 'USD')).toBe('$999.00');
  });

  it('renderPaymentReceiptEmail surfaces the formatted amount + invoice + period in both bodies', () => {
    const out = renderPaymentReceiptEmail({
      recipientName: 'Carol',
      planLabel: 'Aurex MSME India (Scope 1+2)',
      currencyMinorAmount: 499900,
      currency: 'INR',
      invoiceNumber: 'INV-2026-000123',
      periodStart: new Date('2026-04-25T00:00:00Z'),
      periodEnd: new Date('2027-04-25T00:00:00Z'),
    });

    expect(out.subject).toContain('INV-2026-000123');
    expect(out.html).toContain('INV-2026-000123');
    expect(out.html).toContain('₹4,999.00'); // rendered INR
    expect(out.html).toContain('2026-04-25');
    expect(out.html).toContain('2027-04-25');
    expect(out.html).toContain('Aurex MSME India (Scope 1+2)');

    expect(out.text).toContain('INV-2026-000123');
    expect(out.text).toContain('₹4,999.00');
    expect(out.text).toContain('2026-04-25');
    expect(out.text).toContain('Carol');
  });

  it('renders a "View invoice" CTA when billingPortalUrl is set, omits otherwise', () => {
    const without = renderPaymentReceiptEmail({
      recipientName: 'Dave',
      planLabel: 'Aurex SME International',
      currencyMinorAmount: 99900,
      currency: 'USD',
      invoiceNumber: 'INV-2026-000999',
      periodStart: new Date('2026-04-25T00:00:00Z'),
      periodEnd: new Date('2027-04-25T00:00:00Z'),
    });
    expect(without.html).not.toContain('View invoice');

    const withPortal = renderPaymentReceiptEmail({
      recipientName: 'Dave',
      planLabel: 'Aurex SME International',
      currencyMinorAmount: 99900,
      currency: 'USD',
      invoiceNumber: 'INV-2026-000999',
      periodStart: new Date('2026-04-25T00:00:00Z'),
      periodEnd: new Date('2027-04-25T00:00:00Z'),
      billingPortalUrl: 'https://aurex.in/billing/inv-999',
    });
    expect(withPortal.html).toContain('View invoice');
    expect(withPortal.html).toContain('https://aurex.in/billing/inv-999');
    expect(withPortal.text).toContain('https://aurex.in/billing/inv-999');
  });
});
