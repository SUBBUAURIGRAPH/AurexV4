/**
 * OpenBao / Vault HTTP KV v2 path helpers (no I/O, safe to import from tests).
 */

/** Build /v1/{mount}/data/{path} for KV v2 (logical path may use / segments) */
export function buildKv2DataUrlPath(mount: string, dataPath: string): string {
  const m = mount.replace(/\/$/, '');
  const segments = dataPath.split('/').filter(Boolean).map(encodeURIComponent);
  return `/v1/${encodeURIComponent(m)}/data/${segments.join('/')}`;
}
