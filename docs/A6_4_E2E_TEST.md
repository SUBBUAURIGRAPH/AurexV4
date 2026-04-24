# Article 6.4 — End-to-End Test Harness

**Ticket:** AV4-339 (full lifecycle — scenarios 1-10 shipped + 4 negative tests)
**Location:** `tests/a6.4/`
**Scope:** Phase A (activity lifecycle) + Phase B (monitoring + verification + issuance) + Phase C (transfer + CA emission + BTR export + retirement) against a **live deployed API**.

---

## 1. How to run

### Preconditions

The target environment must have been seeded with the E2E users. Seed is idempotent — re-running is safe:

```bash
# On the deploy host (or locally against a DB)
RUN_DB_PUSH=1 RUN_SEED_MASTER=1 E2E_SEED=1 ./scripts/deploy/deploy-to-remote.sh
```

This creates (in addition to `e2e_admin@aurex.in`):

| Email | Password | Role | Org membership |
|---|---|---|---|
| `e2e_doe@aurex.in` | `E2eDoe@2026!` | `DOE` | E2E Test Organisation |
| `e2e_dna@aurex.in` | `E2eDna@2026!` | `DNA` | E2E Test Organisation |

### Run the suite

```bash
# Default base URL: https://aurex.in
pnpm test:a6.4:e2e

# Point at staging:
E2E_BASE_URL=https://staging.aurex.in pnpm test:a6.4:e2e
```

The suite **skips itself** unless `E2E_RUN=1`. The `pnpm test:a6.4:e2e` script sets that for you.

---

## 2. Scenarios shipped (1-7)

Scenarios live in `tests/a6.4/e2e-phase-ab.test.ts`. Each scenario is one `it(...)` and they **share state** across the `describe` block — a single `HarnessState` object passes the activity id, period id, and tokens from scenario N to scenario N+1. This mirrors how a real activity walks the lifecycle.

| # | Scenario | What it asserts |
|---|---|---|
| 1 | Create a grid-RE activity in India (sectoral scope 1) | Activity created in DRAFT; seeded methodology `A6.4-AM-GRID-RE-001` selected |
| 2 | Upsert PDD + monitoring plan | PDD PUT succeeds; monitoring plan version = 1 |
| 3 | DOE validation | Admin submits; DOE starts + validates (POSITIVE); activity → AWAITING_HOST |
| 4 | Host authorization | DNA issues LoA (NDC_USE); activity → REGISTERED |
| 5 | Monitoring period + datapoints | Period created; 10 metered datapoints ingested; period → SUBMITTED |
| 6 | DOE verification | baseline=10000, project=2000, leakage=500, cons=5% → `verified_er=7125`; period → VERIFIED |
| 7 | Issuance + levy assertions | gross=7125 → sop=356, omge=142, net=6627; participant account credited 6627 |

### Expected-value math (scenarios 6-7)

```
gross ER   = baseline − project − leakage                  = 10000 − 2000 − 500 = 7500
verified_er= floor(gross × (1 − cons/100))                 = floor(7500 × 0.95) = 7125
SOP (5%)   = floor(verified_er × 0.05)                     = floor(356.25)     = 356
OMGE (2%)  = floor(verified_er × 0.02)                     = floor(142.50)     = 142
net        = verified_er − SOP − OMGE                      = 7125 − 356 − 142  = 6627
```

Registry math is **floor at every step** (see `apps/api/src/services/issuance.service.ts::calculateLevies`). Conservative on rounding — the Adaptation Fund never receives > 5% via drift.

---

## 3. Phase C scenarios shipped (8-10)

Phase C lands the full transfer → BTR → retirement leg of the A6.4 registry flow. Scenarios 8-10 exercise the endpoints delivered by AAT-1 (`transaction.service.transferBlock` + `retireBlock`), AAT-2 (`corresponding-adjustments/btr/:hostCountry` export + `ca-events.service`), and AAT-8 (this harness wiring).

| # | Scenario | Key assertions |
|---|---|---|
| 8 | First transfer → CA event emitted | Block.holderAccountId moves to buyer account; `block.firstTransferAt` populated; `block.caStatus === 'PENDING'` (stays pending — flips to APPLIED only on host DNA acknowledgement, out of scope); a `CorrespondingAdjustmentEvent` is created with `status='PENDING_EXPORT'` for the transferred block; DNA BTR endpoint surfaces the event. |
| 9 | Host-DNA BTR export | `GET /corresponding-adjustments/btr/IN` returns 200 with `{ hostCountry, asOf, events: [...], totals: { pendingExport, exported, acknowledged } }`; the scenario-8 event is present with `status='EXPORTED'` and a populated `btrExportedAt` timestamp; `totals.exported >= 1`. |
| 10 | NDC retirement + second CA event | `POST /credits/blocks/:id/retire` with `purpose:'NDC'` parks the block on the seeded `RETIREMENT_NDC` admin account (`a64a0000-0000-4000-8000-000000000004`); `block.retirementStatus === 'RETIRED_FOR_NDC'`; `block.retiredAt` populated; a **new** CA event (distinct from the scenario-8 transfer event) is emitted with `status='PENDING_EXPORT'` and surfaces in the DNA BTR feed. |

### Buyer-org model

Aurex's registry has no standalone "receive-only" account type — transfers move a block between two `CreditAccount`s, both typically `ACTIVITY_PARTICIPANT`. The harness therefore creates a **second "buyer" activity** in the same E2E Test Organisation inside scenario 8; that activity's auto-created participant account serves as the transfer target. CA-emission is driven purely by `firstTransferAt === null` + `unitType === A6_4ER` + authorized scope (NDC_USE / OIMP / NDC_AND_OIMP), so same-org cross-activity transfers still exercise the full path.

### Negative tests

Scenarios 8-10 are followed by 4 RBAC + state-machine guards (run after the happy-path lifecycle completes):

| # | Negative | Expected |
|---|---|---|
| 1 | DOE-role user attempts `POST /credits/blocks/:id/retire` | `403 Forbidden` (route gates on ORG_ADMIN / SUPER_ADMIN) |
| 2 | ORG_ADMIN retires with `purpose: 'INVALID'` | `400 Bad Request` (Zod enum rejection) |
| 3 | Transfer to a non-existent account UUID (block now retired from scenario 10) | `404 Not Found` / `409 Conflict` — either branch of the transfer-service guards is acceptable |
| 4 | Retire the already-retired scenario-10 block | `409 Conflict` (block.retirementStatus !== ACTIVE) OR `404 Not Found` (org-scope guard — block now lives on an admin account with `orgId=null`) |

---

## 4. Harness conventions

- Use the shared `api(...)` helper for all fetch calls — it handles headers, JSON bodies, status parsing, and **retries** on 429/503 with exponential back-off (up to 4 attempts).
- Use the shared `S: HarnessState` object for cross-scenario plumbing.
- Assert on the **final state** (status fields + numeric balances) rather than on intermediate HTTP codes where possible.
- Do NOT add arbitrary `sleep` — if you need to wait for an async transition, add a `pollUntil(predicate, timeoutMs)` helper.
- `RUN_TAG = Date.now()` is used in resource titles + BTR `since` filters so parallel runs isolate cleanly.

### BTR endpoint caveat

The `GET /corresponding-adjustments/btr/:hostCountry` route has a side-effect: any events matching the query with `status=PENDING_EXPORT` are atomically flipped to `EXPORTED` + `btrExportedAt` stamped, then the response snapshot is re-read. **Do not pass `status=PENDING_EXPORT` in the query** if you also want to see the just-flipped events in the response body — the re-read uses the same `where` clause and will return `[]` for the now-EXPORTED events. Call without a status filter (or with `status=EXPORTED`) to see the post-flip snapshot. This is a prod-side re-read symmetry bug that should be tracked in a follow-up ticket; the harness works around it explicitly.

---

## 5. Test data isolation

Activities created by the harness are tagged with `Date.now()` (aka `RUN_TAG`) in the title (e.g. `E2E Grid-RE Solar 1735689600000`). Parallel runs therefore don't collide on activity title uniqueness. `RUN_TAG` is also used in the BTR `since=` filter so each run only sees its own CA events. However:

- All runs share the same E2E Test Organisation (OrgId `e2e00000-0000-4000-8000-000000000001`).
- Monitoring data + CA events accumulate across runs. `/admin/retention/report` is the cleanest way to see what's there.

**Future:** if accumulation becomes noisy, add an `afterAll` that closes the activity (`POST /activities/:id/close`) and deletes ephemeral data. Deferred until we see real noise.

---

## 6. CI integration (follow-up)

This pass does **not** wire the suite into CI — it's meant to run post-deploy against the just-deployed environment. The integration pattern (tracked in AV4-339 completion) will be:

1. `scripts/deploy/deploy-to-remote.sh` succeeds → write a `DEPLOY_OK` marker.
2. CI next step: `E2E_BASE_URL=<env-url> pnpm test:a6.4:e2e`.
3. If any scenario fails, block the promotion from staging → prod.

A shorter path: invoke the harness from `pnpm deploy:post-check` as a final gate.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Login failed for e2e_admin@aurex.in` | `E2E_SEED=1` not run on target | Re-deploy with `E2E_SEED=1` |
| 403 on scenario 3 `/validate-start` | DOE user not in target org | Confirm seed created OrgMember for DOE |
| Scenario 4 returns activity status `AWAITING_HOST` (not `REGISTERED`) | Host authorization endpoint path / body shape differs | Align test with current `host-authorization.service` route |
| Scenario 6 `verified_er != 7125` | `calculateEr` changed its rounding | Check `er-calc.service.ts` + its unit test |
| Scenario 7 `net != 6627` | Levy rates drifted from 5% SOP + 2% OMGE | Check `issuance.service.ts::calculateLevies` — rates are platform-wide constants |
| Scenario 8 "CA event emitted for transferred block: expected undefined to be truthy" | BTR query filtered `status=PENDING_EXPORT` — side-effect flipped events EXPORTED before snapshot re-read | Harness already omits the status filter; don't re-add it |
| Scenario 8 / 10 flake with 429 / 503 | Rate-limit burst (100 req/min per IP) | `api()` helper already retries 429/503 with exponential back-off; check `rate-limiter.ts` settings if flakes persist |

---

## 8. References

- `tests/a6.4/e2e-phase-ab.test.ts` — the scenarios.
- `tests/a6.4/vitest.config.ts` — Vitest config.
- `apps/api/src/services/issuance.service.ts` — levy math.
- `apps/api/src/services/er-calc.service.ts` — verified ER calc.
- `apps/api/src/services/transaction.service.ts` — transfer + retirement (Phase C, AAT-1).
- `apps/api/src/services/ca-events.service.ts` — CA event emission on first transfer / retirement.
- `apps/api/src/routes/corresponding-adjustments.ts` — BTR export endpoint (AAT-2).
- `packages/database/src/seed-master-data.ts::seedE2eA64Users` — DOE + DNA seed.
- `docs/A6_4_DEFERRED_SOW.md` §5 — full E2E WBS + expected-value math.
