/**
 * AAT-DEEPRESEARCH — Research provider abstraction.
 *
 * External counterpart to the Claude-driven spec-compliance pipeline
 * (AV4-405 / AAT-405). Where that workflow detects DRIFT between local
 * specs (`docs/BIOCARBON_*.md`, `docs/A6_4_*.md`) and the implementation,
 * this abstraction lets the API call out to a research provider that can
 * scan the wider regulatory landscape (UNFCCC SB updates, BCR procedure
 * changes, SEBI BRSR Core revisions, Verra methodology releases, Gold
 * Standard) and surface findings that should propagate INTO the spec
 * docs.
 *
 * Mirrors the email transport pattern (`services/email/transport.ts`):
 * one interface, one or more implementations, factory in
 * `research.service.ts`. Today only the Gemini Deep Research adapter is
 * shipped; future adapters (Perplexity, Anthropic web-search) plug into
 * the same surface without service-layer churn.
 *
 * Citations are normalised to `{ title, url, publishedAt? }` so the
 * persisted audit row is provider-agnostic.
 */

export interface ResearchQuery {
  /** Free-text research topic (the prompt's "what to look up"). */
  topic: string;
  /** Optional narrowing context — e.g. a date range, a regulator scope. */
  scope?: string;
  /**
   * How aggressively to search. Maps onto provider-specific knobs:
   *   - `quick`    : cheap, single-shot
   *   - `standard` : default, search-grounded reasoning
   *   - `deep`     : multi-step deep research (slower, more expensive)
   */
  depth?: 'quick' | 'standard' | 'deep';
  /**
   * Whether the provider MUST return citations. Failing-closed when the
   * provider returns zero citations is up to the caller.
   */
  citationsRequired?: boolean;
  /** Soft cap on returned citations. Providers are free to clamp. */
  maxSources?: number;
}

export interface ResearchCitation {
  title: string;
  url: string;
  /** ISO-8601 timestamp when the source was published, when known. */
  publishedAt?: string;
}

export interface ResearchFinding {
  /** Plain-text summary suitable for a Jira description body. */
  summary: string;
  /** Bullet-point key findings (typically 3–10 items). */
  keyPoints: string[];
  citations: ResearchCitation[];
  meta: {
    provider: string;
    model: string;
    durationMs: number;
    tokensInput?: number;
    tokensOutput?: number;
  };
}

export type ResearchProviderName = 'gemini-deep-research' | 'mock';

export interface ResearchProvider {
  readonly providerName: ResearchProviderName;
  research(query: ResearchQuery): Promise<ResearchFinding>;
  /**
   * Cheap auth/connectivity probe used by `/api/v1/health/research`.
   * Should not consume the heavy research budget — for the Gemini
   * adapter this is a `models?key=…` listing call.
   */
  ping(): Promise<{ ok: boolean; reason?: string }>;
}
