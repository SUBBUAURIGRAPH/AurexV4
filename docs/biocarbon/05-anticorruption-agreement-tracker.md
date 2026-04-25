# 05 — BCR Anticorruption Policy + Partnership Agreement Tracker

**Purpose:** Pre-signature checklist + post-signature tracker for the BCR-supplied Anticorruption-Bribery Policy and partnership agreement that Aurex must counter-sign at §5.5 step 3 (binding requirement B2). Aurex does not draft the agreement; this document drives the legal-review, signing, storage, and renewal workflow around it.

**Audience:** Aurex Legal (primary owner), Aurex Compliance (counter-signer support), Aurex Operations (storage + retention).
**Owner:** Aurex Legal — ticket AV4-342.
**Status:** Draft for Legal review.
**Companion documents:** [`./01-business-model.md`](./01-business-model.md), [`./04-bcr-application-email.md`](./04-bcr-application-email.md), [`./06-legal-classification-matrix.md`](./06-legal-classification-matrix.md), [`../A6_4_RETENTION_POLICY.md`](../A6_4_RETENTION_POLICY.md).

---

## 1. Pre-signature legal-review checklist

The following must be verified by Aurex Legal **before** any Aurex authorised signer counter-signs the BCR-supplied document. Each row should have a sign-off note + date in the executed-tracker section once cleared.

| # | Clause area | What Legal must confirm | Risk if missed |
|---|---|---|---|
| 1 | Jurisdiction + governing law | Forum is acceptable (Aurex preference: neutral seat — Singapore SIAC or London LCIA; Colombian courts acceptable as fallback given BCR domicile) | Forum-shopping disadvantage in dispute |
| 2 | Arbitration / dispute-resolution clause | Tiered: negotiation → mediation → binding arbitration; carve-out for IP injunctive relief | Forced into hostile court system |
| 3 | Indemnity caps | Aggregate cap not greater than 12 months of fees; no carve-outs above cap except for gross negligence / wilful misconduct / IP infringement | Uncapped exposure |
| 4 | Liability scope | Mutual exclusion of indirect / consequential / lost-profit damages; consistent with Aurex master agreement template | One-sided liability transfer |
| 5 | Term + auto-renewal | Initial term ≤ 3 years; renewal explicit not automatic; both parties can terminate for convenience with 90-day notice | Locked into stale terms |
| 6 | Termination triggers | Material breach with 30-day cure; immediate for insolvency, sanctions listing, regulator order; survival of audit + retention obligations | Sudden cut-off mid-tokenisation cycle |
| 7 | IP / data ownership | Aurex retains ownership of platform IP, customer data, and AurexV4 source; BCR retains registry data + Serial ID schemas; no implied licence beyond the partnership scope | Inadvertent IP transfer |
| 8 | Confidentiality scope | Mutual, 5-year tail post-termination, standard exclusions (public domain, independently developed, lawfully obtained); audit-bundle artefacts excluded from confidentiality where regulator-requested | Block on legitimate disclosure |
| 9 | Non-compete / exclusivity | Reject any clause that prevents Aurex from also working with other registries (Verra, GS, ART-TREES) or operating its own A6.4 PACM workflow | Strategic lock-in |
| 10 | Force majeure | Standard list including pandemic, cyber-incident, regulator-directed pause, chain consensus failure; obligation to notify within 5 business days | Unenforceable in real incident |
| 11 | Anticorruption + sanctions | Mutual reps re: FCPA, UK Bribery Act, Colombian Law 1778/2016, OFAC / UN / EU sanctions; right to terminate on counterparty listing | Regulator exposure for Aurex |
| 12 | Data protection + cross-border transfer | GDPR-compliant SCCs where EU data is in scope; DPDP Act 2023 alignment for India data; LATAM data per LGPD / LFPDPPP; data-residency commitments per `01-business-model.md` | Privacy-regulator action |
| 13 | Audit cooperation scope | Aligns with B24 / `02-architecture-disclosure.md` audit-bundle; reasonable notice; auditor confidentiality undertakings; cost allocation defined | Open-ended audit obligation |
| 14 | Change-management trigger language | Aligns with B20 — Aurex notifies BCR of material smart-contract / chain / distribution changes; defines "material" with examples | Ambiguous notify duty |
| 15 | Insurance | E&O / Cyber / D&O coverage at agreed minima, certificate of insurance on request | Underinsured incident exposure |
| 16 | Assignment | No assignment without prior written consent; permitted assignment to affiliate or in change-of-control with notice | Unwanted counterparty substitution |

---

## 2. Aurex signing-authority matrix

Defines which Aurex role has authority to counter-sign which class of document. Drawn from current Aurigraph-DLT-Corp delegation-of-authority policy (Legal to confirm exact thresholds against the live DoA).

| Document type | Counter-signer | Co-signer / second pair of eyes | Notes |
|---|---|---|---|
| BCR Anticorruption-Bribery Policy (pure compliance attestation, no commercial commitment) | Aurex Compliance Lead | Aurex Legal Counsel review note (no co-sign) | Standalone policy; signs as compliance officer |
| BCR Partnership Agreement (commercial + scope) | Aurex CEO **or** delegated Authorised Signatory | Aurex Legal Counsel sign-off memo + Compliance Lead acknowledgement | Commercial agreement; needs full DoA chain |
| Data-Processing Addendum / SCCs (if separate) | Aurex DPO | Aurex Legal | GDPR / DPDP scope |
| Audit-cooperation NDA with BCR-appointed auditor | Aurex Compliance Lead | Aurex Legal | Per-engagement |
| Change-management notice (B20) — material contract / chain change | Aurex Compliance Lead | Aurex CTO acknowledgement | Notice not amendment |
| Amendments materially changing scope, fees, term, indemnity, IP, or jurisdiction | Aurex CEO | Aurex Legal + Aurex Compliance Lead | Treat as new partnership instrument |
| Anything outside the matrix | **Escalate per §5 below** | — | Default deny |

---

## 3. Post-signature artefact storage

Once executed, the partnership agreement and the Anticorruption-Bribery Policy attestation must be stored, indexed, and surfaced for audit.

| Artefact | Storage location | Index key | Retention |
|---|---|---|---|
| Executed PDF (Anticorruption-Bribery Policy) | `s3://aurex-legal-artifacts/<env>/bcr/anticorruption-policy/` (placeholder bucket — Ops to confirm path before first use) | `bcr_anticorruption_<YYYY-MM-DD>.pdf` | Indefinite (compliance attestation) |
| Executed PDF (Partnership Agreement) | `s3://aurex-legal-artifacts/<env>/bcr/partnership-agreement/` | `bcr_partnership_v<N>_<YYYY-MM-DD>.pdf` | Term + 7 years post-termination |
| Counterpart hash (SHA-256) of each PDF | `LegalArtifact` table — DB row joined to a JIRA reference (AV4-342 + future amendments) | row id | Forever |
| Audit-log entry on counter-sign | Aurex audit-trail subsystem; row tagged `BCR_AGREEMENT_SIGNED` with signer + timestamp + IP + JIRA ref | log id | Forever |
| Renewal-trigger calendar entry | Aurex Compliance calendar + JIRA epic (auto-generated 90 days before term end) | calendar id | Until renewal closes |

The `A6_4_RETENTION_POLICY.md` document (verified to exist at `docs/A6_4_RETENTION_POLICY.md`) governs **monitoring-data** retention; it does not currently cover legal-artefact retention. **Open gap:** Aurex needs a separate Legal-Artefact Retention Policy (contracts, attestations, board approvals) — to be authored under a follow-up ticket. Until then, default to "term + 7 years post-termination" per common-law statute-of-limitations envelope, in line with Aurex's master records schedule.

---

## 4. Renewal / change-management triggers (per B20)

Aurex must re-engage BCR (and, depending on the trigger, re-sign or amend) whenever any of the following events occur:

- **Smart-contract upgrade** that changes mint, burn, transfer, metadata, or governance behaviour on either primary (Aurigraph DLT V12) or fallback (Polygon PoS) chain.
- **Chain set change** — adding a third chain, switching the fallback to a different network, or deprecating the Polygon fallback.
- **Token-distribution-model change** — moving from per-batch SFT to a different token model, even if still NFT/SFT (would also require BCR pre-approval per §4.7 conditional clauses).
- **Operator multisig roster change** on the Polygon fallback governance contract.
- **KYC vendor change** (Sumsub → alternate) — affects B15 / B16 pass-through.
- **Material business-model change** — new revenue line, change to fee structure, expansion into a new buyer market not disclosed at application.
- **Change of control** of Aurex or Aurigraph-DLT-Corp.
- **Counterparty regulator action** — sanction listing, enforcement order, material adverse legal finding.
- **BCR Guidelines version bump** (e.g. v1.0 → v2.0) — Aurex initiates compatibility review and amendment if needed.

Each trigger files a JIRA item under the BCR-relations epic and runs the §1 checklist again for the changed scope.

---

## 5. Escalation path — terms outside Aurex signing authority

If BCR proposes terms that fall outside the matrix in §2 (e.g., uncapped indemnity, perpetual non-compete, mandatory revenue share above the agreed fee model, IP-assignment clauses, jurisdiction in a hostile forum):

1. Authorised signer **does not sign**. Escalates to Aurex Legal in writing within 24 hours.
2. Legal opens a JIRA blocker on AV4-342 (or successor ticket) and convenes a review with Compliance + CEO + (where commercial) CFO.
3. Aurex returns a redline within 10 business days; if BCR rejects, the matter escalates to the Aurex Board's Risk + Compliance subcommittee.
4. Board approval is required to sign anything that materially differs from the matrix. The approval memo is filed alongside the executed agreement in the artefact store.
5. If no acceptable terms are reachable, Aurex notifies BCR formally that authorisation cannot proceed and updates this tracker with the closure reason.

---

## 6. Executed-instrument tracker (fill on signature)

| Instrument | Version | Signed by Aurex (name + role + date) | Signed by BCR (name + role + date) | Storage path | JIRA ref |
|---|---|---|---|---|---|
| Anticorruption-Bribery Policy attestation | `<TBD>` | `<TBD>` | `<TBD>` | `<TBD>` | AV4-342 |
| Partnership Agreement v1 | `<TBD>` | `<TBD>` | `<TBD>` | `<TBD>` | AV4-342 |
| Amendment 1 (if any) | `<TBD>` | `<TBD>` | `<TBD>` | `<TBD>` | `<TBD>` |
