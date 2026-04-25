/**
 * Article 6.4 + BCR methodology catalogue — read-only.
 * Seeded from UNFCCC + BCR / Verra master data in seed-master-data.ts.
 *
 * AAT-π / AV4-368: this service is the single source of truth for
 * methodology metadata. External consumers (AWD2 import, BCR live adapter,
 * Aurigraph DLT SDK) MUST go through `getCatalogue()` / `findByCode()` /
 * `assertBcrEligible()` rather than calling `prisma.methodology.*` directly.
 */

import { createHash } from 'node:crypto';
import { prisma } from '@aurex/database';
import type { MethodologyCatalogueEntry } from '@aurex/shared';
import { AppError } from '../middleware/error-handler.js';

// ── Errors ──────────────────────────────────────────────────────────────────

/** Thrown by `findByCode` / `assertBcrEligible` when no row matches. */
export class MethodologyNotFoundError extends AppError {
  constructor(code: string, version?: string) {
    super(
      404,
      'Not Found',
      version
        ? `Methodology ${code}@${version} not found`
        : `Methodology ${code} not found`,
    );
    this.name = 'MethodologyNotFoundError';
  }
}

/** Thrown by `assertBcrEligible` when the methodology exists but is not eligible. */
export class MethodologyNotBcrEligibleError extends AppError {
  constructor(code: string) {
    super(
      422,
      'Unprocessable Entity',
      `Methodology ${code} is not BCR-eligible (Methodology.isBcrEligible=false)`,
    );
    this.name = 'MethodologyNotBcrEligibleError';
  }
}

// ── Internal: Prisma row → catalogue entry ─────────────────────────────────

/**
 * Shape of the Methodology row we read off Prisma. Declared explicitly so
 * the mapper compiles even when the generated client lags the schema.
 */
interface MethodologyRow {
  code: string;
  name: string;
  version: string;
  category: string;
  registryCategory: string;
  sectoralScope: number | null;
  summary: string | null;
  referenceUrl: string | null;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  isActive: boolean;
  isBcrEligible: boolean;
  gases: string[];
  notes: string | null;
}

/**
 * Map a Methodology row into the canonical catalogue entry shape. The
 * mapper is intentionally total — every consumer-facing field is computed
 * from the row, with deterministic fallbacks for nullable columns.
 */
function rowToEntry(row: MethodologyRow): MethodologyCatalogueEntry {
  // A6.4 eligibility = the code is in the A6.4 prefix family. We don't
  // (yet) have a dedicated column; derive from the registryCategory plus
  // the legacy `code` prefix for compatibility with existing data.
  const isA64Eligible =
    row.registryCategory === 'A6_4' || row.code.startsWith('A6.4-');

  return {
    code: row.code,
    version: row.version,
    name: row.name,
    category: row.registryCategory,
    isBcrEligible: row.isBcrEligible,
    isA64Eligible,
    referenceUrl: row.referenceUrl ?? 'https://unfccc.int/',
    gases: row.gases.length > 0 ? row.gases : ['CO2'],
    sectoralScope: row.sectoralScope ?? 14,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveUntil: row.effectiveUntil ? row.effectiveUntil.toISOString() : null,
    notes: row.notes ?? row.summary ?? null,
  };
}

/**
 * Compute a stable sha256 ETag over the canonical JSON of the entries
 * array. Algorithm choice: sha256 hex digest of `JSON.stringify(entries)`
 * with the entries already sorted by (category, code, version) — this
 * guarantees identical output whenever the underlying data is identical,
 * across processes and across deployments.
 */
function computeEtag(entries: MethodologyCatalogueEntry[]): string {
  const canonical = JSON.stringify(entries);
  return createHash('sha256').update(canonical).digest('hex');
}

// ── Module-level cache (60s) ────────────────────────────────────────────────

interface CatalogueCache {
  entries: MethodologyCatalogueEntry[];
  etag: string;
  generatedAt: string;
  expiresAt: number;
}

const CATALOGUE_TTL_MS = 60_000;
let catalogueCache: CatalogueCache | null = null;

/**
 * Test-only: drop the in-memory cache. Exported so unit tests can force a
 * re-fetch between mocked-Prisma scenarios. NOT part of the public API.
 */
export function _resetCatalogueCacheForTests(): void {
  catalogueCache = null;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Return the full normalised catalogue, sorted by (category, code, version).
 * Caches in memory for 60 seconds; computes a sha256 ETag over the entries
 * array for HTTP cache validation.
 */
export async function getCatalogue(): Promise<{
  entries: MethodologyCatalogueEntry[];
  etag: string;
  generatedAt: string;
}> {
  const now = Date.now();
  if (catalogueCache && catalogueCache.expiresAt > now) {
    return {
      entries: catalogueCache.entries,
      etag: catalogueCache.etag,
      generatedAt: catalogueCache.generatedAt,
    };
  }

  const rows = (await prisma.methodology.findMany({
    where: { isActive: true },
    orderBy: [
      { registryCategory: 'asc' },
      { code: 'asc' },
      { version: 'asc' },
    ],
  })) as unknown as MethodologyRow[];

  const entries = rows.map(rowToEntry);
  const etag = computeEtag(entries);
  const generatedAt = new Date(now).toISOString();

  catalogueCache = {
    entries,
    etag,
    generatedAt,
    expiresAt: now + CATALOGUE_TTL_MS,
  };

  return { entries, etag, generatedAt };
}

/**
 * Internal helper: parse a methodology version into a tuple of integers
 * for "latest" comparison. Falls back to lex order when the version
 * doesn't match the dot-separated numeric pattern. Examples:
 *   "01.0"   → [1, 0]
 *   "2.1"    → [2, 1]
 *   "v1.6"   → [1, 6]
 *   "DRAFT"  → [Number.NEGATIVE_INFINITY] (sorted last in lex fallback)
 */
function versionTuple(v: string): number[] {
  const stripped = v.replace(/^v/i, '');
  const parts = stripped.split(/[.-]/).map((p) => Number.parseInt(p, 10));
  if (parts.every((n) => Number.isFinite(n))) return parts;
  return [Number.NEGATIVE_INFINITY];
}

function compareVersions(a: string, b: string): number {
  const ta = versionTuple(a);
  const tb = versionTuple(b);
  const len = Math.max(ta.length, tb.length);
  for (let i = 0; i < len; i++) {
    const ai = ta[i] ?? 0;
    const bi = tb[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  // Equal numeric tuples → lex on the raw string for tie-break.
  return a.localeCompare(b);
}

/**
 * Look up a single methodology by `code` (and optionally `version`).
 * When `version` is omitted, returns the latest version where:
 *   1. `effectiveUntil IS NULL` rows take precedence (currently active)
 *   2. ties broken by largest `version` per `compareVersions`
 *
 * @throws MethodologyNotFoundError when no row matches.
 */
export async function findByCode(
  code: string,
  version?: string,
): Promise<MethodologyCatalogueEntry> {
  if (version) {
    const row = (await prisma.methodology.findFirst({
      where: { code, version },
    })) as unknown as MethodologyRow | null;
    if (!row) throw new MethodologyNotFoundError(code, version);
    return rowToEntry(row);
  }

  const rows = (await prisma.methodology.findMany({
    where: { code },
  })) as unknown as MethodologyRow[];

  if (rows.length === 0) throw new MethodologyNotFoundError(code);

  // Prefer rows that are still effective (effectiveUntil IS NULL); among
  // those, pick the largest version. Falls back to the largest version
  // overall when every row is sunset.
  const active = rows.filter((r) => r.effectiveUntil === null);
  const candidates = active.length > 0 ? active : rows;
  candidates.sort((a, b) => compareVersions(b.version, a.version));
  const latest = candidates[0];
  if (!latest) throw new MethodologyNotFoundError(code);
  return rowToEntry(latest);
}

/**
 * Convenience for AAT-ξ's awd2-import.service.ts: confirm the methodology
 * exists AND is BCR-eligible. Throws a typed error on either failure mode.
 *
 * @throws MethodologyNotFoundError       — code not in catalogue
 * @throws MethodologyNotBcrEligibleError — code present but isBcrEligible=false
 */
export async function assertBcrEligible(
  code: string,
  version?: string,
): Promise<MethodologyCatalogueEntry> {
  const entry = await findByCode(code, version);
  if (!entry.isBcrEligible) {
    throw new MethodologyNotBcrEligibleError(code);
  }
  return entry;
}

// ── Legacy wrappers (kept for the auth-gated /methodologies route) ─────────

/**
 * Legacy list — keeps the existing `/api/v1/methodologies` route working
 * without forcing the refactor downstream. Returns the raw Prisma rows.
 */
export async function listMethodologies(filter?: {
  category?: string;
  isActive?: boolean;
}) {
  const where: Record<string, unknown> = {};
  if (filter?.category) where.category = filter.category;
  if (filter?.isActive !== undefined) where.isActive = filter.isActive;
  return prisma.methodology.findMany({
    where,
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
  });
}

export async function getMethodologyByCode(code: string) {
  const m = await prisma.methodology.findUnique({ where: { code } });
  if (!m) throw new AppError(404, 'Not Found', `Methodology ${code} not found`);
  return m;
}

export async function getMethodologyById(id: string) {
  const m = await prisma.methodology.findUnique({ where: { id } });
  if (!m) throw new AppError(404, 'Not Found', 'Methodology not found');
  return m;
}
