/**
 * Password-reset email template.
 *
 * Same shape as verification.ts. The reset link is the only call-to-action
 * — the user clicks it, lands on /reset-password?token=..., picks a new
 * password, submits, and is bounced to /login. Token TTL is short (1h).
 */

import { escapeHtml, type RenderedEmail } from './_shared.js';

export interface PasswordResetEmailInput {
  recipientName: string;
  /** Fully-qualified URL the user clicks to set a new password. */
  resetUrl: string;
  /** Token TTL in minutes, surfaced verbatim in copy. */
  expiresInMinutes: number;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const subject = 'Reset your Aurex password';
  const safeName = escapeHtml(input.recipientName);
  const safeUrl = escapeHtml(input.resetUrl);
  const minutes = Number.isFinite(input.expiresInMinutes) ? input.expiresInMinutes : 60;

  const bodyHtml = [
    `<h1 style="margin:0 0 16px;font:600 22px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">Hi ${safeName},</h1>`,
    `<p style="margin:0 0 16px;">We received a request to reset your Aurex password. Click the button below to choose a new one.</p>`,
    `<p style="margin:0 0 24px;">`,
    `<a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;">Reset password</a>`,
    `</p>`,
    `<p style="margin:0 0 8px;color:#374151;">Or copy and paste this URL into your browser:</p>`,
    `<p style="margin:0 0 24px;word-break:break-all;font:400 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#374151;">${safeUrl}</p>`,
    `<p style="margin:0 0 8px;color:#6b7280;font-size:12px;">This link expires in ${minutes} minute${minutes === 1 ? '' : 's'} and can only be used once.</p>`,
    `<p style="margin:0;color:#6b7280;font-size:12px;">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>`,
  ].join('');

  const text = [
    `Hi ${input.recipientName},`,
    '',
    'We received a request to reset your Aurex password.',
    `Open this link to choose a new one (expires in ${minutes} minutes):`,
    input.resetUrl,
    '',
    "If you didn't request this, ignore this email — your password won't change.",
    '',
    '— Aurex',
  ].join('\n');

  return { subject, html: bodyHtml, text };
}
