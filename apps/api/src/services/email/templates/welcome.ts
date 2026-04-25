/**
 * AAT-EMAIL / Wave 8b: post-verification welcome template.
 *
 * Sent ONCE — the moment the user clicks the verification link. We add
 * a subtle "trial active" call-out when the user landed via a coupon so
 * they can find their trial window without digging through the dashboard.
 */

import { escapeHtml, renderFooterText, renderFrame, type RenderedEmail } from './_shared.js';

export interface WelcomeEmailInput {
  recipientName: string;
  /** Optional org name to personalise the copy ("welcome to Acme"). */
  orgName?: string;
  /** Set when the user has an active CouponRedemption. */
  trialActiveCoupon?: {
    couponCode: string;
    /** Trial expiry, ISO string — already date-formatted by the caller. */
    trialEndLabel: string;
    /** e.g. "PROFESSIONAL" — surfaced verbatim. */
    trialTier: string;
  };
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const subject = input.orgName
    ? `Welcome to Aurex, ${input.orgName}`
    : 'Welcome to Aurex';

  const safeName = escapeHtml(input.recipientName);
  const safeOrg = input.orgName ? escapeHtml(input.orgName) : null;

  const trialBlockHtml = input.trialActiveCoupon
    ? [
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#ecfeff;border:1px solid #a5f3fc;border-radius:6px;">`,
        `<tr><td style="padding:16px 20px;">`,
        `<p style="margin:0 0 4px;font-weight:600;color:#0e7490;">Trial active</p>`,
        `<p style="margin:0 0 4px;color:#0e7490;">Coupon: <strong>${escapeHtml(input.trialActiveCoupon.couponCode)}</strong></p>`,
        `<p style="margin:0 0 4px;color:#0e7490;">Tier: <strong>${escapeHtml(input.trialActiveCoupon.trialTier)}</strong></p>`,
        `<p style="margin:0;color:#0e7490;">Trial ends: <strong>${escapeHtml(input.trialActiveCoupon.trialEndLabel)}</strong></p>`,
        `</td></tr>`,
        `</table>`,
      ].join('')
    : '';

  const bodyHtml = [
    `<h1 style="margin:0 0 16px;font:600 22px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">You're all set, ${safeName}</h1>`,
    safeOrg
      ? `<p style="margin:0 0 16px;">Your email is verified and your <strong>${safeOrg}</strong> workspace is ready to go.</p>`
      : `<p style="margin:0 0 16px;">Your email is verified and your Aurex workspace is ready to go.</p>`,
    trialBlockHtml,
    `<p style="margin:0 0 16px;">From here you can:</p>`,
    `<ul style="margin:0 0 24px;padding-left:20px;color:#374151;">`,
    `<li>Configure your emissions baseline and Scope 1/2/3 categories</li>`,
    `<li>Invite team members to collaborate on reporting</li>`,
    `<li>Connect to BRSR, GRI and TCFD frameworks</li>`,
    `</ul>`,
    `<p style="margin:0;color:#6b7280;font-size:12px;">Need a hand? Reply to this email and the team will pick it up.</p>`,
  ].join('');

  const trialText = input.trialActiveCoupon
    ? [
        ``,
        `--- Trial active ---`,
        `Coupon: ${input.trialActiveCoupon.couponCode}`,
        `Tier: ${input.trialActiveCoupon.trialTier}`,
        `Trial ends: ${input.trialActiveCoupon.trialEndLabel}`,
        ``,
      ].join('\n')
    : '';

  const text = [
    `You're all set, ${input.recipientName}`,
    ``,
    input.orgName
      ? `Your email is verified and your ${input.orgName} workspace is ready to go.`
      : `Your email is verified and your Aurex workspace is ready to go.`,
    trialText,
    `From here you can:`,
    `- Configure your emissions baseline and Scope 1/2/3 categories`,
    `- Invite team members to collaborate on reporting`,
    `- Connect to BRSR, GRI and TCFD frameworks`,
    ``,
    `Need a hand? Reply to this email and the team will pick it up.`,
    renderFooterText(),
  ].join('\n');

  return { subject, html: renderFrame(bodyHtml), text };
}
