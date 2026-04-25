/**
 * AAT-EMAIL / Wave 8b: shared template helpers.
 *
 * The brand footer is rendered into every transactional email so the
 * recipient can always identify the sender (Aurigraph DLT Corp / Aurex)
 * and reach a human via contact@aurex.in.
 *
 * Why string templates rather than a templating engine? Volume is low
 * (hundreds/day), the markup is trivial, and this keeps us from pulling
 * a runtime dep + ships zero-config to ops.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND_NAME = 'Aurex';
const BRAND_PARENT = 'Aurigraph DLT Corp';
const BRAND_CONTACT = 'contact@aurex.in';
const BRAND_HOME = 'https://aurex.in';

/**
 * Escape `&`, `<`, `>`, `"` for safe HTML interpolation. Use anywhere a
 * caller-provided string is dropped into the template body. We keep this
 * tiny (no `he` dependency) — the four characters cover everything that
 * could break out of a tag context.
 */
export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Inline-styled HTML footer. Most email clients strip `<style>` blocks
 * (Gmail / Outlook), so every visual rule is set on the element.
 */
export function renderFooterHtml(): string {
  return [
    `<tr>`,
    `<td style="padding:24px 32px;border-top:1px solid #e5e7eb;color:#6b7280;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">`,
    `${BRAND_NAME} by ${BRAND_PARENT}`,
    ` &middot; <a href="mailto:${BRAND_CONTACT}" style="color:#6b7280;text-decoration:underline;">${BRAND_CONTACT}</a>`,
    ` &middot; <a href="${BRAND_HOME}" style="color:#6b7280;text-decoration:underline;">${BRAND_HOME}</a>`,
    `</td>`,
    `</tr>`,
  ].join('');
}

/**
 * Plain-text footer for clients that prefer the text/plain alternative.
 */
export function renderFooterText(): string {
  return `\n\n--\n${BRAND_NAME} by ${BRAND_PARENT}\n${BRAND_CONTACT} | ${BRAND_HOME}\n`;
}

/**
 * Wrap arbitrary body markup in the standard email frame. The frame is
 * a single-cell table — the most-portable shape for HTML email rendering
 * across Gmail / Outlook / Apple Mail.
 */
export function renderFrame(bodyHtml: string): string {
  return [
    `<!doctype html>`,
    `<html lang="en"><head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `</head>`,
    `<body style="margin:0;padding:0;background:#f3f4f6;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">`,
    `<tr><td style="padding:32px;">`,
    bodyHtml,
    `</td></tr>`,
    renderFooterHtml(),
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</body></html>`,
  ].join('');
}
