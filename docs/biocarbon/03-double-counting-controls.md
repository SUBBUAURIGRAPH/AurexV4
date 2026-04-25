# 03 — Double-Counting Controls (BCR Third-Party Authorisation Dossier)

**Audience:** BCR Secretariat — application package for §5.5 step 1, satisfies B5, B6, B9, B10, B11, B12, B17, B18, B21, B24.
**Owner:** Aurex (Aurigraph-DLT-Corp).
**Status:** Draft for PM/Compliance review (AV4-347).
**Companion documents:** `01-business-model.md`, `02-architecture-disclosure.md`.

---

## Layered controls

Aurex implements all nine layered controls drawn from the BCR avoiding-double-counting framework (per `BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md` §13 — synthesised from §5.4 safeguards + §13 BCR Avoiding Double Counting tool):

### 1. Pre-tokenisation VCC lock

Every mint is gated by a successful BCR `lockVCC` call (B5). The chain-side `client.contracts.deploy(UC_CARBON, terms)` call **fails closed** if `terms.bcrLockId` is missing or already consumed. Implementation: the chain.service layer reads `BcrRegistrySyncEvent` for an unconsumed `LOCKED` row matching the Serial ID before invoking the SDK.

### 2. Serial ID propagation (immutable)

BCR Serial ID + SHA-256 hash are written into Ricardian contract terms at deploy time (B6). The `assertMetadataImmutable(contractId)` invariant rejects any post-deploy amend that touches `bcrSerialId` / `bcrSerialIdHash`. The Polygon fallback duplicates the invariant via a contract-level `serialIdLocked` flag set on first mint. Auditors can re-derive the hash from BCR records and prove on-chain match.

### 3. No tokenising already-retired credits

The lock request itself is the gate — BCR will reject a `lockVCC` call against a Serial ID in `RETIRED` lifecycle state. Aurex additionally pre-checks the BCR registry status before issuing the lock request (defence-in-depth), and writes the pre-check result to `BcrRegistrySyncEvent` row tagged `PRE_LOCK_STATUS_CHECK`.

### 4. No sub-ton fractionalisation (whole-ton enforcement)

Two-layer enforcement (B11):

- **Zod schema layer** (`@aurex/shared`): all mint/transfer/burn payloads use `z.number().int().positive()` for amount fields. Sub-ton amounts are 4xx-rejected at the API edge with RFC 7807 `type: /problems/whole-ton-required`.
- **chain.service layer**: re-validates integer-amount before SDK call. Polygon fallback contract re-validates with `require(amount % 1 == 0)` (storage uses uint256, so this collapses to the input-shape check).

### 5. No pooling

Aurex does not deploy any pool, vault, AMM, or commingled-balance contract (B9). One contract = one issuance batch (one Serial ID range, one project, one vintage). The marketplace UI lists batches; it does not sum them. The `audit-bundle` endpoint exposes the per-contract Serial-ID mapping so auditors can verify zero pooling.

### 6. No fungible-attribute-stripping

The SFT model preserves project / vintage / methodology attributes on every token unit (B10). There is no wrap, no rebase, no metadata-stripping bridge. Attributes are read from `terms` at every transfer/burn and surfaced in the public B14 explorer. Polygon fallback ERC-1155 carries the same attributes in per-id metadata; no ERC-20 wrapper exists.

### 7. Authorised Third-Party only (BCR account-holder check)

Mint requests originate only from an Aurex operator with a **valid BCR Account Holder credential** (B4 + B7). The Aurex operator-auth middleware reads the active BCR credential from secure config and refuses to issue a `lockVCC` call if the credential is missing/expired. The credential ID is recorded on every `BcrRegistrySyncEvent` row.

### 8. No "list-then-tokenize"

Aurex's marketplace will not list a batch until the lock-then-mint sequence is fully complete (all 4 steps in `02-architecture-disclosure.md` reach success state). The listing API reads chain-of-record from `notifyMint` confirmation; absence of confirmation = batch not listable. This is enforced at the listing-controller and verified by an end-to-end test in CI.

### 9. CAD Trust meta-registry sync (BCR-side)

Aurex relies on **BCR's** existing CAD Trust integration for cross-registry double-counting prevention (BCR mirrors VCC issuance/retirement to CAD Trust per their published procedure). Aurex does not interact with CAD Trust directly; we surface the CAD Trust record URL on the public B14 explorer when BCR provides it on the retirement receipt.

## Cross-chain serial-uniqueness invariant

**Claim:** A given BCR Serial ID can have at most one **active (un-burned) token** across the entire Aurex multi-chain footprint at any given time.

**Proof sketch:**

1. **BCR is the global lock authority.** Every mint requires a `bcrLockId`, issued by BCR exclusively against a Serial ID in `ISSUED (free)` state.
2. **One outstanding lock per Serial ID.** BCR's registry rules state that a Serial ID can be in only one of {`ISSUED`, `LOCKED`, `TOKENIZED`, `LISTED`, `TRANSFERRED`, `RETIRED`, `DELISTED→ISSUED`} at a time. There cannot be two simultaneous `LOCKED` records for the same Serial ID.
3. **One mint per lock.** Aurex's lock-then-mint protocol consumes the `bcrLockId` on Step 3; Step 4's `notifyMint` records the chain-of-record. The adapter refuses to re-use a `bcrLockId` (`AurigraphCallLog` is keyed by `bcrLockId UNIQUE`).
4. **Only one chain holds the asset.** The combined effect of (2) + (3) is that the `LOCKED → TOKENIZED` transition happens exactly once per Serial ID, on exactly one chain.
5. **Burn-then-unlock returns to free.** `unlockVCC` is the only path to make the Serial ID re-mintable; until then, no second chain can lock it.

Therefore the multi-chain footprint cannot harbour two active tokens for the same Serial ID. The invariant is preserved across primary (Aurigraph DLT V12) and fallback (Polygon PoS) without runtime cross-chain coordination — BCR's lock state is the authoritative arbiter.

## Reverse-bridge integrity (B18)

`unlockVCC` is the **only** path back to the `ISSUED (free)` state. The SDK event handler that observes a chain-side `BURN` event branches on the burn reason:

- `reason == DELIST` → trigger `POST /unlockVCC`. On success, BCR transitions Serial ID `TOKENIZED → ISSUED`.
- `reason == RETIRE` → trigger `POST /retireVCC`. On success, BCR transitions Serial ID `TOKENIZED → RETIRED`.
- `reason == OTHER` (operational pause, contract migration, etc.) → trigger compensating-mint to restore the prior state, with multi-sig + audit row.

Burn-without-followup is structurally impossible because the SDK event handler runs synchronously with the burn confirmation; if the BCR call fails, the handler retries with exponential backoff and, on terminal failure, raises a P1 alarm and queues a compensating-mint proposal.

## Failure modes + mitigations

| Failure mode | Detection | Mitigation | Audit row |
|---|---|---|---|
| **Chain reorg** (Polygon-side) | SDK event handler sees burn / mint un-finalised after N confirmations | Wait for finality threshold (Polygon: 256 blocks) before notifying BCR | `AurigraphCallLog` `STATUS=AWAITING_FINALITY` |
| **Partial-tokenized state** (Step 3 succeeds, Step 4 fails) | Reconciliation job: contracts deployed without matching `notifyMint` confirmation within SOP window | Auto-pause contract via `client.governance.pauseContract`, manual reconcile + re-notify | `BcrRegistrySyncEvent` `STATUS=NOTIFY_PENDING` |
| **BCR-side timeout** (any of /lockVCC, /notifyMint, /unlockVCC, /retireVCC) | HTTP timeout / 5xx | Idempotency-key retry with exponential backoff; on terminal failure, P1 alarm + manual SOP | `BcrRegistrySyncEvent` `STATUS=BCR_TIMEOUT` |
| **Compensating-mint required** (burn-without-unlock) | SDK event handler unable to call `unlockVCC` after retries | Multi-sig governance proposal, compensating mint, BCR notification of the operational incident | `AurigraphCallLog` tagged `COMPENSATING_MINT` |
| **Lost private key / stranded token** | Holder-reported, or detected via inactivity heuristic | Per "Stranded-token recovery" SOP (see silent-gap acknowledgement below); recovery path is manual, BCR-notified | `BcrRegistrySyncEvent` tagged `STRANDED_RECOVERY` |

## Audit observables

Every control above maps to a queryable observable:

- **`BcrRegistrySyncEvent`** — one row per BCR API interaction (lock, notifyMint, unlock, retire, status check, reconcile, compensating action). Indexed by `bcrSerialId`, `bcrLockId`, `status`, `timestamp`.
- **`AurigraphCallLog`** — one row per SDK call (`contracts.deploy`, `contracts.transfer`, `contracts.burn`, `governance.*`). Indexed by `bcrLockId`, `contractId`, `txHash`, `status`.
- **`Transaction` ledger** — the canonical AurexV4 ledger row for every business-meaningful event (mint, transfer, retire, delist, fee charge). Joinable to both tables above.

The `audit-bundle` endpoint (B24) exposes all three to BCR auditors via a signed link.

## Compliance gap acknowledgements

`BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md` §5 lists 18 silent gaps in BCR Guidelines v1.0 — areas where the standard does not yet specify behaviour and platforms must self-document. Aurex commits to documenting all 18 in our own internal self-spec ahead of BCR Guidelines v2.0. **Top 5** that we are tracking with priority:

1. **Article 6.2 / 6.4 corresponding-adjustment mechanics** — Aurex pauses tokenisation on any credit flagged for international transfer pending BCR's authorised handling guidance.
2. **ICVCM-CCP labelling** — tracked but not asserted; Aurex will adopt CCP labels once BCR issues mapping guidance.
3. **MEV protection for buy-and-retire transactions** — primary chain (Aurigraph DLT V12) is permissioned PoA so MEV is structurally minimised; Polygon fallback uses private-relay submission for retire transactions.
4. **Gas / fee / paymaster handling** — Aurex pays gas on behalf of retail beneficiaries via a custodial paymaster on the primary chain; on Polygon, an EIP-4337 paymaster is the planned path.
5. **Key-loss / stranded-token recovery** — manual multi-sig recovery via the `STRANDED_RECOVERY` SOP, BCR-notified, with explicit rejection of any "rebase-and-reissue" pattern that would violate B6.

The remaining 13 gaps (DOE economics, oracle/MRV trust model, reorg policy, bridge security minimum, contract-pause semantics beyond the basic governance pause, GDPR PII handling, tax/VAT, royalty mandates, time-bounded validity, vintage cohort policy, direct cross-registry interop, JSON-schema specifics, and Article 6 mechanics finer detail) will be addressed in our self-spec sprint following BCR authorisation.
