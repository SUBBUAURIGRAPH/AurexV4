# Article 6.4 — UNFCCC Central Registry Adapter

Status: **Scaffold (disabled by default)**
Ticket: AV4-334
Last updated: 2026-04-24

---

## Current status

The UNFCCC central Article 6.4 mechanism registry API specification is
still being finalised under CMA.6+. Until the spec publishes, Aurex cannot
ship a live integration. This scaffold lets the platform be *ready*:

- The adapter **interface** is locked-in (`UnfcccRegistryAdapter`).
- The default production adapter (`disabled`) records every call as
  `synced: false` with a machine-parseable reason.
- Business flows (issuance approval, first transfer, non-voluntary
  retirement) already invoke the adapter at the correct sync points.
- Every adapter call writes an audit row (`UnfcccRegistrySyncEvent` +
  `AuditLog`) regardless of outcome, so when the operator flips to a live
  adapter the sync history is continuous with no gaps.

When the spec publishes, an operator implements a concrete adapter and
flips `UNFCCC_REGISTRY_ADAPTER`. No business-logic changes are required.

---

## Adapter seam

```
apps/api/src/services/registries/
├── unfccc-adapter.ts     # UnfcccRegistryAdapter interface + param types
├── disabled-adapter.ts   # DisabledUnfcccAdapter (default, no-op)
├── sync-recorder.ts      # Best-effort wrappers — called from services
└── index.ts              # getUnfcccAdapter() factory (env-driven)
```

The three notification methods correspond to the three registry sync
points in the A6.4 lifecycle:

| Method                   | Called from                          | Trigger                           |
| ------------------------ | ------------------------------------ | --------------------------------- |
| `notifyIssuance`         | `issuance.service.approveIssuance`   | After CreditUnitBlocks are minted |
| `notifyFirstTransfer`    | `ca-events.service.emitOnFirstTransfer` | After the CA event row is created |
| `notifyRetirement`       | `transaction.service.retireBlock`    | After block update; skipped for VOLUNTARY |

All three call-sites are wrapped in try/catch **twice** (once inside
`sync-recorder.ts`, once at the call-site) so an adapter bug can never
block the primary registry flow.

---

## Environment variable

```
UNFCCC_REGISTRY_ADAPTER=disabled    # default — no-op
UNFCCC_REGISTRY_ADAPTER=mock        # reserved — not yet implemented
UNFCCC_REGISTRY_ADAPTER=backblaze-b2 # reserved — not yet implemented
UNFCCC_REGISTRY_ADAPTER=live-v1     # reserved — not yet implemented
```

- Unset or `disabled` → `DisabledUnfcccAdapter` (default).
- Any **reserved but unimplemented** value throws a clear error at startup
  (fail-fast; surfaces misconfiguration immediately in prod).
- Any other value throws with a "not recognised" error.

The factory is a module-level singleton. The first call reads the env
var and caches the instance — repeated calls within a process share
state (so a future adapter with a connection pool / retry queue sees
one instance).

---

## Operator runbook — flipping to a live adapter

Once the UNFCCC publishes the CMA.6+ API spec:

1. **Build the adapter.** Implement `UnfcccRegistryAdapter` in a new file
   under `apps/api/src/services/registries/` (e.g. `live-v1-adapter.ts`).
   - Authenticate to the central registry (mTLS / OAuth2 TBD by the spec).
   - Map Aurex identifiers → central registry identifiers.
   - Implement idempotency keys on the request body if the spec supports
     them (so retries are safe).
   - NEVER throw — return `{ synced: false, reason }` on any failure.

2. **Register it in the factory.** Add a new branch in
   `apps/api/src/services/registries/index.ts`:

   ```ts
   if (raw === 'live-v1') {
     cached = new LiveV1UnfcccAdapter({ /* config */ });
     return cached;
   }
   ```

3. **Stage it.** Flip `UNFCCC_REGISTRY_ADAPTER=live-v1` in the dev
   environment first. Issue a test credit, verify the
   `unfccc_registry_sync_events` row has `synced=true` and an
   `external_ref`. Check the central registry admin console for the
   matching record.

4. **Dry-run a week in parallel.** Let the mock adapter and the live
   adapter run side-by-side (add a `dual` mode to the factory that calls
   both, logging any divergence). Once drift-free, delete `dual`.

5. **Promote to production.** Set `UNFCCC_REGISTRY_ADAPTER=live-v1`. The
   first live issuance will appear as a new `UnfcccRegistrySyncEvent`
   row with `synced=true` and the external ref.

6. **Backfill historical events (optional).** Query
   `SELECT * FROM unfccc_registry_sync_events WHERE synced=false` for
   events recorded during the disabled period; feed them back through
   the live adapter (one-off script, not scaffolded yet).

---

## Retry policy guidance (future work)

This scaffold **does not** queue failed syncs for retry. The observed
pattern when the spec publishes will be:

- Transient network / 5xx failures → exponential backoff retry queue.
- Permanent 4xx validation failures → surface to a human reviewer queue.

Recommended implementation when it's time:

1. Add a `retryAttempts` + `nextRetryAt` column to
   `UnfcccRegistrySyncEvent`.
2. Background job (BullMQ / pg-boss) picks up rows where
   `synced=false AND nextRetryAt <= now()`, re-invokes the adapter, and
   updates the row.
3. After N failed attempts, flip a permanent-failure flag and page ops.

None of the above is in scope for AV4-334 — this ticket is the seam only.

---

## Observability

Every adapter call produces:

1. **`UnfcccRegistrySyncEvent` row** — machine-readable sync log
   (`resourceKind`, `resourceId`, `adapterName`, `externalRef`, `synced`,
   `reason`, `requestPayload`).
2. **`AuditLog` row** — human-readable with a stable action key:
   - `unfccc.registry.issuance_notified`
   - `unfccc.registry.first_transfer_notified`
   - `unfccc.registry.retirement_notified`

Dashboards should alert on the failure ratio once a live adapter is
wired — e.g. `synced=false` events in the last hour divided by total
events. During the `disabled` era, failure ratio is always 100% by
design; treat that as a known-noise baseline.

---

## Related

- `docs/A6_4_DEFERRED_SOW.md` — the broader A6.4 deferred work list
- `docs/A6_4_E2E_TEST.md` — end-to-end happy-path walkthrough
- AV4-330 — removal buffer deposit (Phase C)
- AV4-334 — this ticket (UNFCCC registry adapter scaffold)
