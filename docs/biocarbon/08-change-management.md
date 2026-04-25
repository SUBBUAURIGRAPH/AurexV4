# 08 — BCR Change-Management Runbook

**Purpose:** Procedure for notifying BCR of material changes to AurexV4's smart contracts, distribution, or operating posture, per binding requirement **B20** of the BioCarbon Tokenization Guidelines v1.0 (and §5.3.f of the partnership agreement).
**Audience:** Aurex Engineering (change author), Aurex Compliance Lead (notifier), Aurex Legal (review-of-record), Aurex Operations (audit-trail keeper).
**Owner:** AAT-ο / AV4-363 — Sprint 4 operational leg.
**Status:** Draft — applies on day-one of `BCR_REGISTRY_ADAPTER=live-v1`.
**Companion documents:** [`./05-anticorruption-agreement-tracker.md`](./05-anticorruption-agreement-tracker.md) §4 (renewal triggers); [`./07-bcr-cutover-runbook.md`](./07-bcr-cutover-runbook.md); [`./02-architecture-disclosure.md`](./02-architecture-disclosure.md) §"Multi-chain disclosure (B21)" + §"Smart contract upgradeability".

---

## 1. What triggers a change notification

A **material change** that requires advance notice to BCR is any of:

- **Smart-contract changes**:
  - Aurigraph DLT SDK upgrade (any version bump that ships a new mint/burn/transfer/governance code path).
  - `UC_CARBON` Ricardian-template change (terms schema, immutability invariants, retire/burn semantics).
  - Polygon fallback adapter upgrade (proxy implementation swap, governance multisig threshold change, timelock parameter change).
  - Any change to the `bcrSerialId` / `bcrSerialIdHash` immutability guarantee (B6 — extremely rare, treated as B-grade risk by default).

- **Distribution changes** (per binding requirement **B21**):
  - New chain added to the `CHAIN_ADAPTER` enumeration (e.g. moving from `aurigraph-dlt-v12` + `polygon` to a third chain).
  - Polygon fallback retired or replaced with a different L2.
  - Any change that alters the cross-chain serial-uniqueness invariant.

- **KYC vendor change**: switching from the current vendor (e.g. Sumsub) to an alternate. This impacts B15 / B16 pass-through and is itself B-grade.

- **Marketplace UI restructuring** that changes B13 attribution: e.g. token-detail page redesign, change in retirement-statement layout, removal/addition of fields surfaced on the public explorer.

- **Schema changes affecting per-token storage**: any migration that adds, removes, renames, or re-types columns on `Issuance`, `Retirement`, `DelistRequest`, `BcrRegistrySyncEvent`, `KycVerification`, or `AurigraphProcessedEvent`. Index changes are *not* material; column changes are.

**Not** material (no notice required, but record in the change-log tracker):

- Aurex bug fixes that don't touch the contracts / adapters / schema.
- Performance / observability work that doesn't change behaviour visible to BCR.
- UI changes that don't touch B13 attribution.
- Internal refactors with the same external behaviour.

When in doubt, notify. Over-disclosure is cheap; under-disclosure is a B20 violation.

---

## 2. Notification template

Every notification is a single structured email from `compliance@aurex.in` to BCR (the named technical + Secretariat contacts kept in `s3://aurex-legal-artifacts/<env>/bcr/contacts.json`). Subject line:

```
[Aurex Change Notice] <YYYY-MM-DD> <short-title>
```

Body (copy-paste template):

```
Dear BCR Secretariat,

Aurex (Aurigraph-DLT-Corp) is providing advance notice of the following
change to its BCR Third-Party tokeniser integration, per binding
requirement B20 of the BioCarbon Tokenization Guidelines v1.0.

CHANGE DESCRIPTION
------------------
<one-paragraph summary, plain English>

AFFECTED BINDING REQUIREMENTS
-----------------------------
<list — e.g. B6 (metadata immutability), B21 (multi-chain disclosure),
 B24 (audit-bundle inventory)>

AUDIT-BUNDLE DELTA
------------------
- Repository: github.com/Aurigraph-DLT-Corp/AurexV4
- Pre-change commit SHA: <SHA-before>
- Post-change commit SHA: <SHA-after>
- Files changed (paths): <list>
- Tests added / updated: <list>

PROPOSED EFFECTIVE DATE
-----------------------
<UTC date + time, ≥ 14 days from this email for non-urgent changes,
 or "immediate" for security patches with retroactive disclosure>

ROLLBACK PLAN
-------------
<one-paragraph — what we revert to if BCR objects within the notice window>

CONTACT
-------
Compliance Lead: <NAME>, <EMAIL>
Engineering on-call: <PAGER LINK>

Sincerely,
<COMPLIANCE_LEAD_NAME>
Aurex Compliance Lead
```

The compliance archive mailbox is BCC'd on every notice so the email-of-record lands in the legal-artefact bucket automatically.

---

## 3. Timing

| Change class | Advance notice required | Activation gate |
|---|---|---|
| Smart-contract / chain / distribution change | ≥ 14 calendar days | BCR ack OR no objection by day 13 |
| KYC vendor change | ≥ 14 calendar days | BCR ack required (B15 / B16 are blocking) |
| Marketplace UI restructuring affecting B13 | ≥ 7 calendar days | BCR ack OR no objection by day 6 |
| Schema migration affecting per-token storage | ≥ 7 calendar days | BCR ack OR no objection by day 6 |
| Security patch (CVE / active exploit) | Immediate notice; retroactive disclosure | Activate as soon as code is on prod; notice email same business day |

**Best-effort retroactive disclosure** for security patches: the email lands within one business day of activation, includes the full audit-bundle delta, and notes the CVE / threat that justified the urgency. BCR's right of objection is preserved — if BCR objects, Aurex must roll back per §4 of `05-anticorruption-agreement-tracker.md`.

If BCR does not respond by the activation date, the change activates by default. Aurex re-asks BCR for an explicit ack within 5 business days post-activation if silence persists.

---

## 4. Internal review path

Every change-notification is gated by four sign-offs. Each is recorded in the JIRA ticket associated with the change.

```
[1] Change author (Engineering)
       drafts the notification email + attaches the audit-bundle delta
       signs off:  "ready for engineering review"
                   |
                   v
[2] Engineering review (peer engineer + tech lead)
       verifies: (a) audit-bundle delta is complete; (b) tests cover the change;
                 (c) no leakage of customer/PII data in the description.
       signs off:  "ready for compliance review"
                   |
                   v
[3] Compliance review (Compliance Lead)
       verifies: (a) the change is correctly classified as material vs.
                 non-material; (b) timing window is correct; (c) the
                 affected-bindings list is complete.
       signs off:  "ready to send"
                   |
                   v
[4] Send (Compliance Lead)
       sends the email; archives a copy to s3://aurex-legal-artifacts/<env>/bcr/change-notices/<YYYY-MM-DD>/.
       updates the change-log tracker (§6).
```

A change cannot activate until step [4] is complete. Code can land on `main` before the notice goes out, but it cannot ship to production until the notice is sent and (where required) acknowledged.

---

## 5. Audit-trail recording

Every change-notification email and BCR's response is stored alongside the partnership agreement, mirroring the legal-artefact-storage pattern in [`./05-anticorruption-agreement-tracker.md`](./05-anticorruption-agreement-tracker.md) §3.

| Artefact | Storage location | Index key | Retention |
|---|---|---|---|
| Outbound notice email (PDF + raw .eml) | `s3://aurex-legal-artifacts/<env>/bcr/change-notices/<YYYY-MM-DD>-<slug>/` | `<YYYY-MM-DD>-<slug>.pdf` | Term + 7 years post-termination |
| BCR response email (PDF + raw .eml) | same bucket, same prefix | `<YYYY-MM-DD>-<slug>-bcr-response.pdf` | Term + 7 years post-termination |
| SHA-256 of each PDF | `LegalArtifact` table — DB row joined to JIRA reference | row id | Forever |
| Audit log row | Aurex audit-trail subsystem; `BCR_CHANGE_NOTICE_SENT` action | log id | Forever |

The same retention envelope used for the partnership agreement (`05-anticorruption-agreement-tracker.md` §3) applies — change notices are part of the same compliance record and cannot be deleted while the partnership is live.

---

## 6. Quarterly change-log table (template)

Operations copies this table into a new tracker doc at the start of each quarter:

```
| #  | Sent (UTC) | Effective (UTC) | Class            | Title                          | Bindings   | Pre-SHA  | Post-SHA | BCR ack | Rolled back? | Storage path                                       |
|----|------------|-----------------|------------------|--------------------------------|------------|----------|----------|---------|--------------|----------------------------------------------------|
| Q4-1 | 2026-04-01 | 2026-04-15      | Smart-contract   | UC_CARBON terms refine         | B6, B7     | abcd1234 | def56789 | yes     | no           | s3://…/change-notices/2026-04-01-uc-carbon-refine/ |
| Q4-2 |            |                 |                  |                                |            |          |          |         |              |                                                    |
| Q4-3 |            |                 |                  |                                |            |          |          |         |              |                                                    |
```

A blank quarter is a perfectly acceptable outcome — Aurex aims for **fewer** notices, not more.

The Compliance Lead presents the quarterly tracker at the next Risk + Compliance subcommittee meeting for board-level visibility. Any tracker row marked `Rolled back? = yes` is a follow-up agenda item.

---

## 7. Special case — "no-notice" emergency activation

If Aurex must activate an immediate change without prior notice (e.g. live exploit on the chain adapter):

1. Activate under the security-patch policy in §3.
2. Send the notice within 1 business day, marked `URGENT — RETROACTIVE DISCLOSURE`.
3. Open a JIRA blocker on the BCR-relations epic for a written explanation memo to BCR within 5 business days, signed by Aurex CTO + Compliance Lead.
4. The next quarterly Risk + Compliance subcommittee reviews whether the emergency activation was warranted; the reviewer's decision is recorded in the meeting minutes and stored alongside the notice in the artefact bucket.

The default disposition is "warranted" — Aurex's ability to ship security fixes fast is itself a B23 obligation. But the post-hoc review is the discipline that prevents abuse.
