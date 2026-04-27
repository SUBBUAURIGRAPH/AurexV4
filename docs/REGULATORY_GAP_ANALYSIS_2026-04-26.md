# AurexV4 — Regulatory Gap Analysis (Gemini Deep Research)

_Generated 2026-04-26 via `gemini-2.5-flash` with Google Search grounding (60+ sources). Two-batch run via `apps/api/src/services/research/gemini-deep-research.ts`._

## Code traceability (Jira ADM-59 / closure evidence)

| Ticket | Where in repo |
|--------|-----------------|
| AV4-416 | *Deferred* — BCR Standard vendor; legal outreach (no app code) |
| AV4-417 | `packages/shared/src/schemas/methodology-catalogue.ts`, `methodology.service.ts` |
| AV4-419 | `host-authorization` model + `HostAuthorization` / activity lifecycle |
| AV4-420 / 421 / 424 | `methodology.service.ts`, methodology catalogue / cookstove fNRB checks |
| AV4-422 / 423 | `registry-label.service.ts` (`applyCorsiaLabels`), `host-authorization.service.ts` |
| AV4-426 / 427 | BRSR render + `admin-brsr` routes + assurance fields |
| AV4-428–432 | `dpdp/*`, `routes/dpdp.ts`, `consent.service`, DSAR, breach |
| AV4-433 / 434 | *Deferred* — Razorpay / RBI PA attestation; finance vendor |
| AV4-435 / 436 | *Deferred* — FIU-IND / AML policy; legal + compliance program |
| AV4-418 | `registry-label.service` → `article6LabelInterop` on label JSON |
| AV4-425 | Ops: `docs/REGULATORY_GAP_FOLLOWUP_RUNBOOK.md` (Verra monitoring) |
| AV4-437 | `apps/web/.../MarketplacePage.tsx` (EU CBAM notice) |
| AV4-438 | `retirement-csrd-export.service.ts`, retirement flow |
| AV4-439 | Same CSRD E1-7 path as 438; full ESRS/BRSR crosswalk still PM-owned |

## Status (2026-04-27)

| Tier | Count | Status |
|---|---|---|
| **Engineering shipped** | 14 | Done — commits `e657081` (R1, carbon-market), `0b1cd5f` (R2, BRSR), `2d40cf7` (R3, DPDP), `8f6ab8e` (R4, CSRD). Deployed to prod. |
| **Deferred — compliance/legal/vendor** | 6 | Labelled `compliance-blocker` with concrete next-action owner per ticket. |
| **Backlog (P2 nice-to-haves)** | 4 | Open, low-priority. |

**Shipped (Done):** AV4-417, AV4-419, AV4-420, AV4-421, AV4-422, AV4-423, AV4-424, AV4-426, AV4-427, AV4-428, AV4-429, AV4-430, AV4-432, AV4-438

**Deferred (compliance-blocker):** AV4-416 (BCR vendor), AV4-431 (DPDP SDF assessment), AV4-433/434 (PCI-DSS RBI PA), AV4-435/436 (PMLA / FIU-IND)

**Open backlog (P2) — follow-ups:** AV4-425 (Verra watchlist / ops), AV4-439 (ESRS map vs BRSR — partially covered by AV4-438 CSRD export). **P2 scaffolds in-repo:** AV4-418 (`article6LabelInterop` on `GET …/credits/…/label` JSON), AV4-437 (EU CBAM notice on public BioCarbon marketplace).

## Summary

Aurex V4 has 24 active regulatory gaps spanning carbon-market standards (UNFCCC A6.4, ICVCM, CORSIA, Verra), India compliance (BRSR, DPDP, RBI PA, PMLA AML), and EU obligations (CBAM, CSRD). Highest severity is concentrated in **DPDP Act 2023** consent + breach notification (P0), **CORSIA Phase 2** Article 6 Authorized labels (P0), **AML/PMLA** Reporting Entity registration (P0), and **A6.4 host-country authorization forms** (P0). All gaps are tracked as AV4 tickets (AV4-416 through AV4-439).

## Findings: 24 unique gaps (12 P0, 10 P1, 2 P2)

### P0 — production blocker (9)

#### [A6.4] New UNFCCC forms (A6 — [AV4-419](https://aurigraphdlt.atlassian.net/browse/AV4-419)

**Gap:** New UNFCCC forms (A6.4-FORM-GOV-002/003/010, published March-June 2025) detail host-country authorization requirements for A6.4ERs, including specific uses (NDC, OIMP) and duration, which need to be fully integrated.

**Current state:** Aurex's PACM activity lifecycle includes host-country authorization but may not capture all new granular details from the latest UNFCCC forms.

**Recommendation:** Update Aurex's PACM activity lifecycle and data models to align with the latest UNFCCC A6.4 host-country authorization forms and requirements.

**Sources:**
- A6.4-FORM-GOV-002 HOST PARTY AUTHORIZATION OF THE USE OF ARTICLE 6.4 EMISSION REDUCTIONS FORM FOR ARTICLE 6.4 PROJECTS (Version - UNFCCC — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGexl9XQro4NEPUNE5klu3ocp19_n30YSBw6yeV07l3kpiRV-eeQKNOOG8Pt5ngWMabrK8o6vbtEkPgyjFShW_hWqn87cJDQx98-7hHRRzLGswT0I_y3ppVLKF3JVXH1RbLOEe55K3pwOAp5-s1rQovA4Vliqss18l1WVXd3WWG (2025-03-19)
- Host Party authorization of the use of Article 6.4 emission reductions form for Article 6.4 programmes of activities (PDF) (v.01.1) | UNFCCC — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEF8NtjOMpEgcauU1NN0Jmi3LckxwqHVf7ZBIRbyvVAQW8jkXqTsIvidVFBhsM9EVz-MHNGsUBKWAQG0g5waKnyHZcBJWYphTmf1tW5TmH9GD_489WTfdvjWnluLBE= (2025-05-06)
- Host party approval and authorization of activity participants form for Article 6.4 projects (PDF) | UNFCCC — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF1ojJbrKTwHDlY0rh_t_T0syrXMhNo0AgafvWjceoBJJcka4zAfNPB0L52Uie6OixivqcWzdwHWUq1ymOZDXp78iI-sT3Z4MkZqPEQC_7KNfazY8qJvNV14KY7u1A= (2025-06-20)
- 2025 - Authorising Article 6.4 carbon credits — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHXwryDj0ZdejemKV5IW_y_lXbeczzvme8dhL-VaPCDO2ZwLtvsBiL-nGQK-k16r17RdgLaHWzqHA7OfnddyVGkBzEzlaineOCTJ0Tmvqs8Hhh1eeQA6I0OnbK1XKS3nkSNCwQ36nfKh4G2Go9loEOaaU8VsRToAAT-3knJDNkMUMTdVEdu8UqI556AMoghGxZK4tey1JDPr3gBGD9seHJxrFfkt0UYh_f_u2_UheDJ8E82f6hW1Q== (2025)

#### [AML] Aurex, by operating with tokenized environmental assets (BCR, Article 6 — [AV4-435](https://aurigraphdlt.atlassian.net/browse/AV4-435)

**Gap:** Aurex, by operating with tokenized environmental assets (BCR, Article 6.4 PACM), likely qualifies as a 'reporting entity' under India's PMLA and needs to register with FIU-IND.

**Current state:** Tokenized environmental assets (BCR, Article 6.4 PACM) are handled, but FIU-IND registration is not mentioned.

**Recommendation:** Initiate immediate registration with FIU-IND as a reporting entity, providing all required documentation and a clear explanation of how Aurex's activities fall under PMLA.

**Sources:**
- FIU Registration Services for Entities in India - Ahlawat Associates — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHztgEDW20Gn9VwoM1_DwDf2Brc2u-olVBW3ujX6KrjZAAwfFIBAtPqw3ATBtkjvohwwSjk8edHB8U1Hlhd7ESGerag926yJjWsyf-UwMrHVS5QN3YsuYR0Lpugu9qemiqcnDQk5hvQv88U36jBPrE6ZjaO2loGsZQJh4IgaaMMgI8= (2023-03-10)
- FIU-IND Registration Services in India - Gadi & Associates — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFwgxE2olnrtPB07VU-a0vwDEJz3n2y6cBfajGJ0SESW6JYX04NWbdAhY9NtJkf_uZwkB2W6_poPiakyeQycAr2VJWxsfMfoK-Wte6m8i866udxbkfeccgtTHNm4VWEEZyQR2Yuv7IhllRbA4eCE8byL4HIaiE8rFw= (2026-04-26)
- Financial Intelligence Unit India (FIU IND) Registration Process in 2026: A Step-by-Step Guide - Finlaw Consultancy — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHSDlMv75UKIjEeMFLKnXUP3AChoJ-f1o3ozUb5u_W8am1Yo4SbOm97Xpr-5EsOhYyUGq3tkwCgXuD1la87HFnh2aJM38X4aZ7Gd__mHs4qr5SxtWM9jLEeysIFWEJns7dZ89CN6FjSv9-eFIz6bBvVeNbmtj9vdJkDAc1NDsuRE8u-4zaFuUTUaovs-aqVyDa7YOQlrzx9HXjAOIuKVUACavd8sA= (2024-12-24)

#### [AML] Aurex needs to implement comprehensive AML/CFT policies, including enhanced… — [AV4-436](https://aurigraphdlt.atlassian.net/browse/AV4-436)

**Gap:** Aurex needs to implement comprehensive AML/CFT policies, including enhanced KYC, transaction monitoring, and suspicious transaction reporting, in line with PMLA and FATF guidance for virtual assets.

**Current state:** KYC adapter (Sumsub-pattern) is present, but specific AML/CFT policies for tokenized assets are not detailed.

**Recommendation:** Develop and implement a robust AML/CFT framework, including risk-based KYC for all users, continuous transaction monitoring for tokenized asset movements, and a formal process for reporting suspicious transactions to FIU-IND.

**Sources:**
- Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers - FATF — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEEFqVG-a2UrqYb3mVWa68ZuTCQcpqswVw6oLnCIcxLB2swGe24x7PRKDA9z3_pqRr_M_m2oRfXYyiP-T6YPsy3zisHy3NB4UNO92XJ6IK-d_dcNmz1TazpL_IAz41yz6rwJNTXN6VhYuzPj48vYqyY-KdZQNbYQfOqePecSra53QJns33AvTiagm0Ndh6Med_M7ZBC-lalOOjN-OqO (2021-10-28)
- Tokenised Carbon Credits: Opportunities and Key Market Distinctions. | Hassans — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGZNAxvUERVUUWoMY659W-eS5vQIJKaeXUfP1QY4h5j9BzrzWstjV73qiagTyR5Qz2zRTN7QVFmVmQ-y7T75ePxAsdzWQploB6FnkAWPge3N_jyalV5uyaxS9Q45arvCfy-HoY57JZR08HysNOwziJJaeIvsqwILuv8ZKfTXaYZFW2N_lDGs-RpBS-FNYXsNjeqdxeiY6N97mujMVl21C1cypYcXAGH_S8H8JB5hwpZQA== (2025-12-03)
- FIU-IND Registration Services in India - Gadi & Associates — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFwgxE2olnrtPB07VU-a0vwDEJz3n2y6cBfajGJ0SESW6JYX04NWbdAhY9NtJkf_uZwkB2W6_poPiakyeQycAr2VJWxsfMfoK-Wte6m8i866udxbkfeccgtTHNm4VWEEZyQR2Yuv7IhllRbA4eCE8byL4HIaiE8rFw= (2026-04-26)

#### [CORSIA] CORSIA Phase 2 (2027+) requires an 'Article 6 Authorized – International… — [AV4-422](https://aurigraphdlt.atlassian.net/browse/AV4-422)

**Gap:** CORSIA Phase 2 (2027+) requires an 'Article 6 Authorized – International Mitigation Purposes' label and corresponding adjustment for credits with vintages from 2021 onward. Aurex lacks explicit support for these labels.

**Current state:** Aurex tokenizes credits but does not explicitly apply CORSIA-specific Article 6 labels or track corresponding adjustments.

**Recommendation:** Implement functionality to apply 'Article 6 Authorized – International Mitigation Purposes' and 'Correspondingly Adjusted' labels for CORSIA-eligible credits.

**Sources:**
- Verra Releases Updated Article 6 and CORSIA Label Guidance, New Buyer Resource — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE51cI9ZXACvOUxf4ApSBNv6VyaqJClDre3bbrhlZZEcZyeA-47o_Qt8BR6YMacpCmvpfxsA284eGRruyyxARmYBS7wGhIO9wlNtX_BgubDGno_QB6ReSYCQMaTJy2ajhvqHzWmd34hvZO67-WHlzWYKroFikL_EdfduYIgPfdqc4VJ2ygZwmztGUzNZjhaKljokQtzIx45Qf26 (2026-04-09)
- The VCS Under CORSIA - Verra — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF5fNplAVEz14_mHFomJWk963SVGbP_GnXPZ_efdFRjIfk7aU14X57vs7MJsmy2BA3Lzg582pJw_GIHakWn9k7LNyZ28mw3C4dm4gjJtl3PLv-Yt1-3gpu0GkSIwO2rF1SY8vs5C3HaICb1Lc4fGQWEsKu9_35bfPl9uYPVCh77 (2026-04-09)
- Verra Updates Article 6 And CORSIA Label Guidance, Releases New Tool For Credit Buyers - Carbon Herald — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH80DPAx9IOwBzaByKppFwPLL7o5BvUr9lNByDuJEllftAZiAEZ4wrFzkPLvLekzt3OLsaHSEQOIJBEU8WK0yCin1-7eq-tAMaYfIJoxtjkJXiV2TOpUzsx7y5UxyOh0K6xB8J3uD0F0cE5NhRDqjXOiiGl0Od04Cmpo6e9S_2HQjxGqJh1EKWn4P5KP5HgoItTtm8LkNbGECUwiRo08Ty6mz_QWM0OOOHo (2026-04-13)
- Verra Updates Article 6 and CORSIA Guidance - ClearBlue Markets — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHs4jY2sGgs-0Jfq9lrtJG4UDlmmt6oI5NlcVerxe9bu__NKJfeCS8CBbkfTo0G6-MBYIHLnECMcVZvT3MZ7aGnpc-eKzF5bqQd-d-8vWBBr4TH_SC1F_0ts7jWWYfztA_pwDfW9GRcR3ZZ8q0i5ga-4Cr3D7Z_2s86m42FgSudl7tKDhZUyf9bp_56aW2aJxcY8ZglSA== (2026-04-14)

#### [CORSIA] A robust mechanism is needed to track and verify host-country Letters of… — [AV4-423](https://aurigraphdlt.atlassian.net/browse/AV4-423)

**Gap:** A robust mechanism is needed to track and verify host-country Letters of Authorization (LoAs) and corresponding adjustments for tokenized credits to ensure CORSIA eligibility.

**Current state:** Aurex's two-way bridge and retirement with verified beneficiary KYC do not explicitly cover LoA tracking and corresponding adjustment verification for CORSIA.

**Recommendation:** Develop a system to track and verify host-country LoAs and corresponding adjustments for CORSIA-intended credits.

**Sources:**
- Airlines & CORSIA: New Eligible Emissions Unit Standards - South Pole — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFKxSFW72aZwKZyi4sa-z5CcrG1btDc4uJMzT4gA_Qi4o5xw-cIW3pltTJFNeOBsHXgtFXbLPfRwMDO9MV-fr3SAGX1ZWNMZrCetYWgkF1lN2iCRuGZYymXemUzN8GZ6yJ7Lee-VTRRJUmxN_C7yiMU5ngAjYSCheDv9qj1cAbsQ1s5OSmy4nNq0lxiU4qbDMYmDgtGwiqS_Qdec0zvlzYE5UAVAG6YbA== (2025-03-17)
- Fact sheet: CORSIA - IATA — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGdqKYhzHbNNK4KqMmbPB42OZIaL5Ri1LI3kokXzxCZozkVA-OWMQXzI_DfBx6joxcvvRer57kbgPaobdOWgm0_Gi-DpW77Pl0FX97Iofqq0YxQlHdfU7GYLHdFc03pY34kRLuRcRaNCyVU7-7boPordyz3E-D5RByR0Ov8AcKDR_y12WBRPsjjUHM= (2024-01-01)
- CORSIA: Carbon Offsetting Scheme for International Aviation - ClimatePartner — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDUgx1zicFvy9VDcjSRdRYvl7ENptPMgKVR3Fww2EF-5BgqNlp6R1kfB85j_BS-l5zpQnT8xmP78pA59qzKFTUnfrdfoGnjKHhEFy8Y40TQC-YPCBc9q4ZhqU_NXXsMVUYjubxrCjTEnTZRNlPNC3qx7KEc2MeuOShczW5T_-l0BF9vZiQjaBeTcyFD2O01v6Sf8i-DSQEgw3UYM0ftRE0c7B0al8dgfxIdtgSmylAsGm97_rfnHM= (2025-10-20)
- Offsetting CO2 Emissions with CORSIA - IATA — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGoBjg_hU42KbWJMRuoiCf2r-7zlIjdPS25L0KbxK1Er8PY0Gm5OP_VQ9ZhHB4_7fbLS2PaQLQdvq-BPLratm0jnica5rUXhCedJDq3blHsdHh008hiB0pgRzjn8DG2RuDcmXbNB7YDIvvV5Qcqo8DKLQ== (2026-02-15)
- International airlines face major CORSIA offset costs from 2027, says IBA - GreenAir News — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGdOO2QRbrF91f5JcUSbj4Ic2fqYfyB5kN7MD57yqbQCdKjf11anVxJ7TTKrRyYju6eicnTU6skre3vYZGT9t71_mcJbR3M_kmuXWm84tGSBXx49vhLSmVVBYB2PX3 (2025-09-03)

#### [DPDP] Aurex's consent mechanisms (email verification, onboarding) may not meet the… — [AV4-428](https://aurigraphdlt.atlassian.net/browse/AV4-428)

**Gap:** Aurex's consent mechanisms (email verification, onboarding) may not meet the 'free, specific, informed, unconditional and unambiguous with a clear affirmative action' standard of DPDP Act 2023, effective by May 2027.

**Current state:** Email verification, onboarding wizard, password reset.

**Recommendation:** Revise consent flows to explicitly capture granular, unambiguous consent for each processing purpose, providing clear affirmative action options as per DPDP Rules 2025.

**Sources:**
- Understanding India's New Data Protection Law — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH233fI1TPkl6l0i5lxJEcw_vmxFnMXYfbWsvqu1E_xm6aFB37hhwGBb778qbST7pXcuQDpcoSjmd2DU6zM9_mz02R0BT5NkPlnBYz2JG4NEcGB-qTkhFRypeGp1ENg6aqRPEu29WdH_-8G0-kjXcWhzB3gF34g8E9VbDqyfq8l7N7EsI0meK0SAY2NOyyS4rsf6cYgLQ== (2023-10-03)
- India's Digital Personal Data Protection Act, 2023 (DPDP Act) vs GDPR - Securiti — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcujb6aXcd0WLdObs7dBPuSkB7TkR0HZybYxc7sB4gOaZvDeLKv66MDBBUSCDKNcO35G6QbyIcLKSUEfzvpQwgy-B-o5PDe9rlMPSlwKptz_Uy-jSqUUhqqpcmOWwGXwu1o5KBbtFwaDSq21_cQF0zr5KpSXxteQLewknEhRzLQJY= (2024-01-24)
- Global Businesses Should Brace Themselves for India's New Personal Data Protection Law — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEXgViaiAl2QOQx2CC-AXzT9P6jfTGOY7sxvH4vNR1HSPKyfjVR49vp3H2FVKMb8p5Xwww0NXpjk1SYzyaIUu1jSvivjrxGDW9tr1JWU0UoV2f2p3Ni_sqB3pzGSduw2bRJYJuiHvp8IFkONjALi9Rt4OPssYqWcUFWTn83J9JriundeqRg4GSGtClf_ZPGR8wFaWglUkSLRnSAYTgPeeJ5L8ssIYpky-a5bQ== (2025-05-15)

#### [DPDP] Aurex's KYC adapter needs to ensure verifiable consent for sensitive personal… — [AV4-429](https://aurigraphdlt.atlassian.net/browse/AV4-429)

**Gap:** Aurex's KYC adapter needs to ensure verifiable consent for sensitive personal data, especially for children/disabled persons, as mandated by DPDP Rules 2025, effective by May 2027.

**Current state:** KYC adapter (Sumsub-pattern — disabled by default; vendor-agnostic interface).

**Recommendation:** Implement robust verifiable consent mechanisms for all KYC data, with specific flows for children/disabled persons, aligning with DPDP Rules 2025 requirements.

**Sources:**
- Decoding the Digital Personal Data Protection Act, 2023 - EY — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIp1DfZvRm9wtUBeUWLIdzAhQVVzd6OzUjc8xzduOwCZsPHYDP70Wu4NkfIsDLnpFyov1CjC-Msaaen1h5bkjHG92kqADSRK9JjSKQQP_DS2wFjceacr5RA-IOjze1om4oQMW6lDSvQj7LvI9OOY_kpxkpGXiFhjbhTxJCFu5T3w9ZchN_Y_E7kuYwk6PO3nmj_aSsK0Ikv_NqFLTY4u4r (2025-11-20)
- India's Digital Personal Data Protection Act, 2023 (DPDP Act) vs GDPR - Securiti — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcujb6aXcd0WLdObs7dBPuSkB7TkR0HZybYxc7sB4gOaZvDeLKv66MDBBUSCDKNcO35G6QbyIcLKSUEfzvpQwgy-B-o5PDe9rlMPSlwKptz_Uy-jSqUUhqqpcmOWwGXwu1o5KBbtFwaDSq21_cQF0zr5KpSXxteQLewknEhRzLQJY= (2024-01-24)

#### [DPDP] Aurex lacks a formal personal data breach intimation process to the Data… — [AV4-432](https://aurigraphdlt.atlassian.net/browse/AV4-432)

**Gap:** Aurex lacks a formal personal data breach intimation process to the Data Protection Board and affected Data Principals within 72 hours, as required by DPDP Rules 2025.

**Current state:** No explicit breach notification process aligned with DPDP Rules.

**Recommendation:** Establish a clear incident response plan, including a 72-hour notification protocol to the DPB and affected Data Principals, with prescribed reporting formats.

**Sources:**
- DPDP Rules 2025: What Changed + Phased Compliance Timeline - Glocert International — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHMjxrSxC79as1rBKSmpzaarQxl68TCkY0tgF4mKL_QMjUNIiQNRogp9qt9DmQWTIm_kVsbhJ2eWYFx6y16KyWsX0BgEcpOS1XZP6yNCRq99mnKW3mgWOPejp48GiBPGAbRmgLkGlyIDPMaryjHslo5zVDyczU7-gbbP3oZJ9-bFFRuhAVIAsE6IPgIrEEvR9-uZc6w (2026-01-17)
- DPDP Act Effective Date & 2025 Rollout: What to Do Now - Cloud Security Provider - Cy5.io — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHf8tax-zBEVlNvDdLk1MnmcxjZG_tdBhtIVKmo1IL0Iym_iY-RZzaSyuAPMfLZpX_gVqjjhKs3pqQIGyiK2yjwaZW86NdT2d2g20TAGXOgldnADnG6GhW6wIL_qaGjaTr0reHKYcvce47S_MfkB6_NyUM2fEzCbv7msRnMXUI= (2025-10-29)
- Digital Personal Data Protection Rules, 2025 – Notified! - ADP Law Offices — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEedo5Z8Qg4u34g0sdJ-KpnKnzdn0rT2S7VQc7ZhqW6bAhfbm7dk5x8oAk8Ep4u2_zp9c_O02Q-HYbfoi4cth3rbCg3uQRaPUMqHOTjgMAcWHFLLho3v-1DYeXKwrG1ZHEzJ_YuUAlHj_TmSWbDFQXy_u0FsJjsT2-FlWwj0as-vtPfZd9INbWBRw== (2025-12-11)

#### [Verra] All Verra cookstove projects must transition to VM0050 for 2027 vintages and… — [AV4-424](https://aurigraphdlt.atlassian.net/browse/AV4-424)

**Gap:** All Verra cookstove projects must transition to VM0050 for 2027 vintages and later. VCUs using TOOL30 for fNRB are not CORSIA Phase 2 eligible.

**Current state:** Aurex tokenizes cookstove credits; reliance on TOOL30 or older methodologies for 2027+ vintages is a risk.

**Recommendation:** Enforce VM0050 for all Verra cookstove projects with 2027+ vintages and ensure TOOL30 is not used for fNRB calculation for CORSIA-eligible credits.

**Sources:**
- ICAO Approves the VCS Program for Second Phase of CORSIA: The Details - Verra — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH0m7nERztu7jk2OuDPqkWrTbZy1oFHl-DKzg8MPHvqMOt-1IPXB0Cu_1JeejZZQxMVqn6vopEVFECXu805bC1Fl6E2CkbVcfqe_wNHvuoEvciRYFA7YWk2hGE5IhuNjVtWvCasZF9ORVRXzPn8cz6GeSzwmopiPi9B_83fMokEirEDrxEYUG3DEF76LgZNEB40y9Qf63uUUUzqCQoSq9kGoA== (2025-11-20)
- Gold Standard approved to supply credits for CORSIA Second Phase (2027–2029) | GS - Gold Standard — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE_PAvyqPfwibNBzDd_im_GKvSSTsHgao4HarDKDowdDY6GlU2ANHmINqZRzLW5uuU5EnU0K5Le86jfKAoGFWOM8yOBMFLbkc6j_fZgcVF5JueOpHchbzPb5MnuiFHqNBtOLD8gNV1ROYKr_DOrjDcBg81hOryP4EIHh85zJOgTyj2_dtkyXdaRWgisXT1QStQ3-hOPZSg6v6A== (2025-11-13)
- Revision to VM0050 Energy Efficiency and Fuel-Switch Measures in Cookstoves - Verra — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFw1t-cCoyC5xVAvUsH1adEYewK7eaoGMYJnw5aUjYUlhQeQZ7TDqSACbdtyvsGNBNGxjFYgqjHvJqSj-xaUnuij7yV35mKWC0hEETnF11wTZSRRnRp6d2zfaFwMvQOHy3ZY5PPoC6sxI0ZZMTr0V3dJ1YJgucuaqqZPp-FaKJAy4BoErL9efdBhNdfCWS0E6Vf2d8V8mIDhUJBxpZykM_BQ7Rszf5d (2025-02-03)
- VM0050 Energy Efficiency and Fuel-Switch Measures in Cookstoves, v1.0 - Verra — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFu4Fpb3REyeM2u4AjBoPCvKlZ3V4TVZxRqY5gEkraP8c9G8QhtBZ0Fvl5W86kkLUEoP74jmUDlmY7-6j77d0ug4bWu1SmffVYd77lVk1jjcYIf1SjR9CPv0TsAVTxMttZivURw2ZH7V14QSdwTao7HX3FOImCrFjvKrmvBWp83Z5m68Vdjf6akrIENDfmqqI2UASqhZ_oe-NvXFPNMx9I= (2024-10-09)
- Verra Releases New Cookstoves Methodology — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHUs1vYORc0Wx-ikt85i3Me8jH3PbZa5QPOKMkx30uBp5s86CFpBu-kAbiGO-G95pJnFgF4EpyV5_aD9bxl5Hbbhvh7CJH0iCw4l7gIm-7hCaCakn_3nSJN-eOQoly1FfpdApskOdvW9pQlmfgN9upRlayzO0C (2024-10-09)

### P1 — this quarter (11)

#### [A6.4] Specific methodology approvals for new Article 6 — [AV4-417](https://aurigraphdlt.atlassian.net/browse/AV4-417)

**Gap:** Specific methodology approvals for new Article 6.4 projects are still emerging (expected mid-2025), and the Supervisory Body is developing further guidelines on baselines, additionality, non-permanence, and suppressed demand.

**Current state:** Aurex supports Article 6.4 PACM activity lifecycle but may not be fully aligned with all new or upcoming methodological specifics.

**Recommendation:** Monitor UNFCCC SB and MEP decisions closely for new methodology approvals and evolving guidelines, and update UC_CARBON template accordingly.

**Sources:**
- Article 6.4 moves to operationalization, bringing a new wave of carbon credits to the market — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF2tsq3qhLmA3udP0j9eOebBQ-Zf8snhPyHpdKewZW9jjokEHkEcOwqE_Ob8iUZaACMT7wGD2AALjA6NdueKJ0c1Tt2KANtQ5GmLQalL51kbY_4b5RNHrc7YS-Rw93Exu3v3LtXaY2hLMq4EJqpSAYftrfdyNSr51vLhLMn_XPWB2KElNrXM-ssBEzwpQfvJo2PJZP4CqaaFqu--xS0SKA1Ruh5hMw1JpgFz2koXO40EASV1N2POS0= (2024-11-18)
- COP29 & Article 6.4: A new chapter in global carbon markets — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFVbV1c5LVYmuSeehhdNCcuNYxkYUbnxDEd5JoLwrvLQSdSxvKaij9-jqQx91_32XFms2_3nColqHOF0SjSEdvU4LOOMd_QmNiWOIOxYq-KGUGZoDHMDsYwYzvOu7xXvPQ_eqD3vMKRNfhBWuL0iE5NFsQ1Wp0ghlZgrLgUHnBNG2AsRmQIFZm7aY7LGN7NJ0mkw_Z7D8nC0cY= (2024-11-26)
- UN Experts Release Key Updates to Article 6.4 Methodologies - ClearBlue Markets — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFJIaDxrYghEEXMqERsxkUpLl17Mpmv3GyNj6bYovkBPBoMkKZfYL8IlV_fetka1hvXkXYc9Ss5BGTVMSTehxIqiUiQ9drmNC4rdTnPT7Tg4AtK954n34xWZQ2DVlykmqoDkR4CgN3HjG4h-kuM9kF89gf9CMfhhUKDN4X4qkhvCNEn_OxR0xIINyBf08t0emCsTGg8PzG7WaE6UEdG0swWicvdtk8= (2025-06-10)
- COP29: Complex Article 6 rules pave way to unruly carbon markets — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEiVdf6uBAKrAwX-unPYnp6iT7sXT0CQ5f2RG7GKZFEsJ5KdT_frhdMw2rI6rQHa9S2N4746Q_MdodFyqJbO2N_TOlzCu-PmibAACP_N4W3LK2FFty-Svb5ZnY5_O_Kxrw5I8-CYqR_75lY8VR-VPjK55i6_XTE2_yGQdGv7sPTSudW48113MFs5y_tfSoEihMuz_Ttmnu9_8VrzO-eJglAuRhV (2024-11-23)

#### [BCR] Lack of current public information on BioCarbon Registry (BCR) Standard v1 — [AV4-416](https://aurigraphdlt.atlassian.net/browse/AV4-416)

**Gap:** Lack of current public information on BioCarbon Registry (BCR) Standard v1.0 revisions, new Third-Party requirements, or ICROA realignment status as of April 2026, creating compliance uncertainty.

**Current state:** Aurex implements BCR Third-Party tokenization based on existing understanding (assumed v1.0 May 2024).

**Recommendation:** Conduct direct outreach to BioCarbon Registry to obtain the latest standard documents and confirm ICROA realignment status.

#### [BRSR] Aurex's BRSR XBRL render lacks explicit SEBI XSD validation, which is… — [AV4-426](https://aurigraphdlt.atlassian.net/browse/AV4-426)

**Gap:** Aurex's BRSR XBRL render lacks explicit SEBI XSD validation, which is mandatory for regulatory filings. The 'Industry Standards on Reporting of BRSR Core' (Dec 2024) likely detail this.

**Current state:** BRSR PDF + XBRL render (no SEBI XSD validation yet).

**Recommendation:** Integrate SEBI's official XBRL taxonomy and XSD validation into the BRSR Core reporting module to ensure compliance with filing requirements.

**Sources:**
- SEBI Introduces BRSR Core with Enhanced Reporting, Assurance & Value Chain Disclosures - Singhi & Co — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEREwFUDdqJl36Qs2al_EiQi2VgV13W8CKjmb3fjDbDoUfzAK6cxJTyL543TMQECvJD3fzxS9jMkdY8ZEGGCC6U4ThBBvcvG8XM5GADhWD8AtKJUov59cHsDNjCmvSUtkY= (2023-07-12)
- Latest Updates on the BRSR Reporting and Assurance Framework - Uniqus — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEq7NTqiPpQmFj_pXbhN56o0Duqzg_B1mxEYTmRP3lCG7zE6rjF6xiYc0_H6ytwEeHfY_FYrdj3KziLYuMJHjomj9XJp9cwi3wi7khUC94r8xDrBtvQ0FqHxZ2Igpf3yyVzoJGukrxAchS-nRZMXxIfw-TeFik3rxA-sGs_B41WxK5feob6TOBd818= (2025-05-27)

#### [BRSR] Aurex's current BRSR Core assurance readiness is not explicitly aligned with… — [AV4-427](https://aurigraphdlt.atlassian.net/browse/AV4-427)

**Gap:** Aurex's current BRSR Core assurance readiness is not explicitly aligned with the phased reasonable assurance mandate for top 1000 listed companies by FY 2026-27.

**Current state:** BRSR Core reporting is available, but assurance readiness is not specified.

**Recommendation:** Develop a roadmap to align Aurex's BRSR Core data collection and reporting with reasonable assurance requirements, including robust internal controls and audit trails, in line with SEBI's glide path.

**Sources:**
- SEBI's ESG Disclosure Mandates: Unveiling the Value Chain | Dispute Resolution Blog — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHy1LZPzzFRRb687ko4RHeDbFdhvqmS_MhLt4nDnSZpw7JR8hrhYpSQ9AMNB1nHmIzZmFYAe7u9SnSbWFOfYdyoB2Uq3SjNwSRFkf0AJcCB_QDNjVsLp7gD9GA-SicOooB-4lzT3oy2om737WW4q0cIxW7aQHj56OTFnxWHAp1g6DeasRW4lMGQ27tVm2NNxs9YjdiqNdqaDp7uHr0cJms8q77wIQhWrYFwc1Q7 (2024-04-29)
- BRSR Core Assurance Readiness Guide for Indian Companies - Glocert International — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHGup6Y-axStPjiFh3oXir78Z81NVe4AGS1FvVHl20HXk2S2wnQ-BRTFQcxECVN3KF9KlJ0a9kf7TLyrlXk3ACS_rCc9CWHU6BOMCK4b8U4VrimB4FWnbDiuGCdNgNiEopFEwbanFCABMMZ9qO-UbBpGXnRL7wnBURSEATJQaeP1XLriXrwpYzhVCvKQsrUEvX4guzB (2026-02-01)
- BRSR Core and ESG Assurance: What Auditors Will Actually Expect from Indian Companies in 2026 - Ecodrisil — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHCBAVZNkKTVAErv7dpebPjAZGfouSXZl8cr4vn9X5h09YoevkCealcjolVko5SY4cZoiAkHycPoUMD8ofM3z5C94xJWpqgBUA0kydx7Fgy4jwPgsWk3AFXb9GaLnN0ecMmltV0b4gVq8L78zaxoE88GleNvgKCxi-4ZkIa-tt-8TMs7PeCxGfENRirDsc1W7QdUXTRFtO2k_AvilfMKqnSZl5g6ALbeWERqR1FXg= (2026-01-09)
- BRSR Reporting Guide 2026: Complete Guide for Indian Companies | ESG PULSE — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH8actHzG5Q6it6GVtkJq0FmehcAnx3GDFctTN5dd3CZ_S79uBaex8L89qTl9EH_eiwIa6oruRRcDHw6SBGXiGolpLu148mNSjR0gjtCzWLI3HGCuDEowlLUb0rq1bbVdqgqAo= (2026-04-26)
- BRSR Core - ICSI — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF6jCo99NaXVhrEJAcVFl2XHCQkSeqv3BDXRKRx5ywY26ykl83V6dF98zU82AMMgwrRT2TQ0sRNwac6u5WXqtJ4Q_5v4YHizbHoiZb2tia5CfK5LesQch70dme1bylQl4YwIQItRvI23OtsAZE-HnVoGlSbGw= (2023-07-12)

#### [CSRD] Aurex's carbon credit retirement statements need to provide granular data… — [AV4-438](https://aurigraphdlt.atlassian.net/browse/AV4-438)

**Gap:** Aurex's carbon credit retirement statements need to provide granular data (quality, additionality, permanence) for EU customers to comply with ESRS E1-7's separate disclosure requirements, explicitly stating non-netting against gross emissions.

**Current state:** Tokenized environmental assets (BCR, Article 6.4 PACM) retirement with verified beneficiary KYC.

**Recommendation:** Enhance carbon credit retirement statements to include all ESRS E1-7 mandated details (quality, additionality, permanence) and explicitly clarify that these are for separate disclosure, not for netting against Scope 1, 2, or 3 emissions.

**Sources:**
- ESRS E1, explained: master CSRD's climate change disclosure - Normative — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFPUVSXjrspsn8XamvMF9CiiEul9IIN46SnKcjZNIPLW6zJv9DJS3qL8Ss0UP0n4_rv3egF9JEBpU7pf1P-7Oczswle3B1SHWGAgRXInmpoaYBSSCJqsLXSA0iPPqkVA== (2024-10-25)
- CSRD Reporting Requirements: A Practical Climate & ESRS E1 Guide - Senken — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE0a2Nn-yuBLqhcbIkgycmXFCllnZLcYCbFIXqKPGfCFQyPKFMK4S-CjwGzyfkDUkn4UeE_Q6JYnoiiLC88HbKJDf7BG3HVOpjEzujEbHljRju-ZdcqMgIDNqPVHf-5gG8shLYpxraXg6Q3UGJ3-cUnU6Yg (2025-12-19)
- Fashion Brief: ESRS E1 Climate Reporting for the CSRD - Carbonfact — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG3-8Iz_eHtcvb7WRmiOSIkfcHLIr9I6IbYhvEyXu25JaiuBkgDWPq2II8P9LKwuBAPeH6FTOfEoM2RgvELygbPL-C9nhBRQ3IJvEl4sO7DR1ah7DyHJZglaCapx8tPyhuvtuUP4TFgSot049M= (2026-01-17)

#### [DPDP] Aurex lacks explicit mechanisms for Data Principal rights (access, correction,… — [AV4-430](https://aurigraphdlt.atlassian.net/browse/AV4-430)

**Gap:** Aurex lacks explicit mechanisms for Data Principal rights (access, correction, erasure, nomination) and a formal grievance redressal, mandated by DPDP Rules 2025, effective by May 2027.

**Current state:** No explicit features for Data Principal rights or formal grievance redressal.

**Recommendation:** Implement features allowing Data Principals to exercise their rights and establish a clear, accessible grievance redressal mechanism as per DPDP Rules 2025.

**Sources:**
- DPDP Act + Rules 2025: Effective Sections, Deadlines and What To-Do Next - DPO India — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIAmNQUqdHmiUjIay9sMU0Lwdq3Wka6e2nY2F4_5ko17Q_DeVrTqVOJnwsCexIL_1_cwD3XPrFfSYEXWuDuaP6v0tJWErbOvXrWPu_pxkcRwXi_YUyZm7mhbTGDXwLaCEqwYVhCWEtAb3CGOBAhIJ9Qk_uM4rC7wmWX5o_lFAvzvouy9u09ad-_cmntinIb05LZso8b6GRHAoCvySQsrx4B79LtXiOOQ-kv-fOsTg5E22boKE= (2025-11-13)
- DPDP Rules 2025: What Changed + Phased Compliance Timeline - Glocert International — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHMjxrSxC79as1rBKSmpzaarQxl68TCkY0tgF4mKL_QMjUNIiQNRogp9qt9DmQWTIm_kVsbhJ2eWYFx6y16KyWsX0BgEcpOS1XZP6yNCRq99mnKW3mgWOPejp48GiBPGAbRmgLkGlyIDPMaryjHslo5zVDyczU7-gbbP3oZJ9-bFFRuhAVIAsE6IPgIrEEvR9-uZc6w (2026-01-17)
- Understanding India's New Data Protection Law — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH233fI1TPkl6l0i5lxJEcw_vmxFnMXYfbWsvqu1E_xm6aFB37hhwGBb778qbST7pXcuQDpcoSjmd2DU6zM9_mz02R0BT5NkPlnBYz2JG4NEcGB-qTkhFRypeGp1ENg6aqRPEu29WdH_-8G0-kjXcWhzB3gF34g8E9VbDqyfq8l7N7EsI0meK0SAY2NOyyS4rsf6cYgLQ== (2023-10-03)

#### [DPDP] Aurex needs to assess if it qualifies as a 'Significant Data Fiduciary' (SDF)… — [AV4-431](https://aurigraphdlt.atlassian.net/browse/AV4-431)

**Gap:** Aurex needs to assess if it qualifies as a 'Significant Data Fiduciary' (SDF) under DPDP Act 2023, triggering additional obligations (DPO, DPIA, auditor) by May 2027.

**Current state:** No explicit SDF assessment or related compliance measures.

**Recommendation:** Conduct a formal assessment of SDF criteria based on data volume/sensitivity. If applicable, appoint a DPO, plan DPIAs, and engage an independent data auditor.

**Sources:**
- Decoding the Digital Personal Data Protection Act, 2023 - EY — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIp1DfZvRm9wtUBeUWLIdzAhQVVzd6OzUjc8xzduOwCZsPHYDP70Wu4NkfIsDLnpFyov1CjC-Msaaen1h5bkjHG92kqADSRK9JjSKQQP_DS2wFjceacr5RA-IOjze1om4oQMW6lDSvQj7LvI9OOY_kpxkpGXiFhjbhTxJCFu5T3w9ZchN_Y_E7kuYwk6PO3nmj_aSsK0Ikv_NqFLTY4u4r (2025-11-20)
- India's Digital Personal Data Protection Act, 2023 (DPDP Act) vs GDPR - Securiti — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcujb6aXcd0WLdObs7dBPuSkB7TkR0HZybYxc7sB4gOaZvDeLKv66MDBBUSCDKNcO35G6QbyIcLKSUEfzvpQwgy-B-o5PDe9rlMPSlwKptz_Uy-jSqUUhqqpcmOWwGXwu1o5KBbtFwaDSq21_cQF0zr5KpSXxteQLewknEhRzLQJY= (2024-01-24)

#### [ICVCM] Aurex's tokenization flow does not explicitly support tracking or applying… — [AV4-420](https://aurigraphdlt.atlassian.net/browse/AV4-420)

**Gap:** Aurex's tokenization flow does not explicitly support tracking or applying ICVCM Core Carbon Principles (CCP) labels, which are now a key indicator of market integrity and buyer trust.

**Current state:** Aurex tokenizes carbon credits but lacks explicit CCP labeling functionality.

**Recommendation:** Implement functionality to identify CCP-eligible credits based on approved programs/methodologies and apply CCP labels during tokenization.

**Sources:**
- The 5 Best CCP-labeled Carbon Credits of 2026 - Regreener — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEdc-ctGgBwrPkt1bHWNOnGdfIjmUoCdKs1rykp_n3S1RbIGuvJ7YYD8Vmfb09Ultt85eeFXddET1zFmFwCY9tcb-ByUxevFQhwMNXPsZD4IGrtmawa4hmIS_BC95eCvRKWNK7qif6xssLgF6Grxcqm-Z6sUhsoPSJKLJKJzA5R09Bh-wO-P2uP (2026-03-10)
- ICVCM Adds New CCP-Approved Carbon Credit Methods for Isometric, Gold Standard and ACR - CarbonCredits.com — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEQJZJOXHLa5YbwtOy_rgbNG1IG4Zv3_HA6OuIRnXJ71qjoPvVm87y2QLzdgFJFAS4ZQnK6pvsI4peY62l4uR4ECGfS3xxGmcxWkxI-O_szH1os-M0X61Sc4opfz3fbz2W5mtCaNh20DRbNjrU1eInv_n6qaWcwL--1UlZewl6xwVtweXsWyUvUv8F9UJLWm6duJur0bR259Fp3blt-BGOxmI55-pgMWYpcjA== (2026-02-10)
- Integrity Council confirms carbon crediting program Rainbow as CCP-Eligible — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHck0kccQsEw3fWLLW3pPctAbW4vXjapIp6uofsuz5EOz3TyB1oxow6UseKQiBn5a20o00I8mQBsXWNfdygaTVAPOGx5ggMa37VkAdNUJzcPabc-9YUjb7MT-_e9UU5ALlb3Puu42FJW2ft6OgfXnZ4jl4TCuWd9YcyIdWBAj60MN7YNlijxAzINCrbvxZxwBuMLHLu4d24oA== (2026-03-05)
- Reforestation, IFM & Rice Methane Methodologies CCP-Approved - Integrity Council for the Voluntary Carbon Market — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE-sJBK-Q9tB6DMbu-cujHe1FPT0S8N9imlLoUFUcFF8-1X8HHHQYKnadEe9U1cqnLM9u_wSP2uhNeeO_HvNatN5o21lH2uAwTVIml9R-nRaje47t3WjdVQZ69OFptvWsT4jmgZkACkmV1fOBQf8UfyXl2w0mRdLxB_L8z1NtoS69H_EuxbRi2hbs1IstAD-35XvWqaABXDhXDpH8t2tJcZJpdceBtDYFbw86BWxiwhAkU--fpmbm4gxNY3ZY3OCfyEyw3EwN_JYl1aZcq9ikYOmw== (2026-02-05)

#### [ICVCM] For cookstove projects to be CCP-eligible, fNRB calculation must use MoFuSS or… — [AV4-421](https://aurigraphdlt.atlassian.net/browse/AV4-421)

**Gap:** For cookstove projects to be CCP-eligible, fNRB calculation must use MoFuSS or the CDM default of 0.3 for a limited period; Aurex's current fNRB calculation method may not align.

**Current state:** Aurex tokenizes cookstove credits; specific fNRB calculation method for CCP eligibility is not detailed.

**Recommendation:** Verify and update cookstove fNRB calculation methods to align with ICVCM CCP requirements (MoFuSS or limited CDM 0.3 default).

**Sources:**
- ICVCM CCP-label tracker - Calyx Global — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGtMVoyZV4A4522jwXufbByRWVK0vcnl-YMtf3jYJBpI8hrWNAfrJpa3l6Qssc5hoFq8ynED2MxZqdi5s-06RMKpMinned9Huo8a7_0b8h1twJkt-GiPwXP_9ueDCCkG22VVQceQ1lRqkIG2iDCh-7GEdo6-L65WlJXIP_ROeW9Vhk= (2026-02-05)

#### [PCI-DSS] Aurex needs to confirm its exact legal standing with Razorpay regarding RBI's… — [AV4-433](https://aurigraphdlt.atlassian.net/browse/AV4-433)

**Gap:** Aurex needs to confirm its exact legal standing with Razorpay regarding RBI's Payment Aggregator (PA) guidelines to ensure it doesn't require its own PA license.

**Current state:** Razorpay multi-currency (INR + USD) is used for billing.

**Recommendation:** Obtain a formal legal opinion or clarification from Razorpay and/or RBI on whether Aurex's specific business model necessitates a separate PA license or if Razorpay's covers all activities.

**Sources:**
- Cross-Border Payments: Everything You Need to Know in 2026 - Razorpay — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGLsffBYo80Mb0xEo16rr7sIpxDNbzc3AutsVaBtmJCVMi_A6mPaxjF0WcC9_KN9jL9kTpFD73ElQBHdU_dIhm3S4XHNktstGtw2qcbdxb4n__2dAqz44EQ4Uee5X4-1GDUKHZs18NkNiTftHc8hdaE (2025-06-19)
- Foreign Exchange Management Act (FEMA): A Comprehensive Guide - Razorpay — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGBe1JvYP6M8pa8jtWvtwhLE3L4lxjveX6SC4qKiFB35VBOhFGN785mYp7rin6qCyS1VuyhXFSJQi4joMJdIeAa-PmxEYt0U69K-JF_q5C1XqjocLJ_ilGYrCQWXLW0BF-R3r5l11b5tvhMaycnhPfqHxx4BHfWK7Zw== (2025-10-10)

#### [PCI-DSS] Aurex needs to explicitly verify that its USD payment processing via Razorpay… — [AV4-434](https://aurigraphdlt.atlassian.net/browse/AV4-434)

**Gap:** Aurex needs to explicitly verify that its USD payment processing via Razorpay fully leverages AD Category 1 banks and adheres to all FEMA regulations for inward remittances, including repatriation timelines.

**Current state:** Razorpay multi-currency (INR + USD) is used for billing.

**Recommendation:** Obtain documentation from Razorpay confirming their use of AD Category 1 banks for international transactions and ensure internal processes align with FEMA repatriation timelines (e.g., 15 months for export proceeds).

**Sources:**
- AD Category 1 Banks: Comprehensive Guide for India's Foreign Exchange - Razorpay — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE2odUoN-MKpT3_pON9LrkIt1gqf0h2VWJbMZIY6LHjHqaxUC5ZQ0jCxDwnbXuZEyE2N47SFnZukpTwSepEdc0t9XWAAEO8oD21b0dyl2X_u925WAhYWKxofxZa4JCwyLp_IwPbTRVp_m3vPo3aQ5hlmn6HFg== (2026-01-09)
- Current Account Transactions Under FEMA: 2026 Rules & Limits - Razorpay — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEkQsBTSckTUkJhj7oWzixJaHMW8Wwcxgr1jYc6oxm0c50gBfrazP-gzYWHGHnYwIqX2o-z0tZ1IQUbhHhW1Fw95XtykTHHa5WYL4wneIDfeRETxMFWwpQnZa56aAh1vCmSD0VYPoIxwWdtzUnimR1Xma5Kd3_kx8n7tbGf (2026-02-09)
- Foreign Exchange Management Act (FEMA): A Comprehensive Guide - Razorpay — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGBe1JvYP6M8pa8jtWvtwhLE3L4lxjveX6SC4qKiFB35VBOhFGN785mYp7rin6qCyS1VuyhXFSJQi4joMJdIeAa-PmxEYt0U69K-JF_q5C1XqjocLJ_ilGYrCQWXLW0BF-R3r5l11b5tvhMaycnhPfqHxx4BHfWK7Zw== (2025-10-10)

### P2 — backlog (4)

#### [A6.4] A detailed registry interoperability specification for Article 6 — [AV4-418](https://aurigraphdlt.atlassian.net/browse/AV4-418)

**Gap:** A detailed registry interoperability specification for Article 6.4 is not explicitly finalized or publicly available for integration, beyond the mechanism managing its own registry.

**Current state:** Aurex's two-way bridge implies registry interaction, but specific A6.4 interoperability is undefined.

**Recommendation:** Actively engage with UNFCCC Article 6.4 registry developments to understand interoperability specifications for future integration.

**Sources:**
- COP29 & Article 6.4: A new chapter in global carbon markets — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFVbV1c5LVYmuSeehhdNCcuNYxkYUbnxDEd5JoLwrvLQSdSxvKaij9-jqQx91_32XFms2_3nColqHOF0SjSEdvU4LOOMd_QmNiWOIOxYq-KGUGZoDHMDsYwYzvOu7xXvPQ_eqD3vMKRNfhBWuL0iE5NFsQ1Wp0ghlZgrLgUHnBNG2AsRmQIFZm7aY7LGN7NJ0mkw_Z7D8nC0cY= (2024-11-26)
- New collective quantified goal on climate finance (Decision -/CMA.6) (Advance Unedited Version) - World | ReliefWeb — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFetAeXXBzALJ9rUx4l-i-yodUMhLkwRMwINbqQfMi3QPiQ02KEA7_o7I5qSGgvsCPARJzwjGVXH7LrRuzGlmfa8x4YV7RwKyrs38ng5NUI8pTiwuA-ogq6gmP_9X4rGeC8KNV-algLjYDfkHr_ScMcMLUTRyGNH2VRI709BMVufuhNRcMAfyKWZB0wxW3LKIP7uGu_4oD_cr3MPxqsIgIAMWHgzKETWuCUMWHy9RtjpGDy (2024-11-24)

#### [CBAM] Aurex needs to clearly communicate to EU customers that carbon credit… — [AV4-437](https://aurigraphdlt.atlassian.net/browse/AV4-437)

**Gap:** Aurex needs to clearly communicate to EU customers that carbon credit retirement does not directly fulfill CBAM obligations for embedded emissions in imported goods.

**Current state:** Aurex facilitates carbon credit retirement.

**Recommendation:** Provide clear disclaimers and educational materials to EU customers, distinguishing carbon credit retirement from CBAM compliance requirements for imported goods.

**Sources:**
- Carbon Border Adjustment Mechanism - Taxation and Customs Union — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHewxo_JW3RhBzA70H9U5iBP_oKu4t_KHl2vP50AbmyfDnDx5HWiVopxds_KBcvJ1Z1qQTz0zWmL4g6qP1pM27ra6gkSc3WpkHS0NYX68FFvOaWYesrajcWSY_W3SaQksAzhRhvJfRBPNVPm2IPn1jH8osct4RnrUqpIDQIrDGwvjPzzIq4 (2026-01-01)
- CBAM: A guide to Carbon Border Adjustment Mechanism - One Click LCA — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE7nb3MXSK0bGmXE50yjS9oDcprEqOe9NeNkfQRkrOrnilQXbKocu6MHLqc-A0VBIzsYa8QM4TrYxxkeiYP6IFeKb6C5Sf3sSfpQcSE5oNOEeRG-e3_2NIyzsLHvbB5JOr6dqtS_k1_YD72bZBLb29t1jNnZps9lO8vZr31tNCUj_njJs34ZmCLz3jAf-PKGpI9lGbaafINmV-7J-XD (2026-02-20)

#### [CSRD] Aurex's current reporting (BRSR, TCFD, GRI, CDP, SASB, ISSB) does not… — [AV4-439](https://aurigraphdlt.atlassian.net/browse/AV4-439)

**Gap:** Aurex's current reporting (BRSR, TCFD, GRI, CDP, SASB, ISSB) does not explicitly cover ESRS E1-7's specific requirements for carbon credit disclosures, which are distinct from general emissions reporting.

**Current state:** Reporting for BRSR Core (India SEBI), TCFD, GRI, CDP, SASB, ISSB.

**Recommendation:** Map existing reporting capabilities to ESRS E1-7 requirements and identify gaps. Develop a dedicated module or enhancement to ensure full alignment with ESRS E1-7 for EU customers.

**Sources:**
- ESRS E1, explained: master CSRD's climate change disclosure - Normative — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFPUVSXjrspsn8XamvMF9CiiEul9IIN46SnKcjZNIPLW6zJv9DJS3qL8Ss0UP0n4_rv3egF9JEBpU7pf1P-7Oczswle3B1SHWGAgRXInmpoaYBSSCJqsLXSA0iPPqkVA== (2024-10-25)
- CSRD Reporting Requirements: A Practical Climate & ESRS E1 Guide - Senken — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE0a2Nn-yuBLqhcbIkgycmXFCllnZLcYCbFIXqKPGfCFQyPKFMK4S-CjwGzyfkDUkn4UeE_Q6JYnoiiLC88HbKJDf7BG3HVOpjEzujEbHljRju-ZdcqMgIDNqPVHf-5gG8shLYpxraXg6Q3UGJ3-cUnU6Yg (2025-12-19)
- Fashion Brief: ESRS E1 Climate Reporting for the CSRD - Carbonfact — https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG3-8Iz_eHtcvb7WRmiOSIkfcHLIr9I6IbYhvEyXu25JaiuBkgDWPq2II8P9LKwuBAPeH6FTOfEoM2RgvELygbPL-C9nhBRQ3IJvEl4sO7DR1ah7DyHJZglaCapx8tPyhuvtuUP4TFgSot049M= (2026-01-17)

#### [Verra] No specific updates affecting Verra VM0007, VM0033, or AR-AMS series since Jan… — [AV4-425](https://aurigraphdlt.atlassian.net/browse/AV4-425)

**Gap:** No specific updates affecting Verra VM0007, VM0033, or AR-AMS series since Jan 2025 were found, indicating a need for continuous monitoring of these widely used methodologies.

**Current state:** Aurex supports these methodologies based on existing versions.

**Recommendation:** Establish a continuous monitoring process for methodology updates from Verra and Gold Standard, especially for widely used series.

## Process notes

- **Run 1 (single prompt):** `gemini-2.5-flash`, hit MAX_TOKENS at 16000. 8 unique findings extracted. → preliminary doc.
- **Run 2 (this run, split prompts):** Two prompts split by topic — Batch A (BCR / A6.4 / ICVCM / CORSIA / Verra) + Batch B (BRSR / DPDP / PCI-DSS / AML / CBAM / CSRD). Both finished cleanly with `STOP` (no truncation). 24 unique findings after dedupe, supersede the original 8.
- **Why flash, not pro:** `gemini-2.5-pro` free tier is rate-limited to 0 requests as of 2026-04-26. Free-tier flash worked.
- **Grounding:** Google Search tool enabled both batches; combined 60+ source citations across batches.
- **Tickets:** Each finding has an AV4 ticket with labels `regulatory-gap`, `gap-<area>`, `severity-<P0/P1/P2>`. Priority field mapped (P0→Highest, P1→High, P2→Medium).
