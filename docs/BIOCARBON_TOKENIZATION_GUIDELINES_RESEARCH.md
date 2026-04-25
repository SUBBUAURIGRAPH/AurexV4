# BioCarbon Tokenization Guidelines v1.0 — Research Reference

**Canonical PDF:** [globalcarbontrace.io/docs/page/BioCarbon_Tokenization_guidelines.pdf](https://globalcarbontrace.io/docs/page/BioCarbon_Tokenization_guidelines.pdf) — *BIOCARBON CERT. 2024. Tokenization Guidelines. Version 1.0. May 3, 2024. Bogotá, Colombia. 29 p.*

This is the source-of-truth research summary feeding the gap analysis at `BIOCARBON_GAP_ANALYSIS.md` and the SPARC plan at `BIOCARBON_SPARC_PLAN.md`.

---

## 1. Architecture (BCR side)

| Layer | Implementation | Notes |
|---|---|---|
| Registry | Hyperledger Fabric (managed by Global CarbonTrace) | Permissioned; immutability of registry records |
| Public anchor | Stamping.io on LACChain | IDB-led permissioned-public network for LATAM |
| Cross-registry | CAD Trust (World Bank Climate Warehouse) | Cross-registry double-counting prevention |
| Tokenization | **Third-Party only** (BCR does not mint itself) | Out of scope of BCR's own platform |

**Critical:** BCR mints nothing on public chains. Any platform claiming to "tokenize BCR credits" is acting as an authorised **Third-Party** under §5.5 procedure.

---

## 2. Binding requirements (B1–B24)

Direct lift from the guidelines `§5.2 Core / §5.3 Additional / §5.4 Safeguards / §5.5 Procedure`:

| # | Requirement | Source | Platform feature |
|---|---|---|---|
| **B1** | Apply for BCR Third-Party authorisation (email + business model + smart-contract links + audit reports) | §5.5 step 1 | Onboarding doc + audit pipeline |
| **B2** | Sign BCR Anticorruption-Bribery Policy + partnership agreement | §5.5 step 3 | Legal artifact (off-code) |
| **B3** | API integration with BCR registry — full lifecycle pass-through | §5.3.c, §5.5 step 6 | Backend BCR connector |
| **B4** | Become BCR Account Holder | §5.5 step 5 | Operational |
| **B5** | Lock-then-mint sequence (lock VCC on registry → mint 1:1 token) | §5.5 steps 6–8, §5.4.c | Mint contract gated by `lockConfirmed` |
| **B6** | Embed BCR Serial ID in token metadata; preserve until burn | §5.2.a, §4.7.4 | NFT/SFT immutable metadata |
| **B7** | One VCC = one token (1:1) | §5.2.c | Mint contract invariant |
| **B8** | Use NFT (ERC-721) or Semi-Fungible (ERC-1155) only | §5.4.d | Choose 721 / 1155 — not 20 |
| **B9** | No pooling across projects | §5.4.e | Reject pool-style contracts |
| **B10** | No attribute-stripping wrapping | §5.4.d | Disallow wrap mechanics |
| **B11** | No sub-ton fractionalisation without case-by-case BCR approval | §5.4.c | Whole-ton enforcement |
| **B12** | No tokenising already-retired credits | §4.7.3 | Pre-mint status check |
| **B13** | Listing UI: project title, visuals, project page link, "BioCarbon" attribution | §5.5 step 9 | Frontend display contract |
| **B14** | Public token registry / inventory + transaction history UI | §5.5 step 10 | Public explorer / dashboard |
| **B15** | KYC / CDD / AML / CTF + tax compliance on marketplace | §5.1 | Identity stack (Sumsub / Onfido / Persona) |
| **B16** | Beneficiary identity verification + pass-through to BCR on retirement | §5.5 step 13 | Retirement payload schema |
| **B17** | Burn-on-retirement → BCR API call (vintage / amount / purpose / beneficiary) | §5.3.d, §5.5 steps 14–15 | Burn hook → API call |
| **B18** | Two-way bridge: support delist (burn token + unlock VCC on BCR) | §5.5 steps 11.a / 11.b | Reverse-bridge function |
| **B19** | Energy-efficient (non-PoW) blockchain | §5.3.b | Chain selection + disclosure |
| **B20** | Notify BCR of changes — smart contract / distribution / chain | §5.3.f | Change-management process |
| **B21** | Disclose multi-chain tokenisation + double-counting controls at application | §5.5 step 1 | Architecture doc |
| **B22** | Local legal classification (utility / security / commodity) | §5.2.b | Per-jurisdiction legal review |
| **B23** | Token used solely for environmental sustainability + authentic offsetting | §5.3.a | Use-case attestation |
| **B24** | Submit to BCR audit of contracts / documentation | §5.4.f | Audit cooperation runbook |

---

## 3. Lifecycle states (mandatory)

```
ISSUED (free)
  ↓ Third-Party request → BCR locks VCC
LOCKED (B5)
  ↓ Smart contract mint (1:1)
TOKENIZED (B6 + B7 + B8)
  ↓ Listed on Third-Party marketplace
LISTED (B13 + B14)
  ↓ Whole-ton transfers between holders
TRANSFERRED (B11)
  ↓ EITHER: burn → BCR API retire
BURNED + RETIRED (B16 + B17)
  ↓ OR: burn → BCR API unlock (two-way bridge)
DELISTED / UNLOCKED → ISSUED (B18)
```

---

## 4. Conditional / prohibited / nice-to-have

**Conditional (BCR approval required):** sub-ton fractionalisation, wrapping with other env assets, alt token models beyond NFT/SFT, cross-blockchain tokenisation.

**Prohibited:** unauthorised Third-Parties (B1 violation), pooling, fungible-only models that drop Serial ID, listing-before-locking, altering Serial ID, tokenising retired credits, manipulative trading, PoW chains in practice.

**Nice-to-have:** beneficiary-side BCR retirement statement passthrough, non-blockchain-savvy UX.

---

## 5. Silent gaps in v1.0 (platform must self-document)

1. Article 6.2 / 6.4 corresponding-adjustment mechanics
2. ICVCM Core Carbon Principles (CCP) labelling
3. Specific JSON-schema for token metadata (BCR defers to SOP for Serial ID format)
4. Gas / fee / paymaster handling
5. MEV protection for buy-and-retire transactions
6. Slashing / staking / DOE misbehaviour economics
7. Oracle / decentralised MRV trust model
8. Reorg policy / chain finality requirements
9. Bridge security minimum bar (validator threshold, multisig topology)
10. Smart-contract upgradeability (proxy patterns, timelocks, governance)
11. Pause / emergency-stop semantics
12. Privacy / GDPR / beneficiary PII handling
13. Tax treatment / VAT / withholding
14. Royalty / programmable-fee mandates
15. Stranded-token recovery (Third-Party bankruptcy, lost keys)
16. Time-bounded token validity
17. Vintage-bucketing or cohort minting policy
18. Direct cross-registry interop with Verra / GS / ART-TREES (only via CAD Trust by reference)

---

## 6. Authoritative citations

- BCR SOP: https://biocarbonstandard.com/wp-content/uploads/BCR_Standard-Operating-Procedures.pdf
- BCR Avoiding Double Counting tool: https://biocarbonstandard.com/wp-content/uploads/BCR_avoiding-double-counting.pdf
- BCR Handbook v4.0: https://biocarbonstandard.com/wp-content/uploads/BCR_Handbook-and-good-practices.pdf
- ICROA endorsement: https://icroa.org/icroa-endorses-biocarbon-registry-standards/
- LACChain: https://www.lacchain.net/
- Stamping.io: BCR's blockchain gateway (§2.2)
- Thallo two-way bridge (live example): https://www.thallo.io/thallo-biocarbon-registry-launch-worlds-first-two-way-carbon-bridge/

---

## 7. Cross-references to AurexV4 work

- `docs/A6_4_DEFERRED_SOW.md` — Article 6.4 is *adjacent but distinct* from BCR tokenisation; the gap analysis covers what overlaps (DOE, lifecycle, retirement) and what's net-new (NFT/SFT minting, Serial ID propagation, two-way bridge).
- `docs/A6_4_UNFCCC_REGISTRY.md` — adapter pattern from AAT-5 is reusable for BCR API connector (B3).
- `docs/A6_4_RETENTION_POLICY.md` — token registry transparency (B14) shares the audit/retention infrastructure from AV4-338.
