/**
 * AAT-DEEPRESEARCH — Google Deep Research (Gemini) adapter.
 *
 * Direct REST against the standalone Gemini API:
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}
 *   GET  https://generativelanguage.googleapis.com/v1beta/models?key={KEY}                 (ping)
 *
 * We deliberately do NOT add `@google/generative-ai` as a dependency —
 * the wire protocol is small, the SDK adds no value beyond a typed
 * wrapper, and keeping the dep small matters for the API container size.
 *
 * Auth surface: a standalone Gemini API key is sufficient; no Google
 * Cloud project is required. Resolved lazily on first call so the API
 * boots without the key (Mandrill-style: failure is loud only when you
 * actually try to use the feature).
 *
 * Depth → model mapping:
 *   - `quick`    : `gemini-2.5-flash` + Google Search tool
 *   - `standard` : `gemini-2.5-pro`   + Google Search tool
 *   - `deep`     : `gemini-2.5-pro-deep-research` (preferred). If that
 *                  model isn't enabled on the user's tier, set
 *                  `GEMINI_DEEP_RESEARCH_MODEL=gemini-2.5-pro` for an
 *                  extended-thinking + search fallback. Documented in
 *                  `docs/REGULATORY_RESEARCH_AUTOMATION.md`.
 *
 * Output coercion: we use prompt-driven JSON (system instruction +
 * `responseMimeType: application/json`) and post-parse strip of any
 * accidental markdown fence. We do NOT use a strict JSON-schema
 * `responseSchema` because the deep-research model rejects strict
 * schemas in some tier combinations; tolerant prompt + post-parse
 * stripping is the documented Gemini-recommended pattern.
 *
 * Citation extraction:
 *   1. Preferred — the model returns `citations: [{title,url,publishedAt}]`
 *      directly in its JSON output (per the system instruction).
 *   2. Fallback — `groundingMetadata.groundingChunks[].web` on the
 *      candidate (the standard search-grounded response shape Gemini
 *      attaches even when the JSON block doesn't echo URLs back).
 *
 * Mock mode: `GEMINI_MOCK_MODE=1` OR `NODE_ENV=test` → deterministic
 * stub with synthetic citations. No network call.
 */

import { logger } from '../../lib/logger.js';
import type {
  ResearchCitation,
  ResearchFinding,
  ResearchProvider,
  ResearchProviderName,
  ResearchQuery,
} from './provider.js';

// ─── Errors ────────────────────────────────────────────────────────────

export class GeminiKeyMissingError extends Error {
  readonly code = 'GEMINI_KEY_MISSING';
  constructor() {
    super(
      'Neither GOOGLE_AI_API_KEY nor GEMINI_API_KEY is set. Either provide ' +
        'a Google AI Studio API key (https://aistudio.google.com/apikey), ' +
        'set GEMINI_MOCK_MODE=1 for local/test envs, or disable the ' +
        '/admin/research/run endpoint.',
    );
    this.name = 'GeminiKeyMissingError';
  }
}

export class GeminiAuthError extends Error {
  readonly code = 'GEMINI_AUTH';
  readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = 'GeminiAuthError';
    this.httpStatus = httpStatus;
  }
}

export class GeminiRateLimitError extends Error {
  readonly code = 'GEMINI_RATE_LIMIT';
  readonly httpStatus = 429;
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

export class GeminiServerError extends Error {
  readonly code = 'GEMINI_SERVER';
  readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = 'GeminiServerError';
    this.httpStatus = httpStatus;
  }
}

export class GeminiNetworkError extends Error {
  readonly code = 'GEMINI_NETWORK';
  constructor(message: string) {
    super(message);
    this.name = 'GeminiNetworkError';
  }
}

export class GeminiBadResponseError extends Error {
  readonly code = 'GEMINI_BAD_RESPONSE';
  constructor(message: string) {
    super(message);
    this.name = 'GeminiBadResponseError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────────

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const SYSTEM_INSTRUCTION =
  'You are a regulatory analyst for Aurex (a carbon-credit + ESG platform). ' +
  'Return findings as structured JSON with shape: ' +
  '{ "summary": string, "keyPoints": string[], "citations": ' +
  '[{ "title": string, "url": string, "publishedAt"?: string }] }. ' +
  'Cite primary sources (UNFCCC SB, Verra registry, BCR, SEBI BRSR, ' +
  'Gold Standard) where possible. Do not wrap the JSON in markdown fences.';

const DEFAULT_DEEP_MODEL = 'gemini-2.5-pro-deep-research';

// ─── Internal helpers ──────────────────────────────────────────────────

function isMockMode(): boolean {
  return (
    process.env.NODE_ENV === 'test' || process.env.GEMINI_MOCK_MODE === '1'
  );
}

function resolveApiKey(): string {
  const key = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (key && key.length > 0) return key;
  if (isMockMode()) return 'gemini-mock-fixture-key';
  throw new GeminiKeyMissingError();
}

function modelForDepth(depth: ResearchQuery['depth']): string {
  switch (depth) {
    case 'quick':
      return process.env.GEMINI_QUICK_MODEL ?? 'gemini-2.5-flash';
    case 'deep':
      return process.env.GEMINI_DEEP_RESEARCH_MODEL ?? DEFAULT_DEEP_MODEL;
    case 'standard':
    default:
      return process.env.GEMINI_STANDARD_MODEL ?? 'gemini-2.5-pro';
  }
}

/**
 * Strip a leading/trailing ```json fence (or plain ``` fence) if the
 * model returned its JSON wrapped in markdown. Defensive — the system
 * instruction asks it not to, but Gemini occasionally does anyway.
 */
function stripJsonFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```')) {
    // ```json … ``` or ``` … ```
    s = s.replace(/^```(?:json|JSON)?\s*\n?/, '');
    s = s.replace(/\n?```\s*$/, '');
    s = s.trim();
  }
  return s;
}

interface ParsedFindingShape {
  summary: string;
  keyPoints: string[];
  citations: ResearchCitation[];
}

function coerceCitation(value: unknown): ResearchCitation | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const title = typeof v.title === 'string' ? v.title : null;
  const url = typeof v.url === 'string' ? v.url : null;
  if (!url) return null;
  const publishedAt =
    typeof v.publishedAt === 'string' ? v.publishedAt : undefined;
  return {
    title: title ?? url,
    url,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

function coerceFinding(parsed: unknown): ParsedFindingShape | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const summary = typeof obj.summary === 'string' ? obj.summary : null;
  if (!summary) return null;
  const keyPointsRaw = Array.isArray(obj.keyPoints) ? obj.keyPoints : [];
  const keyPoints = keyPointsRaw.filter(
    (p): p is string => typeof p === 'string',
  );
  const citationsRaw = Array.isArray(obj.citations) ? obj.citations : [];
  const citations = citationsRaw
    .map(coerceCitation)
    .filter((c): c is ResearchCitation => c !== null);
  return { summary, keyPoints, citations };
}

interface GroundingChunkWeb {
  uri?: string;
  title?: string;
}

interface GroundingChunk {
  web?: GroundingChunkWeb;
}

interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
  groundingMetadata?: {
    groundingChunks?: GroundingChunk[];
  };
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: UsageMetadata;
}

function citationsFromGroundingMetadata(
  candidate: GeminiCandidate,
): ResearchCitation[] {
  const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
  const out: ResearchCitation[] = [];
  for (const chunk of chunks) {
    const w = chunk.web;
    if (!w?.uri) continue;
    out.push({ title: w.title ?? w.uri, url: w.uri });
  }
  return out;
}

function extractTextFromCandidate(candidate: GeminiCandidate): string {
  const parts = candidate.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('');
}

// ─── Adapter ───────────────────────────────────────────────────────────

export class GeminiDeepResearchProvider implements ResearchProvider {
  readonly providerName: ResearchProviderName = 'gemini-deep-research';

  /**
   * Lazy-resolved API key — we don't read env on import so the API
   * process can boot without the key. The key is materialised on the
   * first `research()` or `ping()` call. Subclasses / tests can pass
   * an explicit key to bypass env resolution.
   */
  private cachedApiKey: string | null = null;

  constructor(apiKeyOverride?: string) {
    if (apiKeyOverride !== undefined) {
      this.cachedApiKey = apiKeyOverride;
    }
  }

  private getApiKey(): string {
    if (this.cachedApiKey) return this.cachedApiKey;
    this.cachedApiKey = resolveApiKey();
    return this.cachedApiKey;
  }

  /**
   * Probe the `/v1beta/models` listing endpoint. Cheap, read-only, and
   * a 200 means the key is recognised. Mock mode short-circuits to a
   * deterministic OK.
   */
  async ping(): Promise<{ ok: boolean; reason?: string }> {
    if (isMockMode()) return { ok: true };
    let key: string;
    try {
      key = this.getApiKey();
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
    try {
      const res = await fetch(
        `${GEMINI_BASE_URL}/models?key=${encodeURIComponent(key)}`,
        { method: 'GET' },
      );
      if (res.ok) return { ok: true };
      const detail = await res.text().catch(() => '');
      return {
        ok: false,
        reason: `HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async research(query: ResearchQuery): Promise<ResearchFinding> {
    const startedAt = Date.now();
    const depth = query.depth ?? 'standard';
    const model = modelForDepth(depth);

    // ── Mock-mode short-circuit (test envs + local dev) ────────────────
    if (isMockMode()) {
      const finding: ResearchFinding = {
        summary: `Mock research finding for topic: ${query.topic}`,
        keyPoints: [
          `Mock key point 1 about ${query.topic}`,
          `Mock key point 2 about ${query.topic}`,
          `Mock key point 3 about ${query.topic}`,
        ],
        citations: [
          {
            title: 'Mock UNFCCC source',
            url: 'https://unfccc.int/mock-source-1',
            publishedAt: '2026-01-15T00:00:00Z',
          },
          {
            title: 'Mock Verra registry source',
            url: 'https://verra.org/mock-source-2',
          },
        ],
        meta: {
          provider: this.providerName,
          model,
          durationMs: Date.now() - startedAt,
          tokensInput: 0,
          tokensOutput: 0,
        },
      };
      logger.debug(
        { topic: query.topic, depth, model },
        'Gemini research mock-mode (no HTTP call)',
      );
      return finding;
    }

    const key = this.getApiKey();
    const userPromptParts: string[] = [
      `Research topic: ${query.topic}`,
    ];
    if (query.scope) userPromptParts.push(`Scope: ${query.scope}`);
    if (typeof query.maxSources === 'number') {
      userPromptParts.push(`Return at most ${query.maxSources} citations.`);
    }
    if (query.citationsRequired) {
      userPromptParts.push(
        'Citations are REQUIRED. Do not return findings without citations.',
      );
    }
    userPromptParts.push(
      'Return ONLY a JSON object with keys summary, keyPoints, citations.',
    );

    const body: Record<string, unknown> = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPromptParts.join('\n\n') }],
        },
      ],
      tools: [{ google_search: {} }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(key)}`;

    let httpResponse: Response;
    try {
      httpResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new GeminiNetworkError(`Gemini network error: ${cause}`);
    }

    if (!httpResponse.ok) {
      const detail = await httpResponse.text().catch(() => '');
      const snippet = detail ? `: ${detail.slice(0, 500)}` : '';
      if (httpResponse.status === 401 || httpResponse.status === 403) {
        throw new GeminiAuthError(
          `Gemini auth error (HTTP ${httpResponse.status})${snippet}`,
          httpResponse.status,
        );
      }
      if (httpResponse.status === 429) {
        throw new GeminiRateLimitError(
          `Gemini rate-limited (HTTP 429)${snippet}`,
        );
      }
      if (httpResponse.status >= 500) {
        throw new GeminiServerError(
          `Gemini server error (HTTP ${httpResponse.status})${snippet}`,
          httpResponse.status,
        );
      }
      // Treat any other 4xx as bad-response — the request was malformed
      // by us or the model, not an auth/network issue.
      throw new GeminiBadResponseError(
        `Gemini returned HTTP ${httpResponse.status}${snippet}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = await httpResponse.json();
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new GeminiBadResponseError(
        `Gemini returned non-JSON response: ${cause}`,
      );
    }

    const response = parsed as GeminiGenerateContentResponse;
    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new GeminiBadResponseError(
        'Gemini response carried no candidates',
      );
    }

    const text = extractTextFromCandidate(candidate);
    if (!text) {
      throw new GeminiBadResponseError(
        'Gemini candidate produced no text content',
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripJsonFence(text));
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new GeminiBadResponseError(
        `Gemini JSON output failed to parse: ${cause}`,
      );
    }

    const coerced = coerceFinding(parsedJson);
    if (!coerced) {
      throw new GeminiBadResponseError(
        'Gemini JSON output missing required `summary` field',
      );
    }

    // Citation fallback — if the JSON block didn't carry citations but
    // the candidate's groundingMetadata did, lift them in.
    let citations = coerced.citations;
    if (citations.length === 0) {
      const grounded = citationsFromGroundingMetadata(candidate);
      if (grounded.length > 0) citations = grounded;
    }

    const usage = response.usageMetadata;
    const finding: ResearchFinding = {
      summary: coerced.summary,
      keyPoints: coerced.keyPoints,
      citations,
      meta: {
        provider: this.providerName,
        model,
        durationMs: Date.now() - startedAt,
        ...(typeof usage?.promptTokenCount === 'number'
          ? { tokensInput: usage.promptTokenCount }
          : {}),
        ...(typeof usage?.candidatesTokenCount === 'number'
          ? { tokensOutput: usage.candidatesTokenCount }
          : {}),
      },
    };
    return finding;
  }
}

/**
 * Test-only — drop the lazily-cached key on the singleton so a
 * subsequent test can rebuild it under a different env. We don't ship
 * a singleton in the module (each `getProvider()` call returns a fresh
 * instance), but tests that hand-construct the provider may want this.
 */
export function _resetGeminiProviderForTests(provider: GeminiDeepResearchProvider): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (provider as any).cachedApiKey = null;
}
