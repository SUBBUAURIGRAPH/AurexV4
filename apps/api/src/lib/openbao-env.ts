/**
 * J4C / WBS 11.1.1 — OpenBao **KMS** (Vault-API–compatible) bootstrap.
 *
 * J4C: **OpenBao = KMS / secrets**; **Harbor = Docker image registry** — different systems.
 *
 * Runs before any other app imports so Prisma and services see DATABASE_URL, JWT
 * secrets, etc. from KV v2. Local dev: load `.env` only; set OPENBAO_ADDR + token
 * in staging/prod (or K8s-injected) to pull secrets from OpenBao.
 *
 * **Canonical Aurigraph J4C endpoint** (set `OPENBAO_ADDR` to this in prod if using the org OpenBao):
 * `AURIGRAPH_J4C_OPENBAO_ADDR` in `j4c-platform.ts` (path-mounted Vault API).
 */
import { AURIGRAPH_J4C_OPENBAO_ADDR } from './j4c-platform.js';
import { buildKv2DataUrlPath } from './openbao-kv.js';
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
/** apps/api (three levels up from src/lib) */
const appRoot = join(here, '..', '..', '..');
/** monorepo root (four levels up from src/lib) */
const monorepoRoot = join(here, '..', '..', '..', '..');

export { AURIGRAPH_J4C_OPENBAO_ADDR };

function loadDotenvFiles(): void {
  const tryPaths = [join(appRoot, '.env'), join(monorepoRoot, '.env'), join(process.cwd(), '.env')];
  for (const p of tryPaths) {
    if (existsSync(p)) {
      dotenvConfig({ path: p, override: false });
    }
  }
}

function openbaoBaseUrl(): string {
  return (process.env.OPENBAO_ADDR ?? process.env.VAULT_ADDR ?? '').replace(/\/$/, '');
}

function openbaoToken(): string {
  return (process.env.OPENBAO_TOKEN ?? process.env.VAULT_TOKEN ?? '').trim();
}

/** KV v2 data path, e.g. aurex/api/prod (no /data/ prefix) */
function kvDataPath(): string {
  return (process.env.OPENBAO_KV_DATA_PATH ?? 'aurex/api').replace(/^\/+/, '');
}

function kvMount(): string {
  return (process.env.OPENBAO_KV_MOUNT ?? 'secret').replace(/\/$/, '');
}

function isTruthy(s: string | undefined): boolean {
  if (!s) return false;
  return !['0', 'false', 'no', 'off'].includes(s.trim().toLowerCase());
}

function shouldRunOpenBao(): boolean {
  if (process.env.NODE_ENV === 'test' && !isTruthy(process.env.OPENBAO_IN_TEST)) {
    return false;
  }
  if (isTruthy(process.env.OPENBAO_DISABLE)) {
    return false;
  }
  if (isTruthy(process.env.OPENBAO_ENABLED)) {
    return true;
  }
  return !!(openbaoBaseUrl() && openbaoToken());
}

function mergeIntoEnv(
  data: Record<string, unknown>,
  options: { override: boolean }
): { applied: string[] } {
  const applied: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'metadata' || k.startsWith('vault:')) {
      continue;
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      const s = String(v);
      if (process.env[k] === undefined || options.override) {
        process.env[k] = s;
        applied.push(k);
      }
    }
  }
  return { applied };
}

/**
 * Fetches one KV v2 object and applies keys to process.env.
 * Must be the first import side effect in the API (before Prisma).
 */
export async function applyOpenBaoEnv(): Promise<void> {
  loadDotenvFiles();
  if (!shouldRunOpenBao()) {
    return;
  }
  const base = openbaoBaseUrl();
  const token = openbaoToken();
  if (!base || !token) {
    return;
  }
  const mount = kvMount();
  const dPath = kvDataPath();
  const pathPart = buildKv2DataUrlPath(mount, dPath);
  const url = `${base}${pathPart}`;
  const override = isTruthy(process.env.OPENBAO_ENV_OVERRIDE) || process.env.OPENBAO_ENV_OVERRIDE === undefined;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Vault-Token': token, Accept: 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text();
    const msg = `OpenBao KV read failed: ${res.status} ${res.statusText} — ${errBody.slice(0, 500)}`;
    if (isTruthy(process.env.OPENBAO_STRICT) || process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
    // eslint-disable-next-line no-console
    console.warn(`[openbao-env] ${msg}`);
    return;
  }
  const body = (await res.json()) as { data?: { data?: Record<string, unknown> } };
  const secret = body?.data?.data;
  if (!secret || typeof secret !== 'object') {
    throw new Error('OpenBao: empty or missing data.data in KV v2 response');
  }
  const { applied } = mergeIntoEnv(secret, { override });
  if (applied.length > 0 && process.env.OPENBAO_LOG_KEYS === '1') {
    // eslint-disable-next-line no-console
    console.info(`[openbao-env] merged env keys: ${applied.sort().join(', ')}`);
  }
}

// Top-level await: importers of this module wait before Prisma loads.
await applyOpenBaoEnv();
