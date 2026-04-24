# Article 6.4 — Deferred Items: Scope of Work + Work Breakdown Structure

**Epic:** AV4-309 — Article 6.4 / PACM Compliance
**Scope:** 5 items deferred from Phases A–C (AV4-335 through AV4-339)
**Authored:** 2026-04-24
**Status:** Planning — awaiting scheduling decision
**Source gap analysis:** `~/.claude/plans/tidy-soaring-pancake.md`

---

## Executive summary

Five items were deferred from the initial Aurex A6.4 implementation. Collectively they close the last compliance gaps between what shipped in Phases A + B (+ Phase C in flight) and a full UNFCCC Supervisory Body PACM implementation. Three are **compliance-blocking** if the platform is to register real activities under A6.4; two are **operational quality** improvements.

| # | Ticket | Title | Classification | Effort | Blocks real A6.4 operation? |
|---|---|---|---|---|---|
| 1 | AV4-335 | Full PDD builder UI | UX completeness | 64 h / ~8 dev-days | No — can store PDD via API today, but no authoring UX |
| 2 | AV4-336 | Structured BaselineScenario entity | Compliance | 30 h / ~4 dev-days | **Yes** — A6.4-STAN-METH-004 mandates structured baseline with downward adjustment |
| 3 | AV4-337 | SD-Tool (17 SDG monitoring) | Compliance | 31 h / ~4 dev-days | **Yes** — SD-Tool is MANDATORY since 2024 for all PACM activities |
| 4 | AV4-338 | Raw-data retention policy (≥2 yr) | Compliance | 24 h / ~3 dev-days | **Yes** — A6.4-PROC-AC-002 raw data retention rule |
| 5 | AV4-339 | E2E test — full activity lifecycle | Quality | 39 h / ~5 dev-days | No — but essential regression protection for the above |
| | | **Total** | | **188 h ≈ 24 dev-days (≈5 calendar weeks for 1 eng)** | |

**Recommended sequencing** — target activities as the unit of throughput:
1. **AV4-336** BaselineScenario first — blocks verified issuance correctness.
2. **AV4-337** SD-Tool — blocks PDD completeness.
3. **AV4-335** PDD builder UI — closes the visible workflow loop.
4. **AV4-338** Retention policy — operational; can run in parallel once blob store provisioned.
5. **AV4-339** E2E test — last, exercises the full stack.

---

## 1. AV4-335 — Full PDD (Project Design Document) builder UI

### 1.1 Objective

Provide an authoring UX for the **Project Design Document** that every A6.4 activity must submit before DOE validation. Schema exists (`Pdd.content: Json`) but no UI today — admins must write raw JSON.

### 1.2 Scope

**In scope:**
- Multi-step wizard for PDD authoring with draft save/resume
- Nine structured tabs per A6.4-PROC-AC-002 PDD template
- Version control via `Pdd.version` (auto-increment)
- PDF export to the UNFCCC PDD template layout
- Validation of methodology-specific required fields
- RBAC: MANAGER+ can edit drafts; DOE/DNA read-only; submission locks version

**Out of scope:**
- PDD auto-generation from monitoring-plan data (future enhancement)
- Legal review workflow (delegate to existing Report lifecycle if needed)
- Multi-user collaborative editing (single-writer with shareToken preview)
- ML-assisted additionality argument (out-of-scope; human-authored)

### 1.3 Work Breakdown Structure

| # | Task | Detail | Effort |
|---|---|---|---|
| 1 | Wizard skeleton | Route `/activities/:id/pdd/edit`, 9-tab form layout, draft persistence to `Pdd.content`, per-tab validation state tracking, save/resume across sessions | 8 h |
| 2 | Tab 1 — Project info | Title, description, technology, host country, crediting period auto-filled from Activity | 2 h |
| 3 | Tab 2 — Boundaries | GeoJSON polygon drawer using `leaflet-draw` or MapLibre GL; separate project area + leakage belt polygons; sectoral scope selector (1–15) | 6 h |
| 4 | Tab 3 — Baseline scenario | Counterfactual narrative rich-text; baseline methodology version auto-filled; baseline-emissions time-series CSV upload; links to `BaselineScenario` (AV4-336) | 4 h |
| 5 | Tab 4 — Additionality | Investment analysis (IRR/NPV calculator); barrier analysis checklist; common practice analysis (sector + region penetration %); lock-in risk narrative per `A6.4-SBM015-A11` | 6 h |
| 6 | Tab 5 — Monitoring plan summary | Read-only display of `MonitoringPlan` (built in Phase B); inline link to the full monitoring editor | 2 h |
| 7 | Tab 6 — Leakage | Category selectors (upstream / downstream / market / activity-shifting); per-category quantification + methodology reference | 3 h |
| 8 | Tab 7 — SD-Tool (SDGs) | Ties to `SdContribution` model from AV4-337; 17 SDG selector with ex-ante projection fields per selected SDG | 7 h |
| 9 | Tab 8 — Stakeholder consultation | Consultation log (date, stakeholder group, summary); uploadable proof documents via pre-signed URL | 3 h |
| 10 | Tab 9 — Attachments | File uploads via pre-signed S3 URLs; supported types: PDF, DOCX, XLSX, images; file size + virus scanning | 2 h |
| 11 | PDF export service | Server-side rendering via `puppeteer` or `pdfkit`; styled to UNFCCC PDD template; assembles all tabs + cover page + TOC | 8 h |
| 12 | Version control UI | Diff view between PDD versions (side-by-side); submit-for-validation locks the version; list past versions with submitter + date | 3 h |
| 13 | API additions | `PUT /pdds/:activityId` (upsert + version increment); `GET /pdds/:activityId/versions`; `POST /pdds/:activityId/export-pdf`; `POST /pdds/:activityId/submit` | 4 h |
| 14 | Unit + integration tests | IRR/NPV calculator correctness; wizard happy-path E2E; version auto-increment; version lock on submit | 4 h |
| 15 | Polish, accessibility, docs | Keyboard nav through wizard; WCAG AA for form fields; `docs/A6_4_PDD_GUIDE.md` | 2 h |
| | **Total** | | **64 h** |

### 1.4 Dependencies

- **AV4-337** (SD-Tool) — Tab 7 consumes `SdIndicator` catalogue and writes `SdContribution` rows.
- **AV4-336** (BaselineScenario) — Tab 3 reads/writes the structured baseline.
- **Blob store** (S3/Backblaze/local) for attachments in Tab 9 — shared with AV4-337 evidence + AV4-338 archive.
- **Map library choice** — `leaflet-draw` vs `MapLibre GL` decision (recommend `MapLibre GL` for vector tiles + better mobile UX; add ~3 h if choosing Leaflet due to less modern touch support).

### 1.5 Acceptance criteria

- [ ] A MANAGER or ORG_ADMIN can author a PDD end-to-end via the wizard without dropping to raw JSON.
- [ ] Draft saves persist across browser sessions and can be resumed.
- [ ] PDF export produces a document structurally matching the UNFCCC PDD template with all 9 sections populated.
- [ ] Submitted PDDs are locked for editing until the activity is REJECTED (then unlocked, creating a new version).
- [ ] PDD version history visible on activity detail page with submitter + timestamp + diff view.
- [ ] DOE and DNA users can view but not edit.
- [ ] All tabs pass WCAG AA accessibility audit.

### 1.6 Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GeoJSON boundary editing UX complexity | High | Med | Start with file-upload fallback; interactive drawing as v2 |
| PDF rendering inconsistency across methodologies | Med | Med | Template-per-methodology overrides; golden-file test per seeded methodology |
| Additionality investment calc correctness | Med | High | Unit-test IRR/NPV against published examples; DOE validates in practice anyway |
| Blob store cost (attachments) | Low | Low | Lifecycle rules: hot 90d → cold (IA/Glacier) |

---

## 2. AV4-336 — Structured BaselineScenario entity

### 2.1 Objective

Replace the current **flat baseline number** on `VerificationReport` with a structured `BaselineScenario` entity that supports the counterfactual narrative, per-year baseline time-series, mandatory downward-adjustment factor, NDC alignment declaration, and suppressed-demand handling required by A6.4-STAN-METH-004.

### 2.2 Scope

**In scope:**
- `BaselineScenario` Prisma model FK'd to Activity
- `BaselineEmission` yearly time-series with downward-adjustment factor
- NDC alignment declaration + LT-LEDS reference
- Suppressed-demand flag for LDC/SIDS (per A6.4-STAN-METH-004 §suppressed demand)
- Versioning — baseline must be re-approved at crediting-period renewal
- DOE approval gate (can't leave AWAITING_HOST without approved baseline)
- API CRUD + wire `verification.service` to consume structured baseline

**Out of scope:**
- Automatic baseline computation from methodology (future — per-methodology calculator modules)
- Integration with national GHG inventories for benchmarking (future)
- Sector-specific baseline templates (future)

### 2.3 Work Breakdown Structure

| # | Task | Detail | Effort |
|---|---|---|---|
| 1 | Schema additions | `BaselineScenario` (activityId FK, version, status, narrative, methodologyVersion, ndcAlignmentJustification, ltLedsReference, suppressedDemandFlag, suppressedDemandNotes, approvedBy, approvedAt). `BaselineEmission` (scenarioId FK, year, emissionsTco2e, downwardAdjustmentFactor, notes). Add back-relations on Activity | 4 h |
| 2 | Prisma generate + typecheck | Run `prisma generate`, verify API + web compile | 1 h |
| 3 | Service layer | `baseline-scenario.service.ts`: `upsertScenario`, `addEmission`, `approveByDoe`, `listVersions`, `computeForYear(year) → emissionsTco2e × adjustmentFactor` | 6 h |
| 4 | Route layer | `PUT /activities/:id/baseline-scenarios` (MANAGER+, creates new version); `POST /baseline-scenarios/:id/approve` (DOE-gated); `GET /activities/:id/baseline-scenarios` (list versions); `GET /baseline-scenarios/:id` (detail) | 3 h |
| 5 | Wire verification.service | Replace `baselineEmissions` input in `VerificationReport` submission with structured lookup from approved `BaselineScenario` for the monitoring period's year(s). Maintain backward compat for activities without structured baseline (legacy path) | 3 h |
| 6 | UI — baseline tab | New tab on activity detail page: narrative editor, yearly emissions grid editor, NDC/LT-LEDS fields, suppressed-demand toggle, DOE approval action button (gated by role) | 6 h |
| 7 | Unit tests | Downward-adjustment applied per-year; version state machine (DRAFT → SUBMITTED → APPROVED → SUPERSEDED); approval role gate; backward-compat path | 3 h |
| 8 | Seed baseline examples | Example `BaselineScenario` + per-year emissions for the seeded Grid-connected RE methodology (A6.4-AM-GRID-RE-001) as a reference | 2 h |
| 9 | Data migration | Backfill existing `VerificationReport` rows with synthetic single-year `BaselineScenario` (dev/staging only); document the migration path for prod | 2 h |
| | **Total** | | **30 h** |

### 2.4 Dependencies

- **Activity** model (Phase A, done).
- **VerificationReport** model (Phase B, done).
- **AV4-335** Tab 3 integrates with this entity for authoring UX.

### 2.5 Acceptance criteria

- [ ] A MANAGER can create a `BaselineScenario` with per-year emissions and per-year downward adjustment factors.
- [ ] DOE approval is required before Activity can transition `AWAITING_HOST → REGISTERED` (new gate).
- [ ] `VerificationReport` submission reads the approved `BaselineScenario.computeForYear()` rather than accepting a flat baseline input.
- [ ] Re-approval is required at crediting-period renewal (status transitions APPROVED → SUPERSEDED on renewal).
- [ ] Legacy `VerificationReport` rows (no `BaselineScenario`) continue to work — no breaking change.
- [ ] Suppressed-demand flag is surfaced in the baseline summary and in the verified ER calculation audit trail.

### 2.6 Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Data migration risk — dual-mode during transition | High | Med | Keep the flat input as a fallback in code for legacy rows; explicit opt-in via feature flag per activity |
| Methodology-specific baseline formulas (PV vs landfill vs AR) not captured in generic model | High | Med | This pass stays generic; per-methodology calculators are future work |
| Downward-adjustment factor correctness | Med | High | Unit-test against A6.4-STAN-METH-004 worked examples |

---

## 3. AV4-337 — SD-Tool (17 SDG monitoring)

### 3.1 Objective

Implement the **Sustainable Development Tool** (SD-Tool) — ex-ante projection at PDD stage + ex-post monitoring per monitoring period. **MANDATORY since 2024** for all PACM activities.

### 3.2 Scope

**In scope:**
- 17 SDG catalogue (pre-seeded from UN SDG framework)
- Per-SDG indicators (~70 indicators — e.g. SDG 7: renewable energy access, jobs created, gender equity)
- `SdContribution` entity: ex-ante (per activity) + ex-post (per monitoring period)
- A6.4 SD-Tool report template export
- UI — PDD wizard (ex-ante) + monitoring UI (ex-post)
- Evidence URLs (via shared blob store)

**Out of scope:**
- ML-assisted SDG suggestion
- Third-party SDG verification (would be a separate DOE sub-protocol)
- Real-time satellite/SDG feed integration

### 3.3 Work Breakdown Structure

| # | Task | Detail | Effort |
|---|---|---|---|
| 1 | Seed 17 SDGs | `Sdg` table: code (SDG_1..SDG_17), name, description, icon URL (per UN branding) | 2 h |
| 2 | Seed SD indicators | `SdIndicator` catalogue: ~70 indicators per UN SDG framework (e.g. SDG_7.1 "Proportion of population with access to electricity"), unit, measurement guidance | 2 h |
| 3 | Schema | `Sdg` (code, name, description, iconUrl). `SdIndicator` (code unique, sdgCode FK, name, description, unit, measurementGuidance). `SdContribution` (activityId FK, indicatorCode FK, contributionType: EX_ANTE/EX_POST, monitoringPeriodId nullable FK, value decimal, unit, notes, evidenceUrl, updatedBy) | 3 h |
| 4 | Service layer | `sd-tool.service.ts`: `listSdgs`, `listIndicators`, `upsertContribution`, `listByActivity`, `listByPeriod`, `computeDelta(ex-ante, ex-post)` per indicator | 4 h |
| 5 | Route layer | `GET /sdgs` (catalogue); `GET /sd-indicators?sdg=SDG_7` (filtered catalogue); `PUT /activities/:id/sd-contributions` (ex-ante batch); `PUT /monitoring/periods/:id/sd-contributions` (ex-post batch); `GET /activities/:id/sd-report` (aggregated ex-ante vs ex-post) | 3 h |
| 6 | UI — PDD Tab 7 | 17-goal multi-select grid with UN SDG icons; per-selected-SDG indicator accordion; value + notes + evidence URL per indicator; ex-ante projection form | 6 h |
| 7 | UI — monitoring SD tab | Per-monitoring-period SD contribution capture; same indicators as ex-ante; shows delta vs ex-ante projection with traffic-light status | 4 h |
| 8 | Report export | SD-Tool summary in `A6.4 SD-Tool report template` format; aggregated ex-ante vs ex-post table; PDF option via the AV4-335 export service | 4 h |
| 9 | Unit tests | Contribution value aggregation per SDG; delta calculation; evidence URL validation | 2 h |
| 10 | Seed test + typecheck | Verify seed runs idempotent; API + web compile | 1 h |
| | **Total** | | **31 h** |

### 3.4 Dependencies

- **AV4-335** PDD wizard Tab 7 integration for ex-ante.
- **MonitoringPeriod** model (Phase B, done) for ex-post tie-in.
- **Blob store** for evidence URLs.

### 3.5 Acceptance criteria

- [ ] PDD wizard requires at least 2 SDG selections (A6.4 SD-Tool minimum).
- [ ] Ex-ante projection captured per selected indicator with unit and narrative.
- [ ] Each monitoring period captures ex-post SD contributions against the activity's declared indicators.
- [ ] Delta report (ex-ante vs ex-post) surfaces traffic-light status per indicator.
- [ ] Report export matches the A6.4 SD-Tool template structure.
- [ ] UN SDG icons render correctly in PDD and report PDFs.

### 3.6 Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Indicator taxonomy: UN official vs A6.4-SB narrower set | High | Med | Start with UN official 70; add SB-specific filter when SB publishes final set; use `isSbApproved` flag |
| Evidence URL storage cost | Low | Low | Share blob store with AV4-335/338; lifecycle rules |
| Subjective indicators (e.g. "gender equity") lack clear measurement | Med | Med | Measurement guidance per indicator + narrative required; flag as "qualitative" unit |

---

## 4. AV4-338 — Raw-data retention policy (≥ 2 yr post-crediting-period)

### 4.1 Objective

Enforce the A6.4 rule that raw MRV data must be retained **≥ 2 years after the end of the activity's crediting period** (practically ≥ 10 years total since crediting periods run 5–45 years). Today Aurex has no retention policy encoded — data lives in Postgres until manually pruned.

### 4.2 Scope

**In scope:**
- `RetentionPolicy` model + default policy referenced to `Activity.creditingPeriodEnd`
- Scheduled archival job that moves expired monitoring datapoints to cold storage (Parquet/gzip on S3 or Backblaze)
- Retention metadata in API responses (via response headers) for auditor visibility
- Admin retention-report endpoint for compliance audit
- Restore-from-archive CLI
- Documented retention doc in `docs/`

**Out of scope:**
- Data purge (**never** — A6.4 mandates retention, not deletion)
- Immutable ledger / blockchain (separate concern; out-of-scope)
- Cross-region replication (ops concern, not schema)

### 4.3 Work Breakdown Structure

| # | Task | Detail | Effort |
|---|---|---|---|
| 1 | Schema | `RetentionPolicy` (name, ruleJson, retainUntilFormula, minRetentionYears, isDefault). `DatapointArchive` (periodId FK, archivedAt, archiveUrl, rowCount, checksum SHA-256, restoreCount). Add retention-horizon derivation on MonitoringPeriod | 2 h |
| 2 | Archival service | `archival.service.ts`: `identifyEligible()` (MonitoringPeriod where `activity.creditingPeriodEnd + 2yr < now` but `retainUntil > now`); `archivePeriod(periodId)` serializes datapoints to Parquet (via `apache-arrow` / `parquetjs-lite`); uploads to configured blob store; writes `DatapointArchive` row; deletes datapoints from Postgres within a single transaction | 6 h |
| 3 | Scheduled job | Cron worker (using existing Node + `node-cron` or BullMQ) that runs nightly at 02:00 UTC; logs to `AuditLog`; alerts on failure via notification | 3 h |
| 4 | Retention metadata in API | Add `x-retention-policy` response header to `/monitoring/*` + `/verification/*` routes; retention footer on generated verification reports | 2 h |
| 5 | Admin retention report | `GET /admin/retention-report` — list MonitoringPeriods with retention status (ACTIVE / ELIGIBLE / ARCHIVED / RESTORED); SUPER_ADMIN only | 3 h |
| 6 | Retention policy doc | `docs/A6_4_RETENTION_POLICY.md`: policy text, operator runbook, restore procedure, regulatory basis (A6.4-PROC-AC-002 + Decision 3/CMA.3) | 2 h |
| 7 | Unit tests | Eligibility calc (periodEnd + crediting-period end + 2 yr); archive/restore round-trip; checksum verification | 2 h |
| 8 | Restore procedure | CLI script: `node scripts/restore-archive.js <periodId>` — downloads Parquet from blob store, validates SHA-256, re-hydrates into Postgres, writes `AuditLog` | 3 h |
| 9 | Compliance integration test | E2E test: seed a stale MonitoringPeriod → run archival → verify Parquet on blob store + row-count match → run restore → verify datapoints back in Postgres with identical values | 1 h |
| | **Total** | | **24 h** |

### 4.4 Dependencies

- **Blob store** — S3, Backblaze, or compatible. **Shared** with AV4-335 (PDD attachments) and AV4-337 (SDG evidence).
- **Scheduling infrastructure** — existing API process or a dedicated worker. Recommend BullMQ + Redis (Redis already in stack).

### 4.5 Acceptance criteria

- [ ] Nightly job identifies and archives MonitoringPeriods past retention horizon.
- [ ] Each archived period produces a Parquet file with verified SHA-256 checksum.
- [ ] `DatapointArchive` row records all metadata (checksum, row count, archive URL).
- [ ] Restore path round-trips without data loss; datapoints identical before/after.
- [ ] `x-retention-policy` header appears on relevant API responses.
- [ ] `docs/A6_4_RETENTION_POLICY.md` published and discoverable.
- [ ] SUPER_ADMIN can run retention report and see all archive events.

### 4.6 Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Blob store cost (egress during restore) | Med | Low | Lifecycle rules: 90 d hot → IA → Glacier/cold; restore from cold acceptable for audit use |
| Checksum mismatch on restore | Low | High | SHA-256 verified before DB re-hydration; alert + block if mismatch |
| Regulatory variance by host country (EU data-residency, data-protection laws) | Med | High | Per-host-country blob-store region configuration; document DPO sign-off required |
| Archive format lock-in (Parquet) | Low | Low | Store column schema alongside the archive; human-readable recovery script committed to repo |

---

## 5. AV4-339 — E2E test: full activity lifecycle

### 5.1 Objective

End-to-end regression coverage of the complete A6.4 flow: activity → PDD → monitoring plan → DOE validation → host LoA → monitoring period → DOE verification → issuance → transfer (Phase C) → CA event → retirement. Also serves as **living documentation** of the A6.4 flow.

### 5.2 Scope

**In scope:**
- Formal `tests/a6.4/` Vitest integration harness
- 10+ numbered scenarios covering happy-path + key negative cases
- Assertions on SOP/OMGE levy math against expected numbers
- Assertions on CA event emission (depends on Phase C / AV4-329)
- CI integration — runs on every commit touching `apps/api/**` or `packages/database/**`
- Documentation diagram of the full flow

**Out of scope:**
- Performance / load testing (separate workstream)
- UI E2E via Playwright/Cypress (separate workstream)
- Chaos / failure-injection testing

### 5.3 Work Breakdown Structure

| # | Task | Detail | Effort |
|---|---|---|---|
| 1 | Test harness setup | `tests/a6.4/e2e.test.ts` with Vitest integration config; shared setup: auth fixtures for ORG_ADMIN + DOE + DNA + SUPER_ADMIN; cleanup between tests; rate-limit paces | 3 h |
| 2 | Scenario 1 — Activity creation | Pick methodology `A6.4-AM-GRID-RE-001`; create activity (grid-connected solar, IN, scope 1, 10MW); assert participant account auto-provisioned; assert status DRAFT | 2 h |
| 3 | Scenario 2 — PDD + monitoring plan | Upload minimal PDD; upsert monitoring plan with 3 parameters (electricity_generated, grid_ef, displacement_factor); assert plan version = 1 | 2 h |
| 4 | Scenario 3 — DOE validation | Authenticate as DOE user; submit ValidationReport (opinion=POSITIVE, doeOrgName="DOE-TEST-001"); assert activity status → AWAITING_HOST; assert audit log captures validation event | 2 h |
| 5 | Scenario 4 — Host authorization | Authenticate as DNA user (India DNA); issue LoA with `authorizedFor=NDC_USE`; assert activity status → REGISTERED; assert HostAuthorization.status=ISSUED | 2 h |
| 6 | Scenario 5 — Monitoring period + datapoints | Create monitoring period 2026-Q1; ingest 10 metered datapoints (values representing actual kWh); submit period; assert status SUBMITTED | 3 h |
| 7 | Scenario 6 — DOE verification | Authenticate as DOE; submit VerificationReport (baseline=10000, project=2000, leakage=500, conservativenessPct=5); assert `verified_er = 7125` (= floor(7500 × 0.95)); assert period → VERIFIED | 3 h |
| 8 | Scenario 7 — Issuance + levy assertions | Request issuance; approve issuance; assert `net=6627`, `sop=356`, `omge=142` (with conservative floor); assert 3 `CreditUnitBlock` rows minted (net/sop/omge); assert participant account balance = 6627 | 4 h |
| 9 | Scenario 8 — First transfer + CA emission *(needs AV4-329)* | Create a buyer org + account; transfer 3000 units to buyer; assert `CorrespondingAdjustmentEvent` row created with status PENDING_EXPORT; assert block.firstTransferAt populated; assert block.caStatus = PENDING | 4 h |
| 10 | Scenario 9 — BTR export *(needs AV4-330)* | Authenticate as DNA; call `/corresponding-adjustments/btr/IN`; assert our CA event in response; assert event marked EXPORTED with `btrExportedAt` set | 3 h |
| 11 | Scenario 10 — Retirement *(needs AV4-331)* | Retire remaining 3627 units for NDC (buyer side); assert CA event emitted for retirement; assert block.retirementStatus = RETIRED_FOR_NDC; assert retired block moved to RETIREMENT_NDC admin account | 3 h |
| 12 | Negative tests | VIEWER cannot create activity (403); non-DOE cannot validate (403); invalid state transition DRAFT → REGISTERED (409); levy boundary gross=19 → all net, no levies; bad methodology ID → 400; duplicate host authorization → 409 | 4 h |
| 13 | Test runner integration | `pnpm test:a6.4` script in package.json; CI integration via GitHub Actions; conditional on `apps/api/**` or `packages/database/**` path filter | 2 h |
| 14 | Documentation | `docs/A6_4_E2E_TEST.md` with Mermaid sequence diagram of the flow + per-scenario description | 2 h |
| | **Total** | | **39 h** |

### 5.4 Dependencies

- **Phase A + B** — done (scenarios 1–7 testable today).
- **Phase C (AV4-328..333)** — needed for scenarios 8–10 (transfer, CA, BTR, retirement).
- **Test-user provisioning** — extend existing `E2E_SEED=1` seed pattern to create DOE / DNA test users.
- **Ephemeral test environment** — recommend dedicated test org with prefix `e2e_a6.4_*` to avoid polluting production data.

### 5.5 Acceptance criteria

- [ ] All 10 happy-path scenarios pass.
- [ ] All 6 negative tests pass.
- [ ] Test suite runs in < 60 s in CI.
- [ ] Docs include a legible Mermaid sequence diagram.
- [ ] CI gate blocks merges that break any A6.4 scenario.

### 5.6 Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Test isolation — pollutes production data | High | Med | Dedicated `e2e_a6.4_*` prefixed test org + auto-cleanup teardown |
| Rate limiting during test | Med | Low | Paces between calls (0.2 s default); dedicated test-IP allowlist optional |
| DOE / DNA test-user provisioning complexity | Med | Low | Extend `E2E_SEED=1` pattern already in `seed-master-data.ts` |
| Flaky assertions on async lifecycle transitions | Med | Med | Explicit poll+wait helpers; never `sleep(arbitrary)` |

---

## Cross-cutting infrastructure prerequisites

Three items share **common prerequisites** that should be provisioned once up-front:

### Blob store (S3 / Backblaze / compatible)

**Used by:** AV4-335 (PDD attachments), AV4-337 (SDG evidence), AV4-338 (MRV archive).

**Recommended choice:** Backblaze B2 — S3-compatible, lowest egress cost (~$10/TB vs S3's ~$90/TB), sufficient durability (11×9s), avoids AWS lock-in.

**Configuration:**
- Bucket per environment: `aurex-prod-blob`, `aurex-staging-blob`.
- Lifecycle: 90 d hot → infrequent access → cold after 2 yr.
- Pre-signed URL pattern (expiry 15 min for reads, 60 min for uploads).
- CORS allowlist for `aurex.in`.

**Effort if not already provisioned:** +8 h (ops + env vars + middleware + unit test).

### Scheduled job infrastructure

**Used by:** AV4-338 (nightly archive).

**Recommended choice:** BullMQ + existing Redis (Redis is already in stack per CLAUDE.md). Avoids adding a new worker runtime.

**Effort if not already provisioned:** +4 h.

### Test-user seed extension

**Used by:** AV4-339 (E2E tests).

**Extend** `packages/database/src/seed-master-data.ts` (existing `E2E_SEED=1` path) to also seed a DOE user and a DNA user with fixed UUIDs + known passwords.

**Effort:** +2 h (bundled into AV4-339 WBS already).

---

## Assumptions

1. **Single-tenant deployment.** If Aurex moves to multi-tenant SaaS, retention policy (AV4-338) may need per-tenant region routing for data residency — add ~8 h for tenant-scoped config.
2. **MapLibre GL chosen** for AV4-335 boundary drawer. Leaflet adds ~3 h (older touch stack).
3. **SDG indicators** — start with UN official 70. If A6.4-SB publishes narrower set before implementation, adjust downward.
4. **Parquet** for AV4-338 archive format. Alternative would be gzipped CSV (simpler, larger); Parquet preferred for column-pruning on large monitoring periods.
5. **No new runtime dependencies outside existing tech stack** — all work uses Node, Express, Prisma, Postgres, Redis, Vitest, React, tanstack-query. The one addition is a Parquet library (AV4-338).

---

## Grand totals

| Item | Effort | Calendar |
|---|---|---|
| AV4-335 PDD builder UI | 64 h | ~8 dev-days |
| AV4-336 BaselineScenario | 30 h | ~4 dev-days |
| AV4-337 SD-Tool | 31 h | ~4 dev-days |
| AV4-338 Retention policy | 24 h | ~3 dev-days |
| AV4-339 E2E test | 39 h | ~5 dev-days |
| Cross-cutting (blob store + scheduler) | 12 h | ~1.5 dev-days |
| **Total for 1 engineer** | **200 h** | **~25 dev-days ≈ 5 calendar weeks** |
| **Total for 2 engineers parallel (BaselineScenario + SD-Tool + Retention in parallel)** | **~120 h wall-clock** | **~15 dev-days ≈ 3 calendar weeks** |

---

## Open decisions for the user

1. **Blob store provider** — Backblaze B2 (recommended, cheapest) vs AWS S3 (default if already in AWS).
2. **Schedule** — sequential (1 eng, 5 weeks) or parallel (2 eng, 3 weeks)?
3. **AV4-339 dependency** — OK to build E2E test incrementally as Phase C lands, or wait until C is fully done?
4. **Retention policy regulator sign-off** — who signs off on the retention doc? (Suggested: legal + compliance lead; blocking for AV4-338 production rollout.)
