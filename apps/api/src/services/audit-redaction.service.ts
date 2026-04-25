/**
 * Audit-export PII redaction helper. AAT-ρ / AV4-377.
 *
 * Referenced by `docs/biocarbon/09-audit-cooperation-runbook.md` §4 — the
 * BCR audit cooperation runbook commits to a single redaction pipeline so
 * the rules are testable and uniformly applied across all export paths.
 *
 * Behaviour: returns a deep-cloned copy of the input row with all configured
 * PII keys replaced by the constant string `[REDACTED]`. Honours nested-
 * path keys via dot notation (e.g. `retiredFor.email`). Non-PII fields are
 * preserved verbatim. The original input is never mutated.
 */

/** Sentinel string used in place of redacted PII values. */
export const REDACTED = '[REDACTED]';

/**
 * Default PII key set. Mirrors the field classes in the audit cooperation
 * runbook (retiree natural-person name, beneficiary legalIdRef, etc.).
 */
export const DEFAULT_PII_KEYS: readonly string[] = [
  'name',
  'email',
  'legalIdRef',
  'phone',
  'beneficiaryRef',
  'retiredFor.name',
  'retiredFor.legalIdRef',
  'retiredFor.email',
];

export interface RedactForAuditOpts {
  /** Override the PII key list. Default: `DEFAULT_PII_KEYS`. */
  piiKeys?: readonly string[];
}

/**
 * Redact PII fields in an audit-export row. Returns a NEW object with the
 * same shape as the input — the input is never mutated.
 *
 * Path semantics: a key like `retiredFor.email` walks into the nested
 * `retiredFor` object (if present + an object) and redacts `email` there.
 * A key with no dot redacts a top-level field. Missing intermediate paths
 * are silently skipped (no creation of partial parent objects).
 *
 * Arrays at intermediate path segments are redacted element-wise — every
 * matching element is treated as the next path step. This matches how the
 * BCR audit bundle exports nested retirement / beneficiary lists.
 */
export function redactForAudit(
  row: Record<string, unknown>,
  opts: RedactForAuditOpts = {},
): Record<string, unknown> {
  const piiKeys = opts.piiKeys ?? DEFAULT_PII_KEYS;
  const cloned = deepClone(row);
  for (const key of piiKeys) {
    applyRedaction(cloned, key.split('.'));
  }
  return cloned;
}

// ── Internals ──────────────────────────────────────────────────────────────

/**
 * Apply the redaction sentinel at the given path. If a path component is
 * missing, the redaction silently no-ops (we don't synthesise empty
 * intermediates — we only redact data that was already there).
 */
function applyRedaction(target: unknown, path: readonly string[]): void {
  if (path.length === 0 || target === null || typeof target !== 'object') {
    return;
  }

  // Walk arrays element-wise so `retiredFor.email` redacts every entry's
  // email if `retiredFor` happens to be an array.
  if (Array.isArray(target)) {
    for (const item of target) applyRedaction(item, path);
    return;
  }

  const obj = target as Record<string, unknown>;
  const [head, ...rest] = path;
  if (typeof head !== 'string' || !(head in obj)) return;

  if (rest.length === 0) {
    obj[head] = REDACTED;
    return;
  }

  applyRedaction(obj[head], rest);
}

/**
 * Structured-clone-like deep copy. We avoid `structuredClone` so the helper
 * works under any Node version + serialises Date/Map/Set into plain shapes,
 * which is what the audit-export tarball expects anyway. Functions, symbols,
 * and unsupported types are passed through by value.
 */
function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => deepClone(v)) as unknown as T;
  }
  // Preserve Date as a string (audit exports are JSON anyway).
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepClone(v);
  }
  return out as T;
}
