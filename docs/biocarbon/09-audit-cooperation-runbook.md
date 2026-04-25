# 09 — BCR Audit-Cooperation Runbook

**Purpose:** Standing operating procedure for cooperating with BCR audits of Aurex's smart contracts, integration code, and operational records, per binding requirement **B24** of the BioCarbon Tokenization Guidelines v1.0.
**Audience:** Aurex Compliance Lead (audit liaison), Aurex Engineering on-call (data delivery), Aurex Legal (PII review), Aurex Operations (audit-prep drills).
**Owner:** AAT-ο / AV4-363 — Sprint 4 operational leg.
**Status:** Draft — applies once `BCR_REGISTRY_ADAPTER=live-v1` ships.
**Companion documents:** [`./02-architecture-disclosure.md`](./02-architecture-disclosure.md) §"Audit cooperation (B24)"; [`./05-anticorruption-agreement-tracker.md`](./05-anticorruption-agreement-tracker.md); [`./08-change-management.md`](./08-change-management.md); [`../A6_4_RETENTION_POLICY.md`](../A6_4_RETENTION_POLICY.md).

---

## 1. Audit-bundle inventory

The canonical bundle delivered by the `GET /admin/biocarbon/audit-bundle` endpoint is documented in [`02-architecture-disclosure.md`](./02-architecture-disclosure.md) §"Audit cooperation (B24)". This runbook treats that as the **default delivery** and documents the **escalation surface** — what BCR auditors may additionally request and how Aurex satisfies it.

| Tier | Always delivered (canonical bundle) | Available on auditor escalation |
|---|---|---|
| Code | Contract refs (chainId + contractId + terms hash); commit SHAs; Foundry test reports for the Polygon fallback | Slither + MythX raw outputs; full source-code archive at the SHAs requested; build artefacts (Docker image manifests) |
| Sync | Full `BcrRegistrySyncEvent` log | `AurigraphCallLog` slice; `AurigraphProcessedEvent` slice (FAILED_PERMANENT rows in the audit window) |
| MRV | Per-batch DMRV reports linked by project id | Raw monitoring datapoints from `MonitoringDatapoint` (per `A6_4_RETENTION_POLICY.md`) |
| Operations | Cutover-runbook artefacts; change-notice archive | Monitoring telemetry sample (Prometheus snapshot) for the audit window; sample of `AuditLog` rows for `retirement.initiated` / `issuance.tokenized` / `issuance.delist_requested` |
| KYC | KYC vendor name + integration version | KYC-verification log sample (vendor refs only; PII redacted by default) |
| Retirement | Per-retirement statement URLs | Retirement payload samples (B16 pass-through) with PII redacted |

Every escalation item ships through a single signed-link channel — auditors cannot request bulk data via email or out-of-band channels. The signed link expires 14 days after issue and is single-use per auditor account.

---

## 2. Standing audit-prep — quarterly readiness drill

Aurex Compliance runs an internal audit-readiness drill on the first business day of every quarter. The drill simulates a BCR audit so the team's response time and bundle completeness are continuously verified.

**Drill protocol:**

1. Compliance Lead picks a random month inside the prior quarter.
2. For each of the 24 binding requirements (B1–B24), Compliance traces the requirement to a specific evidence artefact in the audit pack:
   - **Code-level**: a test file, a contract source, a deploy commit SHA.
   - **Operational**: a sync-event sample, an audit-log slice, a runbook excerpt.
   - **Legal**: a signed agreement, a counsel opinion, a notice email.
3. Any binding that cannot be traced inside 30 minutes is logged as a **gap** and ticketed under AV4 with a 30-day remediation SLA.
4. The drill output (timestamped trace per binding + gap list) is filed in `s3://aurex-legal-artifacts/<env>/bcr/audit-prep-drills/<YYYY-Qn>/`.
5. The Q4 drill becomes the basis for the annual board attestation that Aurex remains in good standing on all 24 binding requirements.

A drill that completes with zero gaps is logged but does not relax the next quarter's drill cadence — readiness is a continuous property, not a checkbox.

---

## 3. Auditor onboarding — read-access mechanism

Aurex offers BCR-appointed auditors **two delivery options**; the auditor team picks one at engagement kick-off. Aurex's recommendation is **Option B** (pre-curated S3 export) for almost every audit; Option A is reserved for forensic deep-dives that require ad-hoc query access.

### Option A — Read-only Postgres replica

A pre-provisioned read replica of the production database, accessible via Aurex VPN with auditor-specific creds.

- **Pros:** auditors can run arbitrary SQL; lowest data-transfer effort for Aurex.
- **Cons:** PII surfaces are wider (every Postgres column is reachable, even if redacted in the API); auditor onboarding requires VPN cert provisioning + DBA-supervised query review; audit-of-the-audit-log is harder (the auditor's queries are not always recorded).
- **When to pick:** forensic incident response; binding-requirement disputes that need ad-hoc joins across `BcrRegistrySyncEvent` × `AurigraphCallLog` × `Issuance`.

### Option B — Pre-curated S3 export (recommended)

Aurex Compliance assembles a curated, redacted, immutable export tarball at audit kick-off. Auditor receives a single S3 signed-link valid for 30 days, single-download.

- **Pros:** PII redaction is done up-front by Aurex DPO + Compliance, auditable; the export is hash-pinned and re-deliverable for any later re-audit; auditor onboarding is just "give us your IP allowlist and your engagement letter".
- **Cons:** ad-hoc queries require a re-export round-trip; turnaround for follow-up requests is up to 5 business days.
- **When to pick:** every routine audit (annual, recertification, scheduled spot-check).

**Trade-off recommendation:** default to Option B. Switch to Option A only on explicit BCR auditor request with a stated investigative purpose. Document the reason in the audit-engagement memo so the auditor's decision is reviewable post-hoc.

---

## 4. PII handling during audit

The bundle that BCR auditors receive is **PII-redacted by default**. PII handling rules:

| Field class | Default redaction | Surfaced when |
|---|---|---|
| Retiree natural-person name | Hashed (SHA-256, salted with audit-engagement nonce) | Never to BCR; only to law-enforcement under valid subpoena |
| Retiree organisation name | Surfaced verbatim | Always — the retirement statement is publicly attributable per B14 |
| Beneficiary `legalIdRef` (PAN / EIN / etc.) | Hashed (SHA-256, salted with audit-engagement nonce) | Surfaced verbatim only on auditor escalation with stated cause + DPO sign-off |
| Beneficiary `jurisdiction` | Surfaced verbatim | Always — needed to disambiguate legal-id format |
| Customer org user names + emails | Redacted; surfaced as `<userId-uuid>` | Never to BCR auditors; only to internal compliance reviewers |
| KYC vendor refs (Sumsub id etc.) | Surfaced verbatim | Always — these are not PII; they are pointers to the vendor's record |
| KYC verification timestamps | Surfaced verbatim | Always |
| Methodology codes | Surfaced verbatim | Always — not PII |
| `bcrSerialId`, `bcrLockId`, `txHash` | Surfaced verbatim | Always — these are public chain / registry references |
| BCR sync-event `requestPayload` / `responsePayload` JSON | Surfaced verbatim, **with PII fields stripped via the same redaction pipeline as above** | Always |

The redaction pipeline is implemented as a single function `redactForAudit(row)` (to be added under AV4-377 if not already present) so the rules are testable and uniformly applied across all export paths.

---

## 5. Cooperation timeline commitments

Aurex commits to the following SLAs from the moment a BCR audit request is received via the partnership-agreement contact channel:

| Step | SLA | Acknowledgement |
|---|---|---|
| Initial acknowledgement of receipt | 1 business day | Compliance Lead replies confirming the request, names the engagement lead, and starts the audit-engagement memo |
| Canonical audit-bundle delivery | 5 business days | Signed-link to S3 export + checksum |
| Non-PII follow-up data delivery | 5 business days per follow-up | Same channel as bundle |
| PII-bearing data follow-up delivery | 10 business days per follow-up | Includes DPO sign-off + redaction pipeline output |
| Live audit-of-an-audit (Aurex Compliance present) | Within 10 business days of request | DBA + Compliance Lead pair on call |
| Final audit report response | 10 business days from audit close-out | Aurex's acceptance / disagreement memo with corrective-action plan if any gap is found |

The 5-day / 10-day separation is the privacy-review window — PII-bearing data must pass through the DPO desk before delivery.

If Aurex misses any SLA, the cause + recovery plan goes into the next quarterly audit-prep drill report (§2 step 4) and is reviewed by the Risk + Compliance subcommittee.

---

## 6. Escalation matrix — gap discovery

If a BCR auditor finds a gap (missing evidence, contradictory records, binding-requirement non-compliance), the response is tiered.

| Severity | Examples | Response | Owner |
|---|---|---|---|
| **Low** | Documentation typo; a single sync-event row with non-fatal `synced=false`; a runbook out of date | Patch in the next sprint; record in the next quarterly tracker | Engineering |
| **Medium** | A non-blocking binding (e.g. UI attribution drift on a screen) is non-compliant | Patch within 30 days; root-cause memo to BCR; ticket on the BCR-relations JIRA epic | Compliance Lead + Engineering |
| **High** | A blocking binding (e.g. B6 metadata immutability, B17 retirement pass-through, B18 two-way bridge) shows non-compliance on production data | Convene a Risk + Compliance subcommittee meeting within 5 business days; corrective action within 10 business days; written response to BCR within 5 business days | CTO + Compliance Lead + Legal |
| **Critical** | Active double-counting incident; PII leak in audit bundle; BCR Serial ID immutability violated | Page on-call immediately; freeze new mints (`AUREX_TOKENIZATION_DRAIN=1`); freeze events worker; convene the Risk + Compliance subcommittee in emergency session within 24 hours; full incident memo to BCR within 48 hours; corrective action plus board-attestation refresh | CEO + CTO + Compliance Lead + Legal |

Critical incidents trigger the same drain procedure as the cutover-runbook rollback (§4 of [`07-bcr-cutover-runbook.md`](./07-bcr-cutover-runbook.md)) — Aurex's design choice is to fail closed rather than continue accepting state changes whose audit trail is suspect.

---

## 7. Audit close-out artefacts

For every BCR audit (routine or escalated), the following are filed in `s3://aurex-legal-artifacts/<env>/bcr/audits/<YYYY-MM-DD-engagement-id>/`:

- The auditor's engagement letter.
- The redaction pipeline's input/output hashes.
- The signed-link URL + S3 export tarball checksum.
- All follow-up email threads.
- BCR's final audit report.
- Aurex's response memo + corrective-action plan (if any).
- Compliance Lead's hand-off memo to the Board.

These artefacts are the formal evidence of BCR's continued authorisation of Aurex as a Third-Party tokeniser and feed directly into the next year's recertification.
