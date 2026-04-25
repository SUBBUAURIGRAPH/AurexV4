# 01 — Business Model (BCR Third-Party Authorisation Dossier)

**Audience:** BCR Secretariat — application package for §5.5 step 1.
**Owner:** Aurex (Aurigraph-DLT-Corp).
**Status:** Draft for PM/Compliance review (AV4-347).
**Companion documents:** `02-architecture-disclosure.md`, `03-double-counting-controls.md`.

---

## Who is Aurex

Aurex is a corporate carbon-accounting and Article 6.4 PACM (Paris Agreement Crediting Mechanism) platform operated by the Aurex business unit of Aurigraph-DLT-Corp. The platform combines (a) GHG inventory + reduction tracking for enterprise customers, (b) UNFCCC A6.4 PACM workflow tooling for project developers, and (c) — under this authorisation — registry-grade tokenisation of BCR-issued Verified Carbon Credits (VCCs).

Aurex is in production at https://aurex.in since 2026-04 with **N orgs onboarded** (placeholder — Compliance to insert verified count from the live customer ledger before submission). The platform runs on the AurexV4 monorepo (Node/Express + React/Vite + Prisma/PostgreSQL), deployed via CI/CD to a managed nginx fleet. Aurex is operationally separate from, but corporately affiliated with, Aurigraph DLT (sibling business unit running the chain at dlt.aurigraph.io) and AWD2 (sibling business unit running farmer-cooperative ARR/ALM origination on Polygon).

## Why we want to tokenise BCR-issued VCCs

Aurex's enterprise customers sign sustainability claims (CDP, CSRD, SBTi, voluntary net-zero pathways) that increasingly require **proof-of-retirement that is publicly verifiable, immutable, and traceable to a recognised standard registry**. The pure off-chain BCR registry record is sufficient for ICROA-aligned claims but does not give buyers the audit-trail UX that downstream stakeholders (auditors, NGOs, regulators) now demand. Tokenisation under the BCR Two-Way Bridge model closes this loop: the credit stays canonically on the BCR registry, but a 1:1 token shadow lives on a permissioned chain with an immutable record of issuance, transfer, and retirement.

The strategic case is to serve three buyer markets where on-chain proof-of-retirement is becoming a procurement requirement: **EU** (CSRD + ESRS E1 disclosure season 2026+), **India** (BRSR-Core + the upcoming Indian Carbon Market interop), and **LATAM** (post-COP30 voluntary market reforms). BCR's ICROA endorsement and Latin-American footprint make it our preferred standard for these markets.

## Target user segments

1. **Corporate offsetters** using AurexV4 SaaS — enterprises (Scope 1+2+3 reporters) who buy BCR credits inside the Aurex marketplace, retire them against a specific reporting period, and embed the on-chain retirement receipt in their disclosure pack.
2. **AWD2 farmer cooperatives** originating ARR (Afforestation/Reforestation/Revegetation) and ALM (Agricultural Land Management) credits — issuance flows from AWD2 into Aurex via a signed JWT handoff API, then into BCR via the standard project registration path. Tokenisation under this authorisation is the on-chain mirror of those BCR-registered credits.
3. **Third-party marketplace buyers** via the public B14 explorer — wallet-based or KYC-gated buyers who discover BCR-tokenised inventory via Aurex's public registry UI (no Aurex SaaS subscription required for browse + buy + retire).

## Revenue model

- **SaaS subscription** (corporate tier) for the Aurex platform — per-seat / per-org annual licensing; this is the dominant revenue line and is **independent of tokenisation volume**.
- **Transaction fee on retirement** — 10–25 basis points charged in **USD on top of the credit price**, never deducted from the credit unit count. This preserves B7 (1 VCC = 1 token) and B11 (whole-ton) — the chain-side asset is untouched; the fee is a fiat/stablecoin side-line.
- **Explicit no-pool no-derivative posture** — Aurex will not list, mint, or settle any pooled-credit, fungible-stripped, or derivative product. Each token corresponds to exactly one BCR Serial ID.

## Volume estimate (year 1)

- 10–50k tCO2e tokenised within the first 12 months post-authorisation.
- ~80% AWD2 origination (farmer-cooperative ARR/ALM), ~20% Aurex enterprise issuance (corporate-led project pipelines, mostly forestry + biochar).

## Aurigraph DLT vendor relationship

Aurigraph DLT V12 (https://dlt.aurigraph.io) is the **primary chain** for tokenised VCCs. Polygon PoS is the **fallback** chain, switchable via `CHAIN_ADAPTER=polygon`. Aurigraph DLT is operated by a sibling business unit of Aurigraph-DLT-Corp — the same parent owns Aurex.

**Conflict-of-interest mitigation** (per BCR §5.4.f and our `audit cooperation` SOP — see `02-architecture-disclosure.md`):

- Aurex contracts an **independent third-party auditor** (separate engagement from any Aurigraph DLT internal audit) for B24 audit cooperation deliverables.
- Smart-contract upgrade governance on the primary chain follows Aurigraph DLT's published `client.governance.*` rules; Aurex does not have unilateral authority to alter deployed contracts.
- All registry sync events and chain calls are double-logged (`BcrRegistrySyncEvent` + `AurigraphCallLog`) and exposed to BCR auditors via the audit-bundle endpoint.

## Compliance posture

- **KYC / CDD / AML / CTF** — Sumsub is the chosen vendor (Onfido/Persona retained as alternates); applied to all marketplace buyers and beneficiaries before any retire transaction.
- **Data residency** — EU customer data hosted in EU regions (per GDPR Art. 44–49); India customer data residency aligned with the DPDP Act 2023; LATAM data per local norms (Brazil LGPD, Mexico LFPDPPP).
- **Standards labelling** — ICVCM Core Carbon Principles (CCP) status is **tracked but not yet certified** for our platform-level adoption; we will follow BCR's labelling guidance once issued and will not assert CCP-aligned claims prematurely.
- **Article 6.2 / 6.4** — corresponding-adjustment mechanics are recorded in our self-spec (see §5 of `BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`); we will pause tokenisation of any credit flagged as "authorised for international transfer" until the BCR-side handling is finalised.
