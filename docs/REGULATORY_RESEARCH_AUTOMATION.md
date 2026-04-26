# Regulatory Research Automation (Google Deep Research / Gemini)

**Owner**: Aurex API team — `apps/api/src/services/research/`
**Jira tag**: `AAT-DEEPRESEARCH`
**Related**: `AV4-405 / AAT-405` (internal Claude-driven spec compliance pipeline)

## What this integration does

Aurex runs two complementary "spec drift" scans:

| Pipeline | Trigger | Direction | Tooling |
|---|---|---|---|
| `claude-spec-compliance.yml` | push to `main` that touches `docs/BIOCARBON_*.md`, `docs/A6_4_*.md`, `docs/PRICING.md` | **internal** drift between specs and the codebase | Claude Code SDK |
| `gemini-regulatory-research.yml` | weekly (Monday 02:00 UTC) + manual | **external** regulatory landscape vs. Aurex specs | Google Deep Research (Gemini) |

The Gemini integration is implemented as a research-provider abstraction:

- `apps/api/src/services/research/provider.ts` — `ResearchProvider` interface
- `apps/api/src/services/research/gemini-deep-research.ts` — Gemini adapter (direct REST, no SDK)
- `apps/api/src/services/research/research.service.ts` — orchestration + audit-row persistence
- `apps/api/src/routes/admin-research.ts` — `POST /api/v1/admin/research/run`, `GET /runs`, `GET /runs/:id`
- `apps/api/src/routes/health.ts` — `GET /api/v1/health/research`
- DB: `regulatory_research_runs` audit table (Prisma model `RegulatoryResearchRun`)

## How to obtain a Gemini API key

The standalone Gemini API key is sufficient — **no Google Cloud project required**.

1. Sign in to https://aistudio.google.com/apikey with the operator Google account.
2. Create a new API key. Copy it.
3. Set on the API container:
   ```bash
   GOOGLE_AI_API_KEY=AIza... # preferred name
   # Backwards-compat alias is also accepted:
   # GEMINI_API_KEY=AIza...
   ```
4. (Optional) Pin specific model variants per depth:
   ```bash
   GEMINI_QUICK_MODEL=gemini-2.5-flash
   GEMINI_STANDARD_MODEL=gemini-2.5-pro
   GEMINI_DEEP_RESEARCH_MODEL=gemini-2.5-pro-deep-research
   ```

If `gemini-2.5-pro-deep-research` is **not enabled** on your tier (some accounts only get the standard `2.5-pro`), set
```bash
GEMINI_DEEP_RESEARCH_MODEL=gemini-2.5-pro
```
and the `depth: 'deep'` calls will fall back to standard pro + Google search grounding.

If you'd rather use a Google Cloud project + Vertex AI, the adapter would need a small refactor (Vertex uses a different endpoint shape — `https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/{model}:generateContent` and OAuth2 instead of an API key). The standalone Gemini API key path is recommended for ops simplicity.

## Cost notes

Gemini pricing as of 2026-04 (verify at https://ai.google.dev/pricing before enabling at scale):

| Depth | Model | Approx cost per run |
|---|---|---|
| `quick` | `gemini-2.5-flash` | ~$0.001 — $0.005 |
| `standard` | `gemini-2.5-pro` | ~$0.01 — $0.05 |
| `deep` | `gemini-2.5-pro-deep-research` | ~$0.10 — $0.50 (slower, multi-step search + reasoning) |

The weekly workflow defaults to **5 deep-research calls / week ≈ $2.50/month worst case**. Deep Research can also surface tens of citations per call, so the per-call cost is high vs. the standard generate endpoint.

## How to run ad-hoc

### Via the admin API (curl)

```bash
TOKEN="<long-lived super-admin JWT>"

curl -X POST https://aurex.in/api/v1/admin/research/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "UNFCCC SB-60 outcomes relevant to Article 6.4 PACM",
    "depth": "deep",
    "citationsRequired": true,
    "maxSources": 8
  }'
```

Response:
```json
{
  "data": {
    "summary": "...",
    "keyPoints": ["...", "..."],
    "citations": [{ "title": "...", "url": "...", "publishedAt": "..." }],
    "meta": { "provider": "gemini-deep-research", "model": "...", "durationMs": 12345, "tokensInput": 100, "tokensOutput": 2000 },
    "runId": "<uuid>"
  }
}
```

### Via the GitHub workflow (manual dispatch)

```bash
gh workflow run gemini-regulatory-research.yml \
  -f topics="Verra VCS methodology releases since 2026-04-01" \
  -f depth="deep"
```

## How to read the audit table

Each call to `runResearch()` writes one row to `regulatory_research_runs`. The row is created as `PENDING` up-front so even a process crash mid-call leaves a forensic breadcrumb, then flipped to `SUCCESS` (with summary, key points, citations, token counts) or `FAILED` (with `error_message`).

```sql
-- Last 10 runs across all status
SELECT id, topic, depth, provider, model, status, duration_ms,
       tokens_input, tokens_output, created_at
FROM regulatory_research_runs
ORDER BY created_at DESC
LIMIT 10;

-- Failures from the last 7 days
SELECT topic, error_message, created_at
FROM regulatory_research_runs
WHERE status = 'failed' AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```

Or via the admin API:
```bash
GET /api/v1/admin/research/runs?status=FAILED&limit=20
GET /api/v1/admin/research/runs/<uuid>
```

Health endpoint (super-admin only):
```bash
GET /api/v1/health/research
```
Returns `{ provider, modelDefault, apiKeyResolved, providerPingOk, lastRunOk, lastRunFailed, runsLast24h }`.

## How to disable the weekly workflow

Edit `.github/workflows/gemini-regulatory-research.yml` and remove the `schedule:` block, or in the GitHub UI: **Actions → Gemini Regulatory Research → ⋯ → Disable workflow**.

The integration is **inert** when `GOOGLE_AI_API_KEY` is unset — the adapter resolves the key lazily, so the API container boots fine without it. The `/admin/research/run` endpoint will return `503 Service Unavailable` with `type: https://aurex.in/errors/research-key-missing`.

## Operational notes

- The API key is **never** logged. The adapter passes it as a query-string `?key=...`, which is the documented Gemini surface; pino redaction (`req.headers.authorization`, `req.headers.cookie`) plus the fact we never log the URL means the key stays out of logs.
- The provider abstraction (`ResearchProvider`) is intentionally provider-agnostic. To swap to Anthropic web-search or Perplexity later, drop in a sibling adapter under `services/research/` and update `getProvider()` in `research.service.ts` — the route + audit table stay identical.
- For the GitHub Action, an `AUREX_ADMIN_TOKEN` (long-lived super-admin JWT) needs to be provisioned out-of-band and stored as a GitHub Actions secret. Rotation cadence: every 90 days.
- The classifier in the workflow (`Classify against docs/`) is **deliberately conservative** — token-overlap heuristic, P1 only. P0 gaps must be hand-curated; this scan is not authoritative.
