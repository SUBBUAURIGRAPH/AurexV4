# Regulatory gap analysis — follow-up re-run (runbook)

**Source run:** 2026-04-26 — `docs/REGULATORY_GAP_ANALYSIS_2026-04-26.md`  
**Known limitations from that run**

- `gemini-2.5-pro` was rate-limited; the run used **`gemini-2.5-flash`** (lighter than ideal for “deep” regulatory synthesis).
- The model response hit **`MAX_TOKENS` at 16,000** — so **AML/CFT** and full **EU CBAM/CSRD** treatment may be thin or missing.
- Some section headings in the report read as **truncated mid-sentence** (BRSR, BCR, CORSIA in the printout) — re-run in **narrower scopes** or with a **higher output budget** (see below).

## When to use this

- You need a **second pass** focused on: **(1) EU**: CBAM, CSRD/ESRS, **(2) Financial crime**: FATF/AML, sanctions screening, **(3) India**: extend BRSR/DPDP with more output room.

## How to re-run (API adapter)

The stack uses `apps/api/src/services/research/gemini-deep-research.ts` (depth `quick` / `standard` / `deep`).

1. **Credentials** (never commit): `GEMINI_API_KEY` and/or `GOOGLE_AI_API_KEY` in `credentials.md` or `apps/api/.env`.
2. **Prefer a higher-capability model** when quota allows:
   - `GEMINI_DEEP_RESEARCH_MODEL=gemini-2.5-pro` or the deep-research model name your tier exposes (see file header).
3. **Split the prompt** into **separate calls** (one theme per run) to avoid one giant 16k cap:
   - *Example A:* “Aurex V4 + EU CBAM and CSRD reporting obligations for an Indian exporter — gaps vs current BRSR/PDF/BCR surfaces.”
   - *Example B:* “Aurex V4 + AML/CFT for beneficiary KYC, retirement, and cross-border DLT — regulatory gaps and controls.”
4. If the service supports increasing **`maxOutputTokens`** for your integration path, raise it in code **only** for this batch job (watch cost).

## Optional: Interactions / Deep Research agent

Long-form autonomous research (different product path) is under **`/api/v1/admin/deep-research`** (Interactions API) — `apps/api/src/services/gemini-interactions.service.ts`. That path is **SUPER_ADMIN**-gated. Use for operator-led reports, not tenant traffic by default.

## Jira

File the eight tracking stories with:

```bash
cd /path/to/AurexV4
python3 scripts/jira/seed_regulatory_gaps_2026.py --dry-run
# then without --dry-run when JIRA_* env is set
```

Or import the epic in pieces via your PM tool from `scripts/jira/regulatory_gap_2026_seed.json`.

## Doc hygiene

After a successful follow-up, either **append** a dated subsection to the original file or add **`docs/REGULATORY_GAP_ANALYSIS_2026-04-26-part2.md`** and link it from the original summary.
