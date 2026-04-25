# 07 — BCR Live-V1 Cutover Runbook

**Purpose:** Day-of-go-live runbook for flipping AurexV4 from `BCR_REGISTRY_ADAPTER=disabled` (Sprint 1–3 default) to `BCR_REGISTRY_ADAPTER=live-v1` against the production BCR Third-Party tokeniser endpoint.
**Audience:** Aurex Compliance Lead (cutover commander), Aurex DevOps Lead (executor), Aurex Engineering on-call (smoke-checks).
**Owner:** AAT-ο / AV4-363 — Sprint 4 operational leg.
**Status:** Draft — ready for first dry-run rehearsal in staging once BCR Third-Party authorisation is received (AV4-341) and the legal classification matrix (AV4-343) is signed.
**Companion documents:** [`./02-architecture-disclosure.md`](./02-architecture-disclosure.md), [`./04-bcr-application-email.md`](./04-bcr-application-email.md), [`./08-change-management.md`](./08-change-management.md).

---

## 1. Pre-cutover checklist (T-7 days)

Each row is **blocking**. The cutover commander must initial each item with date + ticket reference before the maintenance window opens.

| # | Gate | Owner | Evidence required | Reference |
|---|---|---|---|---|
| 1 | BCR Third-Party authorisation confirmed in writing | Compliance Lead | BCR letter / signed PDF stored in `s3://aurex-legal-artifacts/<env>/bcr/authorisation/` | AV4-341, `04-bcr-application-email.md` |
| 2 | Legal classification matrix counter-signed | Legal Counsel | Signed matrix PDF in legal-artefact bucket; jurisdictional opinions for US / UK / EU / IN attached | AV4-343, `06-legal-classification-matrix.md` |
| 3 | KYC vendor live + integrated | Engineering | `kycLookup` resolves an APPROVED beneficiary verification end-to-end against the staging KYC vendor (AAT-θ tests green) | AV4-354 |
| 4 | Audit pack ready | Compliance Lead | `GET /admin/biocarbon/audit-bundle` returns a signed bundle including the contract refs + commit SHA + Foundry reports + sync-event sample | `02-architecture-disclosure.md` §"Audit cooperation (B24)" |
| 5 | 72-hour soak in `mock` adapter mode shows zero errors | DevOps Lead | Grafana export attached to AV4-363; zero `BcrRegistrySyncEvent.synced=false` rows; zero `AurigraphProcessedEvent.status=FAILED_PERMANENT`; events worker tick error rate = 0 | AAT-ζ / AV4-375 |
| 6 | Rollback rehearsal performed in staging | DevOps Lead + Engineering | Recorded Slack thread + rollback time-to-recovery < 15 minutes | this runbook §4 |
| 7 | Compliance + DevOps + Engineering on-call confirmed | Compliance Lead | Pager schedule snapshot for the cutover window | — |
| 8 | BCR support contact on standby | Compliance Lead | Confirmed reply from BCR Secretariat with named technical contact + email + phone for the cutover window | — |

If **any** row is unsigned, the cutover does not proceed. The default action on a missed gate is to slip 7 days and re-run pre-checks.

---

## 2. Cutover steps (chronological)

The full window is scoped to **90 minutes**. All times are wall-clock. The cutover commander narrates each step in the `#bcr-cutover` Slack channel.

### Step 0 — Maintenance window announcement (T-0)

Send the customer-facing maintenance email + status-page banner from `compliance@aurex.in`:

> Aurex is performing a scheduled BioCarbon Registry integration cutover from `HH:MM` to `HH:MM+90min` UTC. The marketplace is read-only during the window; new mints, retirements, and delists are paused. No data is lost; in-flight tokenizations complete before pause.

### Step 1 — Drain in-flight tokenizations (T+5 min)

Reject new mint requests at the route layer, but allow already-started flows (locked → confirmed → minting) to complete. Set:

```bash
ssh deploy@aurex.in "echo 'AUREX_TOKENIZATION_DRAIN=1' >> /etc/aurex-api.env"
ssh deploy@aurex.in "systemctl restart aurex-api"
```

`AUREX_TOKENIZATION_DRAIN=1` makes `POST /api/v1/issuances/:id/tokenize` return `503 Service Unavailable` with RFC 7807 `type=https://aurex.in/errors/maintenance-drain`. Existing chain mints in flight observe no behaviour change. Wait for `BcrRegistrySyncEvent` count to stop incrementing in `eventType IN (LOCK_VCC, CONFIRM_LOCK, NOTIFY_MINT)` for ≥ 5 minutes. Engineering on-call confirms in Slack.

### Step 2 — Pause `aurigraph-events.worker` (T+15 min)

The events worker reconciles burns to BCR asynchronously. We pause it so the BCR adapter swap doesn't race with an in-flight reconciliation tick:

```bash
ssh deploy@aurex.in "sed -i 's/^AURIGRAPH_EVENTS_WORKER_ENABLED=.*/AURIGRAPH_EVENTS_WORKER_ENABLED=0/' /etc/aurex-api.env"
ssh deploy@aurex.in "systemctl restart aurex-api"
```

Verify the worker stopped: `journalctl -u aurex-api | grep "Aurigraph events worker"` should show `started` with the *new* boot but no `processTick` invocations after the restart line.

### Step 3 — Flip BCR adapter to `live-v1` (T+25 min)

This is the surgical change. Update `/etc/aurex-api.env` with the live BCR credentials (sourced from the deploy secret store, never committed):

```
BCR_REGISTRY_ADAPTER=live-v1
BCR_API_BASE_URL=https://api.biocarbonregistry.com
BCR_API_KEY=<from secret store>
BCR_API_SIGNING_SECRET=<from secret store>
BCR_API_TIMEOUT_MS=30000
BCR_API_MAX_RETRIES=3
```

Then restart the API:

```bash
ssh deploy@aurex.in "systemctl restart aurex-api"
```

Confirm boot logs show `BCR adapter resolved: name=live-v1, isActive=true`. If the adapter logs `name=disabled` after this change, **abort the cutover** and run the rollback procedure (§4).

### Step 4 — Single test mint against a real low-tonnage BCR-locked VCC (T+35 min)

Pre-staged on the BCR side: a 1-tCO2e test VCC seeded for the Aurex authorised tokeniser account. Issue a tokenize call against it via the API:

```bash
curl -X POST https://aurex.in/api/v1/issuances/<staging-issuance-uuid>/tokenize \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" -H "Content-Type: application/json"
```

Expected:

- HTTP 200, `data.contractId` populated, `data.txHash` populated, `data.bcrSerialId` matches the seeded VCC.
- `BcrRegistrySyncEvent` rows for `LOCK_VCC` + `CONFIRM_LOCK` + `NOTIFY_MINT`, all `synced=true`.
- `Issuance.tokenizationStatus = 'MINTED'`.

If any of these fails, **abort and rollback (§4)**.

### Step 5 — Lift the tokenization drain (T+45 min)

```bash
ssh deploy@aurex.in "sed -i 's/^AUREX_TOKENIZATION_DRAIN=.*/AUREX_TOKENIZATION_DRAIN=0/' /etc/aurex-api.env"
ssh deploy@aurex.in "systemctl restart aurex-api"
```

### Step 6 — Re-enable the events worker (T+50 min)

```bash
ssh deploy@aurex.in "sed -i 's/^AURIGRAPH_EVENTS_WORKER_ENABLED=.*/AURIGRAPH_EVENTS_WORKER_ENABLED=1/' /etc/aurex-api.env"
ssh deploy@aurex.in "systemctl restart aurex-api"
```

The worker resumes from its `AurigraphEventCursor` row — at-least-once semantics guarantee no events are dropped.

### Step 7 — Lift the maintenance hold (T+60 min)

Update the status page; send the all-clear email; remove the customer banner. Cutover is complete; smoke checks (§3) run for the next 60 minutes.

---

## 3. Smoke checks (post-cutover, first 60 minutes)

Engineering on-call drives all five legs against a real (low-tonnage) staged VCC and checks each result. Each row is non-blocking individually but a failure in any row triggers escalation to §4.

| Leg | API call | Expected DB observable |
|---|---|---|
| Lock | `POST /issuances/:id/tokenize` (locks via BCR `lockVCC` + `confirmLock`) | `BcrRegistrySyncEvent` for `LOCK_VCC` + `CONFIRM_LOCK`, both `synced=true` |
| Mint | (same call as Lock) | `Issuance.tokenizationStatus='MINTED'`; `BcrRegistrySyncEvent` for `NOTIFY_MINT` `synced=true`; marketplace listing visible at `GET /api/v1/biocarbon/marketplace` |
| Transfer | (skipped in V1 — no internal transfer endpoint yet; the `notifyTransfer` BCR adapter call is exercised only by AAT-ξ if merged) | n/a in V1 |
| Burn-for-retirement | `POST /api/v1/retirements` (KYC-verified) → events worker tick | `Retirement.status='BCR_SYNCED'`; `Issuance.status='RETIRED'`; `BcrRegistrySyncEvent` for `RETIRE_VCC` `synced=true` |
| Burn-for-delist | `POST /api/v1/issuances/:id/delist` → events worker tick | `DelistRequest.status='BCR_UNLOCKED'`; `Issuance.status='ISSUED'`; `BcrRegistrySyncEvent` for `UNLOCK_VCC` `synced=true` |

The marketplace endpoint must return the new MINTED row inside 60 seconds of mint:

```bash
curl https://aurex.in/api/v1/biocarbon/marketplace | jq '.data[] | select(.bcrSerialId == "<new-serial>")'
```

Sync-events panel:

```sql
SELECT event_type, synced, COUNT(*)
  FROM bcr_registry_sync_events
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY 1, 2;
```

Every row must have `synced=true`. Any `synced=false` triggers immediate page to the cutover commander.

---

## 4. Rollback procedure

Any smoke-check failure or any unexpected `synced=false` row in the first 60 minutes triggers rollback. Time-to-recovery target: **< 15 minutes**.

1. **Flip the adapter back**:

   ```bash
   ssh deploy@aurex.in "sed -i 's/^BCR_REGISTRY_ADAPTER=.*/BCR_REGISTRY_ADAPTER=disabled/' /etc/aurex-api.env"
   ssh deploy@aurex.in "systemctl restart aurex-api"
   ```

   `disabled` adapter returns `ok:false` with `reason='BCR_DISABLED'` for every call — no further state corruption can occur.

2. **Re-enable the tokenization drain** so the marketplace stops accepting new mint requests until the postmortem is in.

3. **Inventory in-flight state**. Run:

   ```sql
   SELECT i.id, i.tokenization_status, i.bcr_serial_id, i.bcr_lock_id,
          (SELECT status FROM bcr_registry_sync_events
             WHERE resource_id = i.id ORDER BY created_at DESC LIMIT 1) AS last_sync_status
     FROM issuances i
     WHERE i.tokenization_status IS NOT NULL
       AND i.updated_at > NOW() - INTERVAL '2 hours';
   ```

   Document for each row: the lock id, whether the BCR side is `locked` or `free`, and whether the chain side has a contract id.

4. **Contact BCR support** at the standby contact from §1 row 8. Provide: cutover commander name, impacted Aurex environment, list of `bcrLockId`s left in flight, lock-vs-unlocked status of each, and the smoke-check that failed.

5. **Open AV4 incident ticket** with the rollback timeline + lock inventory. The ticket blocks the next cutover attempt.

6. Notify customers via status page that the integration cutover was rolled back; tokenization is offline pending investigation.

---

## 5. Owners

| Role | Name (placeholder — Compliance to fill before first dry-run) |
|---|---|
| Cutover commander | `<COMPLIANCE_LEAD_NAME>` (Aurex Compliance Lead) |
| Cutover executor | `<DEVOPS_LEAD_NAME>` (Aurex DevOps Lead) |
| Engineering on-call | (see PagerDuty schedule for the cutover window) |
| BCR contact | (filled at T-7 from BCR's reply to the standby request) |

Names mirror the placeholder block in [`./04-bcr-application-email.md`](./04-bcr-application-email.md) — the same Compliance Lead and DevOps Lead carry through the partnership lifecycle.

---

## 6. Post-cutover artefacts (compliance retention)

Within 24 hours of a successful cutover, store the following in `s3://aurex-legal-artifacts/<env>/bcr/cutover-runbook-runs/<YYYY-MM-DD>/`:

- This runbook (PDF export, with all checklist items initialled).
- The Slack thread transcript.
- The smoke-check SQL output.
- The cutover commander's hand-off memo to Compliance.
- BCR Secretariat's acknowledgement that the cutover completed (email).

These artefacts are evidence for binding requirement **B24** (audit cooperation) and feed directly into the `09-audit-cooperation-runbook.md` quarterly readiness drill.
