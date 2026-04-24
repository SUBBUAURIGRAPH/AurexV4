# Article 6.4 — End-to-End Test Harness

**Ticket:** AV4-339 (partial — scenarios 1-7 shipped; 8-10 stubbed `it.todo` pending Phase C)
**Location:** `tests/a6.4/`
**Scope:** Phase A (activity lifecycle) + Phase B (monitoring + verification + issuance) against a **live deployed API**.

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

## 3. Scenarios stubbed (8-10)

These are `it.todo(...)` — Vitest reports them as "todo" and they don't fail. They land when Phase C (AV4-328..333) is deployed:

| # | Scenario | Depends on |
|---|---|---|
| 8 | First transfer + CA event emission | AV4-329 |
| 9 | BTR export by host DNA | AV4-330 |
| 10 | Retirement + CA reversal | AV4-331 |

To un-todo a scenario, replace `it.todo(...)` with `it(...)` and implement the body. The harness conventions:

- Use the shared `api(...)` helper for all fetch calls — it handles headers, JSON bodies, and status parsing.
- Use the shared `S: HarnessState` object for cross-scenario plumbing.
- Assert on the **final state** (status fields + numeric balances) rather than on intermediate HTTP codes where possible.
- Do NOT add arbitrary `sleep` — if you need to wait for an async transition, add a `pollUntil(predicate, timeoutMs)` helper.

---

## 4. Test data isolation

Activities created by the harness are tagged with `Date.now()` in the title (e.g. `E2E Grid-RE Solar 1735689600000`). Parallel runs therefore don't collide on activity title uniqueness. However:

- All runs share the same E2E Test Organisation (OrgId `e2e00000-0000-4000-8000-000000000001`).
- Monitoring data accumulates across runs. `/admin/retention/report` is the cleanest way to see what's there.

**Future:** if accumulation becomes noisy, add an `afterAll` that closes the activity (`POST /activities/:id/close`) and deletes ephemeral data. This is deferred until we see real noise.

---

## 5. CI integration (follow-up)

This pass does **not** wire the suite into CI — it's meant to run post-deploy against the just-deployed environment. The integration pattern (tracked in AV4-339 completion) will be:

1. `scripts/deploy/deploy-to-remote.sh` succeeds → write a `DEPLOY_OK` marker.
2. CI next step: `E2E_BASE_URL=<env-url> pnpm test:a6.4:e2e`.
3. If any scenario fails, block the promotion from staging → prod.

A shorter path: invoke the harness from `pnpm deploy:post-check` as a final gate.

---

## 6. Adding Phase C scenarios (quick recipe)

For scenario 8 (first transfer + CA emission), when AV4-329 lands:

```typescript
it('Scenario 8: first transfer + CA emission', async () => {
  // Precondition: S.issuanceId + S.netUnits are populated by scenario 7.
  const buyer = await api(`/organizations`, {
    token: S.admin!.accessToken,
    body: { name: `E2E Buyer ${Date.now()}`, slug: `e2e-buyer-${Date.now()}` },
  });
  // ... transfer 3000 units from participant account to buyer ...
  const transfer = await api(`/credits/transfers`, { ... });
  expect(transfer.status).toBe(200);
  // Assert CA event row exists with status PENDING_EXPORT.
  const ca = await api(`/corresponding-adjustments?blockId=${blockId}`, { ... });
  expect(ca.body.data[0].status).toBe('PENDING_EXPORT');
});
```

See `docs/A6_4_DEFERRED_SOW.md` §5.3 for the full scenario specs.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Login failed for e2e_admin@aurex.in` | `E2E_SEED=1` not run on target | Re-deploy with `E2E_SEED=1` |
| 403 on scenario 3 `/validate-start` | DOE user not in target org | Confirm seed created OrgMember for DOE |
| Scenario 4 returns activity status `AWAITING_HOST` (not `REGISTERED`) | Host authorization endpoint path / body shape differs | Align test with current `host-authorization.service` route |
| Scenario 6 `verified_er != 7125` | `calculateEr` changed its rounding | Check `er-calc.service.ts` + its unit test |
| Scenario 7 `net != 6627` | Levy rates drifted from 5% SOP + 2% OMGE | Check `issuance.service.ts::calculateLevies` — rates are platform-wide constants |

---

## 8. References

- `tests/a6.4/e2e-phase-ab.test.ts` — the scenarios.
- `tests/a6.4/vitest.config.ts` — Vitest config.
- `apps/api/src/services/issuance.service.ts` — levy math.
- `apps/api/src/services/er-calc.service.ts` — verified ER calc.
- `packages/database/src/seed-master-data.ts::seedE2eA64Users` — DOE + DNA seed.
- `docs/A6_4_DEFERRED_SOW.md` §5 — full E2E WBS + expected-value math.
