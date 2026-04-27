/**
 * AAT-R5 / AV4-425 — Methodology drift watcher.
 *
 * Counterpart to the broader `gemini-regulatory-research.yml` weekly
 * workflow (AAT-DEEPRESEARCH). Where that scan covers the wider
 * regulatory landscape (UNFCCC SB, BCR, SEBI BRSR, etc.), this service
 * focuses on a single registry's methodology updates over the last
 * **90 days** and persists each scan as a `RegulatoryResearchRun` row
 * (no new schema — same audit table the rest of the deep-research
 * pipeline writes to).
 *
 * Today the broader process is a quarterly human review documented in
 * `docs/REGULATORY_GAP_FOLLOWUP_RUNBOOK.md` §"Verra / Gold Standard
 * methodology watch". This service automates the bulk of the prep work
 * so the methodology PM walks into the quarterly review with a
 * machine-collected drift report instead of starting from a blank
 * page.
 *
 * The watcher does NOT issue Jira tickets directly — that responsibility
 * stays with `gemini-regulatory-research.yml`'s post-scan classifier
 * (which already knows how to file P1 gap tickets against the docs/
 * corpus). This service only produces the per-registry finding; the
 * workflow yaml extends the `TOPICS` list to call this scan in
 * lockstep with the broad scan.
 */

import { runResearch } from './research.service.js';
import type { ResearchFinding } from './provider.js';

// ── Public types ──────────────────────────────────────────────────────────

export type MethodologyDriftRegistry = 'verra' | 'gold-standard';

/**
 * Result envelope. Carries the underlying `ResearchFinding` verbatim
 * (so downstream consumers can render it the same way they render the
 * broad scan), plus a stable `registry` discriminator so the workflow
 * yaml can sort findings by registry without parsing the topic string.
 */
export interface MethodologyDriftReport {
  registry: MethodologyDriftRegistry;
  /** ISO timestamp of when the scan was kicked off (server clock). */
  scannedAt: string;
  /** Persisted `RegulatoryResearchRun.id` — `''` if the audit row
   *  failed to persist (matches `runResearch` semantics). */
  runId: string;
  /** Verbatim Gemini Deep Research finding for this registry. */
  finding: ResearchFinding;
}

// ── Prompt construction ───────────────────────────────────────────────────

const REGISTRY_LABEL: Record<MethodologyDriftRegistry, string> = {
  verra: 'Verra (VCS Program / Verified Carbon Standard)',
  'gold-standard': 'Gold Standard for the Global Goals',
};

const REGISTRY_FOCUS_AREAS: Record<MethodologyDriftRegistry, string[]> = {
  verra: [
    'methodology releases, revisions, deprecations, or suspensions to the Verra VCS Program in the last 90 days',
    'changes to the Verra VCS Program Definitions, Standard, or Methodology Requirements documents',
    'registry policy updates affecting issuance, retirement, buffer pool contributions, or corresponding adjustments',
    'invalidations, suspensions, or remediation actions on existing methodologies (e.g. VM0006, VM0007, VM0042)',
  ],
  'gold-standard': [
    'methodology releases, revisions, deprecations, or suspensions to Gold Standard for the Global Goals in the last 90 days',
    'changes to the Gold Standard Principles & Requirements or methodology framework',
    'registry policy updates affecting issuance, retirement, or sustainable development goal (SDG) impact reporting',
    'invalidations or remediation actions on existing methodologies',
  ],
};

/**
 * Build the focused prompt for a registry. Exported so the test suite
 * can assert the prompt structure is exactly what we documented (the
 * prompt is part of the auditable trail — if it changes, the historical
 * audit rows lose their narrative pin).
 */
export function buildMethodologyDriftPrompt(
  registry: MethodologyDriftRegistry,
): { topic: string; scope: string } {
  const label = REGISTRY_LABEL[registry];
  const focus = REGISTRY_FOCUS_AREAS[registry]
    .map((line, i) => `  ${i + 1}. ${line}`)
    .join('\n');

  return {
    topic: `Methodology drift watch for ${label}`,
    scope:
      `Identify ${label} methodology updates published or announced in the last 90 days. ` +
      `Treat methodology drift as ANY of:\n${focus}\n\n` +
      `For each item, report: methodology code (where applicable), the change type ` +
      `(release / revision / suspension / deprecation), the effective date, and a primary-source ` +
      `citation (registry policy page, methodology PDF, or registry announcement). Cite the ` +
      `${label} primary registry sources first; secondary commentary is acceptable only when no ` +
      `primary source exists yet.`,
  };
}

// ── Service entrypoint ────────────────────────────────────────────────────

export interface ScanMethodologyDriftOptions {
  /** Triggered-by tag persisted to the audit row. Defaults to
   *  `methodology-drift-watcher`. The cron / workflow can override. */
  triggeredBy?: string;
}

/**
 * Run a focused methodology-drift scan for a single registry. Returns
 * the finding + the audit row id. Throws on Gemini failures (caller —
 * typically the workflow yaml or a route handler — maps to its own
 * error envelope).
 *
 * Persists to `RegulatoryResearchRun` (the same table the broad scan
 * writes to) with provider/model/depth metadata copied through from
 * the underlying `runResearch` call. No new schema.
 */
export async function scanMethodologyDrift(
  registry: MethodologyDriftRegistry,
  opts: ScanMethodologyDriftOptions = {},
): Promise<MethodologyDriftReport> {
  const scannedAt = new Date().toISOString();
  const { topic, scope } = buildMethodologyDriftPrompt(registry);
  const triggeredBy = opts.triggeredBy ?? 'methodology-drift-watcher';

  const { finding, runId } = await runResearch(
    {
      topic,
      scope,
      depth: 'deep',
      citationsRequired: true,
      // Methodology scans tend to be narrow — clamp citation count so
      // the finding stays scannable for the methodology PM.
      maxSources: 8,
    },
    { triggeredBy },
  );

  return {
    registry,
    scannedAt,
    runId,
    finding,
  };
}
