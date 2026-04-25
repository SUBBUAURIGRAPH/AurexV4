/**
 * Shared helpers for Aurigraph DLT SDK project adapters
 * (Provenews, Battua, Hermes).
 *
 * Adapters translate project-specific event shapes into the generic
 * `DmrvEvent` shape consumed by `client.dmrv.recordEvent` / `batchRecord`
 * (see src/namespaces/dmrv.ts).
 *
 * DMRV "framework" is carried in each event's `metadata.framework` field,
 * since the generic `DmrvEvent` is measurement-oriented (deviceId, quantity,
 * unit) and does not have a first-class framework column.
 */

// ── DMRV framework enum (mirrors V12 DmrvFramework Java enum) ──────────────

export type DmrvFramework =
  | 'ISO_14064'
  | 'GHG_PROTOCOL'
  | 'VCM'
  | 'EU_ETS'
  | 'CBAM'
  | 'C2PA'
  | 'CUSTOM';

// ── Validators ─────────────────────────────────────────────────────────────

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;
const AUR_WALLET_RE = /^aur1[a-z0-9]{6,}$/i;
const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSha256Hex(value: string): boolean {
  return typeof value === 'string' && SHA256_HEX_RE.test(value);
}

export function isAurWallet(value: string): boolean {
  return typeof value === 'string' && AUR_WALLET_RE.test(value);
}

export function isEthAddress(value: string): boolean {
  return typeof value === 'string' && ETH_ADDRESS_RE.test(value);
}

export function isUuid(value: string): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Split an array into chunks of the given size. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
