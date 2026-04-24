# Article 6.4 — Raw-data Retention Policy

**Ticket:** AV4-338 (partial — scaffold only; Backblaze provisioning deferred)
**Regulatory basis:** A6.4-PROC-AC-002 + Decision 3/CMA.3 (Paris Agreement Crediting Mechanism)
**Status:** Scaffold shipped — schema + archival service + admin report endpoint. Scheduled cron + Backblaze B2 provisioning pending.
**Sign-off required before production rollout:** Legal Counsel + Compliance Lead (see §6).

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

Two models were added in `packages/database/prisma/schema.prisma`:

- **`RetentionPolicy`** — parameterises the retention rule. Fields: `minRetentionYears` (default 2), `ruleJson` (free-form overrides), `isDefault`, `isActive`. This pass seeds no rows; the default 2-year rule is enforced by code constants until policy rows are authored.
- **`DatapointArchive`** — one row per archived `MonitoringPeriod`. Fields: `periodId` (FK + unique), `archiveUrl`, `archiveFormat` (default `jsonl.gz`), `rowCount`, `checksumSha256` (64-hex), `restoreCount`, `bytes`.

---

## 3. Archive format

**This pass:** JSON-lines gzipped (`.jsonl.gz`). Each line is a single `MonitoringDatapoint` as JSON with all scalar columns preserved. Decimal columns (rawValue, adjustedValue, uncertaintyPct) are serialised as **strings** to preserve precision byte-for-byte on round-trip.

**Why not Parquet now:** Parquet requires adding a column-schema library (`apache-arrow` or `parquetjs-lite`) and a matching restore path. JSONL gzip is trivially recoverable with `gunzip | jq` on any machine with no codebase knowledge — that's a better failure mode for a compliance archive. Parquet can be added as a secondary format in a follow-up without breaking this one.

**Integrity:** SHA-256 over the compressed payload. Verified before re-hydration on restore. Checksum mismatch throws and refuses to restore (`archival.service.test.ts::restorePeriod blocks re-hydration when SHA-256 does not match`).

---

## 4. Blob store

**This pass:** `LocalDirBlobStore` writing to `/tmp/aurex-blob-store/` (configurable via `BLOB_STORE_PATH` env). Suitable for dev + integration tests; **not suitable for production**.

**Production plan:** Backblaze B2, bucket-per-env (`aurex-prod-archive`, `aurex-staging-archive`). Selected via `BLOB_STORE=backblaze` env — currently throws a clear "not implemented" error. Follow-up ticket must:

1. Provision Backblaze B2 buckets + application keys.
2. Add `@aws-sdk/client-s3` + B2-compatible client to `apps/api`.
3. Implement `BackblazeBlobStore` against the same `BlobStore` interface (`put` / `get` / `exists`).
4. Add lifecycle rules: 90d hot → infrequent access → cold after 2yr.
5. Add `x-retention-policy` response header middleware on `/monitoring/*` + `/verification/*` (pending — out of scope for this pass).

---

## 5. Operator runbook

### 5.1 Inspect retention state (compliance audit)

As **SUPER_ADMIN** only:

```bash
curl -H "Authorization: Bearer $TOKEN" https://aurex.in/api/v1/admin/retention/report | jq
```

Returns an array of `{ periodId, activityId, activityTitle, state, retainUntil, archive }` plus a summary count by state.

### 5.2 Archive a monitoring period (manual)

Not yet exposed as an endpoint — call from a REPL or one-shot script:

```typescript
import { archivePeriod } from 'apps/api/src/services/archival.service.js';
await archivePeriod('<period-id>', { userId: null });
```

Once BullMQ scheduler lands (follow-up), this will run nightly at 02:00 UTC across all `ELIGIBLE` periods.

### 5.3 Restore a monitoring period

```typescript
import { restorePeriod } from 'apps/api/src/services/archival.service.js';
await restorePeriod('<archive-id>', { userId: '<operator-user-id>' });
```

Steps executed:
1. Reads archive from blob store using the key stored in the URL fragment.
2. Verifies SHA-256 over the compressed payload.
3. Re-hydrates datapoints into Postgres via `createMany`.
4. Increments `DatapointArchive.restoreCount`.
5. Writes `retention.restore` row to `AuditLog`.

If the checksum fails, the call throws and Postgres is untouched.

### 5.4 Monitoring

Every archive/restore writes an `AuditLog` row (`retention.archive` / `retention.restore`) with the archive id, checksum, and row count. Alert on:
- Any `retention.archive` failure.
- Any `retention.restore` with checksum mismatch.
- Any `ELIGIBLE` period still unarchived > 7 days past horizon.

---

## 6. Sign-off checklist (production rollout)

**Blocking** — Backblaze provisioning + legal/compliance sign-off required before flipping `BLOB_STORE=backblaze` on prod.

- [ ] **Legal Counsel** — reviews retention period (2 yr post-end-of-crediting-period) against applicable jurisdictions for activities in hosted orgs.
- [ ] **Compliance Lead** — reviews cold-storage location (Backblaze region) against host-country data-residency rules (EU GDPR, India DPDPA, etc.).
- [ ] **Security** — reviews Backblaze B2 key scoping (least-privilege, rotation cadence), encryption-at-rest, and audit-log integration.
- [ ] **Operator Ops** — reviews restore runbook, alerting thresholds, and archival cron schedule.
- [ ] **DPO** (if EU-resident activities exist) — reviews data-residency per activity host country.

---

## 7. Regulatory references

- **A6.4-PROC-AC-002** — PACM Procedure for Accreditation. Raw-data retention clause.
- **Decision 3/CMA.3** — CMA Decision adopting A6.4 Rules, Modalities and Procedures.
- **FCCC/PA/CMA/2021/10/Add.1** — authoritative text of Decision 3/CMA.3.
- **A6.4-STAN-METH-004** §6 — Monitoring requirements; implicit data-retention obligations.

---

## 8. Out of scope for this pass (tracked in AV4-338)

- [ ] Scheduled cron job (nightly archival).
- [ ] Backblaze B2 provisioning + `BackblazeBlobStore` implementation.
- [ ] `x-retention-policy` response header middleware.
- [ ] Restore CLI (`scripts/restore-archive.ts`).
- [ ] Parquet secondary archive format.
- [ ] Per-host-country blob-store region routing.
