# 02 — Architecture Disclosure (BCR Third-Party Authorisation Dossier)

**Audience:** BCR Secretariat — application package for §5.5 step 1, satisfies B5, B6, B17, B18, B19, B20, B21, B24.
**Owner:** Aurex (Aurigraph-DLT-Corp).
**Status:** Draft for PM/Compliance review (AV4-347).
**Companion documents:** `01-business-model.md`, `03-double-counting-controls.md`.

---

## Stack diagram

```
                         +-------------------------------+
                         |        AurexV4 Web UI         |
                         | (React/Vite — public B14      |
                         |  explorer + corporate console)|
                         +---------------+---------------+
                                         |
                                         v
                         +-------------------------------+
                         |        AurexV4 API            |
                         |  (Node/Express, Prisma/PG)    |
                         |  /api/v1/biocarbon/...        |
                         +-------+--------------+--------+
                                 |              |
                +----------------+              +-----------------+
                |                                                 |
                v                                                 v
   +-------------------------+                       +-----------------------------+
   |  BcrRegistryAdapter     |                       |  AurigraphDltAdapter        |
   |  (lock / notifyMint /   |                       |  (client.contracts.deploy / |
   |   unlockVCC / retireVCC)|                       |   transfer / burn /         |
   |                         |                       |   governance)               |
   +-----------+-------------+                       +--------------+--------------+
               |                                                    |
               v                                                    v
   +-------------------------+                       +-----------------------------+
   |       BCR API           |                       |  Aurigraph DLT V12          |
   |  (registry of record)   |                       |  permissioned, PoA          |
   |  CAD Trust mirror       |                       |  https://dlt.aurigraph.io   |
   +-------------------------+                       +-----------------------------+
                                                                    ^
                                                                    | (fallback)
                                                                    |
                                                       +-----------------------------+
                                                       |  Polygon PoS                |
                                                       |  (CHAIN_ADAPTER=polygon)    |
                                                       +-----------------------------+

   +-------------------------+
   |        AWD2 API         |  --- signed JWT handoff (HS256, 5-min TTL,
   |  (origination)          |       single-use jti) --->  AurexV4 API
   +-------------------------+
```

All five integration surfaces (BCR adapter, Aurigraph DLT adapter, AWD2 handoff, public explorer, audit-bundle endpoint) are versioned under `/api/v1/` with RFC 7807 error envelopes.

## Token model

- **Standard**: Semi-Fungible Token (SFT) — analogous to ERC-1155 — with per-batch metadata. Whole-ton increments only. Satisfies **B8** (NFT/SFT only — never ERC-20) and **B11** (whole-ton, no fractionalisation).
- **Contract pattern**: `UC_CARBON` Ricardian contract template, deployed via Aurigraph DLT SDK `client.contracts.deploy(UC_CARBON, terms)`. **One contract = one issuance batch** (one BCR Serial ID range, one project, one vintage).
- **Rationale**: SFT (rather than NFT-per-credit) gives cheaper transfers when a single batch covers thousands of tCO2e while keeping each credit unit a discrete whole-ton entry; it avoids the fungibility hazard that ERC-20 would introduce. **B7** (1 VCC = 1 token) is preserved at the unit level — every whole-ton balance is a 1:1 shadow of a BCR Serial ID line item.
- **Polygon fallback**: when `CHAIN_ADAPTER=polygon`, an OpenZeppelin ERC-1155 implementation with an equivalent per-batch metadata struct is deployed; the Ricardian contract terms are mirrored in IPFS-pinned JSON.

## Lock-then-mint sequencing (B5)

Four mandatory steps, each audited:

```
  [Step 1]   Aurex API    --- POST /lockVCC (serialId) --->   BCR API
                                                                   |
  [Step 2]                          BCR API   --- bcrLockId --->   Aurex API
                                                                   |
  [Step 3]   Aurex API    --- client.contracts.deploy(           |
                                UC_CARBON,                         |
                                terms { bcrSerialId, ... }) ---> Aurigraph DLT
                                                                   |
                                          contractRef (chain id + tx hash + contract id)
                                                                   |
  [Step 4]   Aurex API    --- POST /notifyMint(bcrLockId,
                                contractRef) --->                BCR API
```

- **Step 3 is gated** by a precondition check: `bcrLockId` must be present in `BcrRegistrySyncEvent` and not yet used. The deploy call **fails closed** if the precondition is missing.
- **Step 4 is required**: if Aurex deploys but cannot reach BCR within the SOP-defined notify window, the contract is auto-paused via `client.governance.pauseContract(reason="bcr_notify_failed")` and an operator alarm is raised. Recovery is via a manual reconciliation runbook (logged in `BcrRegistrySyncEvent`).
- **Audit trail**: every step writes one row to `BcrRegistrySyncEvent` (BCR side) + one row to `AurigraphCallLog` (chain side). The two tables are joinable on `bcrSerialId`. See `03-double-counting-controls.md` for queryable observables.

## Metadata propagation (B6)

- BCR Serial ID is embedded in the deployed contract's `terms.bcrSerialId` field at the moment of `client.contracts.deploy`.
- A SHA-256 hex digest of the canonical Serial-ID-string is **also** stored in `terms.bcrSerialIdHash` for tamper-evident hashing — auditors can re-derive the hash from the BCR record and prove it matches the on-chain value.
- Per **B6**, the Serial ID and its hash are **never altered post-mint**. Aurex enforces this with an `assertMetadataImmutable(contractId)` check in the chain.service layer that:
  - Rejects any `client.contracts.amendTerms` call whose payload touches `bcrSerialId` or `bcrSerialIdHash`.
  - Is duplicated as a contract-level invariant on the Polygon fallback (`require(serialIdLocked == true)` after first mint).
- See AV4-374 for the implementation ticket.

## Two-way bridge — delist path (B18)

Burn token + unlock VCC, atomically:

```
  burn(tokenId, amount)                    [chain-side]
       |
       v
  if burn.success and burn.reason == DELIST:
       POST /unlockVCC(serialId, bcrLockId, amount)    [BCR-side]
       if unlock.success: write DELIST row to BcrRegistrySyncEvent
       if unlock.failure: trigger compensating mint (chain) + alert
```

The compensating-mint path uses a privileged `client.governance.compensatingMint` call that is rate-limited, requires multi-sig approval on the Aurex operator side, and is itself recorded as a separate audit row tagged `COMPENSATING_MINT`. This guarantees that a chain-side burn never strands a credit in the BCR-locked state.

## Retirement (B17)

Burn token + retire VCC:

- Burn is signed by the beneficiary's wallet (or by Aurex on a custodial-buyer's behalf, after KYC).
- Aurex calls BCR `POST /retireVCC` with the full beneficiary payload required by **B16**: KYC-verified identity (Sumsub reference), retirement reason, vintage, amount, and an Aurex retirement-statement URL.
- BCR returns a permanent retirement receipt; Aurex stores the receipt URL on the burn-event row and exposes it on the public B14 explorer.

## Chain choice (B19)

- **Primary**: Aurigraph DLT V12 — permissioned, Proof-of-Authority. Hosted at https://dlt.aurigraph.io. **Non-PoW** per **B19**. Sustainability-only mandate per **B23** (the chain charter prohibits speculative-finance use cases).
- **Fallback**: Polygon PoS — also **non-PoW** (post-Bor/Heimdall, energy-efficient). Activated only when explicit operator decision sets `CHAIN_ADAPTER=polygon`; documented in change-management notice to BCR per **B20**.
- **Rationale**: see chosen-chain decision in `BIOCARBON_GAP_ANALYSIS.md` §0.5 — Aurigraph DLT V12 is the canonical SDK integration; the Polygon path was retained as defence-in-depth against operational risk (chain pause, validator-set issue, latency).

## Multi-chain disclosure (B21)

Chains on which Aurex tokenises BCR VCCs:

1. **Aurigraph DLT V12** (primary) — permissioned PoA, dlt.aurigraph.io.
2. **Polygon PoS** (fallback) — public PoS, used only on operator-triggered failover.

**Cross-chain double-counting prevention**:

- BCR Serial ID is the **global key**. BCR is the lock authority.
- A given Serial ID can only have **one outstanding `bcrLockId`** at a time.
- Aurex's lock-then-mint protocol guarantees that only **one chain** can hold an unburned token referencing that lock — Step 4 records the chain-of-record in BCR's notifyMint payload.
- A second chain cannot mint the same lock because BCR will reject Step 1 (lock already held) and Aurex's adapter rejects Step 3 (`bcrLockId` already consumed).

See `03-double-counting-controls.md` for the formal invariant statement.

## Smart contract upgradeability

- **Primary (Aurigraph DLT V12)**: contracts are managed by the Aurigraph DLT SDK. Aurex does not own the on-chain bytecode. Upgrades follow `client.governance.*` — proposal → review window → operator multi-sig approval → activation. Aurex's role is to **submit** proposals via the SDK; activation is by Aurigraph DLT governance.
- **Fallback (Polygon)**: OpenZeppelin transparent proxy with:
  - **7-day timelock** on every upgrade (placeholder for ops to formalise).
  - **5-of-9 multisig governor** comprised of Aurex CTO, Aurex Compliance, Aurigraph DLT Ops, plus six independent signers (placeholder list to be finalised by operator team).
  - Pause + emergency-stop functions guarded by the same multisig.
- All upgrade actions on either chain are notified to BCR per **B20**.

## Audit cooperation (B24)

Aurex exposes a single endpoint, `GET /admin/biocarbon/audit-bundle`, accessible to BCR-authorised auditors via a one-time signed link issued by Compliance. The bundle contains:

- Deployed contract refs (chainId + contractId + terms hash) for every active issuance batch.
- Commit SHAs of the AurexV4 release deployed at each contract-deploy timestamp.
- **Foundry test reports** for the Polygon fallback contract (forge test --gas-report + slither + mythx outputs).
- **`BcrRegistrySyncEvent` log** — full lock/mint/transfer/burn/unlock/retire trail.
- **DMRV reports** (where applicable) — for AWD2-originated batches, the upstream MRV bundle is linked by project ID.
- **`AurigraphCallLog`** — every SDK call with request/response hashes (full payloads available on auditor request, redacted for PII).

The bundle is signed (Aurex root key) and timestamped; auditors can request a fresh re-issue at any time.
