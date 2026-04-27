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

// ── ESRS E1-7 field mapping (AV4-439) ─────────────────────────────────────

/**
 * AAT-R5 / AV4-439 — explicit, machine-readable mapping from the CSV
 * columns this service emits to the ESRS E1-7 disclosure data points an
 * external auditor will reconcile against. Exposed via
 * `GET /api/v1/admin/retirements/csrd-export/metadata` so ESG auditors
 * can pivot Aurex output → their ESRS template without re-deriving the
 * crosswalk from code comments.
 *
 * Section references are to ESRS E1-7 ("Climate change mitigation actions
 * and resources" — non-netted disclosure of carbon-credit retirements
 * supporting the undertaking's climate targets). Where ESRS E1-7 doesn't
 * pin a paragraph (e.g. registry-internal identifiers), we cite the
 * supporting ESRS 2 paragraph that mandates the audit-traceability link.
 *
 * Keys here are the camelCase field names on the `CsrdExportRow`
 * interface. The `csvColumn` field cross-references the snake-case CSV
 * header so consumers can pivot in either direction.
 *
 * Contract: every column in `CSRD_RETIREMENT_CSV_HEADER` MUST have an
 * entry below. The `assertEsrsE17MappingCoversCsv()` helper enforces this
 * at module-load time so a future column addition forces the mapping to
 * be updated in lockstep.
 */
export const ESRS_E17_FIELD_MAPPING = {
  retirementId: {
    csvColumn: 'retirement_id',
    esrsRef: 'ESRS 2 §BP-1',
    description:
      'Aurex retirement record identifier — supports the audit-traceability link between disclosed tonnes and the underlying registry burn',
  },
  retiredAt: {
    csvColumn: 'retired_at',
    esrsRef: 'ESRS E1-7 §29(b)',
    description:
      'Date the retirement was recorded against the reporting period; ESRS E1-7 requires per-period disclosure of mitigation actions',
  },
  tonnesRetired: {
    csvColumn: 'tonnes_retired',
    esrsRef: 'ESRS E1-7 §29(a)',
    description:
      'Tonnes CO2-equivalent retired — the headline non-netted quantity disclosed under ESRS E1-7',
  },
  vintage: {
    csvColumn: 'vintage',
    esrsRef: 'ESRS E1-7 §29(c)',
    description:
      'Crediting period vintage of the retired credit (year emission reduction / removal occurred)',
  },
  methodologyCode: {
    csvColumn: 'methodology_code',
    esrsRef: 'ESRS E1-7 §29(c)',
    description:
      'Methodology used to calculate the emission reduction or removal (Verra VCS code, Gold Standard ID, A6.4 methodology id, etc.)',
  },
  projectType: {
    csvColumn: 'project_type',
    esrsRef: 'ESRS E1-7 §29(d)',
    description:
      'Type of mitigation activity bucketed against ESRS-recognised categories (REDD+, ARR, cookstove, renewable energy, other)',
  },
  isRemoval: {
    csvColumn: 'is_removal',
    esrsRef: 'ESRS E1-7 §29(d)',
    description:
      'Removal vs reduction flag — ESRS E1-7 disclosures must distinguish between avoided emissions and actual atmospheric removals',
  },
  bufferPoolContributionPct: {
    csvColumn: 'buffer_pool_pct',
    esrsRef: 'ESRS E1-7 §AR 27',
    description:
      'Percentage of issued tonnes contributed to the registry buffer pool to manage non-permanence risk; relevant for ARR / REDD+ removals',
  },
  hostCountryIso: {
    csvColumn: 'host_country',
    esrsRef: 'ESRS E1-7 §29(e)',
    description:
      'Host country (ISO 3166-1 alpha-2) where the underlying mitigation activity took place',
  },
  corsiaEligible: {
    csvColumn: 'corsia_eligible',
    esrsRef: 'ESRS E1-7 §AR 28',
    description:
      'Whether the credit qualifies under ICAO CORSIA (signal of host-country authorization for international transfer)',
  },
  ccpEligible: {
    csvColumn: 'ccp_eligible',
    esrsRef: 'ESRS E1-7 §AR 28',
    description:
      'Whether the credit carries the ICVCM Core Carbon Principles (CCP) label — a quality signal disclosed alongside the methodology',
  },
  correspondingAdjustmentApplied: {
    csvColumn: 'ca_applied',
    esrsRef: 'ESRS E1-7 §29(f)',
    description:
      'Whether a corresponding adjustment was applied by the host country under Article 6 — material to whether the credit can be claimed against the buyer\'s NDC contribution',
  },
  purpose: {
    csvColumn: 'purpose',
    esrsRef: 'ESRS E1-7 §29(g)',
    description:
      'Reason for the retirement (CSR, NDC contribution, voluntary climate target, OTHER)',
  },
  narrative: {
    csvColumn: 'narrative',
    esrsRef: 'ESRS E1-7 §29(g)',
    description:
      'Free-text narrative qualifying the purpose; required when purpose=OTHER and recommended for audit context',
  },
  beneficiaryKycId: {
    csvColumn: 'beneficiary_kyc_id',
    esrsRef: 'ESRS 2 §BP-1',
    description:
      'KYC verification identifier for the beneficiary of the retirement — supports the audit chain from disclosed tonne to KYB-cleared end-claimant',
  },
} as const satisfies Record<
  Exclude<keyof CsrdExportRow, never>,
  { csvColumn: string; esrsRef: string; description: string }
>;

export type EsrsE17FieldKey = keyof typeof ESRS_E17_FIELD_MAPPING;

/**
 * Self-check: confirm every CSV column has a mapping entry whose
 * `csvColumn` matches. Throws at module load if a column is added to
 * `CSRD_RETIREMENT_CSV_HEADER` without a corresponding `ESRS_E17_FIELD_MAPPING`
 * row, so the export and the auditor-facing crosswalk cannot drift.
 */
export function assertEsrsE17MappingCoversCsv(): void {
  const csvColumns = new Set<string>(CSRD_RETIREMENT_CSV_HEADER);
  const mappedColumns = new Set<string>(
    Object.values(ESRS_E17_FIELD_MAPPING).map((v) => v.csvColumn),
  );
  const missing = [...csvColumns].filter((c) => !mappedColumns.has(c));
  if (missing.length > 0) {
    throw new Error(
      `ESRS_E17_FIELD_MAPPING is missing entries for CSV columns: ${missing.join(
        ', ',
      )}. Add them in retirement-csrd-export.service.ts before deploying.`,
    );
  }
  const orphans = [...mappedColumns].filter((c) => !csvColumns.has(c));
  if (orphans.length > 0) {
    throw new Error(
      `ESRS_E17_FIELD_MAPPING references columns not in CSV header: ${orphans.join(
        ', ',
      )}. Drop or rename them in retirement-csrd-export.service.ts.`,
    );
  }
}

// Run the self-check at module load. Throws loudly rather than letting
// the export ship an inconsistent crosswalk.
assertEsrsE17MappingCoversCsv();

/**
 * Self-describing CSV header comment line — emitted as the first line
 * of the export when the caller passes `{ withHeaderComment: true }`.
 * Format: `# ESRS_E17_MAPPING={"retirement_id":"ESRS 2 §BP-1", ...}` —
 * a single comment line that maps each CSV column to its ESRS reference
 * so the file is self-documenting for offline auditors.
 *
 * RFC 4180 doesn't reserve a comment character; we use `#` because that
 * is the most widely-supported convention across CSV parsers (pandas,
 * R readr, postgres COPY) when configured with comment-skip. Consumers
 * that don't set comment-skip will see a single extra row whose first
 * cell starts with `#` — they can safely drop it.
 */
export function buildEsrsHeaderComment(): string {
  const compact: Record<string, string> = {};
  for (const entry of Object.values(ESRS_E17_FIELD_MAPPING)) {
    compact[entry.csvColumn] = entry.esrsRef;
  }
  return `# ESRS_E17_MAPPING=${JSON.stringify(compact)}`;
}

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
