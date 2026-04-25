/**
 * AAT-EMAIL / Wave 8b: payment-receipt template.
 *
 * Sent the moment a Razorpay payment captures + we issue an Invoice row
 * in PAID. Includes the formatted amount in the buyer's currency, the
 * invoice number, and the period the payment covers.
 */

import { escapeHtml, renderFooterText, renderFrame, type RenderedEmail } from './_shared.js';

export interface PaymentReceiptEmailInput {
  recipientName: string;
  /** Plan label (UI-friendly, e.g. "Aurex MSME India"). */
  planLabel: string;
  /** Amount in minor units (paise / cents). */
  currencyMinorAmount: number;
  /** ISO 4217 code — INR / USD. */
  currency: string;
  invoiceNumber: string;
  /** Subscription period start. */
  periodStart: Date;
  /** Subscription period end. */
  periodEnd: Date;
  /** Optional billing-portal URL the user can use to download a PDF. */
  billingPortalUrl?: string;
}

const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
};

/**
 * Format a minor-unit integer as a human currency string. Falls back to
 * `${code} ${value}` for currencies we don't have an explicit locale for.
 *
 * Examples:
 *   formatMinor(499900, 'INR') => '₹4,999.00'
 *   formatMinor(99900,  'USD') => '$999.00'
 */
export function formatMinor(minor: number, currency: string): string {
  const value = minor / 100;
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Fallback for unrecognised currency codes — keeps the email
    // deliverable even if the upstream sends garbage.
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDate(d: Date): string {
  // Stable RFC 3339 date — independent of host locale, easy to grep
  // against the Invoice row.
  return d.toISOString().slice(0, 10);
}

export function renderPaymentReceiptEmail(
  input: PaymentReceiptEmailInput,
): RenderedEmail {
  const subject = `Payment received — ${input.invoiceNumber}`;
  const safeName = escapeHtml(input.recipientName);
  const safePlan = escapeHtml(input.planLabel);
  const safeInvoice = escapeHtml(input.invoiceNumber);
  const amountStr = formatMinor(input.currencyMinorAmount, input.currency);
  const safeAmount = escapeHtml(amountStr);
  const periodStart = formatDate(input.periodStart);
  const periodEnd = formatDate(input.periodEnd);

  const portalLinkHtml = input.billingPortalUrl
    ? [
        `<p style="margin:0 0 24px;">`,
        `<a href="${escapeHtml(input.billingPortalUrl)}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;">View invoice</a>`,
        `</p>`,
      ].join('')
    : '';

  const bodyHtml = [
    `<h1 style="margin:0 0 16px;font:600 22px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">Payment received</h1>`,
    `<p style="margin:0 0 16px;">Hi ${safeName}, thanks for your payment. Your Aurex subscription is now active.</p>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:6px;">`,
    `<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Plan</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;">${safePlan}</td></tr>`,
    `<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Amount</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;">${safeAmount}</td></tr>`,
    `<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Invoice</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;">${safeInvoice}</td></tr>`,
    `<tr><td style="padding:12px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Period</td><td style="padding:12px 16px;color:#111827;">${periodStart} &rarr; ${periodEnd}</td></tr>`,
    `</table>`,
    portalLinkHtml,
    `<p style="margin:0;color:#6b7280;font-size:12px;">If you have any questions about this invoice, just reply to this email.</p>`,
  ].join('');

  const text = [
    `Payment received`,
    ``,
    `Hi ${input.recipientName}, thanks for your payment. Your Aurex subscription is now active.`,
    ``,
    `Plan:    ${input.planLabel}`,
    `Amount:  ${amountStr}`,
    `Invoice: ${input.invoiceNumber}`,
    `Period:  ${periodStart} -> ${periodEnd}`,
    ...(input.billingPortalUrl
      ? ['', `View invoice: ${input.billingPortalUrl}`]
      : []),
    ``,
    `If you have any questions about this invoice, just reply to this email.`,
    renderFooterText(),
  ].join('\n');

  return { subject, html: renderFrame(bodyHtml), text };
}
