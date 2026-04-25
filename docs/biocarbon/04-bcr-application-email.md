# 04 — BCR Third-Party Authorisation Application Email (Draft)

**Purpose:** Working draft of the cover email Aurex Compliance will send to BCR to initiate Third-Party tokeniser authorisation per §5.5 step 1. The body is ready for copy-paste; meta-fields (intake address, signature block) carry placeholders that Compliance must fill before send.

**Audience:** Aurex Compliance Lead (sender), Aurex Legal (CC), BCR Secretariat (recipient).
**Owner:** Aurex (Aurigraph-DLT-Corp) — ticket AV4-341.
**Status:** Draft for Compliance/Legal review.
**Companion documents:** [`./01-business-model.md`](./01-business-model.md), [`./02-architecture-disclosure.md`](./02-architecture-disclosure.md), [`./03-double-counting-controls.md`](./03-double-counting-controls.md).

---

## Send-meta (verify before send)

| Field | Value |
|---|---|
| To | `<BCR_INTAKE_EMAIL_TBD>` — likely `info@biocarbonregistry.com`; **verify against current §5.5 step 1 procedure / BCR website before sending**. If no public intake address is published, request one from BCR via the contact form at `<TBD>` and update this doc. |
| CC | Aurex Legal (`<LEGAL_DL_EMAIL>`), Aurex Compliance archive (`<COMPLIANCE_ARCHIVE_EMAIL>`) |
| BCC | none |
| Subject | `Application for BCR Third-Party Tokeniser Authorisation — Aurex (Aurigraph-DLT-Corp)` |
| Reply-To | `<COMPLIANCE_LEAD_EMAIL>` |
| Send from | A monitored Aurex compliance mailbox; **never** a personal address |

---

## Email body (copy-paste ready)

> Dear BioCarbon Registry Secretariat,
>
> Aurex, the corporate carbon-accounting and Article 6.4 PACM platform operated by Aurigraph-DLT-Corp, formally applies for authorisation as a Third-Party tokeniser of BCR-issued Verified Carbon Credits (VCCs) under the procedure set out in §5.5 of the BioCarbon Tokenization Guidelines v1.0 (May 3, 2024). This letter and the attached dossier respond to the step-1 application requirements (cover note, business model, smart-contract references, audit-cooperation posture, multi-chain disclosure, and key-personnel signing authority).
>
> Aurex operates the AurexV4 platform in production at https://aurex.in with API surfaces under https://aurex.in/api/v1. Our enterprise customers retire BCR-issued VCCs against CSRD, ESRS E1, BRSR-Core, and voluntary net-zero claims; tokenisation under your Two-Way Bridge model gives those buyers the publicly verifiable proof-of-retirement their auditors and regulators now require. Our business model, target segments, and revenue posture — including the explicit no-pool, no-derivative, fee-on-top-of-credit-price stance that preserves the 1 VCC = 1 token invariant — are described in full in the attached `01-business-model.md`.
>
> Our technical architecture, including the lock-then-mint sequence, immutable BCR Serial ID propagation into Ricardian contract terms, two-way bridge delist path, retirement burn-and-pass-through, audit-cooperation bundle, and chain choice rationale, is described in the attached `02-architecture-disclosure.md`. Smart contracts are deployed via the Aurigraph DLT SDK using the managed `UC_CARBON` Ricardian contract template — token contracts are not user-deployed Solidity bytecode; they are SDK-managed instances of an audited template, one contract per issuance batch (one BCR Serial ID range, one project, one vintage). The vendored SDK is available at `packages/aurigraph-dlt-sdk/` in our repository for BCR review. The Polygon PoS fallback uses an OpenZeppelin ERC-1155 implementation with the same per-batch metadata schema, deployed behind a transparent-proxy pattern with multi-sig governance; full bytecode references are listed in the attached audit-cooperation manifest.
>
> Per §5.5 step 1 we disclose that Aurex tokenises on two non-Proof-of-Work chains: Aurigraph DLT V12 (permissioned PoA, https://dlt.aurigraph.io) as the primary chain, and Polygon PoS as the fallback chain activated only on operator-triggered failover. The cross-chain serial-uniqueness invariant — that a given BCR Serial ID can have at most one active token across the entire Aurex multi-chain footprint at any time — is proved structurally by treating BCR's lock authority as the global arbiter; the formal argument is set out in `03-double-counting-controls.md` together with our nine layered double-counting controls (§B21 disclosure section of `02-architecture-disclosure.md`).
>
> Audit cooperation is provided via a single signed-link endpoint (`GET /admin/biocarbon/audit-bundle`) that exposes contract references, commit SHAs of the deployed AurexV4 release, Foundry test reports for the Polygon fallback, the full `BcrRegistrySyncEvent` lock/mint/transfer/burn/unlock/retire trail, the `AurigraphCallLog` SDK-call log, and DMRV reports for AWD2-originated batches. A formal independent third-party audit report covering the SDK integration and the Polygon fallback contracts is in scope for our Sprint 4 milestone; the audit-bundle inventory in `02-architecture-disclosure.md` lists the artefacts that will be delivered to the auditor and to BCR.
>
> Aurex is committed to signing the BCR Anticorruption-Bribery Policy and the partnership agreement at §5.5 step 3, to becoming a BCR Account Holder at step 5, and to following the full lifecycle pass-through from steps 6 through 15. We will obtain local legal classification opinions per §5.2.b in the jurisdictions we operate in (United States, United Kingdom, European Union, India), and we will notify BCR of any material change to our smart contracts, token distribution, or chain set per §5.3.f.
>
> Our point of contact for this application and for the partnership agreement is `<COMPLIANCE_LEAD_NAME>`, `<COMPLIANCE_LEAD_TITLE>`, reachable at `<COMPLIANCE_LEAD_EMAIL>`. Signing authority for the partnership agreement rests with `<SIGNING_AUTHORITY_NAME>`, `<SIGNING_AUTHORITY_TITLE>`, per the matrix in `05-anticorruption-agreement-tracker.md`. We are available for a video call at BCR's convenience to walk through the architecture and answer any questions ahead of step 3.
>
> Thank you for your time and for the careful design of the BCR Tokenization Guidelines v1.0. We look forward to BCR's response.
>
> Sincerely,
>
> `<COMPLIANCE_LEAD_NAME>`
> `<COMPLIANCE_LEAD_TITLE>`
> Aurex — a business unit of Aurigraph-DLT-Corp
> `<COMPLIANCE_LEAD_EMAIL>` · https://aurex.in

---

## Attachment manifest

The following are attached to (or linked from) the email. Compliance to confirm each is final before send:

1. `01-business-model.md` — business model, conflict-of-interest mitigation, compliance posture.
2. `02-architecture-disclosure.md` — stack diagram, lock-then-mint, metadata immutability, two-way bridge, B21 multi-chain disclosure, B24 audit-bundle.
3. `03-double-counting-controls.md` — nine layered controls + cross-chain invariant + silent-gap acknowledgements.
4. `06-legal-classification-matrix.md` — Aurex's draft legal-classification position per jurisdiction (caveat: not legal advice).
5. Aurex corporate identity pack — certificate of incorporation, beneficial-ownership disclosure, KYC vendor (Sumsub) attestation.
6. Vendored SDK reference — pointer to `packages/aurigraph-dlt-sdk/` in the AurexV4 repository plus a printable PDF export of the SDK README.
7. Public-explorer URL — `https://aurex.in/biocarbon/explorer` (B14 surface) — read-only access for BCR reviewers.

---

## Send-checklist (Compliance must verify before clicking send)

- [ ] BCR intake email confirmed against the current §5.5 step 1 procedure (no stale address from an old PDF).
- [ ] Subject line matches the exact form above; no typos in "Aurigraph-DLT-Corp".
- [ ] All `<PLACEHOLDER>` fields filled — search the document for `<` to confirm none remain.
- [ ] Aurex Legal CC'd on the email; Compliance archive mailbox CC'd.
- [ ] Companion documents (01, 02, 03, 06) attached as PDF exports — links inside the email body resolve when the recipient is *not* on Aurex VPN.
- [ ] Audit-bundle endpoint URL is **not** included in the public email body; signed-link is provisioned only after BCR responds and identifies the auditor.
- [ ] Compliance Lead and Signing Authority names + titles are accurate per current org chart.
- [ ] Customer-count placeholder ("N orgs onboarded") in `01-business-model.md` has been replaced with a verified live-customer count from the production ledger.
- [ ] Date of send recorded in the Compliance archive with a reference to ticket AV4-341.
- [ ] Read-receipt requested; bounce monitored for 72 hours.
- [ ] Reply-To address is a monitored mailbox, not a personal address.
- [ ] Send from a DKIM/DMARC-aligned Aurex domain (no risk of BCR spam-filtering).
- [ ] Legal sign-off recorded (`<LEGAL_SIGNOFF_DATE>`) before send.
