# 11 — Aurigraph DLT Tenant + UC_CARBON Capability Onboarding

**Purpose:** Operational runbook for Aurex's connection to the Aurigraph DLT V12 production platform. Covers first-time tenant registration, UC_CARBON capability provisioning, monthly quota visibility, API-key rotation cadence, and daily ops commands.
**Audience:** Aurex DevOps (deploys + secrets), Aurex Engineering on-call (failure triage), Aurigraph platform-team liaison (off-platform tenant agreement).
**Owner:** AAT-371 / AV4-371 — operational glue around the AAT-β / Wave 1 SDK integration.
**Companion docs:** [`./10-email-transport-runbook.md`](./10-email-transport-runbook.md); the SDK adapter lives at `apps/api/src/services/chains/aurigraph-dlt-adapter.ts`; the singleton client wiring at `apps/api/src/lib/aurigraph-client.ts`; the diagnostic endpoint at `apps/api/src/routes/health.ts` (`GET /api/v1/health/aurigraph`); the onboarding smoke-test at `apps/api/scripts/aurigraph/tenant-onboarding.ts`.

---

## 1. Tenant registration prerequisites

This section is run **once per Aurigraph DLT account**. Re-run only when the tenant identifier or the API key set changes.

### 1.1 Off-platform — tenant agreement

Tenant registration is a **legal / business** step that happens off-platform between Aurex and the Aurigraph platform team. There is no self-service signup.

Required artefacts (delivered out-of-band):

| Artefact | Owner | Notes |
|---|---|---|
| Signed tenant agreement | Aurex Legal × Aurigraph Platform | One-time. Defines KYC level, allowed token types, monthly mint quota. |
| `tenantId` | Aurigraph Platform | Opaque string, scoped to one Aurex environment (dev / staging / prod each get their own). |
| `apiKey` | Aurigraph Platform | Long-lived bearer (rotate every 90 days — see §3.2). |
| `appId` (optional) | Aurigraph Platform | If set, the SDK switches to `Authorization: ApiKey <appId>:<apiKey>` (production-grade auth). Without it the SDK falls back to the legacy `X-API-Key` header. |
| `channelId` | Aurigraph Platform | Defaults to `marketplace-channel`. Per-environment override possible. |

The Aurigraph platform team provisions all of these together. Request them via the same shared channel used for the bi-monthly Aurex × Aurigraph sync.

### 1.2 Aurigraph DLT V12 endpoint

| Environment | Base URL |
|---|---|
| Production | `https://dlt.aurigraph.io` |
| Staging / sandbox | `https://dlt.aurigraph.io` (separate `tenantId` + sandbox-grade key — see §6) |

The same hostname serves both — the **tenantId** is what scopes traffic. There is no `staging.dlt.aurigraph.io` host.

### 1.3 Deploy environment variables

Add these to the deploy environment (production + staging). Defaults from the singleton (`apps/api/src/lib/aurigraph-client.ts`) are listed for reference.

| Variable | Required? | Default | Notes |
|---|---|---|---|
| `AURIGRAPH_API_KEY` | yes | — | Long-lived bearer from the Aurigraph platform team. Required outside `NODE_ENV=test`. |
| `AURIGRAPH_TENANT_ID` | recommended | — | Operational only — surfaces in `/health/aurigraph` and the onboarding script. The SDK 1.2.0 transport does not yet pin this header beyond the API key, but ops dashboards rely on it. |
| `AURIGRAPH_BASE_URL` | no | `https://dlt.aurigraph.io` | Override for sandbox / regional endpoints. |
| `AURIGRAPH_CHANNEL_ID` | no | `marketplace-channel` | Default contract-deploy channel. |
| `AURIGRAPH_APP_ID` | recommended | — | If set, SDK uses production-grade `Authorization: ApiKey <appId>:<apiKey>`. Without it, legacy `X-API-Key` header (deprecation warning logged once per process). |
| `AURIGRAPH_UC_CARBON_CHAIN_ID` | no | — | Surfaces in `/health/aurigraph` for ops cross-reference; not consumed by the adapter. |
| `AURIGRAPH_DEBUG` | no | unset | Set to `1` for verbose SDK request / response logging. |
| `AURIGRAPH_MOCK_MODE` | no | unset | Set to `1` only in CI / smoke environments to make `/health/aurigraph` return a deterministic stub. |

Local secrets live in `credentials.md` (gitignored — see the "Aurigraph DLT" section).

---

## 2. UC_CARBON capability provisioning

`UC_CARBON` is the Aurigraph DLT use-case identifier for biocarbon Ricardian contracts (V11 platform vocabulary). It must be in the tenant's approved-scope list before the adapter can deploy retirement contracts.

### 2.1 What UC_CARBON grants

When UC_CARBON is enabled on the tenant, the SDK can:

- `contracts.deploy({ templateId: 'UC_CARBON', useCaseId: 'UC_CARBON', terms: { … } })` — mint biocarbon Ricardian contracts (`apps/api/src/services/chains/aurigraph-dlt-adapter.ts#deployContract`).
- `contracts.deploy({ templateId: 'RETIREMENT', useCaseId: 'RETIREMENT', terms: { … } })` — burn / retire previously-minted UC_CARBON tokens (used by `burnAsset`).
- `assets.listByUseCase('UC_CARBON')` + `assets.getPublicLedger('UC_CARBON')` — read carbon-asset listings + the public-ledger view (used by the AAT-ζ Aurigraph events worker, AV4-375).
- `compliance.assess(subject, kind, payload)` — submit IFRS S2 / BCR retirement passthrough attestations bound to UC_CARBON activities (Wave 5 / AAT-ρ).
- `dmrv.recordEvent({ … })` — anchor DMRV verification reports to UC_CARBON contracts (Wave 5 / AAT-ρ).

Without UC_CARBON in `approvedScopes`, the V11 server returns `403 Forbidden` on every one of the calls above and the adapter surfaces a `ChainClientError(403)` to the caller.

### 2.2 Confirming UC_CARBON is enabled

Two ways:

1. **Onboarding script** (preferred):

   ```bash
   pnpm --filter @aurex/api tsx scripts/aurigraph/tenant-onboarding.ts
   ```

   The script calls `client.sdk.capabilities()` and inspects the returned `approvedScopes` + `endpoints` for any `UC_CARBON`-prefixed entry. Output ends with `UC_CARBON : ENABLED` or `UC_CARBON : NOT enabled`.

2. **Health endpoint** (continuous):

   ```bash
   curl -H "Authorization: Bearer <super-admin-jwt>" \
     https://aurex.in/api/v1/health/aurigraph
   ```

   The `ucCarbonCapability` field is `true` / `false` / `"unknown"`. Operators dashboard this alongside `/health/email`.

### 2.3 Capability detection mechanism (SDK gap note)

The SDK 1.2.0 vendored at `packages/aurigraph-dlt-sdk/` does **not** expose an explicit per-use-case `getCapabilities()` method on the `tier` namespace. Instead, the handshake surface (`client.sdk.capabilities()`) returns a `CapabilitiesResponse` with `approvedScopes: string[]` + `endpoints: { path, requiredScope, description }[]`. UC_CARBON is detected by string-matching that response.

If the SDK ships a typed `tier.getCapabilities()` in a later release, swap the detection in `health.ts` (`probeUcCarbonCapability`) and `tenant-onboarding.ts` (`detectUcCarbon`) for the typed call. Until then, the string-match approach is the official mechanism.

If the handshake call itself fails (no creds, network error, or the V11 server doesn't yet support `/sdk/handshake/capabilities` on this tenant), the health endpoint surfaces `ucCarbonCapability: "unknown"` so ops can distinguish "definitively not enabled" from "we don't know".

---

## 3. Monthly quota + key rotation

### 3.1 Monthly quota

The SDK exposes per-tenant quota via `tier.getQuota()`, which the adapter surfaces as `aurigraphAdapter.getQuota()`. The shape is `MintQuota` from `@aurigraph/dlt-sdk`:

```ts
{
  mintMonthlyLimit:     number   // -1 means unlimited
  mintMonthlyUsed:      number
  mintMonthlyRemaining: number
  dmrvDailyLimit:       number
  dmrvDailyUsed:        number
  dmrvDailyRemaining:   number
}
```

The pre-flight on every mint / transfer / burn (`aurigraph-dlt-adapter.ts#preflightQuota`) reads this same endpoint and throws `QuotaExhaustedError` when `mintMonthlyRemaining < 1` (skipped when the limit is `-1`).

Default tier quota numbers are negotiated in the tenant agreement (§1.1) and vary per tenant — they are **not** hard-coded in this repo. Typical magnitudes for biocarbon production traffic:

- `mintMonthly`: 10 000 – 100 000 (placeholder — confirm with the Aurigraph platform team before go-live).
- `dmrvDaily`: 1 000 – 10 000 (placeholder).
- `rateRpm`: 60 – 600 requests/minute (V11 default tier).

These are placeholders only. Read the live numbers from `/health/aurigraph` once the tenant is provisioned.

### 3.2 API-key rotation

**Cadence:** rotate `AURIGRAPH_API_KEY` every **90 days** — industry-standard for production bearer tokens. The onboarding script (`step4RotationReminder`) prints the next rotation date 90 days out so the operator can drop it on the team calendar.

**Zero-downtime rotation pattern:**

1. Request a new key from the Aurigraph platform team — the previous key remains valid until explicitly retired.
2. Set the new key as `AURIGRAPH_API_KEY_NEXT` in the deploy env (do not yet swap `AURIGRAPH_API_KEY`).
3. Drain in-flight calls — wait for all `aurigraph_call_logs` rows in `PENDING` status to clear, or 5 minutes (whichever is longer).
4. Swap: set `AURIGRAPH_API_KEY=<new-value>`, redeploy the API.
5. Verify: hit `/health/aurigraph` — `apiKeyResolved` stays `true`, `lastCallOk` stamps within the last minute, `tierQuota` is non-null.
6. Ask the Aurigraph platform team to retire the old key.

The SDK singleton (`getAurigraphClient`) is process-memoised; a redeploy is the cleanest swap. There is no in-process key reload.

### 3.3 What expiry looks like

When a key expires (or is revoked) on the Aurigraph side:

- The next SDK call returns `401` → SDK throws `AurigraphClientError`.
- The adapter maps it to `ChainClientError(401)` and writes a `FAILED` row to `aurigraph_call_logs` with `errorCode: 'UNAUTHORIZED'` (or whatever `errorCode` the V11 problem detail surfaces).
- Ops catch it via `/health/aurigraph` — `lastCallError` carries the message, `callsLast24h.failed` increments.

---

## 4. Daily ops commands

### 4.1 Health check (continuous)

```bash
curl -H "Authorization: Bearer <super-admin-jwt>" \
  https://aurex.in/api/v1/health/aurigraph | jq .
```

Expected fields (full schema — Slice A of AAT-371):

```json
{
  "baseUrl": "https://dlt.aurigraph.io",
  "tenantId": "<tenant-id>",
  "apiKeyResolved": true,
  "channelId": "marketplace-channel",
  "tierQuota": {
    "monthlyCalls": 10000,
    "used": 12,
    "remaining": 9988,
    "resetAt": null
  },
  "ucCarbonCapability": true,
  "ucCarbonChainId": null,
  "lastCallOk": "2026-04-25T10:00:00.000Z",
  "lastCallError": null,
  "callsLast24h": { "success": 17, "failed": 0, "retried": 1, "pending": 0 }
}
```

### 4.2 One-shot connectivity test

```bash
pnpm --filter @aurex/api tsx scripts/aurigraph/tenant-onboarding.ts
```

Walks the four onboarding steps (config / connectivity / capabilities / rotation reminder) and exits non-zero if any fails.

### 4.3 Last-24h failures (SQL)

When ops want the underlying call log directly:

```sql
SELECT method, error_code, error_msg, created_at
FROM aurigraph_call_logs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

The same data backs the `callsLast24h.failed` count in `/health/aurigraph`.

---

## 5. Failure runbook

Every failure mode the V11 platform surfaces — mapped to the operator action.

| HTTP | SDK error | Adapter wrapper | Likely cause | Action |
|---|---|---|---|---|
| `401` | `AurigraphClientError(401)` | `ChainClientError(401)` | API key expired, revoked, or wrong tenant. | Rotate the key (§3.2). Verify `AURIGRAPH_API_KEY` matches what the platform team has on file for `AURIGRAPH_TENANT_ID`. |
| `403` | `AurigraphClientError(403)` | `ChainClientError(403)` | UC_CARBON capability not enabled, or the call uses a scope not in `approvedScopes`. | Run the onboarding script — if `UC_CARBON : NOT enabled`, contact the Aurigraph platform team to add the capability. |
| `429` | `AurigraphClientError(429)` | `ChainClientError(429)` | Quota exhausted (monthly mint or daily DMRV) or rate-limit burst. | Wait for the next reset window, or request a quota increase via the platform team. `tierQuota.remaining` in `/health/aurigraph` confirms. |
| `5xx` | `AurigraphServerError` | `ChainServerError` | Aurigraph platform issue. | The adapter retries up to 3 times for idempotent reads (200ms / 400ms / 800ms back-off). If the failure persists, escalate to the platform team. Check the platform status page — published in the tenant agreement. |
| `pre-flight` | `QuotaExhaustedError` | (passthrough) | Monthly mint quota = 0 before the SDK call lands. | Same as `429`. |
| network | `AurigraphNetworkError` | (passthrough) | DNS / TLS / timeout. | Check `dlt.aurigraph.io` DNS resolution from the API host. The SDK's transport already retries network errors; persistent failures usually mean an outbound NAT or firewall issue. |

The SDK and adapter both write FAILED rows to `aurigraph_call_logs` for every one of the above (best-effort — a flaky DB never blocks a contract deploy). The `/health/aurigraph` endpoint surfaces the latest failure message in `lastCallError`.

---

## 6. Sandbox vs production

The Aurigraph V12 platform serves both sandbox and production traffic from the same hostname (`https://dlt.aurigraph.io`). The **tenantId** + **apiKey** pair is what scopes the traffic.

| Aspect | Sandbox | Production |
|---|---|---|
| `AURIGRAPH_BASE_URL` | `https://dlt.aurigraph.io` | `https://dlt.aurigraph.io` |
| `AURIGRAPH_TENANT_ID` | `aurex-sandbox-<env>` (issued for QA / staging) | `aurex-prod-<env>` (issued for go-live) |
| `AURIGRAPH_API_KEY` | Sandbox-grade key — capped quota, no real on-ledger settlement. | Prod-grade key — full quota, real settlement. |
| Use cases enabled | UC_CARBON typically pre-enabled for sandbox so QA can run end-to-end. | UC_CARBON enabled per tenant agreement. |
| Rotation cadence | Looser — sandbox keys often live 6–12 months. | 90 days (§3.2). |

The Wave 5 sandbox tests (`apps/api/src/sandbox-aurigraph.test.ts`) run against the sandbox tenant — see that test file for the exact env-var set used in CI.

---

## 7. Hand-back to ops

When this runbook ships, ops should:

1. Add the four core env vars (`AURIGRAPH_API_KEY`, `AURIGRAPH_TENANT_ID`, `AURIGRAPH_BASE_URL`, `AURIGRAPH_CHANNEL_ID`) to the deploy secrets store (production + staging).
2. Add a synthetic check that polls `/api/v1/health/aurigraph` every 5 minutes — alert when `apiKeyResolved=false`, `ucCarbonCapability!=true`, or `callsLast24h.failed > 5`.
3. Drop a calendar reminder for the first key rotation (90 days from go-live).
4. Subscribe to the Aurigraph platform-team status feed — link distributed in the tenant agreement.
