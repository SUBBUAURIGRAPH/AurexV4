# 06 — Legal Classification Matrix (Per Jurisdiction)

**Purpose:** Aurex's draft per-jurisdiction legal-classification position for BCR-tokenised VCCs, satisfying binding requirement B22 (§5.2.b — local legal classification as utility / security / commodity / hybrid / unclassified). This is an Aurex working draft and **not** legal advice; each row must be confirmed by external counsel before the position is asserted to BCR or to customers.

**Audience:** Aurex Legal (primary owner), Aurex Compliance, BCR Secretariat (as part of §5.5 step 1 dossier).
**Owner:** Aurex Legal — ticket AV4-343.
**Status:** Draft — counsel sign-off pending.
**Companion documents:** [`./01-business-model.md`](./01-business-model.md), [`./02-architecture-disclosure.md`](./02-architecture-disclosure.md), [`./04-bcr-application-email.md`](./04-bcr-application-email.md), [`./05-anticorruption-agreement-tracker.md`](./05-anticorruption-agreement-tracker.md).

---

## 1. Aurex defensible default position

Aurex's default position — to be tested by external counsel in each jurisdiction — is that the BCR-tokenised VCC is best characterised as a **utility token representing a commodity-like environmental attribute, not a security**, on the following grounds:

- **No common enterprise + no expectation of profits from others' efforts.** The token is a 1:1 digital shadow of an already-issued BCR VCC; its economic substance is the underlying carbon-removal/avoidance attribute, not Aurex's managerial work. Aurex's transaction fee is charged in fiat/stablecoin **on top of** the credit price (`01-business-model.md`) — the chain-side asset is untouched. There is no pooled investment pot.
- **No fungibility of speculative attributes.** Per B7 / B8 / B9 / B10 / B11, each token preserves project, vintage, methodology, and BCR Serial ID; no pooling, no derivative, no fractionalisation. This pulls the instrument away from the "investment contract" archetype and towards a tokenised commodity / environmental attribute certificate.
- **End-use is offset / retirement.** Per B23 the token exists for environmental-sustainability use; the lifecycle terminates in retirement against a beneficiary's claim, not in resale-for-profit. Marketplace transfers between holders exist (per B11) but are incidental to the offset use-case.

This default position is **not** legal advice. Each jurisdiction below requires external-counsel confirmation. Sustainability-token classification is unsettled in most major regimes as of 2026-Q2; counsel should re-verify against the most recent guidance immediately before Aurex relies on the position publicly.

---

## 2. Per-jurisdiction matrix

| Jurisdiction | Proposed classification | Citation (regulator + most recent guidance) | Risk level | Required disclosure on listing UI (per B22) |
|---|---|---|---|---|
| **United States — Federal (SEC)** | Utility / commodity-like environmental attribute; **not** a security under the Howey test, on Aurex's reading | SEC, Framework for "Investment Contract" Analysis of Digital Assets (2019, last consolidated guidance); SEC v. W.J. Howey Co., 328 U.S. 293 (1946); SEC Climate-Related Disclosures Final Rule, 89 FR 21668 (Mar 28, 2024) | **High** — SEC posture on environmental tokens post-2024 climate-rule remains unsettled; counsel must opine | "BCR-tokenised VCC; not registered as a security; not an investment contract under Howey; commodity-like environmental attribute. Past prices not indicative of future." |
| **United States — CFTC** | Carbon credit treated as an exempt commodity; spot transactions in physical-equivalent VCCs not generally within CFTC retail-leverage prohibition unless leveraged/margined | CFTC Final Guidance on Voluntary Carbon Credit Derivative Contracts, 89 FR 80814 (Oct 4, 2024); Commodity Exchange Act §1a(9) | **Medium** | "Spot transaction in a tokenised voluntary carbon credit; no leverage, no margin, no derivative." |
| **United States — New York (NYDFS)** | Likely outside BitLicense if classified as utility/commodity; broker-dealer registration not triggered for non-security spot sale; money-transmitter analysis required for fiat-rails | NYDFS BitLicense, 23 NYCRR Part 200; NYDFS Virtual Currency Guidance (last updated 2024) | **Medium** | (Carries the federal disclosure plus a NYS-specific "this is not a virtual currency under 23 NYCRR Part 200" line, subject to counsel confirmation) |
| **United States — California** | DFPI Digital Financial Assets Law (DFAL) takes effect July 1, 2026 — Aurex must verify scope before launch | California Digital Financial Assets Law (AB 39 / SB 401, eff. 2026-07-01); DFPI implementing regulations (in development) | **High** — new statute, scope unsettled | DFPI-required disclosures per implementing regs (counsel to confirm). |
| **United States — Texas** | Texas treats carbon credits as commodity-like; no current digital-asset securities classification triggered for VCC tokens | Texas State Securities Board, Statement on Digital Asset Securities (most recent revision); Tex. Gov't Code §2054.0593 (state digital-currency study) | **Low–Medium** | Federal disclosure suffices unless counsel advises otherwise. |
| **United Kingdom (FCA)** | Unregulated token under the FCA's Cryptoassets Taxonomy — neither a security token nor an e-money token; financial-promotions regime still applies to marketing | FCA, PS19/22 Guidance on Cryptoassets (Jul 2019, last reaffirmed); FCA Cryptoasset Financial Promotions Regime, PS23/6 (Jun 2023) | **Medium** | "Cryptoasset; unregulated by the FCA; capital at risk; this promotion has been approved by `<FCA-AUTHORISED-FIRM-TBD>`." |
| **European Union (MiCA)** | Most likely **out of scope** of MiCA as a "unique and not fungible with other crypto-assets" carbon-credit instrument under MiCA Recital 11 / Art. 2(3); fallback classification if in scope is **utility token** under MiCA Art. 3(1)(9). Counsel must confirm against ESMA Q&A | Regulation (EU) 2023/1114 (MiCA), Art. 2–3 and Recitals 10–11; ESMA MiCA Q&A and Technical Standards (RTS / ITS, 2024–2026); EU Climate Disclosures (CSRD) Directive (EU) 2022/2464 | **High** — MiCA's treatment of sustainability tokens is the single largest open question for Aurex's EU rollout | "Cryptoasset; if out of MiCA scope, displayed as such; if in scope, utility-token whitepaper reference per Art. 6 MiCA; not an asset-referenced or e-money token." |
| **India — RBI** | RBI does not currently regulate non-currency digital-asset tokenisation outside the e-rupee perimeter; carbon-credit tokens are not "virtual digital currency" for RBI purposes | RBI Circulars on Virtual Digital Assets (most recent 2024 guidance); Indian Carbon Market (CCTS) interop guidance under MoEFCC + BEE | **Medium** | "Not currency; not a deposit; not regulated by the RBI." |
| **India — SEBI** | Not a security under the SCRA so long as Aurex preserves no-pool, no-derivative posture; SEBI guidance on tokenised real-world assets remains in formation | Securities Contracts (Regulation) Act 1956; SEBI Consultation Papers on Tokenisation (most recent 2024–2025); SEBI Circulars on green securities | **Medium–High** — SEBI may issue tokenisation rules within the partnership term | "Not a security under SCRA; not registered with SEBI; spot environmental-attribute purchase only." |
| **India — Income-Tax Act** | Falls within the definition of **virtual digital asset** under §2(47A) of the Income-Tax Act 1961 (inserted by Finance Act 2022), triggering §115BBH (30% flat tax on transfer) and §194S (TDS) | Income-Tax Act 1961 §2(47A), §115BBH, §194S | **Low** (tax-clarity; obligation is operational, not classification-blocking) | "Transfers may be subject to §115BBH 30% tax on capital gains and §194S TDS; consult a tax adviser." |

---

## 3. External-counsel sign-off (required before reliance)

Each row in §2 must be signed off by counsel admitted in that jurisdiction, with a sign-off memo filed to the legal-artefact store referenced in [`./05-anticorruption-agreement-tracker.md`](./05-anticorruption-agreement-tracker.md) §3.

| Jurisdiction | Engaged firm | Sign-off date | Sign-off reference |
|---|---|---|---|
| United States — Federal + CFTC | `<FIRM_TBD>` | `<TBD>` | `<MEMO_REF_TBD>` |
| United States — California (DFAL) | `<FIRM_TBD>` | `<TBD>` | `<MEMO_REF_TBD>` |
| United States — New York | `<FIRM_TBD>` | `<TBD>` | `<MEMO_REF_TBD>` |
| United States — Texas | `<FIRM_TBD>` | `<TBD>` | `<MEMO_REF_TBD>` |
| United Kingdom | `<FIRM_TBD>` | `<TBD>` | `<MEMO_REF_TBD>` |
| European Union (MiCA) | `<FIRM_TBD>` | `<TBD>` | `<MEMO_REF_TBD>` |
| India (RBI + SEBI + tax) | `<FIRM_TBD>` | `<TBD>` | `<MEMO_REF_TBD>` |

Aurex must not assert any classification position publicly (in marketing, in `01-business-model.md`, on the public B14 explorer, or in the BCR application email) until the corresponding sign-off cell is filled.

---

## 4. Open questions for counsel

These are the unsettled-law items that Aurex needs counsel to opine on; they should be flagged in the engagement brief for each jurisdiction.

1. **MiCA scope for sustainability tokens.** Does MiCA Recital 11 (which excludes "unique and not fungible" cryptoassets) cover SFT-modelled VCC tokens where each batch is unique even though units within a batch are fungible? Or does the within-batch fungibility pull the instrument back into scope as a utility token under Art. 3(1)(9)? ESMA Q&A on the unique-and-non-fungible test should be re-checked at the time of opinion.
2. **SEC stance on environmental tokens after 2024 climate-disclosure rules.** The SEC Climate Rule (89 FR 21668) does not directly classify carbon-credit tokens, but it conditions registrants' use of offsets in disclosures — does this elevate VCC tokens into "investment-contract" territory when sold to public-company offset buyers? Howey-test analysis must be specifically tested against the multi-buyer, no-pool, fee-on-top economics.
3. **CFTC retail leverage interpretation** for tokenised VCCs that may be transferred via DEXs or AMMs operated by third parties (not by Aurex). Aurex's no-pool stance keeps Aurex itself out of derivative territory, but secondary-market third-party venues are out of Aurex's control; the question is whether Aurex incurs facilitator liability.
4. **California DFAL July 2026 effective date** — is the BCR-tokenised VCC a "digital financial asset" as defined in the statute? DFPI implementing regulations are in development; counsel must track the rulemaking.
5. **MiCA whitepaper obligation** — if any EU jurisdiction's regulator deems the instrument a utility token in scope, Aurex must publish a MiCA Art. 6 whitepaper. Counsel should opine on the white-paper trigger and on the notification regime for offers below the Art. 4 thresholds.
6. **India SEBI tokenisation consultation outcomes** — SEBI's tokenisation consultation papers may produce rules during the partnership term; Aurex needs a re-classification trigger committed to in the [`./05-anticorruption-agreement-tracker.md`](./05-anticorruption-agreement-tracker.md) §4 list.
7. **Article 6.2 / 6.4 corresponding-adjustment interaction** — does an authorised-for-international-transfer credit's corresponding-adjustment status alter the legal classification of its tokenised shadow in any jurisdiction, particularly under EU CSRD / ESRS E1 reliance rules?
8. **AML / sanctions screening obligations** — confirm that Aurex's Sumsub-based KYC pipeline (per `01-business-model.md`) discharges the platform's AML obligations in each jurisdiction, including OFAC, UK OFSI, EU consolidated sanctions, and Indian PMLA.

This list is not exhaustive; counsel should add jurisdiction-specific items in their respective opinion memoranda.
