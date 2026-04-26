# AurexV4 — Regulatory Gap Analysis (Gemini Deep Research)

_Generated 2026-04-26 via `gemini-2.5-flash` with Google Search grounding (29 sources). Run via `apps/api/src/services/research/gemini-deep-research.ts`._

**Follow-up (from same session, carried over here):**

- Re-run with larger scope / better model: **`docs/REGULATORY_GAP_FOLLOWUP_RUNBOOK.md`**
- Jira: **`python3 scripts/jira/seed_regulatory_gaps_2026.py --dry-run`** (then run without `--dry-run` with `JIRA_*` set — creates 1 epic + 8 stories from `scripts/jira/regulatory_gap_2026_seed.json`)

## Summary

Aurex V4 faces critical gaps in Indian regulatory compliance — RBI Payment Aggregator licensing and SEBI BRSR Core XBRL validation are immediate blockers for billing and reporting. Significant engineering and compliance effort needed for evolving UNFCCC Article 6.4 PACM operationalization, ICVCM Core Carbon Principles propagation, and CORSIA Phase 2 eligibility. India DPDP Act compliance review pending.

## Findings: 8 unique gaps

### P0 — production blocker (3)

#### [A6.4] The UNFCCC Article 6.4 Paris Agreement Crediting Mechanism (PACM) is not fully operational, with new methodologies being approved and published throughout 2026 

**Current state:** Aurex supports Article 6.4 PACM activity lifecycle (Activity / Methodology / MonitoringPeriod / VerificationReport / Issuance / CreditUnit / Retirement) and has Aurigraph DLT V12 tenant integration.

**Recommendation:** Actively monitor UNFCCC Article 6.4 Supervisory Body announcements for new PACM methodology approvals and integrate these specific methodological requirements into Aurex's activity lifecycle templates. Track the development and release of the official UNFCCC Article 6.4 registry and its interoperability specifications, planning for potential integration or adaptation of Aurigraph DLT SDK.

#### [BRSR] Aurex's BRSR Core XBRL render lacks SEBI XSD validation, which is critical for compliance. Additionally, the mandatory reasonable assurance on BRSR Core, phased

**Current state:** Aurex supports BRSR Core (India SEBI) framework and provides BRSR PDF + XBRL render (no SEBI XSD validation yet).

**Recommendation:** Prioritize implementing SEBI XSD validation for BRSR XBRL renders to ensure compliance with filing requirements. Enhance BRSR Core reporting features to explicitly support reasonable assurance requirements, including detailed audit trails, clear KPI definitions, data provenance, and internal control documentation.

#### [PCI-DSS] Aurex's business model needs to be definitively assessed against RBI's Payment Aggregator (PA) licensing requirements. If Aurex collects payments from customers

**Current state:** Aurex uses Razorpay multi-currency (INR + USD) for Subscription / Invoice / RazorpayOrder / RazorpayWebhookEvent.

**Recommendation:** Conduct an urgent legal review with Indian regulatory experts to definitively determine if Aurex's business model requires it to obtain its own RBI Payment Aggregator license. If required, initiate the application process immediately. Regardless, ensure full PCI-DSS compliance for any systems that handle, store, or transmit cardholder data, as this is a fundamental security requirement and part of RBI's PA framework.

### P1 — needs action this quarter (5)

#### [BCR] Lack of explicit confirmation of BioCarbon Registry (BCR) v1.0's current status, any minor revisions or new Third-Party requirements since May 2024, and explici

**Current state:** Aurex implements BCR Third-Party tokenization based on existing understanding of BCR v1.0 (May 2024).

**Recommendation:** Proactively contact BioCarbon Registry for the latest standard documentation, any minor revisions, and explicit guidance on Third-Party requirements and ICROA alignment to ensure continuous compliance.

#### [ICVCM] Aurex's tokenization process does not explicitly support the application or propagation of the ICVCM Core Carbon Principles (CCP) label for underlying credits. 

**Current state:** Aurex tokenizes BCR credits. No explicit mention of CCP labeling or methodology-specific CCP alignment.

**Recommendation:** Investigate how to integrate CCP label status into the tokenization flow, ensuring that tokenized credits carry their CCP eligibility/label information. Conduct a comprehensive review of all BCR-eligible methodologies supported by Aurex to confirm their current CCP approval status and prioritize integration of CCP-approved methodologies.

#### [CORSIA] For tokenized credits to be CORSIA Phase 2 (2027-2029) eligible, they must carry an 'Article 6 Authorized – International Mitigation Purposes' label if issued f

**Current state:** Aurex tokenizes BCR credits. No explicit mention of CORSIA-specific labeling or host country authorization in the tokenization process.

**Recommendation:** Implement functionality to capture and propagate the 'Article 6 Authorized – International Mitigation Purposes' label for CORSIA-eligible credits during tokenization. Review all BCR-eligible methodologies supported by Aurex against CORSIA Phase 2 eligibility criteria, specifically noting any exclusions and planning for updates or transitions to compliant methodologies (e.g., VM0050 for cookstoves). Investigate the process for obtaining and verifying host country Letters of Authorisation (LoAs) for tokenized credits intended for CORSIA compliance.

#### [Verra] Specific methodology updates for Verra (VM0007, VM0033, VM0042) and Gold Standard (AR-AMS series) that are BCR-eligible are not explicitly tracked or integrated

**Current state:** Aurex tokenizes BCR-eligible methodologies, implying reliance on underlying Verra/Gold Standard methodologies.

**Recommendation:** Establish a continuous monitoring process for specific Verra (VM0007, VM0033, VM0042) and Gold Standard (AR-AMS series) methodology updates, particularly concerning CCP and CORSIA eligibility, and integrate changes into Aurex's UC_CARBON template. Review any renewable energy methodologies supported for ICVCM CCP alignment. Ensure cookstove methodologies comply with CORSIA Phase 2 requirements, transitioning away from TOOL 30 for fNRB to VM0050 for 2027+ vintages.

#### [DPDP] While the DPDP Act does not formally categorize 'sensitive personal data,' Aurex handles beneficiary KYC and other personal data that, if misused, could lead to

**Current state:** Aurex has a KYC adapter (Sumsub-pattern), email verification, onboarding wizard, password reset, and retirement with verified beneficiary KYC.

**Recommendation:** Conduct a comprehensive review of all personal data handling processes (collection, storage, processing, transfer, retention) for KYC, beneficiary identity, and retirement statements to ensure alignment with DPDP Act's stringent security and privacy requirements. Formalize and implement strict data minimization and retention policies. Enhance consent management to explicitly capture and manage consent for specific purposes of personal data processing.

## Sources (from Google Search grounding)

- [argusmedia.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFOKjoT33l-BC7-CyRupcsCtAK8N3yHKDegcyUahlh3rC2cMhe0B_m5UXEeOkUmlgvapwvarqd1H2TUmct-oJSV7xlFhAyLS0oKX_Jqgo3LUwSTJI6PJulfbAF7kpvVI46xYmLRfLnjxvuePshVVTZyD4eArpMqUSeyRZJbvYiPGSNCFap2161_VBwmMFOshn0vvCLKBeNeytr6xQByEvCdTVY61meCXZQtCol2oa2vSd2lW65pDTdrjztA6Q==)
- [abatable.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzU9Y668-M8G4i8iigeQ-da7BDRs7RSQ1PVioehis0n9Agile5e1ujKMism0o-NXvtzGxldAg1LYd0vpAwSruOSHnluX3hxiReYRjdcndUTtnHaq7VCdsi42F0S0gkCy7BuILMDyjiM9OZXx2HjYqA8UuXTMqyVuE4x0I=)
- [carbonherald.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEruLYeEQfVU8aV48NbsOeJ9f5AjhG1gcbWirsTufepEC2WtYpbWej2hTVlkU2QuhzQKEMoasgKE8ahUgC9tkRU9qH4U9yBmAslgYyJL1nYsm_MTQs-xI6fil3ZFhMxqEY4R7ASlL-5ljP0z6JmNaNfnFMkNiCaF-S2j-LlECwCVzkfdi8ydwYBChg=)
- [kpmg.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEdfNdlQ1v_SUlWOrEoeBZmOmpeSAbPbiGLdai4DWzjwtWzSM7iaqt8C1gPPyiHrxKI2syIkpMlxOlwQhLUlEih78FxWvktSKZWJfV2953TZzzbYjVxL55k72reGoyN3uK-2eNMuchMHxAseP8evhUEQwLfciLdADfgwafQLXDwK4jiV9dVMHC4B5mUui_ghxY7xDuO7PKIsilbqrBBI46jcYkE3NK4Bhug5QEDksGZHlzk2h73zJu8bqLldYQo8MLdLuMNyGw_L_AC8U7iqjUKzCT8)
- [uniqus.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE7SY6Xz3appeV9Omce9GNK7ojt3PWZJ1knl11tPA6HEKN6kE7l_6wmOdgKxqcD60mvHNWgQySM7cO2cU9I0VLjCTjEQT7FveE2qEo3griWx33o9bETqGbJPJm8IUvHfMHG)
- [ascentium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERJvK4AgqRmJo35u0L61hpSP2BTmqjMR1b2Uks00V6sABQt2Q1FSwuRTzTd105vha91uaTNnlJZr6u9KUA8pBqN7WHbcb-R_rg2L9yKFoZePVvt0rZncz2xi4p7QMdn-gAh0LozmdAJiRxLdIVtWBqJ3VcV9KXpKOeDjFc-CCoYvOVX0w1ro5IXQqx6fkC86ZORmLnVUfPTQ==)
- [ca2013.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4T-CvSRYBLgX829KJka0SHllUUj2ouMTga7psT6FUYua8EvEp6FCURthbTqRKmmIFBV255dzABBhJkI9mqF768qrv8Og7oAc1rbtYDucF-E2Dof1PwC_M1qUPICBhlWdNpypc74Nxf3PLkDg1A_Rv15sJg4xxYrZBspnlv3ICkJX__2c=)
- [glocertinternational.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGilYagumwI_3YzWjpqtxUVMo9FfWkXKqOqIXABJtvDkCIokotg4-OtKGTdOKe_Du0SccDkmh2jMzndEHtkJ7a7Y41OS2_HL5Ldx8siAILXTQYx3hNochagzWIZpE_BKdHO2uOWMQM1Y_EkEWVv0O29lKMl_UkOqF6VDS88hjrBk8MZSZ1I9K3SOyaEUtcLcaAVZq3DtQ==)
- [icvcm.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH4X7UHBPPjA2yuGhM_qOktMnqpcqfS3OMvv5GPlGsEz9fWVcbENmZDrI8vi36UiA8D0dLPZkO6hF5DXWPW2jXy9BhbkDOzL2jvaYl_88pVNWe2Rf-dXrqANAXbM28r7Mo6K8bJTtv4c8NiPi2-dSfqL1hgloerZZK2DEChiHE7Ca5ZQjj2QLqp6AupUdGfB8a0wqpyYCRO55nD6urvXvTzPrcCsDy3v5cYHdo-h_hHbb_JWC7o8xaOlq2tCQXFbWdISqPvfoTYFENf2OhNRKfE6PM=)
- [calyxglobal.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFuikfJn2P4jyCtKfkGeEwjOxsOc4-on5ZwSTRTU5IX-ZzZDxLrorGI9BigE22FjNq6ILAjs6NSw26Qbkm7GgiiVgoKt422PduTApE399FGdXwqHEq_mbozajXAr9w_khoe3iQBlloUTNtCubpoZp_myf0mQNmrmL5F_Keeyo-Qzdhy)
- [senken.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHuKUNW1SFjFosqpHYqUmEtzYCKUVDjZ5nl4ycbZjm5qs0ajVu34nr7CD8qexNpROyOJc4j-w22I9XKzk4lojrxjsjI9mQf4V_YjRbPnrH_RqQFu5oDQl4cG81TWuqjQ0cciFvs6WcOJI91cRPaZLf3-DWa2jIoTebOnMJssulIWEXSP_Nt2GaIPtpKLkVtmIE=)
- [regreener.earth](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGd3rDMs1hyhTEX7lHHc7UW9k66okOzna7nCWF7Yz78VLmOHyn8AaRHnJboGW3Wd_fipNZzJWFcSyp-KmC6QSwNi9GXTRaOFDq01WDXU5cnmA8VMZp9hbZFayrH2ffpRWONdllqtvmuFVp2RN56rRHC296EXg26EZFSSSGzGOEbP8AzPTvau3G-Kg==)
- [verra.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZo8PAokF-HfD4cnShIMF7YFhuf_CIhkxLvo4rH6ASWzpO6Zzssb8LPZuSVt3JliaT8XLtYj7ZFWnt_1jfz7eIQf9M8oyPw9OJmFwG3IuPBKb111fc2_Ugy3CP8lU46Av1mCwwq4vuF8pBtpfiPvbec-vUVFqUKs5GxlaJ90WEYw==)
- [goldstandard.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEqIt8embHldwV1268TwVsXA29l780NLzArEfM69hizpUyAc4pypCUBMV9Z_QZGDj5FI2WUyg0JGgrRDxvb0ZA7fQajGL6dU7yqfps5ZHsGVOEPqMznoumkiDrTeIUf-ZXPbimMWNXKqvRK5BeXfiSFUvxcDcRClLLnnxPCDfFmmZs8Z9QORua7nQyg92NoiPFYu4rKWdGy8n1M)
- [greenairnews.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGDxeW1zSdHpf4ScI_nWBcJBCF4YfRgo7iiMVNtRPiKWmHmMttmxo5zf7oBByv2XdnimJX7Naa0zVw2I0lIRr0gnJfq5Fx3OMdJpdakCc2Jz2wW3CzoF8Cg-YdnqJPlrA==)
- [southpole.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHomehvg16hdOssHF9ONd88-sRRgejGH-CWRdMAZUiiCw7cl5kUaBAQe0V_dkg4b9o0rA1432DUykIEaxo9Bu-ExVA0DJTtfz56gx5YaTGUds8Mx1lgcPU553O8QRmDyMk-5g-rnSi6BfhlCqm3496ozTATvLm0SGY865Gkmuexun4Rg_rX3LXSu-BQ-yjNVEoXupubyJCIDJTH8ztoCG6JMY5wQbGvDYM=)
- [acrcarbon.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcssbhIcnk5vaq_DoATa4zGkNlBqks7NqFdkFV2tqJLVIsaFd-bQS0oWUHMB-UxA_7F7pjmguDyV5LdbOkzjqiH2duGoD6c9tQHdyzkt6CZuXTN5zq9t8RloYWlJoqYM0OGn6cTk7DY6zzwpIENP-gfOvEQTkoxD4LvgiuBJ2r7y_wtmDX8LDG9YaMulWz6_U22g==)
- [verra.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEJiFHX4PSZyGjVcwrH5nWttRtcwTez9yyZZf_fSMsXQvhqYmT7V2G244bqrvPVVLWUkwoEBHdpeaZkAVFG6JibuYGjn1SBF0AafiC_S1fxCrmZw651CrDDGXBGgaBl7wF5ilDMwhiGznY7E8vjrHqj24o4ZfXoOE_FfecF7xy3JCLbLl5FF5YdxY0CsSIXct1-B-0CvZcSCI_ZgL3Y-dB1gdo=)
- [verra.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGi_teFe8iFNK7DdGBbeVZIPXztP2JwtTEb2aNNSndJz0lTx0WupgPJ5fC99QR_xiwjQVAhW59AEUNZOgkeiT7zyRzrMStt4Ku1lN2hZgmEhVJyhMFRdZhHB1Bl9t17D__W10T-CowWmUFXDbVERyOsA5_i3ZdUww==)
- [verra.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFoV4czpoBF14v5o1C8WeMfTIwsfgdyLw3tC1p_f31h9Qqg-l6LviIBCAnVQN7eqqewvV_WZsDmrUkpqgJ4wlAvXmhFtaCAOuk2Jq_jjl78U-zbSYJVyqN8BIvGMF2SB_gjtitMxkmakf_navYCc1QyDuFf8a7z2zKcwpRIuw==)
- [ezsecure.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF9QKWXrLfJ-YKPdimWAdjWQwZCZx2YjN7u7cCeajHOtL0gnQJUYDfOyGX2LiBXLNuv8JuQv6qmmKNFl7J6fLgF-LgkTu_vtoxexZLTgooGgZlj6kCWPu4QbxzBanHlnnbDrRCmeOyWPkrsI7HIwV6X00hwJabIaqZc-KMumQ2a_09uHF6FNUn4PkTPBqtMwIVcEU42YpKibaRDN24q8o5xwHD0lULKBg==)
- [hypertrust.one](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHm1a6v7H6gg2d0oAwS2bDmzLl6WrTfA2pp3DDEb0rraqj8Ra1oX5z_wHE1C6_lPZL5KmRzGM-f6BoPbW9LFicoqEXunCAo7dxtlKmtw_MzIqFpLLVO9rGg6y3IsbUVR0fkNhq5B9gzojiVWGNUPWe-bMsnGZc4m_CCwMFt)
- [consent.in](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHh3MIgnOj0eADXtpPgurTT2SkKsuNzQj7eL-NnXQuKSPyORwTxfne1vRX13s6o3j1Qn3FQdPTQHDxEjpu2nBSBgZj7cLXpTIPY_OSEjOZze_dqX43Wjn3pKWorcQPwgePJcYs4Cw9SeoIpJg==)
- [ksandk.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE_1GJE8TK0Krn6tgoCtGnIbC0QDrTxc-mKrLv4nymtmCcwjShdbTabCGiofxXaCnYKafzwN13kl3RVFg_eWFWTquvhnkPW6e3MAtfkeF_dLZWJ7Bp-9974ns_LlRPqzZ6ESPe-eQKIb1zL8nXSz1wmMY9tKHqmAa9e87hkgRr6f2O2-AT6dFAek9i5W4gGt_7xAMk1lBdfr0lKfsUDgVmb1aaWUQ==)
- [dpdpa.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFRCi4Uwr_it9g30gY5D7cqSbdLGx3a4asL8BpRc5DJhIFvBhjtTMy89iwLnEA1EhHGBNPiHIkLvwFW76qX3WcCjRpVQgMBePAW_VlxcmeHWjsSBWw02wpqMw7-_hOs0A==)
- [corpbiz.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGd4jgGVWE87amK5eDxVTbAljrUnBEbtaYpgbT0gnz8wQM_T5b8ha7OONSR9tLcJ2oskp8s8DKAIMRtUdQg_TDmyPaxo3yj9ty7UzdBkmFtq1GXRFc12ww_2q8CmLBFFLbmy9eLP-jYxA==)
- [finlaw.in](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEvYmvCScho0TRzMxOfQc-arSbDBWBaSpYXKdW8kAiV8pggtvipEuzsNJGndvj3T7lLPvg43Kfvi-71F7l_2wTjEtQErwr1_UD8bT3lCbWq8lnI5UTr5v8rDWV3sbEoOAmRmwwI19AOZ0BokvsqvdKvOPIXP4sRJdLyuVZbOF1b2nBeFBtp9C_-TA6b9RLVrlW3YwMr2ntJ_Q==)
- [corpzo.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHmSTP15gPX7MUsA3qT1TvHVUv1QdLqxBB2U54i20GiqiwLiRNXJk_HFrd5HwBuwi-wS2N0zSLEFBEUNwPtzuQ4jDGaZvkR3weE3RfkhSC5SF5GAjPxF7TLvw1ZF-cSWPmNp7Rc4dnTQxZke7Rxr2abcP4MeZB8JkZeC6UfPwhzBToZqC8U5Tlp3Dqs)
- [enterslice.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHW0XCFffwyQ2WR5Tbfr5CVgRmgO74OGonXe3-FFbFE5wBlrFsFwRAAQjPKdGfdoBg4lAi__AGctJgsc5z0ySM0Rw-atp7KF18gBbSeItobzM3vbggAsHO6SjyfokFM_PJFEGWNpfK-9UUaQPflwaSi8U85u7-QbEKqjd1S3vw=)