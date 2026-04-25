# BioCarbon Tokenization — SPARC Sprint Plan with TDD Test Suites

**Source:** `BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md` + `BIOCARBON_GAP_ANALYSIS.md`
**Scope:** Aurex (primary) + AWD2 (origination handoff). HCE2 explicitly out of scope.
**SPARC framework:** Specification → Pseudocode → Architecture → Refinement → Completion. Each sprint runs the cycle once, with parallel AAT waves at the Refinement stage.
**TDD discipline:** every binding requirement (B1–B24, A1–A9, X1–X5) gets one or more failing tests before any implementation. Tests are RED → GREEN → REFACTOR per Kent Beck.

---

## Sprint 0 — Pre-flight (Week 0, ~5 days)

**Specification**
- Apply for BCR Third-Party authorisation: submit business model, smart-contract architecture spec, audit firm engagement letter, target chain disclosure, double-counting controls. (B1, B21)
- Sign Anticorruption-Bribery Policy + partnership agreement (B2).
- Initiate per-jurisdiction legal classification review (B22).

**Outputs**
- `docs/biocarbon/01-business-model.md`
- `docs/biocarbon/02-architecture-disclosure.md`
- `docs/biocarbon/03-double-counting-controls.md`
- BCR application reference number recorded in CLAUDE.md.

**Deliverable owner:** PM + Compliance (no engineering).
**Gate to Sprint 1:** BCR acknowledgement of receipt (typically 5–10 business days).

---

## Sprint 1 — BCR Adapter + Methodology Extension (Weeks 1–4)

**Goal:** Aurex can talk to BCR's API (or a stub) and represents BCR-eligible methodologies in its catalogue. No on-chain code yet.

### Specification
- **B3** — `BcrRegistryAdapter` interface mirroring `UnfcccRegistryAdapter` (already shipped in AAT-5).
- **B6** — extend `Methodology` model to flag `isBcrEligible: boolean`.
- **B9 / B10 / B11** — guards in service layer (no pooling, no wrapping, whole-ton).
- Adapter envelope: `lockVCC`, `confirmLock`, `notifyMint`, `notifyBurn`, `notifyRetire`, `notifyDelist`, `getStatus`.

### Pseudocode
```ts
interface BcrRegistryAdapter {
  lockVCC(p: { projectId; vintage; units; recipientAccount }): Promise<{ bcrLockId; lockedUnits; expiresAt }>;
  confirmLock(bcrLockId): Promise<{ confirmed: boolean; status }>;
  notifyMint(p: { bcrLockId; chain; tokenContract; tokenId; serialFirst; serialLast }): Promise<{ ok }>;
  notifyBurn(p: { bcrSerialId; reason: 'RETIRE'|'DELIST'; beneficiary?; vintage; amount }): Promise<{ ok; bcrConfirmation }>;
  unlockVCC(bcrLockId): Promise<{ ok }>;  // delist path (B18)
  retireVCC(p: { bcrSerialId; beneficiary; purpose; amount }): Promise<{ ok; retirementStatementUrl }>;
  getStatus(bcrSerialId): Promise<'free'|'locked'|'tokenized'|'retired'|'cancelled'>;
}
```

### Architecture
- Mirror the `apps/api/src/services/registries/` pattern.
- Default impl: `DisabledBcrAdapter` (throws "not authorised yet").
- `MockBcrAdapter` for tests (in-memory state machine).
- `LiveBcrAdapter` (Sprint 2 onward) hits BCR's actual API.
- `BcrRegistrySyncEvent` Prisma model for audit trail (parallels `UnfcccRegistrySyncEvent`).

### Refinement (parallel AAT wave)
| AAT | Files | TDD targets |
|---|---|---|
| **AAT-A1** | `services/registries/bcr-adapter.ts`, `services/registries/disabled-bcr-adapter.ts`, `services/registries/mock-bcr-adapter.ts` | RED → GREEN for the 7 adapter methods |
| **AAT-A2** | Schema additions: `Methodology.isBcrEligible`, `BcrRegistrySyncEvent` model + enum | Schema change + Prisma generate |
| **AAT-A3** | Seed: tag VM0042 / VM0007 / VM0033 etc. as BCR-eligible | Seed test |
| **AAT-A4** | Operational dossier: `docs/biocarbon/01-03/*.md` | Doc lint test |

### TDD test suite — Sprint 1

| Test | Asserts | Maps to |
|---|---|---|
| `bcr-adapter.disabled.test.ts > all 7 methods throw "not authorised"` | DisabledBcrAdapter contract | B1 (pre-auth state) |
| `bcr-adapter.factory.test.ts > BCR_REGISTRY_ADAPTER=disabled returns disabled` | Factory keying | B3 |
| `bcr-adapter.factory.test.ts > unsupported value throws clear error` | Factory error path | B3 |
| `bcr-adapter.mock.test.ts > lockVCC moves VCC to locked` | State machine forward | B5 |
| `bcr-adapter.mock.test.ts > notifyMint after lock returns ok` | Lock-then-mint sequencing | B5 |
| `bcr-adapter.mock.test.ts > notifyMint without lock throws` | Mint guard | B5, B12 |
| `bcr-adapter.mock.test.ts > notifyBurn moves locked → retired (when reason=RETIRE)` | Retire path | B17 |
| `bcr-adapter.mock.test.ts > unlockVCC moves locked → free (when reason=DELIST)` | Delist path | B18 |
| `bcr-adapter.mock.test.ts > getStatus returns current state` | Read path | B14 |
| `bcr-adapter.mock.test.ts > retireVCC includes beneficiary in payload` | Beneficiary contract | B16 |
| `methodology.test.ts > isBcrEligible flag persists` | Schema | B6 |
| `methodology.test.ts > seedA64Methodologies tags eligibles` | Seed integrity | B6 |
| `bcr-sync-event.test.ts > each adapter call writes a BcrRegistrySyncEvent` | Audit trail | B20, B24 |

**Completion gate (Sprint 1):** all 13 tests green; `pnpm --filter @aurex/api typecheck` clean; `docs/biocarbon/01–03` reviewed by PM + Compliance.

---

## Sprint 2 — Smart Contracts + Lock-Then-Mint Orchestration (Weeks 5–8)

**Goal:** mint a real ERC-1155 SFT on Polygon Amoy testnet (or LACChain testnet), driven by Aurex's Issuance flow with BCR mock confirming the lock.

### Specification
- **B5, B6, B7, B8** — ERC-1155 contract `BioCarbonVCCToken.sol` with:
  - `mint(to, tokenId, amount, serialIdMetadataURI)` — gated by `MINTER_ROLE`, only when `_locks[bcrLockId].confirmed`.
  - `burn(tokenId, amount, reason)` — emits `BcrBurnRequested` event for the burn-on-retirement hook (B17).
  - **Immutable metadata** — `tokenURI(id)` is set once at mint, frozen thereafter. Serial ID enforced (B6).
  - Whole-ton enforcement: `amount` must be integer; transfer guards reject sub-1 amounts (B11).
  - No `setApprovalForAll` to non-whitelisted addresses (B15 prep).
- **B19** — choose Polygon PoS (mainnet) / Polygon Amoy (testnet) as default. Document in `docs/biocarbon/04-chain-decision.md`. LACChain alternative as Plan B.
- **B23** — emergency pause: `Pausable` mixin gated by BCR's third-party admin role (audit cooperation, B24).

### Pseudocode (contract sketch)
```solidity
contract BioCarbonVCCToken is ERC1155, AccessControl, Pausable {
    mapping(uint256 => string) private _tokenURIs;       // immutable post-mint
    mapping(uint256 => bytes32) public bcrSerialIdHash;  // tamper-evident
    mapping(bytes32 => Lock) private _locks;             // bcrLockId → confirmed?

    function mint(address to, uint256 id, uint256 amount, string calldata uri_, bytes32 lockId, bytes32 serialIdHash)
        external onlyRole(MINTER_ROLE) whenNotPaused
    {
        require(_locks[lockId].confirmed, "BCR lock not confirmed");
        require(_tokenURIs[id].length == 0, "metadata frozen");
        require(amount > 0 && amount == uint256(uint128(amount)), "whole-ton only");
        _tokenURIs[id] = uri_;
        bcrSerialIdHash[id] = serialIdHash;
        _mint(to, id, amount, "");
        emit MintedAgainstLock(id, lockId, serialIdHash);
    }

    function burn(uint256 id, uint256 amount, BurnReason reason, bytes calldata beneficiaryRef)
        external whenNotPaused
    {
        _burn(msg.sender, id, amount);
        emit BcrBurnRequested(id, amount, reason, beneficiaryRef);
    }
}
```

### Architecture
- New monorepo package `@aurex/contracts` with Hardhat or Foundry.
- Off-chain orchestrator: `apps/api/src/services/tokenization.service.ts` calls BCR adapter + then submits the on-chain mint via `viem` (modern, lightweight; better TS support than ethers v6 in 2026).
- Contract artifacts versioned + deployed via deterministic CREATE2 for chain portability.
- Indexer (BullMQ + viem `watchContractEvent`) listens for `BcrBurnRequested` and triggers the `bcr-adapter.notifyBurn()` API call (closing the loop).

### Refinement (parallel AAT wave)
| AAT | Files | Asserts |
|---|---|---|
| **AAT-B1** | `packages/contracts/contracts/BioCarbonVCCToken.sol` + Foundry tests | Contract invariants |
| **AAT-B2** | `services/tokenization.service.ts` + `services/chain.service.ts` (viem wrapper) | Lock-then-mint orchestrator |
| **AAT-B3** | `workers/burn-event.worker.ts` (BullMQ) | On-chain → BCR API roundtrip |
| **AAT-B4** | `routes/tokenization.ts` — POST `/issuances/:id/tokenize` | Public tokenization trigger |

### TDD test suite — Sprint 2

#### Solidity (Foundry)
| Test | Asserts | Maps to |
|---|---|---|
| `BioCarbonVCCToken.t.sol > mint reverts if lock not confirmed` | Lock-then-mint guard | B5 |
| `mint reverts if non-MINTER_ROLE caller` | Role gate | B23 |
| `mint stores tokenURI immutably (second mint with same id reverts)` | Metadata immutability | B6 |
| `mint reverts on amount=0 or fractional via call data` | Whole-ton (B11) | B11 |
| `bcrSerialIdHash matches the hash of the BCR Serial ID` | Serial ID propagation | B6 |
| `1:1 invariant: total supply matches sum of all mints minus burns` | 1:1 backing | B7 |
| `burn emits BcrBurnRequested with reason RETIRE and beneficiaryRef` | Retirement event | B17 |
| `burn emits BcrBurnRequested with reason DELIST` | Delist event | B18 |
| `pause blocks mint and burn but not transferFrom` | Emergency control | B24 |
| `transfer reverts if sender or receiver not in KYC whitelist (post-B15)` | KYC gate | B15 |
| `no setApprovalForAll(0xMarketplace) without owner explicit consent + KYC` | Marketplace consent | B15 |

#### TypeScript (vitest)
| Test | Asserts | Maps to |
|---|---|---|
| `tokenization.service.test.ts > tokenizeIssuance calls BCR.lockVCC first` | Pre-mint lock | B5 |
| `> waits for confirmLock before submitting on-chain mint` | Lock confirmation | B5 |
| `> on-chain mint receipt triggers notifyMint to BCR` | Two-way sync | B3, B14 |
| `> failure during BCR notifyMint records `partial-tokenized` audit event` | Recovery semantics | B20 |
| `chain.service.test.ts > targets configured chain (Polygon Amoy default)` | Chain choice | B19 |
| `chain.service.test.ts > rejects PoW chain config (e.g. Bitcoin RPC)` | Energy guard | B19 |
| `burn-event.worker.test.ts > observed BcrBurnRequested → notifyBurn API call` | End-to-end loop | B17, B18 |
| `burn-event.worker.test.ts > retries 3x on BCR API 5xx` | Resilience | B3 |

**Completion gate (Sprint 2):** all tests green; contract deployed to Polygon Amoy + verified on Polygonscan; one full lock→mint→burn→retire round-trip on testnet against MockBcrAdapter.

---

## Sprint 3 — KYC, Marketplace UI, Two-Way Bridge (Weeks 9–12)

**Goal:** end-user-facing tokenization. KYC gate, public marketplace, retirement flow, two-way bridge for delist.

### Specification
- **B15** — KYC adapter (`KycVerificationAdapter` interface + `SumsubKycAdapter` impl). `KycVerification` Prisma model. Gate transfer + retirement on `kycStatus === 'VERIFIED'`.
- **B13, B14** — public marketplace UI at `/biocarbon/marketplace`. Per-token detail page at `/biocarbon/tokens/:serialId`.
- **B16** — `RetirementBeneficiary` model with verified-identity link. Retirement API extended to capture full beneficiary payload.
- **B18** — two-way bridge: `delistBlock` operation that burns the token AND calls BCR `unlockVCC`. UI affordance "Return to BCR registry".

### Architecture
- KYC adapter pattern matches BCR/UNFCCC adapter pattern.
- Marketplace UI: server-rendered pages with public read access; mutations gated by Aurex auth.
- Retirement payload schema versioned in `@aurex/shared`.

### Refinement (parallel AAT wave)
| AAT | Files | Asserts |
|---|---|---|
| **AAT-C1** | `services/kyc/sumsub-adapter.ts` + Prisma model | KYC verification flow |
| **AAT-C2** | `apps/web/src/pages/biocarbon/marketplace/*` | Public catalogue UI |
| **AAT-C3** | `apps/web/src/pages/biocarbon/tokens/[serialId]` | Token detail explorer |
| **AAT-C4** | `services/delist.service.ts` + `routes/credits.ts:POST /blocks/:id/delist` | Two-way bridge |
| **AAT-C5** | `services/retirement.service.ts` extended retirement payload | Beneficiary capture |

### TDD test suite — Sprint 3

| Test | Asserts | Maps to |
|---|---|---|
| `kyc-adapter.sumsub.test.ts > startVerification returns SumsubVerificationId` | Adapter contract | B15 |
| `kyc-adapter.sumsub.test.ts > webhook handler updates KycVerification.status` | Async webhook | B15 |
| `transfer.guard.test.ts > rejects transfer when sender.kycStatus !== VERIFIED` | KYC gate | B15 |
| `transfer.guard.test.ts > rejects transfer when receiver.kycStatus !== VERIFIED` | Both-side KYC | B15 |
| `marketplace.e2e.test.ts > unauthenticated user can list available tokens` | Public read | B14 |
| `marketplace.e2e.test.ts > token detail page shows project, visuals, BioCarbon attribution` | UI compliance | B13 |
| `marketplace.e2e.test.ts > transaction history visible per token` | Public history | B14 |
| `delist.service.test.ts > delistBlock burns token + calls BCR.unlockVCC` | Two-way bridge | B18 |
| `delist.service.test.ts > delistBlock fails if BCR.unlockVCC errors (rolls back burn)` | Atomic invariant | B18 |
| `retirement.service.test.ts > retire requires verified beneficiary identity` | Beneficiary verification | B16 |
| `retirement.service.test.ts > retirement payload to BCR includes vintage/amount/purpose/beneficiary` | Payload schema | B16, B17 |

**Completion gate (Sprint 3):** all tests green; KYC sandbox integration live; marketplace deployed to staging; one end-to-end retirement on testnet with verified beneficiary.

---

## Sprint 4 — AWD2 Handoff, BCR Live, Production Cutover (Weeks 13–16)

**Goal:** AWD2 → Aurex VCC handoff API live; BCR sandbox → BCR mainnet cutover; production launch.

### Specification
- **A1, A2, A3, A6, A7, A8** — AWD2 handoff API.
- **X1–X5** — cross-cutting integration.
- **B4** — BCR account holder operationalised.
- **B20** — change-management runbook for BCR change notifications.
- **B24** — audit cooperation runbook.

### Architecture
- AWD2 emits `POST /aurex/api/biocarbon/handoff` with verified VCC bundles.
- Aurex receives, creates `Activity` + `Issuance` records, kicks off the Sprint 1–3 pipeline.
- Service-to-service auth via signed JWT (mTLS later).

### Refinement (parallel AAT wave)
| AAT | Repo | Files | Asserts |
|---|---|---|---|
| **AAT-D1** | AWD2 | `app/api/vcc/handoff/route.ts` + matching tests | Handoff emit |
| **AAT-D2** | Aurex | `routes/biocarbon-handoff.ts` (signed-JWT auth) | Handoff receive |
| **AAT-D3** | Aurex | `services/migrations/awd2-import.service.ts` | Initial backfill |
| **AAT-D4** | Aurex | `docs/biocarbon/05-bcr-cutover-runbook.md`, `06-change-mgmt-sop.md`, `07-audit-cooperation.md` | Runbooks |
| **AAT-D5** | Aurex | `tests/biocarbon/e2e-full-lifecycle.test.ts` | End-to-end E2E (matches A6.4 harness pattern) |

### TDD test suite — Sprint 4

| Test | Asserts | Maps to |
|---|---|---|
| `awd2-handoff.test.ts (AWD2 side) > emits signed JWT with handoff payload` | Producer | A1, A8 |
| `awd2-handoff.test.ts > emit fails if checksum invalid` | Integrity | A4 |
| `aurex-handoff.test.ts (Aurex side) > rejects unsigned handoff with 401` | Auth | A8 |
| `aurex-handoff.test.ts > creates Activity + Issuance from valid handoff` | Receive flow | X2 |
| `aurex-handoff.test.ts > deduplicates on duplicate AWD2 plotId` | Idempotency | A1 |
| `awd2-import.service.test.ts > backfill creates one Activity per Plot with completed VCC` | Migration | A9 |
| `e2e-full-lifecycle.test.ts > AWD2 farmer plot → Aurex tokenization → BCR retirement` | Full path | All B + A + X |
| `change-management.test.ts > POST /admin/biocarbon/change-notification calls BCR API` | B20 process | B20 |
| `audit-cooperation.test.ts > GET /admin/biocarbon/audit-bundle bundles contracts + docs + audit reports` | B24 process | B24 |

**Completion gate (Sprint 4):** full E2E passes; BCR mainnet authorisation received (operational, blocks production launch); cutover playbook executed in staging; production launch sign-off by Compliance + Legal + Engineering.

---

## Cross-sprint test framework

```
tests/
├── biocarbon/
│   ├── unit/                     # vitest, runs in CI on every commit
│   │   ├── adapter/              # BCR + KYC adapter tests (Sprint 1, 3)
│   │   ├── orchestrator/         # tokenization.service, delist.service tests (Sprint 2, 3)
│   │   └── handoff/              # AWD2 ↔ Aurex tests (Sprint 4)
│   ├── contracts/                # Foundry tests (Sprint 2)
│   │   └── BioCarbonVCCToken.t.sol
│   ├── integration/              # vitest with real Polygon Amoy + Mock BCR
│   │   └── tokenization-roundtrip.test.ts
│   └── e2e/                      # Playwright + live RPC (Sprint 4)
│       └── e2e-full-lifecycle.test.ts
└── a6.4/                         # existing
```

CI matrix:
- **Unit** runs on every PR.
- **Contracts** run on every PR touching `packages/contracts`.
- **Integration** runs nightly against Polygon Amoy + Mock BCR.
- **E2E** runs pre-deploy + nightly on staging.

---

## Effort summary

| Sprint | Duration | Eng count | Dev-weeks | New tests |
|---|---|---|---|---|
| Sprint 0 | 1 wk | 0 (PM/Legal) | 0 | 0 |
| Sprint 1 | 4 wk | 2 parallel | 8 | ~13 |
| Sprint 2 | 4 wk | 2 parallel | 8 | ~19 |
| Sprint 3 | 4 wk | 2 parallel | 8 | ~11 |
| Sprint 4 | 4 wk | 2 parallel + 1 AWD2 | 12 | ~9 |
| **Total** | **17 wk** | mix | **36** | **~52** |

With the standard 4× AAT parallel pattern (per ADM-058), each 4-week sprint condenses to roughly 2 calendar weeks of wall-clock — total ≈ **9 calendar weeks** for the full BCR alignment.

---

## Jira Epic + child structure

To be created (next phase):

```
EPIC: BioCarbon Tokenization Alignment v1.0 (BCR Third-Party)
├─ Sprint 0 — Pre-flight
│  ├─ [PM] Submit BCR Third-Party authorisation application (B1)
│  ├─ [Legal] Sign Anticorruption-Bribery Policy + partnership agreement (B2)
│  └─ [Legal] Per-jurisdiction legal classification review (B22)
├─ Sprint 1 — BCR Adapter + Methodology Extension
│  ├─ AAT-A1 BcrRegistryAdapter interface + Disabled + Mock impls (B3)
│  ├─ AAT-A2 Schema: Methodology.isBcrEligible + BcrRegistrySyncEvent
│  ├─ AAT-A3 Seed: tag VM0042 / VM0007 / etc. as BCR-eligible
│  ├─ AAT-A4 Operational dossier docs/biocarbon/01–03
│  └─ Tests: 13 RED→GREEN cases per Sprint 1 table
├─ Sprint 2 — Smart Contracts + Lock-Then-Mint
│  ├─ AAT-B1 BioCarbonVCCToken.sol + Foundry tests (B5–B11, B23)
│  ├─ AAT-B2 tokenization.service + chain.service (viem) (B5, B19)
│  ├─ AAT-B3 Burn-event worker + BCR notifyBurn loop (B17, B18)
│  ├─ AAT-B4 Routes: POST /issuances/:id/tokenize
│  └─ Tests: ~19 contract + TS cases
├─ Sprint 3 — KYC, Marketplace UI, Two-Way Bridge
│  ├─ AAT-C1 SumsubKycAdapter + KycVerification model (B15)
│  ├─ AAT-C2 Marketplace UI /biocarbon/marketplace (B13)
│  ├─ AAT-C3 Token detail page /biocarbon/tokens/[serialId] (B14)
│  ├─ AAT-C4 Delist service + route (B18)
│  ├─ AAT-C5 Retirement payload schema (B16)
│  └─ Tests: ~11 cases
├─ Sprint 4 — AWD2 Handoff + BCR Cutover
│  ├─ [AWD2] AAT-D1 Handoff emit API + signed JWT (A1, A8)
│  ├─ [Aurex] AAT-D2 Handoff receive + dedup (X2)
│  ├─ [Aurex] AAT-D3 awd2-import.service backfill (A9)
│  ├─ [Aurex] AAT-D4 Runbooks 05–07
│  ├─ [Aurex] AAT-D5 e2e-full-lifecycle test
│  └─ [Ops] BCR mainnet account-holder operational (B4)
└─ Cross-cutting
   ├─ [X1] Service-to-service identity federation
   ├─ [X3] Methodology catalogue single source of truth
   └─ [X5] tests/biocarbon/ harness
```
