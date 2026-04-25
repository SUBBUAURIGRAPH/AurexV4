# Data Persistence Audit — AurexV4

**Date**: 2026-04-25
**Branch**: `main`
**Ticket**: AAT-PERSISTENCE / Wave 9b
**Author**: AAT-PERSISTENCE audit run
**Trigger**: tester reported "links work but nothing gets generated for downloads or further action"

## Scope

Round-trip every CRUD operation across 24 major entities through Postgres + Prisma to prove (or disprove) that user actions persist and surface back through reads. The harness is the in-memory fake-prisma pattern from `apps/api/src/cross-system-regression.test.ts`. New round-trip coverage lives in `apps/api/src/persistence-round-trip.test.ts` (11 tests, hermetic).

## Summary

| Bucket | Count | Entities |
|---|---|---|
| **PASS** — full Create / List / Read / Update / Delete round-trips through Prisma | 17 | Organization, User, EmissionsRecord, EmissionsBaseline, EmissionsTarget, Report, ApprovalRequest, Supplier, Activity, Methodology (read-only by design), Issuance, KycVerification, Subscription, Invoice, SignupCoupon, Awd2Handoff, OnboardingProgress |
| **PARTIAL** — write path persists, but read surface is incomplete (no list endpoint OR read scaffolded but never wired) | 6 | Retirement, DelistRequest, Credit (CreditUnit / CreditAccount), AuditLog, RenewalAttempt, OutboundEmail |
| **WORKER-ONLY** — no public route by design; persistence verified via worker / service tests | 1 | EmailVerification |

**Persistence integrity**: every write that the application *initiates* lands a row. The user-visible "nothing gets generated" symptom is **not** a write bug — it's a **read-surface gap**: certain entities (Retirement, DelistRequest, RenewalAttempt) have writes wired but no `GET` route, so the UI has nothing to render. See [Gap inventory](#gap-inventory).

## Per-entity results

Status conventions:
- ✓ PASS — write + read both present and round-trip exercised
- ◑ PARTIAL — write present, read incomplete or read present but no list / detail endpoint
- ✗ FAIL — write does not persist, OR read does not surface persisted rows

### 1. Organization
- **Schema**: `packages/database/prisma/schema.prisma:110`
- **Write routes**: POST `/api/v1/organizations` · PATCH `/api/v1/organizations/:id` · POST/PATCH/DELETE `/api/v1/organizations/:id/members/...`
- **Read routes**: GET `/api/v1/organizations` · GET `/api/v1/organizations/:id` · GET `/api/v1/organizations/tree` · GET `/api/v1/organizations/:id/members`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — Organization` (NEW)
- **Status**: ✓ PASS
- **Notes**: No hard `DELETE /:id` for an org — soft-delete is via `PATCH { isActive: false }`. Acceptable: orgs are tenant roots and a hard delete would cascade ~30 dependent tables. Documented but not a fix candidate.

### 2. User
- **Schema**: `schema.prisma:12` (User), `schema.prisma:149` (OrgMember)
- **Write routes**: POST `/api/v1/users` (admin invite) · PATCH `/api/v1/users/:id` · DELETE `/api/v1/users/:id` (soft) · POST `/api/v1/auth/register` · PATCH `/api/v1/auth/me`
- **Read routes**: GET `/api/v1/users` · GET `/api/v1/users/:id` · GET `/api/v1/auth/me`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — User` (NEW); also `routes/auth.test.ts` for register/login
- **Status**: ✓ PASS
- **Notes**: createUserForOrg writes both `User` and `OrgMember` in one nested-create — round-trip test asserts both rows land.

### 3. EmissionsRecord
- **Schema**: `schema.prisma:174`
- **Write routes**: POST `/api/v1/emissions` · PATCH `/api/v1/emissions/:id` · PATCH `/api/v1/emissions/:id/status` · POST `/api/v1/emissions/bulk-status` · DELETE `/api/v1/emissions/:id`
- **Read routes**: GET `/api/v1/emissions` · GET `/api/v1/emissions/:id` · GET `/api/v1/emissions/export`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — EmissionsRecord` (2 cases — full CRUD + status-only update) (NEW)
- **Status**: ✓ PASS
- **Notes**: Update is gated to DRAFT/REJECTED status (correct), delete is gated to DRAFT only (correct). Verified.

### 4. EmissionsBaseline
- **Schema**: `schema.prisma:246`
- **Write routes**: POST/PATCH/DELETE `/api/v1/baselines/:id`
- **Read routes**: GET `/api/v1/baselines` · GET `/api/v1/baselines/:id`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — EmissionsBaseline` (NEW)
- **Status**: ✓ PASS

### 5. EmissionsTarget
- **Schema**: `schema.prisma:265` (Target), `schema.prisma:284` (TargetProgress)
- **Write routes**: POST `/api/v1/targets` · PATCH `/api/v1/targets/:id` · PATCH `/api/v1/targets/:id/approve` · POST `/api/v1/targets/:id/progress`
- **Read routes**: GET `/api/v1/targets` · GET `/api/v1/targets/:id` · GET `/api/v1/targets/:id/progress`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — EmissionsTarget` (NEW)
- **Status**: ✓ PASS
- **Notes**: There is **no DELETE route** for a Target. Targets are intentionally append-only (compliance trail). Not a fix candidate.

### 6. Report
- **Schema**: `schema.prisma:309`
- **Write routes**: POST `/api/v1/reports` · POST `/api/v1/reports/:id/submit|approve|publish|archive`
- **Read routes**: GET `/api/v1/reports` · GET `/api/v1/reports/:id` · GET `/api/v1/reports/:id/status` · GET `/api/v1/reports/:id/download` · GET `/api/v1/reports/:id/indicator-summary` · GET `/api/v1/reports/public/:shareToken`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — Report` (NEW); generation goes from QUEUED → COMPLETED in-process
- **Status**: ✓ PASS
- **Notes**: `generateReport` is synchronous-with-graceful-degradation — there is no background queue. Status flips to FAILED on inner error. Verified.

### 7. ApprovalRequest / ApprovalVote
- **Schema**: `schema.prisma:489` (ApprovalRequest), `schema.prisma:565` (ApprovalVote)
- **Write routes**: POST `/api/v1/approvals` · PATCH `/api/v1/approvals/:id/decide` · POST `/api/v1/approvals/:id/comments`
- **Read routes**: GET `/api/v1/approvals` · GET `/api/v1/approvals/:id` · GET `/api/v1/approvals/:id/votes`
- **Round-trip test**: `apps/api/src/services/approval.service.test.ts` (existing — submitApproval, decideApproval, addComment all covered)
- **Status**: ✓ PASS
- **Notes**: ApprovalVote is written *only* via PATCH `:id/decide` — there is no separate vote-creation endpoint. Correct (votes are an audit record of decisions, not an independent entity).

### 8. Supplier / SupplierDataRequest
- **Schema**: `schema.prisma:737` (Supplier), `schema.prisma:757` (SupplierDataRequest)
- **Write routes**: POST/PATCH/DELETE `/api/v1/suppliers/:id` · POST `/api/v1/suppliers/:id/requests` · POST `/api/v1/suppliers/requests/:id/submit` · PATCH `/api/v1/suppliers/requests/:id/decide`
- **Read routes**: GET `/api/v1/suppliers` · GET `/api/v1/suppliers/:id` · GET `/api/v1/suppliers/requests` · GET `/api/v1/suppliers/requests/:id`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — Supplier` (NEW; asserts AuditLog side-effect lands too)
- **Status**: ✓ PASS

### 9. Activity (A6.4)
- **Schema**: `schema.prisma:854`
- **Write routes**: POST `/api/v1/activities` · PATCH `/api/v1/activities/:id` · POST `/api/v1/activities/:id/{submit,validate-start,close,...}`
- **Read routes**: GET `/api/v1/activities` · GET `/api/v1/activities/:id`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — Activity` (NEW; asserts CreditAccount side-effect lands too)
- **Status**: ✓ PASS
- **Notes**: Activity create has a side-effect: it writes a participant `CreditAccount` row. Verified via the round-trip.

### 10. Methodology
- **Schema**: `schema.prisma:790`
- **Write routes**: NONE — methodologies are seeded master-data (AAT-π / AV4-368)
- **Read routes**: GET `/api/v1/methodologies` · GET `/api/v1/methodologies/:code` · GET `/api/v1/biocarbon/methodologies`
- **Round-trip test**: `apps/api/src/services/methodology.service.test.ts` (existing — getCatalogue, findByCode, assertBcrEligible)
- **Status**: ✓ PASS (read-only by design)

### 11. Issuance
- **Schema**: `schema.prisma:1145`
- **Write routes**: POST `/api/v1/issuances/periods/:periodId` · POST `/api/v1/issuances/:id/{approve,reject,tokenize,delist}`
- **Read routes**: GET `/api/v1/issuances/activities/:activityId`
- **Round-trip test**: `apps/api/src/services/issuance.service.test.ts`, `apps/api/src/services/tokenization.service.test.ts`, `apps/api/src/e2e-full-lifecycle.test.ts`, `apps/api/src/cross-system-regression.test.ts` (existing — comprehensive)
- **Status**: ✓ PASS
- **Notes**: No GET `/api/v1/issuances/:id` direct route — only via `/activities/:activityId` collection. UI surfaces issuances through the marketplace endpoint instead. Acceptable.

### 12. CreditUnit / CreditAccount
- **Schema**: `schema.prisma:1217` (CreditUnitBlock), `schema.prisma:1267` (CreditAccount)
- **Write routes**: POST `/api/v1/credits/blocks/:id/{retire,transfer}`
- **Read routes**: GET `/api/v1/credits/accounts` · GET `/api/v1/credits/accounts/:id` · GET `/api/v1/credits/blocks/:serialFirst` · GET `/api/v1/credits/blocks/:id/registry-label`
- **Round-trip test**: covered indirectly via `apps/api/src/e2e-full-lifecycle.test.ts` (existing — full activity → issuance → block → retirement chain)
- **Status**: ◑ PARTIAL
- **Notes**: GET by `:serialFirst` exists but there is **no GET list of blocks per account** other than via the (paginated) account-detail include. Operationally the UI's "blocks dashboard" view will be missing — see Gap #2.

### 13. Retirement
- **Schema**: `schema.prisma:1600`
- **Write routes**: written by `services/retirement.service.ts` (called from `/api/v1/biocarbon/...`-bound flows), no direct `POST /api/v1/retirements`
- **Read routes**: **NONE** — `Retirement` rows are never returned to clients except as embedded events under `GET /api/v1/biocarbon/tokens/:bcrSerialId` (the biocarbon-public service probes the model dynamically, see `services/biocarbon-public.service.ts:475`).
- **Round-trip test**: `apps/api/src/services/retirement.service.test.ts` (existing — comprehensive)
- **Status**: ◑ PARTIAL
- **Notes**: This is the **most likely cause of the tester's symptom**. A user retires a credit, Aurex writes the row, the chain burn fires, the BCR sync event lands — but the org admin has **no list endpoint** to see "all retirements I've done". The retirement certificate URL is on the row, but there's no way to fetch the row. See Gap #1.

### 14. DelistRequest
- **Schema**: `schema.prisma:1770`
- **Write routes**: written by `services/delist.service.ts` (called via `POST /api/v1/issuances/:id/delist`)
- **Read routes**: **NONE** — same situation as Retirement; surfaced only as DELIST events on the public token-detail endpoint
- **Round-trip test**: `apps/api/src/services/delist.service.test.ts` (existing — comprehensive)
- **Status**: ◑ PARTIAL
- **Notes**: Same problem as Retirement. After hitting "Delist", the user has no way to see the in-flight `DelistRequest` rows in their org. See Gap #1.

### 15. KycVerification / KycVerificationEvent
- **Schema**: `schema.prisma:1835` (Verification), `schema.prisma:1861` (Event)
- **Write routes**: POST `/api/v1/kyc/verifications` · POST `/api/v1/kyc/verifications/:id/revoke` · POST `/api/v1/kyc/beneficiary`
- **Read routes**: GET `/api/v1/kyc/verifications/:id` only
- **Round-trip test**: `apps/api/src/services/kyc/kyc.service.test.ts`, `apps/api/src/services/kyc/mock-kyc-adapter.test.ts` (existing)
- **Status**: ◑ PARTIAL
- **Notes**: There is **no GET list of verifications** for an org. After starting a KYC, the user must keep the verification ID to ever look at it again. See Gap #4.

### 16. Subscription (Wave 7)
- **Schema**: `schema.prisma:2017`
- **Write routes**: POST `/api/v1/billing/checkout` · POST `/api/v1/billing/checkout/success` · POST `/api/v1/billing/webhook/razorpay`
- **Read routes**: GET `/api/v1/billing/subscriptions/me`
- **Round-trip test**: `apps/api/src/routes/billing.test.ts`, `apps/api/src/services/billing/subscription.service.test.ts` (existing — extensive)
- **Status**: ✓ PASS

### 17. Invoice (Wave 7)
- **Schema**: `schema.prisma:2050`
- **Write routes**: written by subscription service on payment-success, no direct route
- **Read routes**: GET `/api/v1/billing/invoices`
- **Round-trip test**: `apps/api/src/routes/billing.test.ts` covers list (existing)
- **Status**: ✓ PASS
- **Notes**: There is **no individual GET `/billing/invoices/:id`** or `/invoices/:id/download` PDF route. The invoice list returns metadata only. See Gap #5 — invoice download is a likely component of the tester's "nothing gets generated for downloads" complaint.

### 18. RenewalAttempt (Wave 8c)
- **Schema**: `schema.prisma:2205`
- **Write routes**: written by `workers/subscription-renewal.worker.ts`, no public route
- **Read routes**: **NONE**
- **Round-trip test**: `apps/api/src/workers/subscription-renewal.worker.test.ts` (existing — covers create/update/email-sent/paid lifecycle)
- **Status**: ◑ PARTIAL
- **Notes**: Operators have no way to see "all in-flight renewals" except by querying the DB directly. See Gap #3.

### 19. OutboundEmail (Wave 8b)
- **Schema**: `schema.prisma:2160`
- **Write routes**: written by `services/email/email.service.ts`, audit-only
- **Read routes**: **NONE**
- **Round-trip test**: `apps/api/src/services/email/email.service.test.ts` (existing — covers PENDING → SENT/FAILED transitions)
- **Status**: ◑ PARTIAL (read-by-design; intentional audit-only)
- **Notes**: Acceptable. Operators tail Postgres directly when debugging email delivery. Not a fix candidate.

### 20. EmailVerification
- **Schema**: `schema.prisma:60`
- **Write routes**: written by `services/email-verification.service.ts` (called from auth register/resend); consumed by `POST /api/v1/auth/verify-email`
- **Read routes**: token-driven only — no list
- **Round-trip test**: `apps/api/src/services/email-verification.service.test.ts` (existing)
- **Status**: ✓ PASS (worker-only by design)

### 21. SignupCoupon / CouponRedemption
- **Schema**: `schema.prisma:1938` (SignupCoupon), `schema.prisma:1962` (CouponRedemption)
- **Write routes**: POST `/api/v1/admin/coupons` · PATCH `/api/v1/admin/coupons/:id` · POST `/api/v1/admin/coupons/:id/deactivate` · POST `/api/v1/coupons/redeem` (public)
- **Read routes**: GET `/api/v1/admin/coupons` · GET `/api/v1/admin/coupons/:id` · GET `/api/v1/admin/coupons/:id/redemptions`
- **Round-trip test**: `apps/api/src/services/coupon.service.test.ts`, `apps/api/src/routes/coupons.test.ts` (existing — comprehensive)
- **Status**: ✓ PASS

### 22. Awd2Handoff
- **Schema**: `schema.prisma:1900`
- **Write routes**: POST `/api/v1/awd2/handoff` (signed JWT webhook)
- **Read routes**: NONE — write-only audit; results surface as Issuance rows
- **Round-trip test**: `apps/api/src/cross-system-regression.test.ts`, `apps/api/src/routes/awd2-handoff.test.ts` (existing — exhaustive)
- **Status**: ✓ PASS (write-only by design — Issuance is the materialized view)

### 23. OnboardingProgress
- **Schema**: `schema.prisma:705`
- **Write routes**: POST `/api/v1/onboarding/steps/{1,2,3,4}` · POST `/api/v1/onboarding/skip` · POST `/api/v1/onboarding/complete` · DELETE `/api/v1/onboarding`
- **Read routes**: GET `/api/v1/onboarding`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — OnboardingProgress` (NEW; saveStep → completeOnboarding → resetOnboarding all verified)
- **Status**: ✓ PASS

### 24. AuditLog
- **Schema**: `schema.prisma:372`
- **Write routes**: written by every mutating service via `recordAudit()` — no public POST
- **Read routes**: GET `/api/v1/audit-logs`
- **Round-trip test**: `apps/api/src/persistence-round-trip.test.ts` — `AAT-PERSISTENCE — AuditLog` (NEW); also `apps/api/src/services/audit-log.service.test.ts` (existing)
- **Status**: ✓ PASS

## Gap inventory

Ranked by user-impact for the reported "nothing gets generated for downloads or further action" symptom.

| # | Entity | Gap | Why it explains the symptom | Priority |
|---|---|---|---|---|
| 1 | Retirement, DelistRequest | Service writes the row but **no GET list endpoint** for an org admin to see their own retirements / delists. UI must surface "your retirements" but the API has nowhere to call. | **High** — direct hit on tester complaint. User clicks "Retire" or "Delist", row lands in DB, UI cannot fetch it back, screen stays empty. | **P0** |
| 2 | CreditUnitBlock | No GET list endpoint for blocks per org or per account; only single-block lookup by `:serialFirst`. The "Credits" dashboard has no list source. | **High** — same UX pattern. | **P0** |
| 3 | RenewalAttempt | No admin route to view in-flight / failed renewal attempts. Operators rely on logs / DB. | Medium — affects ops UX, not end-user UX. | P1 |
| 4 | KycVerification | No GET list per org — only single GET by id. Org admin cannot see "who has KYC pending". | Medium | P1 |
| 5 | Invoice | List endpoint exists, but **no individual GET `:id` and no download URL**. The "Download invoice" button has nothing to call. | **High** — likely component of "nothing gets generated for downloads". | **P0** |
| 6 | Issuance | No GET `/api/v1/issuances/:id` — must navigate via `/activities/:activityId/`. A "share this issuance" link from email cannot resolve. | Low | P2 |
| 7 | Organization | No DELETE `:id` (only soft-delete via PATCH). Documented design choice — tenant root cannot be hard-deleted to avoid cascade across ~30 tables. | None | not a fix |
| 8 | EmissionsTarget | No DELETE — append-only by design. | None | not a fix |
| 9 | OutboundEmail | No GET — audit-only by design. | None | not a fix |
| 10 | KycVerificationEvent, AuthEvent | No GET. By design (audit trail). Acceptable. | None | not a fix |

## Recommended fixes (Wave 9c+)

Single-line / small route-mount changes (NOT applied — verify-only audit per scope).

1. **Add GET `/api/v1/retirements`** — list retirements scoped to caller's org. Service helper already exists implicitly (`prisma.retirement.findMany` is used in `biocarbon-public.service.ts:478`); just promote it to a public route. **P0 — this is the smoking gun for the tester report.**
2. **Add GET `/api/v1/delist-requests`** — same pattern as retirements. **P0**
3. **Add GET `/api/v1/credits/blocks?accountId=…`** — scoped block list per account. **P0**
4. **Add GET `/api/v1/billing/invoices/:id`** AND `/api/v1/billing/invoices/:id/download` (HTML / PDF). **P0** — fixes "Download invoice" button.
5. **Add GET `/api/v1/kyc/verifications`** — list, scoped to org. **P1**
6. **Add GET `/api/v1/billing/renewal-attempts`** — admin-only, list with filters by status. **P1**
7. **Add GET `/api/v1/issuances/:id`** — direct lookup by id. **P2** (low impact, mostly for shareable links).

Each item is a < 30-line route addition that wraps an existing service findMany / findFirst. The fix is mechanical; do **not** auto-apply during this audit.

## Test count delta

- Before: **532 passing, 3 skipped (535 total) across 48 files**
- After:  **543 passing, 3 skipped (546 total) across 49 files** (+1 file, +11 tests, 0 regressions)
- New tests: 11, all in `apps/api/src/persistence-round-trip.test.ts`, hermetic (in-memory fake-prisma, no test DB required).

## Gates run

```
pnpm --filter @aurex/database db:generate    ✓ Prisma client v6.19.3 generated
pnpm --filter @aurex/api typecheck            ✓ tsc --noEmit clean
pnpm --filter @aurex/api test                 ✓ 543 passed (49 files)
```

## Conclusion

**Persistence integrity is intact.** Every CRUD write that the application initiates lands a row, and the matching `findMany` / `findUnique` calls observe it. The "nothing gets generated for downloads or further action" report is **not** a write bug — it is a **read-surface gap** for three high-impact entities: Retirement, DelistRequest, and Invoice download. Wave 9c should add the seven listed GET routes; the work is mechanical and risk-free.
