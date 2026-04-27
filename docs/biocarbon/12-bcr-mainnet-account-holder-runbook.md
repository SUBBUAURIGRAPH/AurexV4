# 12 — BCR Mainnet Account-Holder Onboarding Runbook

**Purpose:** Hand off the BCR mainnet account-holder onboarding to the
non-engineering owners (Compliance, Sales, Finance) and define the
unambiguous resume trigger that brings engineering back into the loop.
**Audience:** Aurex Compliance Lead (primary owner), Aurex Head of Sales
(BCR commercial relationship), Aurex Finance Lead (KYB countersign +
banking), Aurex Engineering on-call (resume-trigger executor).
**Owner:** AAT-R5 / AV4-366 — Sprint 4 ops leg.
**Status:** Draft — covers the BCR documentary and procedural
requirements as of CMA.6+. Specific BCR onboarding desk contacts and
exact form names are intentionally TBD; the Compliance Lead
fills these in on first engagement and updates this runbook in place.
**Companion documents:**
[`./04-bcr-application-email.md`](./04-bcr-application-email.md) —
Third-Party Tokeniser application email (Sprint 1, AV4-341);
[`./07-bcr-cutover-runbook.md`](./07-bcr-cutover-runbook.md) — the
day-of-go-live cutover that consumes the credentials this runbook
produces;
[`./11-aurigraph-tenant-onboarding.md`](./11-aurigraph-tenant-onboarding.md) —
the Aurigraph DLT tenant smoke test that mirrors this flow on the chain
side.

---

## 0. Why engineering can't open this account

The BCR mainnet account-holder agreement is a **commercial + legal
contract** between BCR (BioCarbon Standard) and Aurex as a corporate
entity. It binds Aurex to the BCR Trading Rules, the BCR Anti-Corruption
clause, and the registry's KYB posture. Engineering can wire the API
adapter (the live-v1 implementation lives in
`apps/api/src/services/registries/bcr/` behind the `BCR_REGISTRY_ADAPTER`
env flag), but the underlying account is opened by signed counterparts
between BCR and an Aurex authorised signatory — typically the CFO or a
director-level signatory under the company's signing matrix.

This runbook does **not** ask engineering to forge that signature or
proxy that decision. It maps every blocking item to the human owner who
can actually sign / pay / countersign, and pins a single explicit resume
trigger that brings engineering back in when the credentials are issued.

---

## 1. What an Aurex BCR account-holder agreement requires

This section is the working checklist Compliance + Sales + Finance run
through before approaching BCR. Each row is **blocking** — BCR will not
issue mainnet credentials without all KYB artefacts on file.

| # | Artefact | Owner | Acceptance criterion |
|---|---|---|---|
| 1 | Aurex Certificate of Incorporation (or jurisdictional equivalent) | Compliance Lead | Latest registry-issued copy, ≤ 6 months old, scanned PDF |
| 2 | Memorandum + Articles of Association | Compliance Lead | Current version stamped/registered with the relevant company registry |
| 3 | Beneficial-ownership declaration (UBO) | Compliance Lead | Names + addresses + ID copies for every UBO ≥ 25 % stake; signed by company secretary |
| 4 | Tax registration certificate (PAN / TIN / VAT as applicable) | Finance Lead | Government-issued, current; scanned PDF |
| 5 | Director / authorised-signatory ID + proof of address | Compliance Lead | Passport-grade ID + utility bill / bank statement ≤ 3 months old; signatory must be the same person who countersigns the account agreement |
| 6 | Anti-corruption + sanctions screening pack | Compliance Lead | Sanctions screening report (OFAC / UN / EU / UK / India MEA) ≤ 30 days old; archived alongside KYB pack |
| 7 | Company resolution authorising the BCR account | Compliance Lead + Board | Board resolution naming the signatory; minuted; PDF signed by company secretary |
| 8 | Proof of operational address | Compliance Lead | Office utility bill / lease ≤ 3 months old |
| 9 | Audited financial statements (most recent FY) | Finance Lead | If audited statements not yet available, BCR may accept management accounts + auditor's letter — confirm with the BCR onboarding desk |
| 10 | Aurex<>BCR primary commercial contact | Sales Lead | Name + email + phone of the Aurex relationship owner BCR will route requests through |
| 11 | Aurex banking detail confirmation | Finance Lead | Letterhead from Aurex's bank confirming the account to which BCR will invoice or route fee payments |
| 12 | Counter-signed BCR Anti-Corruption Agreement | Compliance + Legal | Tracked in [`./05-anticorruption-agreement-tracker.md`](./05-anticorruption-agreement-tracker.md) — BCR will not progress without this |
| 13 | Counter-signed BCR Account-Holder Agreement | Authorised Signatory + BCR Secretariat | Final executed PDF on file in `s3://aurex-legal-artifacts/<env>/bcr/account-holder/` |

**Storage:** every artefact lands in
`s3://aurex-legal-artifacts/prod/bcr/onboarding/` with object-lock
retention. Engineering does not need read access — the Compliance Lead
shares only the issued credentials (item 13) with engineering.

**Jurisdiction note:** Aurex operates as an Indian-incorporated entity
(per [`./06-legal-classification-matrix.md`](./06-legal-classification-matrix.md));
artefacts 1–11 above use the Indian-equivalents (CIN certificate, PAN,
GST registration, Aadhaar/PAN-based UBO declarations). If a future
deployment opens a BCR account from a different jurisdiction (US LLC,
UK Ltd, EU SE), Compliance Lead re-runs the classification matrix and
swaps in the local artefact equivalents before re-running this runbook.

---

## 2. Onboarding steps (BCR-side process)

The exact form names + portal URLs change across BCR's procedure
revisions; treat the steps below as the structural flow and confirm
specifics with the BCR onboarding desk on first engagement.

> **BCR onboarding desk contact:** _<TBD — Compliance Lead populates on
> first call. Document email, named contact, phone number, and any
> portal URL handed over.>_

1. **Initial enquiry.** Sales Lead opens the conversation via BCR's
   public contact channel using the application email template in
   [`./04-bcr-application-email.md`](./04-bcr-application-email.md).
   The first reply from BCR Secretariat establishes the named onboarding
   contact (TBD slot above) and the portal / file-share where the KYB
   pack must be uploaded.
2. **KYB submission.** Compliance Lead uploads the full pack from §1
   in the order BCR's portal expects. BCR typically acknowledges within
   3–5 business days; chase weekly via the named contact if not.
3. **Anti-corruption agreement.** BCR returns a counterpart of the
   Anti-Corruption Agreement for Aurex's signature. This is tracked
   separately in
   [`./05-anticorruption-agreement-tracker.md`](./05-anticorruption-agreement-tracker.md);
   countersigned PDF goes back to BCR before account-holder review
   begins.
4. **Account-Holder Agreement.** BCR returns the Account-Holder
   Agreement once KYB clears review. Authorised Signatory countersigns
   via DocuSign (or equivalent); Compliance Lead files the executed PDF
   in the legal-artefacts bucket.
5. **Mainnet credential issuance.** BCR provisions:
   - A **tenant identifier** (`BCR_TENANT_ID`) — the registry's logical
     handle for the Aurex account.
   - An **API key** (`BCR_API_KEY`) — long-lived bearer token issued
     against the tenant. Treated as a high-value secret; rotated per
     §4 below.
   - An **account-holder identifier** (`BCR_ACCOUNT_HOLDER_ID`) — the
     subject id used on issuance/lock/retire payloads.
   These three values are emailed to the named Aurex contact (typically
   the Compliance Lead) and also surfaced inside the BCR portal.
6. **Sandbox dry-run (optional but recommended).** Compliance Lead asks
   BCR to issue a parallel sandbox tenant first; engineering points the
   staging deploy at the sandbox creds, runs the standard biocarbon
   end-to-end smoke (`apps/api/src/e2e-full-lifecycle.test.ts`) against
   the BCR-mock adapter swapped for live-v1, captures artefacts, then
   moves to mainnet with the same procedure.
7. **Mainnet cutover.** Engineering picks up at the resume trigger in
   §3 and runs the cutover steps in
   [`./07-bcr-cutover-runbook.md`](./07-bcr-cutover-runbook.md).

---

## 3. Resume trigger for engineering

Engineering's cue to re-engage is **single, documented, and explicit**:

> **TRIGGER:** Compliance Lead has on file (a) the executed BCR
> Account-Holder Agreement PDF in the legal-artefacts bucket, AND (b) a
> BCR-issued credentials email containing `BCR_TENANT_ID`, `BCR_API_KEY`,
> and `BCR_ACCOUNT_HOLDER_ID`.

When both conditions are true, Compliance Lead opens a Jira issue under
project AV4 with the following payload:

| Field | Value |
|---|---|
| Project | AV4 |
| Issue Type | Task |
| Summary | "BCR mainnet creds delivered — execute live-v1 cutover (AV4-366 follow-on)" |
| Labels | `bcr`, `cutover`, `engineering-resume` |
| Description | Reference the artefact paths in S3 + a redacted copy of the credentials email (subject + sender + date only — secrets stay out of Jira) |
| Assignee | Engineering on-call |

Engineering on-call then runs the
[`./07-bcr-cutover-runbook.md`](./07-bcr-cutover-runbook.md) end-to-end.

**Until the trigger fires, engineering does not poll BCR, does not
chase the BCR Secretariat, and does not file follow-up tickets on
AV4-366 itself.** AV4-366 is closed once this runbook is written; the
cutover work is its own ticket as per the trigger payload above.

---

## 4. Aurex env vars to flip once credentials are live

Engineering, on receiving the resume trigger, sets the following on the
production deploy. The values themselves are read from the BCR
credentials email; they are **not** committed anywhere in the repo.

| Env var | Purpose | Where read |
|---|---|---|
| `BCR_REGISTRY_ADAPTER` | Switch from `disabled` (default) to `live-v1` once creds are live | `apps/api/src/services/registries/bcr/` factory (mirrors the UNFCCC adapter pattern in `apps/api/src/services/registries/index.ts`) |
| `BCR_TENANT_ID` | BCR-issued tenant handle | `apps/api/src/services/registries/bcr/live-v1-adapter.ts` (when the live adapter ships) |
| `BCR_API_KEY` | BCR-issued bearer token | Same adapter; secret — surface via the runtime secret store, never `.env.example` |
| `BCR_ACCOUNT_HOLDER_ID` | BCR-issued subject id used on issuance / lock / retire payloads | Same adapter |
| `BCR_BASE_URL` | Optional — pin to BCR mainnet if BCR ever publishes a separate mainnet host | Same adapter |

Cross-reference the Aurigraph DLT tenant onboarding pattern in
[`apps/api/scripts/aurigraph/tenant-onboarding.ts`](../../apps/api/scripts/aurigraph/tenant-onboarding.ts)
and the equivalent BCR-side smoke (when it lands) under
`apps/api/scripts/bcr/`. Both scripts print the env vars they expect on
startup so an operator can verify the runtime config without reading
the source.

The BCR adapter is the same pattern as the UNFCCC adapter:

- `apps/api/src/services/registries/index.ts` — factory that reads the
  env var and returns a typed adapter; throws on unknown values.
- `apps/api/src/services/registries/bcr/disabled-adapter.ts` — the no-op
  default; every call records an audit row with `synced=false`.
- `apps/api/src/services/registries/bcr/mock-bcr-adapter.ts` — the
  staging mock used today.
- `apps/api/src/services/registries/bcr/live-v1-adapter.ts` — the live
  adapter (ships when AV4-341 / authorisation is in hand).

---

## 5. Rotation + revocation policy

`BCR_API_KEY` is rotated every **90 days** at minimum, or immediately
when:

- A holder of the key leaves Aurex.
- A potentially-compromised host has had the key on disk.
- BCR notifies Aurex of any registry-side anomaly tied to the tenant.

Rotation procedure mirrors §4 of
[`./11-aurigraph-tenant-onboarding.md`](./11-aurigraph-tenant-onboarding.md):

1. Compliance Lead requests a new key from BCR via the named contact.
2. BCR provisions the new key with a 7-day overlap window.
3. Engineering swaps the env var (using the runtime secret store, not a
   redeploy of source) and runs the BCR-side smoke against the new key.
4. Engineering confirms in `#bcr-cutover` Slack; Compliance Lead
   notifies BCR that the old key can be revoked.
5. BCR revokes the old key at the end of the 7-day window.

Revocations are filed against this runbook's row in
[`./05-anticorruption-agreement-tracker.md`](./05-anticorruption-agreement-tracker.md)
so the audit pack always shows a continuous chain of custody.

---

## 6. Owners

| Role | Name | Owns |
|---|---|---|
| Compliance Lead | Aurex Compliance | KYB pack, BCR portal liaison, credentials custody, rotation |
| Head of Sales | Aurex Sales | BCR commercial relationship, initial enquiry, named onboarding contact |
| Finance Lead | Aurex Finance | Tax registration, audited statements, bank-letter, fee invoicing |
| Authorised Signatory | CFO / Director | Counter-signs the Account-Holder Agreement and Anti-Corruption Agreement |
| Engineering on-call | Aurex Engineering | Executes the resume trigger and runs `07-bcr-cutover-runbook.md` |
| Legal Counsel | Aurex Legal (external where required) | Reviews counterparts before any signature |

**Escalation path:** Compliance Lead → Authorised Signatory → CEO. BCR
Secretariat escalation goes through the named onboarding contact first;
fall back to the public BCR support address if the named contact is
unresponsive for > 5 business days.

---

## 7. Done criteria for AV4-366

AV4-366 is **closed** when:

1. This runbook is committed to `docs/biocarbon/` on `main`.
2. The Compliance Lead has acknowledged ownership in writing (Jira
   comment on AV4-366) and confirmed the §3 trigger as the engineering
   resume cue.
3. The TBD onboarding-desk-contact line in §2 is filled in **OR** the
   Compliance Lead has explicitly noted "no contact established yet —
   will update on first engagement".

Engineering does **not** wait for the BCR account to actually open; the
ticket closes on documentation handoff. The follow-on cutover ticket
(named in §3) is created by Compliance Lead when the resume trigger
fires.
