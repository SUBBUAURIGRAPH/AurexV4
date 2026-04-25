/**
 * AAT-EMAIL / Wave 8b: email-verification template.
 *
 * Rendered the moment a user signs up (or asks for a fresh link via
 * /resend-verification). The link MUST be the only call-to-action — any
 * extra branding/CTA bloat increases the chance the verification button
 * gets buried by the user's email client.
 */

import { escapeHtml, renderFooterText, renderFrame, type RenderedEmail } from './_shared.js';

export interface VerificationEmailInput {
  recipientName: string;
  /** Fully-qualified URL the user clicks to complete verification. */
  verificationUrl: string;
  /** Token TTL in hours, surfaced verbatim in copy. */
  expiresInHours: number;
}

export function renderVerificationEmail(input: VerificationEmailInput): RenderedEmail {
  const subject = 'Verify your Aurex email';
  const safeName = escapeHtml(input.recipientName);
  const safeUrl = escapeHtml(input.verificationUrl);
  const hours = Number.isFinite(input.expiresInHours)
    ? input.expiresInHours
    : 24;

  const bodyHtml = [
    `<h1 style="margin:0 0 16px;font:600 22px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">Welcome, ${safeName}</h1>`,
    `<p style="margin:0 0 16px;">Thanks for signing up for Aurex. Please confirm this email address so we can secure your account.</p>`,
    `<p style="margin:0 0 24px;">`,
    `<a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;">Verify email</a>`,
    `</p>`,
    `<p style="margin:0 0 8px;color:#374151;">Or copy and paste this URL into your browser:</p>`,
    `<p style="margin:0 0 24px;word-break:break-all;font:400 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#374151;">${safeUrl}</p>`,
    `<p style="margin:0;color:#6b7280;font-size:12px;">This link expires in ${hours} hour${hours === 1 ? '' : 's'}. If you didn't sign up for Aurex, you can safely ignore this message.</p>`,
  ].join('');

  const text = [
    `Welcome, ${input.recipientName}`,
    ``,
    `Thanks for signing up for Aurex. Please confirm this email address so we can secure your account.`,
    ``,
    `Verify your email by visiting:`,
    input.verificationUrl,
    ``,
    `This link expires in ${hours} hour${hours === 1 ? '' : 's'}. If you didn't sign up for Aurex, you can safely ignore this message.`,
    renderFooterText(),
  ].join('\n');

  return { subject, html: renderFrame(bodyHtml), text };
}
