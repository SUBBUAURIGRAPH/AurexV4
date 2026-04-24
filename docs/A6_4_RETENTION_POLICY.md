# Article 6.4 — Raw-data Retention Policy

**Ticket:** AV4-338 (production-ready — AAT-7)
**Regulatory basis:** A6.4-PROC-AC-002 + Decision 3/CMA.3 (Paris Agreement Crediting Mechanism)
**Status:** Production-ready. Schema + archival service + admin report + Backblaze B2 adapter + nightly worker + restore CLI + `x-retention-policy` header shipped.
**Sign-off required before production rollout:** Legal Counsel + Compliance Lead + Security + DPO (see §9).

---

## 1. Policy text

Aurex retains **all raw monitoring-data (`MonitoringDatapoint` rows)** for every A6.4 activity for a minimum period of:

> **Two (2) calendar years after the end of the activity's crediting period**, as given by `Activity.creditingPeriodEnd` at the time of the most recent DOE verification.

Data is **archived** (moved to cold blob storage) rather than **deleted**. A6.4 never permits data purge. Archived data remains retrievable for audit, dispute, host-country BTR reconciliation, or Supervisory Body review.

In practice the total lifespan of an activity's raw data therefore runs:
- `FIXED_10YR` crediting period → ≥ 12 years.
- `RENEWABLE_5YR` × 3 renewals → ≥ 17 years.
- `REMOVAL_15YR` × 3 renewals → ≥ 47 years.

### 1.1 What is retained

| Entity | Retention | Rationale |
|---|---|---|
| `MonitoringDatapoint` | Archived to blob store after horizon; never deleted | A6.4-PROC-AC-002 raw-data retention |
| `MonitoringPeriod` metadata | Never archived — lives in Postgres | Needed for retention report indexing |
| `VerificationReport` | Never archived — lives in Postgres | Issuance traceability |
| `Issuance` / `CreditUnitBlock` | Never archived — registry ledger | Registry integrity + CA traceability |
| `AuditLog` | 10 years minimum in Postgres; never purged | Operator + SB accountability |

### 1.2 Retention states

Every MonitoringPeriod is in exactly one of four states, derivable from `Activity.creditingPeriodEnd` and the presence/absence of a `DatapointArchive` row:

| State | Condition |
|---|---|
| `ACTIVE` | `creditingPeriodEnd > now` OR `creditingPeriodEnd + 2yr > now` |
| `ELIGIBLE` | `creditingPeriodEnd + 2yr ≤ now` AND no `DatapointArchive` exists |
| `ARCHIVED` | `DatapointArchive.restoreCount == 0` |
| `RESTORED` | `DatapointArchive.restoreCount > 0` |

---

## 2. Schema

Two models in `packages/database/prisma/schema.prisma`:

- **`RetentionPolicy`** — parameterises the retention rule. Fields: `minRetentionYears` (default 2), `ruleJson` (free-form overrides), `isDefault`, `isActive`. One default row is seeded by `packages/database/src/seed-master-data.ts::seedRetentionPolicies()`.
- **`DatapointArchive`** — one row per archived `MonitoringPeriod`. Fields: `periodId` (FK + unique), `archiveUrl`, `archiveFormat` (default `jsonl.gz`), `rowCount`, `checksumSha256` (64-hex), `restoreCount`, `bytes`.

---

## 3. Archive format

**Current:** JSON-lines gzipped (`.jsonl.gz`). Each line is a single `MonitoringDatapoint` as JSON with all scalar columns preserved. Decimal columns (rawValue, adjustedValue, uncertaintyPct) are serialised as **strings** to preserve precision byte-for-byte on round-trip.

**Why not Parquet:** Parquet requires adding a column-schema library (`apache-arrow` or `parquetjs-lite`) and a matching restore path. JSONL gzip is trivially recoverable with `gunzip | jq` on any machine with no codebase knowledge — that's a better failure mode for a compliance archive. Parquet can be added as a secondary format in a follow-up without breaking this one.

**Integrity:** SHA-256 over the compressed payload. Verified before re-hydration on restore. Checksum mismatch throws and refuses to restore (`archival.service.test.ts::restorePeriod blocks re-hydration when SHA-256 does not match`).

---

## 4. Blob store

### 4.1 Providers

Configured via `BLOB_STORE` env:

| Value | Implementation | Use |
|---|---|---|
| unset / `local` | `LocalDirBlobStore` at `BLOB_STORE_PATH` (default `/tmp/aurex-blob-store`) | dev, CI, integration tests |
| `backblaze-b2` (or `backblaze`) | `BackblazeB2BlobStore` via AWS SDK v3 against B2's S3-compatible API | staging + production |

### 4.2 Backblaze B2 provisioning runbook

B2 is S3-compatible — the adapter uses `@aws-sdk/client-s3`. Per-env bucket (`aurex-staging-archive`, `aurex-prod-archive`).

**Steps:**

1. **Create the bucket** in the Backblaze B2 console:
   - Name: `aurex-<env>-archive` (globally unique).
   - Region: pick nearest to operator ops (e.g. `us-west-000`, `eu-central-003`). Document the choice — DPO reviews for host-country residency.
   - **Files**: `Private` (never public).
   - **Encryption**: enable **SSE-B2** (server-side AES-256). B2 supports this by default.
   - **Object Lock**: enable **governance mode** with a minimum retention equal to the longest-possible A6.4 horizon (e.g. `17 years` for renewable × 3, `47 years` for removal × 3 — pick the longer horizon your org hosts). This gives a belt-and-braces delete-protection on top of code-level policy.

2. **Lifecycle rules** (B2 console → Bucket → Lifecycle Settings):
   - Keep all file versions indefinitely (A6.4 never permits purge).
   - Do **not** enable any "hide old versions after N days" rule — that would mask rather than delete, but it would break `get(key)` for restore. Leave empty.

3. **Create an application key** (B2 console → App Keys):
   - Name: `aurex-<env>-archival`.
   - **Scope: this bucket only** — never the master "all buckets" key.
   - Capabilities: `listFiles`, `readFiles`, `writeFiles`. **Never** grant `deleteFiles`, `bypassGovernance`, or bucket-config capabilities.
   - Duration: no expiry (we rotate manually via the rotation runbook — see §8).
   - Save the `keyID` + `applicationKey` — **this is the only time `applicationKey` is shown**.

4. **Add env vars to the deploy secret store** (never commit to git):

   | Env var | Example | Source |
   |---|---|---|
   | `BACKBLAZE_B2_ENDPOINT` | `https://s3.us-west-000.backblazeb2.com` | B2 bucket page → "S3-compatible API" |
   | `BACKBLAZE_B2_REGION` | `us-west-000` | derived from endpoint |
   | `BACKBLAZE_B2_BUCKET` | `aurex-prod-archive` | bucket name from step 1 |
   | `BACKBLAZE_B2_KEY_ID` | `000abcdef...` | from step 3 |
   | `BACKBLAZE_B2_APP_KEY` | `K000...` | from step 3 |

5. **Flip the gates** on the API deploy:

   | Env var | Value | Effect |
   |---|---|---|
   | `BLOB_STORE` | `backblaze-b2` | archival service uses B2 instead of local dir |
   | `RETENTION_WORKER_ENABLED` | `1` | nightly 02:00 UTC archival cron runs |
   | `REDIS_URL` | (existing) | BullMQ queue — already in the stack |

6. **Smoke-test** on staging:
   - `GET /api/v1/admin/retention/report` as SUPER_ADMIN — confirm counts by state.
   - Trigger `archival.service.archivePeriod(<eligible-id>)` on one period — confirm B2 object appears in the bucket, `DatapointArchive` row writes, `AuditLog` row writes.
   - Run `pnpm --filter @aurex/api run restore-archive <periodId>` — confirm exit 0 + `rowsRestored` match + `checksumVerified: true`.
   - Check Prometheus / logs for `Retention archival worker started`.

### 4.3 Env var reference (complete)

| Env var | Required | Default | Consumed by |
|---|---|---|---|
| `BLOB_STORE` | no | `local` | `defaultBlobStore()` in `archival.service.ts` |
| `BLOB_STORE_PATH` | no (only for `local`) | `/tmp/aurex-blob-store` | `LocalDirBlobStore` |
| `BACKBLAZE_B2_ENDPOINT` | yes (when `BLOB_STORE=backblaze-b2`) | — | `BackblazeB2BlobStore` |
| `BACKBLAZE_B2_REGION` | yes (when `BLOB_STORE=backblaze-b2`) | — | `BackblazeB2BlobStore` |
| `BACKBLAZE_B2_BUCKET` | yes (when `BLOB_STORE=backblaze-b2`) | — | `BackblazeB2BlobStore` |
| `BACKBLAZE_B2_KEY_ID` | yes (when `BLOB_STORE=backblaze-b2`) | — | `BackblazeB2BlobStore` |
| `BACKBLAZE_B2_APP_KEY` | yes (when `BLOB_STORE=backblaze-b2`) | — | `BackblazeB2BlobStore` |
| `RETENTION_WORKER_ENABLED` | no | unset (off) | `startRetentionWorker()` bootstrap in `index.ts` |
| `REDIS_URL` | yes (when worker enabled) | — | BullMQ Queue + Worker |

Missing B2 env vars surface as a constructor-time error with the missing names listed — see `blob-stores/backblaze-b2.test.ts`.

---

## 5. Nightly archival worker

`apps/api/src/workers/retention-archival.worker.ts` — BullMQ repeatable job.

- **Schedule:** `0 2 * * *` (02:00 UTC nightly), timezone `UTC`.
- **Queue name:** `retention-archival`.
- **Job name:** `nightly-archive`.
- **Handler:** `runNightlyArchival` — calls `identifyEligible()` then `archivePeriod()` per period. Per-period failures are logged + audit-logged (`retention.archival.nightly_run.failure`) but do **not** stop the loop.
- **Gating:** disabled unless `RETENTION_WORKER_ENABLED=1` AND `NODE_ENV !== 'test'`. Safe default — operator explicitly opts in after B2 provisioning.
- **Audit trail:** each run writes one `retention.archival.nightly_run` AuditLog row with `{attempted, ok, failed, failures}`.

---

## 6. `x-retention-policy` response header

`apps/api/src/middleware/retention-header.ts` is wired on `/api/v1/monitoring/*` and `/api/v1/verification/*`. Every response carries:

```
x-retention-policy: aurex-a6.4-min-2yr-post-crediting-period
```

This makes every monitoring/verification response self-describing w.r.t. the applicable retention rule — DOEs, SB reviewers, and host-country auditors can verify the rule without referring to out-of-band docs. Value is a stable identifier; policy details live in this document.

---

## 7. Operator runbook

### 7.1 Inspect retention state (compliance audit)

As **SUPER_ADMIN** only:

```bash
curl -H "Authorization: Bearer $TOKEN" https://aurex.in/api/v1/admin/retention/report | jq
```

Returns an array of `{ periodId, activityId, activityTitle, state, retainUntil, archive }` plus a summary count by state.

### 7.2 Archive a monitoring period (manual / one-shot)

The nightly worker does this automatically. For a one-off manual trigger (e.g. a backfill), call from a REPL:

```typescript
import { archivePeriod } from 'apps/api/src/services/archival.service.js';
await archivePeriod('<period-id>', { userId: '<operator-user-id>' });
```

### 7.3 Restore a monitoring period (CLI)

```bash
pnpm --filter @aurex/api run restore-archive <periodId>
```

Steps executed:
1. Reads archive from B2 using the key stored in the URL fragment.
2. Verifies SHA-256 over the compressed payload.
3. Re-hydrates datapoints into Postgres via `createMany`.
4. Increments `DatapointArchive.restoreCount`.
5. Writes `retention.restore` row to `AuditLog`.

**Exit codes:**
- `0` — restore OK; stdout contains JSON `{ ok: true, rowsRestored, checksumVerified: true, ... }`.
- `1` — not-found OR checksum mismatch OR any other error; stderr contains JSON with `ok: false, error, checksumVerified: bool`.

On checksum mismatch the Postgres write is rejected before any rows are inserted.

### 7.4 Monitoring + alerting

Every archive/restore writes an `AuditLog` row (`retention.archive` / `retention.restore` / `retention.archival.nightly_run`) with archive id, checksum, row count.

Alert on:
- Any `retention.archival.nightly_run` with `failed > 0`.
- Any `retention.restore` with checksum mismatch (the log row carries `archiveId`; investigate the blob source).
- Any `ELIGIBLE` period still unarchived > 7 days past horizon (query the `/admin/retention/report` endpoint).
- BullMQ worker process down (via Redis + process health).

---

## 8. Credential rotation

B2 application keys must be rotated on a **12-month cadence** (or immediately on any suspected compromise). Rotation steps:

1. Create a new app key in B2 console (step 3 of §4.2) with the **same** capabilities + bucket scope.
2. Update `BACKBLAZE_B2_KEY_ID` + `BACKBLAZE_B2_APP_KEY` in the deploy secret store.
3. Redeploy the API. Worker restart reloads env.
4. Confirm one nightly run succeeds under the new key.
5. Revoke the old key in the B2 console.

---

## 9. Sign-off checklist (production rollout)

**Blocking** — every item must be explicitly signed off (ticket, email, or Signal) before flipping `BLOB_STORE=backblaze-b2` + `RETENTION_WORKER_ENABLED=1` on prod.

- [ ] **Legal Counsel** — reviews retention period (2 yr post-end-of-crediting-period) against applicable jurisdictions for activities in hosted orgs. Confirms no conflict with tax-record or dispute-resolution retention rules in any hosted host country.
- [ ] **Compliance Lead** — reviews cold-storage location (Backblaze region) against host-country data-residency rules (EU GDPR, India DPDPA, California CPRA, Singapore PDPA, etc.). Documents the chosen B2 region in the DPIA.
- [ ] **Security** — reviews Backblaze B2 key scoping (least-privilege: `listFiles`, `readFiles`, `writeFiles`; never `deleteFiles` or `bypassGovernance`), Object-Lock governance-mode retention window, SSE-B2 at-rest encryption, rotation cadence (§8), and audit-log integration (`retention.*` actions).
- [ ] **Operator Ops** — reviews restore runbook (§7.3), alerting thresholds (§7.4), archival cron schedule (§5), and BullMQ + Redis health wiring.
- [ ] **DPO** (if EU-resident activities exist) — reviews data-residency per activity host country; confirms SCCs/IDTAs in place for any transfer out of EEA.
- [ ] **Board / Compliance Committee** — final approval noted in board minutes.

---

## 10. Regulatory references

- **A6.4-PROC-AC-002** — PACM Procedure for Accreditation. Raw-data retention clause.
- **Decision 3/CMA.3** — CMA Decision adopting A6.4 Rules, Modalities and Procedures.
- **FCCC/PA/CMA/2021/10/Add.1** — authoritative text of Decision 3/CMA.3.
- **A6.4-STAN-METH-004** §6 — Monitoring requirements; implicit data-retention obligations.

---

## 11. Out of scope for this pass (tracked separately)

- [ ] Parquet secondary archive format (open as follow-up).
- [ ] Cross-region replication (B2 does not natively replicate — operator-ops would run a second bucket + sync; tracked separately).
- [ ] Lifecycle-rule automation via IaC (Terraform / Pulumi) — today documented manually in §4.2.
- [ ] Per-host-country blob-store region routing (single region per env today; switch to multi-region requires policy + DPIA review).
