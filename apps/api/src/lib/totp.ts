import { createHmac, randomBytes } from 'node:crypto';

/**
 * RFC 6238 TOTP helper. Deliberately standalone (no new deps) — Google
 * Authenticator and Authy both accept the `otpauth://totp/...` URL we produce.
 *
 * Window: 30s. Digits: 6. Algorithm: SHA-1. Tolerance: ±1 step on verify to
 * absorb clock drift between client and server.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i += 1) {
    value = (value << 8) | buf[i]!;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 1) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]!);
    if (idx < 0) throw new Error('invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return String(code % 1_000_000).padStart(6, '0');
}

export function totpCode(secret: string, time = Date.now()): string {
  return hotp(secret, Math.floor(time / 1000 / 30));
}

/**
 * Verify a TOTP code against a secret, tolerating ±1 time step (~30s) of drift.
 */
export function verifyTotp(secret: string, code: string, time = Date.now()): boolean {
  const cleaned = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const counter = Math.floor(time / 1000 / 30);
  for (const offset of [-1, 0, 1]) {
    if (hotp(secret, counter + offset) === cleaned) return true;
  }
  return false;
}

/**
 * Build an otpauth:// URL usable by Google Authenticator / Authy.
 * Issuer + label are URL-encoded.
 */
export function otpauthUrl(secret: string, email: string, issuer = 'Aurex'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}
