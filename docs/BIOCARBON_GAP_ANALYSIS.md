# BioCarbon Tokenization — 3-Platform Gap Analysis

**Source guideline:** *BIOCARBON CERT, Tokenization Guidelines v1.0, 3 May 2024.* See `BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md` for the binding-requirements catalogue (B1–B24).

**Scope:** What does each Aurigraph-DLT-Corp platform need to do to align with BCR's third-party tokenization rules?

---

## Executive scope verdict

| Platform | Repo | Domain | Tokenization role | Verdict |
|---|---|---|---|---|
| **Aurex** | `Aurex-V4` | Corporate carbon accounting + A6.4 PACM | Primary tokenizer + marketplace | **In scope — most work** |
| **AWD2** | `AWD2` | Agricultural carbon credits (VM0042, farmer-onboarded), ERC-721 NFTs deployed to Polygon | Origination + has its own contracts | **In scope — needs BCR alignment migration** |
| **HCE2** | `HCE2` | **Hybrid** — CLAUDE.md describes HIPAA/EHR; code has `contracts/carbon_credits/AurigraphCarbonToken.sol` (ERC-20) + `app/agents/carbon_estimation_agent.py` + Project/Parcel/Forest3D models | **Conflicting signals — needs user decision** | **CONDITIONAL — see §0** |

### §0 — HCE2 scope conflict (resolution required before Sprint 1)

Two independent surveys returned different verdicts:

- **Survey A** (read CLAUDE.md): HCE2 is a Hospital Care & EHR Management System. Compliance focus: HIPAA, HITRUST, HL7 FHIR. No carbon role. Out of scope.
- **Survey B** (read code directly): HCE2 contains:
  - `contracts/carbon_credits/AurigraphCarbonToken.sol` — ERC-20 carbon token with `serialNumber`, `projectId`, `vintage`, `methodology`, `verificationBody`, `bufferPoolContribution`, retire/transfer events.
  - `app/agents/carbon_estimation_agent.py` — DMRV agent for biomass + carbon-stock + DMRV-compliance.
  - `Project`, `Parcel`, `Forest3DTree`, `ForestStructureMetrics`, `ForestReconstructionResponse` models.
  - 4 contract roles: `MINTER_ROLE`, `REGISTRY_ROLE`, `AUDITOR_ROLE`, `PAUSER_ROLE`.
  - The Jira project HCE2 has carbon epics (HCE2-13 "Cross-Chain Carbon Token Bridge", HCE2-57 "Blockchain integration for carbon credits").

**Most likely explanation:** HCE2 is a hospital EHR product whose repo also hosts an earlier-phase carbon-credit prototype (or a parallel experiment). The carbon code is real but may be inactive / unowned / scheduled for extraction.

**Three resolution paths — user pick:**

1. **Confirm HCE2 carbon code is dead — out of scope.** Update CLAUDE.md to remove ambiguity; archive `/contracts/carbon_credits/`. Move to AWD2 + Aurex as planned.
2. **Confirm HCE2 carbon code is alive — in scope alongside AWD2.** Treat HCE2 as a *third origination source* analogous to AWD2 (Sprint 4 D-track expanded). HCE2's ERC-20 must be migrated to ERC-721/1155 per B8 (BCR prohibits fungible tokens that drop Serial ID).
3. **Extract HCE2 carbon code to its own repo.** Create a new `Aurigraph-DLT-Corp/biocarbon-tokenization` repo, move `contracts/carbon_credits/` + `carbon_estimation_agent` there, keep HCE2 as pure EHR.

**Default in this plan:** Path 1 — HCE2 is out of scope until the user confirms otherwise. Sprint 4's AAT-D track has an optional **AAT-D6** (HCE2 ERC-20 → ERC-1155 migration) that activates only if path 2 is chosen.

The rest of this analysis covers Aurex + AWD2 in detail; HCE2 references appear only in optional/conditional sections.

---

## 1. Aurex (AurexV4) — gap matrix

**Current state:** Phase A/B/C of Article 6.4 already shipped (commit `9caacf2` + retention + UNFCCC scaffold + PDD wizard + E2E). 14/14 live E2E pass. Existing primitives reusable for BCR work:

- `Activity` model — project-level mitigation activity with crediting period, methodology, host country (per A6.4).
- `Methodology` catalogue — read-only registry of methodologies (currently 8 A6.4-STAN-METH-* entries; can add BCR's VM0042 / VM0007 / etc.).
- `CreditUnitBlock` — 13-field registry-aligned schema with `serialFirst`/`serialLast`, `unitType`, `vintage`, `caStatus`, `retirementStatus`. **Already supports the kind of metadata BCR's Serial ID requires.**
- `Issuance` with SOP/OMGE levy semantics (transferable to BCR's lock-then-mint pattern).
- `Transaction` ledger (transfer + retirement + reversal).
- `CorrespondingAdjustmentEvent` — A6.4 mechanic, not directly applicable to BCR but the infrastructure for "external registry sync events" is reusable.
- `UnfcccRegistryAdapter` interface (AAT-5) — the adapter pattern is **directly reusable** for a `BcrRegistryAdapter`.
- DOE / DNA / SB_OBSERVER roles — DOE maps cleanly to BCR's third-party verifier role.
- Audit log + retention policy + BullMQ scheduling — reusable.

### Gap matrix per binding requirement

| # | Binding requirement | Aurex status | Effort | Notes |
|---|---|---|---|---|
| **B1** | Apply for BCR Third-Party authorisation | ❌ Not done | S (operational) | Email registry@biocarbonstandard.com + business model + smart-contract docs + audit reports |
| **B2** | Sign BCR Anticorruption-Bribery Policy + partnership agreement | ❌ Not done | S (legal) | Off-code |
| **B3** | API integration with BCR registry — full lifecycle pass-through | ❌ Not done | M | New service `bcr-registry.service.ts` mirroring `UnfcccRegistryAdapter` shape; methods: `lockVCC`, `confirmLock`, `notifyMint`, `notifyTransfer`, `notifyBurn`, `notifyRetire`, `notifyDelist`, `getStatus` |
| **B4** | Become BCR Account Holder | ❌ Not done | S (operational) | Output of B1 |
| **B5** | Lock-then-mint sequencing | ⚠️ Partial | M | Issuance lifecycle exists but doesn't gate on a remote-lock confirmation. Add `Issuance.bcrLockId` + `Issuance.bcrLockedAt`; mint only fires after BCR API confirms lock |
| **B6** | Embed BCR Serial ID in token metadata; preserve until burn | ⚠️ Partial | S | `CreditUnitBlock.serialFirst` already exists; needs `bcrSerialId String?` field + immutability check in update guards |
| **B7** | One VCC = one token (1:1) | ⚠️ Partial | S | Integer-rounding logic already enforces whole-ton; need contract-level invariant on the on-chain side |
| **B8** | NFT (ERC-721) or Semi-Fungible (ERC-1155) only | ❌ Missing | **L** | No on-chain code today. Recommend ERC-1155 SFT (one ID per VCC batch with whole-ton balance) |
| **B9** | No pooling across projects | ✅ Already | — | Each Activity is independent; no pooling implementation exists |
| **B10** | No attribute-stripping wrapping | ✅ Already | — | No wrap mechanics in code |
| **B11** | No sub-ton fractionalisation | ✅ Already | — | Whole-ton enforcement in `er-calc.service` and `issuance.service` |
| **B12** | No tokenising already-retired credits | ⚠️ Partial | S | Existing `retirementStatus !== ACTIVE` checks; need pre-mint guard that includes BCR's lock status |
| **B13** | Listing UI: project / visuals / page link / "BioCarbon" attribution | ❌ Missing | M | New marketplace page; can extend existing `/credits` UI |
| **B14** | Public token registry / inventory + history UI | ⚠️ Partial | M | `/credits/accounts` + `/credits/blocks/:id` exist behind auth; need a **public** explorer for transparency (B14 is explicit about "accessible to the user") |
| **B15** | KYC / CDD / AML / CTF + tax compliance | ❌ Missing | **L** | New: `KycVerification` model + adapter for Sumsub/Onfido/Persona; gate on transfer/retirement |
| **B16** | Beneficiary identity verification + pass-through to BCR on retirement | ⚠️ Partial | M | Retirement narrative exists; needs structured `RetirementBeneficiary` with verified-identity link |
| **B17** | Burn-on-retirement → BCR API call | ⚠️ Partial | S | `transaction.service.retireBlock` already routes to retirement admin accounts; needs to add the BCR API call (via the new B3 adapter) |
| **B18** | Two-way bridge (delist path) | ❌ Missing | M | New `delistBlock` operation that burns the token AND calls BCR `unlockVCC` — symmetric to retirement but reverses to ISSUED state |
| **B19** | Energy-efficient (non-PoW) blockchain | ❌ Decision pending | S | Recommend Polygon PoS or LACChain (BCR's own anchor chain). Document decision |
| **B20** | Notify BCR of changes | ❌ Not done | S (process) | Change-management runbook |
| **B21** | Disclose multi-chain tokenisation + double-counting controls at application | ❌ Not done | S (doc) | Architecture doc submitted to BCR with B1 |
| **B22** | Local legal classification | ❌ Not done | S (legal) | Per-jurisdiction review |
| **B23** | Token used solely for environmental sustainability | ✅ By design | — | Use-case attestation |
| **B24** | Submit to BCR audit | ❌ Not done | S (process) | Audit cooperation SOP |

**Aurex effort total (engineering only, excluding ops/legal):** ~10 dev-weeks for 1 engineer; ~5 calendar weeks with 2 engineers in parallel.

---

## 2. AWD2 — gap matrix

**Current state (corrected after deeper survey):** Next.js 16 + Prisma + PostgreSQL + MinIO + Redis **plus** Solidity 0.8.19 + Hardhat at `/AWD1-1/contracts/contracts/` (the AWD codebase splits across `AWD2` and `AWD1-1` for legacy contract artefacts). Farmer-centric agricultural carbon platform with 8-role RBAC, file-migration audit, GHG calculations (VM0042), approval workflows.

**Carbon-credit infrastructure already shipped:**
- `CarbonCreditNFT.sol` — ERC-721 NFT-per-credit on Polygon mainnet + Mumbai testnet. Per-token `CarbonCredit` struct: `creditId`, `farmer`, `creditsAmount` (kg×1000), `vintageYear`, `projectName`, `issuanceDate`, `isRetired`, `retirementDate`, `retirementReason`, `retiredBy`. Mint gated by `onlyAuthorizedMinter`; retire by token owner; transfer hooks update `farmerTokens[]`.
- `DMRVVerification.sol` — separate contract for DMRV reports with `reportId`, `reportHash` (SHA-256), `waterSaved`, `carbonSequestered`, `verifier`, `verified`, `blockNumber`. Two-step submit + verify flow.
- Prisma `CarbonCredit` model with `creditCode`, `methodology`, `methodologyVersion`, `vvbVerified`, `vvbCertificateUrl`, `registryId` (placeholder), `serialNumbers` (JSON array), `isRetired`.
- Full workflow: Farmer → Field Agent → Supervisor → QAQC → VVB → mint NFT.

**This changes the verdict:** AWD2 is **NOT greenfield** — it's already running ERC-721 NFTs on Polygon. The work is to **align** the existing system with BCR's Serial ID schema, lock-then-mint sequencing, and registry interop, NOT build from scratch.

What AWD2 has that's reusable:

- `Farmer`, `Farm`, `Plot`, `GhgCalculation`, `ApprovalAction` data models.
- 8-role RBAC (ADMIN / SUPERVISOR / FIELD_AGENT / LOCAL_PARTNER / FARMER / APPROVER_L1-L3) — `APPROVER_L3` is conceptually equivalent to a DOE-validated step.
- Audit logging via `DataMigrationLog` + `AuditLog`.
- Production deployment (Docker + Nginx + TLS 1.3).
- File checksum validation (transfers to BioCarbon-style proof requirements naturally).

### Architectural choice — AWD2 already has its own contracts

Three options, **revised** given AWD2 has live Polygon NFTs:

**Option A — AWD2 sunsets its NFT contract; Aurex tokenizes.**
- AWD2's existing `CarbonCreditNFT.sol` is paused for new mints; existing tokens grandfathered.
- AWD2 emits a "VCC issuance ready" event to Aurex; Aurex mints under BCR-aligned contract.
- One BCR adapter, one production contract, one KYC pipeline.
- Cost: migrating AWD2 customers off the existing NFT to the new Aurex-issued one.

**Option B — AWD2 keeps its contract, makes it BCR-compliant.**
- AWD2's `CarbonCreditNFT.sol` (ERC-721) stays — already 1-token-per-credit, already non-PoW (Polygon).
- Add BCR Serial ID fields, lock-then-mint guard, two-way bridge.
- AWD2 applies for its own BCR Third-Party authorisation.
- Aurex's BCR work focuses on its own marketplace + non-AWD activities.
- Cost: two BCR authorisations, two KYC stacks, contract migration of existing AWD2 NFTs.

**Option C — AWD2 keeps contract for legacy; new mints route to Aurex (recommended).**
- AWD2's existing NFT contract becomes a "legacy" registry for credits already issued.
- New issuances flow through Aurex's BCR-aligned contract.
- AWD2 ships the handoff API; Aurex owns all new mints.
- Avoids customer migration; preserves the existing chain history.
- Cost: two contracts coexist; legacy reporting path.

**Recommendation: Option C** unless AWD2's deployed contract has a meaningful user base beyond pilots. The handoff pattern matches how mature carbon platforms (Toucan, Thallo) coexist with origination layers.

### Gap matrix

| # | Requirement | AWD2 status | Effort | Notes |
|---|---|---|---|---|
| **A1** | VCC issuance handoff API to Aurex | ❌ Missing | M | New `POST /api/vcc/handoff` endpoint emitting `{plotId, methodology, vintage, units, ghgCalculationId, verifierId, fileChecksums}` |
| **A2** | BCR Serial ID format conformance for AWD2-originated projects | ❌ Missing | S | Project IDs follow BCR SOP format when registered with BCR |
| **A3** | DOE-equivalent verification step | ⚠️ Partial | M | Existing APPROVER_L3 is internal; needs to map to BCR-recognised VVB. Either contract with a real VVB or formalise APPROVER_L3 + audit trail to satisfy BCR project registration |
| **A4** | File integrity (already done) | ✅ Done | — | Checksum validation already in `data-migration` service |
| **A5** | Project registration on BCR | ❌ Operational | S | Per-project BCR registration before any token can be minted |
| **A6** | KYC / AML on Farmer (not just User) | ⚠️ Partial | S | Farmer model has `governmentId` + photo — extend to a full KYC verification flow with status tracking |
| **A7** | Audit-log enrichment for token-relevant events | ⚠️ Partial | S | Existing AuditLog needs new event types: `VCC_ISSUANCE_PREPARED`, `VCC_HANDED_OFF_TO_AUREX`, `VCC_TOKENIZED_BY_AUREX`, `VCC_RETIRED` |
| **A8** | API authentication with Aurex (mTLS or signed JWT) | ❌ Missing | S | Service-to-service trust |
| **A9** | Backfill existing AWD2 farmer plots into Aurex Activity model | ❌ Missing | M | One-time migration script |

**AWD2 effort total:** ~2 dev-weeks. Most of the heavy lifting moves to Aurex.

---

## 3. HCE2 — conditional, scope decision pending

See §0 above for the conflict resolution. **Default: out of scope.** If user activates path 2 (HCE2 carbon code is alive), the gap matrix below applies.

**HCE2 carbon code current state:**
- `contracts/carbon_credits/AurigraphCarbonToken.sol` — **ERC-20** (BCR-prohibited per B8).
- `app/agents/carbon_estimation_agent.py` — DMRV agent for biomass + carbon-stock + DMRV-compliance.
- `Project`, `Parcel`, `Forest3DTree`, `ForestStructureMetrics`, `ForestReconstructionResponse` Pydantic models.
- 4 contract roles: `MINTER_ROLE`, `REGISTRY_ROLE`, `AUDITOR_ROLE`, `PAUSER_ROLE`.
- Buffer pool tracking already in contract (line 45/157 of AurigraphCarbonToken.sol).
- No Verra / Gold Standard / BCR registry integration; `IRegistry` interface stub at lines 362–369.

| # | Requirement | HCE2 status (if path 2) | Effort | Notes |
|---|---|---|---|---|
| **H1** | Migrate ERC-20 → ERC-1155 (or ERC-721) | ❌ Required by B8 | **L** | Existing ERC-20 violates B8/B10 (drops Serial ID across fungible holders). Hard fork to ERC-1155 with Serial ID per token-id |
| **H2** | Treat HCE2 as origination source like AWD2 | ❌ Not done | M | Same handoff API pattern (§4 X2) |
| **H3** | Forest 3D reconstruction → BCR project metadata | ❌ Not done | S | Map `Forest3DTree`/`ForestStructureMetrics` into PDD-equivalent metadata |
| **H4** | Project lifecycle management | ⚠️ Partial | M | Has `Project` model but no methodology binding, crediting period, baseline scenario |
| **H5** | DMRV agent → BCR-recognised verification report | ❌ Not done | M | `carbon_estimation_agent.py` produces internal compliance scores; needs DOE/VVB sign-off layer |

**HCE2 effort total (path 2 only):** ~4 dev-weeks (mostly contract migration + handoff integration).

---

## 4. Cross-cutting (Aurex ↔ AWD2 integration)

| # | Cross-cutting concern | Owner | Notes |
|---|---|---|---|
| **X1** | Shared identity (Aurex SUPER_ADMIN can act on behalf of AWD2 ADMIN for cross-system audit) | Both | OAuth2 federation or shared Keycloak |
| **X2** | VCC handoff schema (AWD2 → Aurex) | Both | Versioned JSON schema; tracked in `@aurex/shared` |
| **X3** | Single source of truth for methodology catalogue | Aurex | AWD2 reads from `GET /methodologies` rather than maintaining its own list |
| **X4** | Per-project BCR Serial ID lifecycle | Aurex | Aurex owns the BCR connector; AWD2 only ever sees its own AWD-side IDs |
| **X5** | Regression E2E spanning both platforms | Aurex | Extend `tests/a6.4/` harness into `tests/biocarbon/` covering AWD2 → handoff → Aurex tokenization → BCR mock |

---

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| BCR rejects Third-Party authorisation application | M | H | Submit early; AAT-A1 (Sprint 1) prepares the dossier in parallel with code |
| Smart-contract audit findings delay mainnet launch | M | H | Use battle-tested ERC-1155 + OpenZeppelin; engage external audit firm at Sprint 3 boundary |
| BCR API spec changes during build | M | M | Adapter pattern (B3) absorbs changes in one place |
| AWD2 farmer plots don't map cleanly to BCR project structure | M | M | A9 migration script with a per-project review gate before tokenization |
| LACChain capacity / latency unsuitable for production volume | L | M | Polygon PoS as fallback; chain decision documented per B19/B21 |
| Two-way bridge security model not formally specified by BCR (silent gap) | M | M | Adopt 5-of-7 multisig threshold by default; document in self-spec |
| KYC vendor lock-in (Sumsub/Onfido/Persona) | L | L | Adapter pattern for KYC similar to BCR adapter |
| Dual interpretation of "no pooling" (B9) — does cross-project marketplace count? | M | L | Clarify with BCR pre-launch; default conservative (no pools) |

---

## 6. Where the SPARC plan lives

See `BIOCARBON_SPARC_PLAN.md` for the 4-sprint phased delivery with TDD test taxonomies per binding requirement.

---

## 7. Where the Jira Epic lives

Epic to be created in the AV4 project (since Aurex owns the bulk of the work). Cross-system tickets can carry `[AWD2]` or `[X]` prefix in summary. See bottom of `BIOCARBON_SPARC_PLAN.md` for the Epic + child-ticket structure.
