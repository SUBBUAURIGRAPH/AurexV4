/**
 * Idempotency key helper — deterministic SHA-256 over a canonical JSON
 * representation of the request payload.
 *
 * Works in Node 18+ (uses `globalThis.crypto.subtle`) and modern browsers.
 */

/**
 * Canonicalise a JSON value: objects get sorted keys, arrays preserve order.
 * Undefined values are skipped (mirrors JSON.stringify behaviour).
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalize(v)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      if (obj[k] === undefined) continue;
      parts.push(JSON.stringify(k) + ':' + canonicalize(obj[k]));
    }
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(String(value));
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Generate a SHA-256 idempotency key for a payload. Deterministic: same input
 * (modulo key order) → same key.
 *
 * Falls back to a simple FNV-1a hash in environments without crypto.subtle.
 */
export async function generateKey(payload: unknown): Promise<string> {
  const canonical = canonicalize(payload);
  const subtle =
    typeof globalThis !== 'undefined' &&
    (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (subtle) {
    const encoder = new TextEncoder();
    const digest = await subtle.digest('SHA-256', encoder.encode(canonical));
    return toHex(digest);
  }
  // Fallback: FNV-1a 64-bit (not cryptographic but deterministic)
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i++) {
    h1 ^= canonical.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
    h2 ^= canonical.charCodeAt(canonical.length - 1 - i);
    h2 = (h2 * 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/**
 * Synchronous variant using the FNV-1a fallback — for hot paths where
 * SubtleCrypto's async API is inconvenient. Not cryptographic.
 */
export function generateKeySync(payload: unknown): string {
  const canonical = canonicalize(payload);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i++) {
    h1 ^= canonical.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
    h2 ^= canonical.charCodeAt(canonical.length - 1 - i);
    h2 = (h2 * 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
