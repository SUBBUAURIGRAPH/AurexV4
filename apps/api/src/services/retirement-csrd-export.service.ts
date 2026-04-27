/**
 * AAT-R4 / AV4-438 — EU CSRD ESRS E1-7 retirement export + backfill.
 * Related: AV4-439 (broader CSRD / ESRS mapping vs BRSR·TCFD·GRI stacks) is
 * satisfied for *credit-retirement* disclosure by the same E1-7 denormalized
 * row + this CSV; full multi-framework crosswalk remains PM/assurance scope.
 *
 * ESRS E1-7 (climate change mitigation actions and resources) requires
 * non-netted, granular disclosure of every carbon-credit retirement an
 * undertaking uses against its targets:
 *
 *   - vintage
 *   - methodology code
 *   - project type bucket (REDD+ / ARR / cookstove / renewable / other)
 *   - removal vs. reduction
 *   - buffer pool contribution % (relevant for removals)
 *   - host country (ISO 3166-1 alpha-2)
 *   - CORSIA / CCP eligibility flags
 *   - whether a corresponding adjustment was applied
 *
 * The Retirement model carries denormalised copies of these fields so the
 * disclosure record is stable against upstream master-data churn (a method-
 * ology version bump or a registry reclassification must not retroactively
 * change a published disclosure).
 *
 * This service exposes:
 *
 *   - `buildCsrdExportCsv(orgId, range)` — pulls all retirements for the
 *     org over the date range and emits a flat CSV with the column order
 *     ESRS E1-7 disclosure tooling expects.
 *
 *   - `backfillRetirementGranularity()` — admin one-shot that fills the
 *     denormalised fields on pre-existing rows. Idempotent: only touches
 *     rows where any of the new columns is NULL / default. Runs through
 *     the standard `resolveRetirementGranularity` loader so a backfilled
 *     row is identical to a freshly-created row.
 *
 * TODO (out of scope for AV4-438): structured XBRL output for ESRS E1-7
 * Inline XBRL filings. Flat CSV is the operator-pivot artefact; XBRL
 * generation will be a follow-up ticket once the EFRAG taxonomy IDs are
 * pinned to specific ESRS data points.
 */

import { prisma, Prisma } from '@aurex/database';
import { csvEscape } from './export.service.js';
import { logger } from '../lib/logger.js';
import { resolveRetirementGranularity } from './retirement.service.js';

// ── CSV contract ──────────────────────────────────────────────────────────

/**
 * Column order is load-bearing — disclosure tooling pivots on column index,
 * not header name. Do not reorder without coordinating with the BRSR /
 * CSRD export consumers.
 */
export const CSRD_RETIREMENT_CSV_HEADER = [
  'retirement_id',
  'retired_at',
  'tonnes_retired',
  'vintage',
  'methodology_code',
  'project_type',
  'is_removal',
  'buffer_pool_pct',
  'host_country',
  'corsia_eligible',
  'ccp_eligible',
  'ca_applied',
  'purpose',
  'narrative',
  'beneficiary_kyc_id',
] as const;

export interface CsrdExportRange {
  /** Inclusive lower bound on `createdAt`. */
  from: Date;
  /** Exclusive upper bound on `createdAt`. */
  to: Date;
}

export interface CsrdExportRow {
  retirementId: string;
  retiredAt: Date;
  tonnesRetired: number;
  vintage: number;
  methodologyCode: string | null;
  projectType: string | null;
  isRemoval: boolean;
  bufferPoolContributionPct: number | null;
  hostCountryIso: string | null;
  corsiaEligible: boolean;
  ccpEligible: boolean;
  correspondingAdjustmentApplied: boolean;
  purpose: string;
  narrative: string | null;
  beneficiaryKycId: string;
}

/**
 * Encode the row set as RFC 4180-style CSV with CRLF line endings + every
 * field double-quoted (mirrors `export.service.ts` conventions). `metadata`
 * is JSON-stringified — same rule as the emissions export.
 */
export function encodeCsrdExportCsv(rows: CsrdExportRow[]): string {
  const lines: string[] = [];
  lines.push(CSRD_RETIREMENT_CSV_HEADER.map((c) => csvEscape(c)).join(','));
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.retirementId),
        csvEscape(r.retiredAt),
        csvEscape(r.tonnesRetired),
        csvEscape(r.vintage),
        csvEscape(r.methodologyCode),
        csvEscape(r.projectType),
        csvEscape(r.isRemoval),
        csvEscape(r.bufferPoolContributionPct),
        csvEscape(r.hostCountryIso),
        csvEscape(r.corsiaEligible),
        csvEscape(r.ccpEligible),
        csvEscape(r.correspondingAdjustmentApplied),
        csvEscape(r.purpose),
        csvEscape(r.narrative),
        csvEscape(r.beneficiaryKycId),
      ].join(','),
    );
  }
  return lines.join('\r\n');
}

// ── Loader + CSV builder ──────────────────────────────────────────────────

/**
 * Load the retirement rows for an org over a date range, normalised to the
 * CSV row shape. Sorted by retiredAt (createdAt) ascending so the export is
 * deterministic and readable.
 */
export async function loadCsrdExportRows(
  orgId: string,
  range: CsrdExportRange,
): Promise<CsrdExportRow[]> {
  const rows = await prisma.retirement.findMany({
    where: {
      retiredByOrgId: orgId,
      createdAt: {
        gte: range.from,
        lt: range.to,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({
    retirementId: r.id,
    retiredAt: r.createdAt,
    tonnesRetired: r.tonnesRetired,
    vintage: r.vintage,
    methodologyCode: r.methodologyCode ?? null,
    projectType: r.projectType ?? null,
    isRemoval: Boolean(r.isRemoval),
    bufferPoolContributionPct:
      r.bufferPoolContributionPct === null ||
      r.bufferPoolContributionPct === undefined
        ? null
        : Number(r.bufferPoolContributionPct),
    hostCountryIso: r.hostCountryIso ?? null,
    corsiaEligible: Boolean(r.corsiaEligible),
    ccpEligible: Boolean(r.ccpEligible),
    correspondingAdjustmentApplied: Boolean(r.correspondingAdjustmentApplied),
    purpose: String(r.purpose),
    narrative: r.purposeNarrative ?? null,
    beneficiaryKycId: r.kycVerificationId,
  }));
}

export interface CsrdExportArtifact {
  filename: string;
  csv: string;
  rowCount: number;
}

function buildCsrdFilename(orgId: string, range: CsrdExportRange): string {
  const fmt = (d: Date): string => {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  };
  // Org id slice keeps the filename short while still being identifiable.
  const orgFrag = orgId.slice(0, 8);
  return `csrd-retirements-${orgFrag}-${fmt(range.from)}-${fmt(range.to)}.csv`;
}

/**
 * Public entrypoint used by the route layer. Returns the CSV string + a
 * deterministic filename + the row count (for logging / Content-Length
 * headers / no-row diagnostics).
 */
export async function buildCsrdExportCsv(
  orgId: string,
  range: CsrdExportRange,
): Promise<CsrdExportArtifact> {
  const rows = await loadCsrdExportRows(orgId, range);
  const csv = encodeCsrdExportCsv(rows);
  return {
    filename: buildCsrdFilename(orgId, range),
    csv,
    rowCount: rows.length,
  };
}

// ── Backfill ──────────────────────────────────────────────────────────────

export interface BackfillResult {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * Backfill the AV4-438 denormalised CSRD fields for pre-existing Retirement
 * rows. Selects rows where the new fields are still at default (null /
 * false) and re-resolves the snapshot via `resolveRetirementGranularity`.
 *
 * Idempotent — re-running on a fully-backfilled table is a no-op (the
 * scan filter excludes already-populated rows). Operator-callable; not
 * wired into request-time flows.
 */
export async function backfillRetirementGranularity(
  opts: { batchSize?: number } = {},
): Promise<BackfillResult> {
  const batchSize = opts.batchSize ?? 200;
  const result: BackfillResult = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  let cursor: string | null = null;

  // Pull rows that look un-backfilled. Cheaper than per-row checks: select
  // anything where methodologyCode IS NULL AND projectType IS NULL — the
  // two fields are always written together, so this is a safe "needs work"
  // signal even for very old rows.
  // We don't `where: { methodologyCode: null }` directly because some
  // legitimate rows have a null methodology (issuance with no activity at
  // all — synthetic AWD2 imports). Those will fall through the resolver
  // gracefully.
  while (true) {
    const findArgs: Prisma.RetirementFindManyArgs = {
      where: {
        AND: [{ methodologyCode: null }, { projectType: null }],
      },
      take: batchSize,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    };
    const batch = await prisma.retirement.findMany(findArgs);
    if (batch.length === 0) break;

    for (const row of batch) {
      result.scanned++;
      try {
        const issuance = await prisma.issuance.findUnique({
          where: { id: row.issuanceId },
        });
        if (!issuance) {
          result.skipped++;
          continue;
        }

        const snap = await resolveRetirementGranularity(issuance);

        // No-op shortcut: if every field is at default we have nothing
        // useful to write. Skip rather than churn.
        const hasSomething =
          snap.methodologyCode !== null ||
          snap.projectType !== null ||
          snap.hostCountryIso !== null ||
          snap.bufferPoolContributionPct !== null ||
          snap.corsiaEligible ||
          snap.ccpEligible ||
          snap.correspondingAdjustmentApplied ||
          snap.isRemoval;
        if (!hasSomething) {
          result.skipped++;
          continue;
        }

        await prisma.retirement.update({
          where: { id: row.id },
          data: {
            methodologyCode: snap.methodologyCode,
            projectType: snap.projectType,
            isRemoval: snap.isRemoval,
            bufferPoolContributionPct: snap.bufferPoolContributionPct,
            hostCountryIso: snap.hostCountryIso,
            corsiaEligible: snap.corsiaEligible,
            ccpEligible: snap.ccpEligible,
            correspondingAdjustmentApplied: snap.correspondingAdjustmentApplied,
          },
        });
        result.updated++;
      } catch (err) {
        result.failed++;
        logger.warn(
          {
            err: err instanceof Error ? err.message : String(err),
            retirementId: row.id,
          },
          'backfillRetirementGranularity: row failed; continuing',
        );
      }
    }

    cursor = batch[batch.length - 1]!.id;
    if (batch.length < batchSize) break;
  }

  logger.info(result, 'backfillRetirementGranularity: complete');
  return result;
}
