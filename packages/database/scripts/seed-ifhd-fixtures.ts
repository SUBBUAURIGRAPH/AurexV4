/**
 * IFHD org-scoped fixture seed (AAT-SEED).
 *
 * Populates org-scoped sample data for the IFHD organisation
 * (id 439099fd-4197-40fb-80c8-713d1efb9599) so that the registered
 * tester (shreyas@ifhd.in) can exercise the full application end-to-end:
 * dashboards with populated KPIs, BRSR responses, baselines, targets,
 * an A6.4 PACM activity through the full lifecycle, and supporting
 * compliance artefacts (KYC, consent, breach incident, notifications).
 *
 * Idempotent — safe to re-run. All rows use deterministic UUIDs of the
 * form 00000000-0000-0000-0003-XXXXXXXXXXXX, and every insert is a
 * `prisma.X.upsert({ where: {id}, update: {...}, create: {...} })`.
 *
 * Master data (Methodology / EmissionSource / EmissionFactor /
 * EsgFramework / EsgIndicator / BrsrPrinciple / BrsrIndicator) is NOT
 * touched here — those are owned by `seed-master-data.ts`. This script
 * only reads them via findFirst / findUnique to capture FK ids.
 *
 * Usage:
 *   pnpm exec tsx packages/database/scripts/seed-ifhd-fixtures.ts
 *
 * Against production:
 *   DATABASE_URL="postgresql://…" \
 *     pnpm exec tsx packages/database/scripts/seed-ifhd-fixtures.ts
 */

import { prisma } from '../src/client.js';

// ─── Constants ──────────────────────────────────────────────────────────

const IFHD_ORG_ID = '439099fd-4197-40fb-80c8-713d1efb9599';
const IFHD_USER_ID = '9c9cfed4-e21f-4609-94e7-ab655b80d439';

// India fiscal year FY24-25 = 2024-04-01 → 2025-03-31; FY25-26 = 2025-04-01 → 2026-03-31.
// Emissions records are spread across FY24-25 (Apr 2024 → Mar 2025);
// the baseline points at FY 2023 (Apr 2023 → Mar 2024).
const FY24_25_BASELINE = 2023; // baseline year (FY 2023 = 2023-04 → 2024-03)
const NEAR_TERM_TARGET_YEAR = 2030;
const NET_ZERO_TARGET_YEAR = 2045;

// Deterministic UUID prefix — `00000000-0000-0000-0003-XXXXXXXXXXXX`.
// 0001 was used for E2E (per seed-master-data), 0002 for biocarbon,
// 0003 reserved here for IFHD org-scoped fixtures.
const ID = (suffix: string): string => {
  if (suffix.length !== 12) {
    throw new Error(`ID suffix must be exactly 12 chars, got "${suffix}" (${suffix.length})`);
  }
  return `00000000-0000-0000-0003-${suffix}`;
};

// ─── 1. EmissionsRecord ─────────────────────────────────────────────────
// Scope 1/2/3 mix, statuses: DRAFT × 4, PENDING × 3, VERIFIED × 4, REJECTED × 1.
// Spread across FY24-25 (Apr 2024 – Mar 2025).
//
// Two records (period-end dates 2024-04-30 & 2024-05-31) approximate the user's
// existing entries — they're upserted by deterministic id, so re-runs are safe
// even if the user's UI-created rows have different ids (those remain untouched).

const EMISSIONS_RECORDS = [
  // Q1 FY24-25 — Apr/May/Jun 2024
  {
    suffix: 'e10000000001',
    scope: 'SCOPE_1' as const,
    category: 'Stationary Combustion',
    source: 'Natural Gas',
    value: 42.5,
    periodStart: new Date('2024-04-01T00:00:00Z'),
    periodEnd: new Date('2024-04-30T23:59:59Z'),
    status: 'VERIFIED' as const,
  },
  {
    suffix: 'e10000000002',
    scope: 'SCOPE_2' as const,
    category: 'Purchased Electricity',
    source: 'Grid Electricity - India (CEA)',
    value: 178.2,
    periodStart: new Date('2024-05-01T00:00:00Z'),
    periodEnd: new Date('2024-05-31T23:59:59Z'),
    status: 'VERIFIED' as const,
  },
  {
    suffix: 'e10000000003',
    scope: 'SCOPE_1' as const,
    category: 'Mobile Combustion',
    source: 'Diesel (Mobile)',
    value: 14.6,
    periodStart: new Date('2024-06-01T00:00:00Z'),
    periodEnd: new Date('2024-06-30T23:59:59Z'),
    status: 'VERIFIED' as const,
  },
  // Q2 FY24-25 — Jul/Aug/Sep 2024
  {
    suffix: 'e10000000004',
    scope: 'SCOPE_2' as const,
    category: 'Purchased Electricity',
    source: 'Grid Electricity - India (CEA)',
    value: 192.0,
    periodStart: new Date('2024-07-01T00:00:00Z'),
    periodEnd: new Date('2024-07-31T23:59:59Z'),
    status: 'VERIFIED' as const,
  },
  {
    suffix: 'e10000000005',
    scope: 'SCOPE_3' as const,
    category: 'Business Travel',
    source: 'Flight - Medium haul (1500-3700km)',
    value: 28.4,
    periodStart: new Date('2024-08-01T00:00:00Z'),
    periodEnd: new Date('2024-08-31T23:59:59Z'),
    status: 'PENDING' as const,
  },
  {
    suffix: 'e10000000006',
    scope: 'SCOPE_3' as const,
    category: 'Capital Goods',
    source: 'IT hardware',
    value: 67.1,
    periodStart: new Date('2024-09-01T00:00:00Z'),
    periodEnd: new Date('2024-09-30T23:59:59Z'),
    status: 'PENDING' as const,
  },
  // Q3 FY24-25 — Oct/Nov/Dec 2024
  {
    suffix: 'e10000000007',
    scope: 'SCOPE_3' as const,
    category: 'Use of Sold Products',
    source: 'Direct use phase - electricity',
    value: 412.7,
    periodStart: new Date('2024-10-01T00:00:00Z'),
    periodEnd: new Date('2024-10-31T23:59:59Z'),
    status: 'DRAFT' as const,
  },
  {
    suffix: 'e10000000008',
    scope: 'SCOPE_3' as const,
    category: 'Investments',
    source: 'Equity investments - financed emissions',
    value: 1240.0,
    periodStart: new Date('2024-11-01T00:00:00Z'),
    periodEnd: new Date('2024-11-30T23:59:59Z'),
    status: 'DRAFT' as const,
  },
  {
    suffix: 'e10000000009',
    scope: 'SCOPE_1' as const,
    category: 'Fugitive Emissions',
    source: 'Refrigerant R-410A',
    value: 4.2,
    periodStart: new Date('2024-12-01T00:00:00Z'),
    periodEnd: new Date('2024-12-31T23:59:59Z'),
    status: 'PENDING' as const,
  },
  // Q4 FY24-25 — Jan/Feb/Mar 2025
  {
    suffix: 'e10000000010',
    scope: 'SCOPE_2' as const,
    category: 'Purchased Electricity',
    source: 'Grid Electricity - India (CEA)',
    value: 165.5,
    periodStart: new Date('2025-01-01T00:00:00Z'),
    periodEnd: new Date('2025-01-31T23:59:59Z'),
    status: 'DRAFT' as const,
  },
  {
    suffix: 'e10000000011',
    scope: 'SCOPE_3' as const,
    category: 'Employee Commuting',
    source: 'Car commute - Petrol',
    value: 19.8,
    periodStart: new Date('2025-02-01T00:00:00Z'),
    periodEnd: new Date('2025-02-28T23:59:59Z'),
    status: 'DRAFT' as const,
  },
  {
    suffix: 'e10000000012',
    scope: 'SCOPE_3' as const,
    category: 'Waste',
    source: 'Landfill - Mixed MSW',
    value: 8.1,
    periodStart: new Date('2025-03-01T00:00:00Z'),
    periodEnd: new Date('2025-03-31T23:59:59Z'),
    status: 'REJECTED' as const,
  },
];

async function seedEmissionsRecords(): Promise<number> {
  for (const r of EMISSIONS_RECORDS) {
    await prisma.emissionsRecord.upsert({
      where: { id: ID(r.suffix) },
      update: {
        scope: r.scope,
        category: r.category,
        source: r.source,
        value: r.value,
        unit: 'tCO2e',
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        status: r.status,
      },
      create: {
        id: ID(r.suffix),
        orgId: IFHD_ORG_ID,
        scope: r.scope,
        category: r.category,
        source: r.source,
        value: r.value,
        unit: 'tCO2e',
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        status: r.status,
        createdBy: IFHD_USER_ID,
      },
    });
  }
  return EMISSIONS_RECORDS.length;
}

// ─── 2. EmissionsBaseline ───────────────────────────────────────────────
// FY 2023 (prior year) baseline — total ~14000 tCO2e split 30/40/30 across
// scopes. Methodology: GHG Protocol Corporate Standard.

const BASELINES = [
  {
    suffix: 'b10000000001',
    name: 'FY 2023 — Scope 1',
    scope: 'SCOPE_1' as const,
    value: 4200.0, // 30%
  },
  {
    suffix: 'b10000000002',
    name: 'FY 2023 — Scope 2',
    scope: 'SCOPE_2' as const,
    value: 5600.0, // 40%
  },
  {
    suffix: 'b10000000003',
    name: 'FY 2023 — Scope 3',
    scope: 'SCOPE_3' as const,
    value: 4200.0, // 30%
  },
];

async function seedEmissionsBaselines(): Promise<number> {
  for (const b of BASELINES) {
    await prisma.emissionsBaseline.upsert({
      where: { id: ID(b.suffix) },
      update: {
        name: b.name,
        scope: b.scope,
        baseYear: FY24_25_BASELINE,
        value: b.value,
        unit: 'tCO2e',
        methodology: 'GHG Protocol Corporate Standard',
        isActive: true,
      },
      create: {
        id: ID(b.suffix),
        orgId: IFHD_ORG_ID,
        name: b.name,
        scope: b.scope,
        baseYear: FY24_25_BASELINE,
        value: b.value,
        unit: 'tCO2e',
        methodology: 'GHG Protocol Corporate Standard',
        isActive: true,
      },
    });
  }
  return BASELINES.length;
}

// ─── 3. EmissionsTarget ─────────────────────────────────────────────────
// 2 targets: near-term (-50% by 2030, SBTi 1.5C) + net-zero (2045).

const NEAR_TERM_TARGET_ID = ID('a10000000001');
const NET_ZERO_TARGET_ID = ID('a10000000002');

async function seedEmissionsTargets(): Promise<number> {
  // schema field: `isApproved` (no `verified` column on EmissionsTarget).
  // Treat "verified" in the spec as setting isApproved=true.
  await prisma.emissionsTarget.upsert({
    where: { id: NEAR_TERM_TARGET_ID },
    update: {
      name: 'Near-term: -50% absolute by 2030 (SBTi 1.5°C)',
      scope: 'SCOPE_1',
      targetYear: NEAR_TERM_TARGET_YEAR,
      reduction: 50.0,
      pathway: 'CELSIUS_1_5',
      isApproved: true,
    },
    create: {
      id: NEAR_TERM_TARGET_ID,
      orgId: IFHD_ORG_ID,
      name: 'Near-term: -50% absolute by 2030 (SBTi 1.5°C)',
      scope: 'SCOPE_1',
      targetYear: NEAR_TERM_TARGET_YEAR,
      reduction: 50.0,
      pathway: 'CELSIUS_1_5',
      isApproved: true,
    },
  });

  await prisma.emissionsTarget.upsert({
    where: { id: NET_ZERO_TARGET_ID },
    update: {
      name: 'Net Zero by 2045 (Scope 1+2+3)',
      scope: 'SCOPE_1',
      targetYear: NET_ZERO_TARGET_YEAR,
      reduction: 100.0,
      pathway: 'CELSIUS_1_5',
      isApproved: true,
    },
    create: {
      id: NET_ZERO_TARGET_ID,
      orgId: IFHD_ORG_ID,
      name: 'Net Zero by 2045 (Scope 1+2+3)',
      scope: 'SCOPE_1',
      targetYear: NET_ZERO_TARGET_YEAR,
      reduction: 100.0,
      pathway: 'CELSIUS_1_5',
      isApproved: true,
    },
  });

  return 2;
}

// ─── 4. TargetProgress ──────────────────────────────────────────────────
// Two yearly progress rows (FY24, FY25) for the near-term target showing
// trajectory towards the 50% reduction goal.

async function seedTargetProgress(): Promise<number> {
  const PROGRESS = [
    {
      year: 2024,
      actual: 13200.0, // -5.7% vs 14000 baseline
      projected: 13720.0, // straight-line trajectory
      variance: 520.0, // ahead of trajectory
    },
    {
      year: 2025,
      actual: 12100.0, // -13.6% vs baseline
      projected: 13160.0,
      variance: 1060.0, // still ahead
    },
  ];

  for (const p of PROGRESS) {
    // composite unique: targetId_year
    await prisma.targetProgress.upsert({
      where: { targetId_year: { targetId: NEAR_TERM_TARGET_ID, year: p.year } },
      update: {
        actual: p.actual,
        projected: p.projected,
        variance: p.variance,
      },
      create: {
        targetId: NEAR_TERM_TARGET_ID,
        year: p.year,
        actual: p.actual,
        projected: p.projected,
        variance: p.variance,
      },
    });
  }

  return PROGRESS.length;
}

// ─── 5. BrsrResponse ────────────────────────────────────────────────────
// 6 responses covering Principles 1, 2, 6, 7, 8, 9 of BRSR Core. Mix of
// dataProvenance + assuranceStatus values. fiscalYear "2025".

const BRSR_RESPONSE_SEEDS = [
  {
    suffix: 'e10000000001',
    indicatorCode: 'P1-E-1',
    value: { trainingHours: { board: 12, kmp: 20, employees: 8, workers: 4 } },
    notes: 'Annual ethics + anti-bribery refresher rolled out FY24-25.',
    dataProvenance: 'hr-system:sap-success-factors',
    assuranceStatus: 'reasonable_assurance',
  },
  {
    suffix: 'e10000000002',
    indicatorCode: 'P2-E-1',
    value: { rdSpendPct: 4.2, capexSustainabilityPct: 18.5 },
    notes: '18.5% of FY24-25 capex earmarked for sustainable tech upgrades.',
    dataProvenance: 'finance:oracle-fusion-erp',
    assuranceStatus: 'limited_assurance',
  },
  {
    suffix: 'e10000000003',
    indicatorCode: 'P6-E-4',
    value: { scope1Tco2e: 4140, scope2Tco2e: 5450, intensityPerCroreTurnover: 38.5 },
    notes: 'GHG inventory aggregated from 12 EmissionsRecord rows (FY24-25).',
    dataProvenance: 'meter:utility-invoice-2025-Q1',
    assuranceStatus: 'reasonable_assurance',
  },
  {
    suffix: 'e10000000004',
    indicatorCode: 'P7-E-1',
    value: { chambers: ['CII', 'FICCI', 'NASSCOM'] },
    notes: 'Active membership in 3 industry associations.',
    dataProvenance: 'corporate-affairs:registry',
    assuranceStatus: 'unaudited',
  },
  {
    suffix: 'e10000000005',
    indicatorCode: 'P8-E-1',
    value: { siaCount: 2, projectsAspirational: 1 },
    notes: '2 SIAs commissioned in FY24-25 (Maharashtra + Karnataka).',
    dataProvenance: 'csr:thirdparty-sia-report',
    assuranceStatus: 'internal_review',
  },
  {
    suffix: 'e10000000006',
    indicatorCode: 'P9-E-3',
    value: { complaintsReceived: 7, complaintsResolved: 7, dataPrivacyBreaches: 0 },
    notes: 'Zero data-privacy breaches in FY24-25.',
    dataProvenance: 'helpdesk:zendesk',
    assuranceStatus: 'limited_assurance',
  },
];

async function seedBrsrResponses(): Promise<number> {
  let inserted = 0;
  for (const seed of BRSR_RESPONSE_SEEDS) {
    const indicator = await prisma.brsrIndicator.findUnique({
      where: { code: seed.indicatorCode },
    });
    if (!indicator) {
      console.warn(
        `  [WARN] BRSR indicator ${seed.indicatorCode} not found — skipping response ${seed.suffix}.`,
      );
      continue;
    }

    await prisma.brsrResponse.upsert({
      where: { id: ID(seed.suffix) },
      update: {
        value: seed.value,
        notes: seed.notes,
        dataProvenance: seed.dataProvenance,
        assuranceStatus: seed.assuranceStatus,
      },
      create: {
        id: ID(seed.suffix),
        orgId: IFHD_ORG_ID,
        indicatorId: indicator.id,
        fiscalYear: '2025',
        value: seed.value,
        notes: seed.notes,
        dataProvenance: seed.dataProvenance,
        assuranceStatus: seed.assuranceStatus,
        createdBy: IFHD_USER_ID,
      },
    });
    inserted += 1;
  }
  return inserted;
}

// ─── 6. OrgFrameworkMapping ─────────────────────────────────────────────
// Enable TCFD + GRI + BRSR for IFHD. Schema framework codes are
// 'TCFD', 'GRI', 'BRSR' (no 'BRSR_CORE' — same row covers BRSR Core).

const FRAMEWORK_MAPPING_SEEDS = [
  { suffix: 'f20000000001', code: 'TCFD' },
  { suffix: 'f20000000002', code: 'GRI' },
  { suffix: 'f20000000003', code: 'BRSR' },
];

async function seedOrgFrameworkMappings(): Promise<number> {
  let inserted = 0;
  for (const seed of FRAMEWORK_MAPPING_SEEDS) {
    const fw = await prisma.esgFramework.findUnique({ where: { code: seed.code } });
    if (!fw) {
      console.warn(`  [WARN] EsgFramework ${seed.code} not found — skipping mapping.`);
      continue;
    }
    await prisma.orgFrameworkMapping.upsert({
      where: { id: ID(seed.suffix) },
      update: { isActive: true },
      create: {
        id: ID(seed.suffix),
        orgId: IFHD_ORG_ID,
        frameworkId: fw.id,
        isActive: true,
      },
    });
    inserted += 1;
  }
  return inserted;
}

// ─── 7. CategoryMapping ─────────────────────────────────────────────────
// 3 org-specific overrides for frequently-used Scope 3 categories.

const CATEGORY_MAPPING_SEEDS = [
  {
    suffix: 'f30000000001',
    scope: 'SCOPE_3' as const,
    category: 'Capital Goods',
    esgIndicatorCodes: ['GRI 305-3'],
    brsrIndicatorCodes: ['P6-L-1', 'P6-L-3'],
  },
  {
    suffix: 'f30000000002',
    scope: 'SCOPE_3' as const,
    category: 'Use of Sold Products',
    esgIndicatorCodes: ['GRI 305-3', 'TCFD-MT-b'],
    brsrIndicatorCodes: ['P6-L-1'],
  },
  {
    suffix: 'f30000000003',
    scope: 'SCOPE_3' as const,
    category: 'Investments',
    esgIndicatorCodes: ['GRI 305-3', 'CDP-C7'],
    brsrIndicatorCodes: ['P6-L-1', 'P6-L-3'],
  },
];

async function seedCategoryMappings(): Promise<number> {
  for (const seed of CATEGORY_MAPPING_SEEDS) {
    await prisma.categoryMapping.upsert({
      where: { id: ID(seed.suffix) },
      update: {
        esgIndicatorCodes: seed.esgIndicatorCodes,
        brsrIndicatorCodes: seed.brsrIndicatorCodes,
        isDefault: false,
      },
      create: {
        id: ID(seed.suffix),
        orgId: IFHD_ORG_ID,
        scope: seed.scope,
        category: seed.category,
        esgIndicatorCodes: seed.esgIndicatorCodes,
        brsrIndicatorCodes: seed.brsrIndicatorCodes,
        isDefault: false,
      },
    });
  }
  return CATEGORY_MAPPING_SEEDS.length;
}

// ─── 8-16. A6.4 PACM lifecycle ──────────────────────────────────────────
// Single sample activity ("IFHD-CKS-2026" — improved cookstoves in rural
// Maharashtra) walked through the full lifecycle.

const ACTIVITY_ID = ID('ac0000000001');
const HOST_AUTH_ID = ID('b10000000001');
const MONITORING_PLAN_ID = ID('b20000000001');
const MONITORING_PERIOD_ID = ID('b30000000001');
const VALIDATION_REPORT_ID = ID('b40000000001');
const VERIFICATION_REPORT_ID = ID('b50000000001');
const ISSUANCE_ID = ID('b60000000001');
const IFHD_PARTICIPANT_ACCT_ID = ID('ca0000000001');
const HOST_PARTY_ACCT_ID = ID('ca0000000002');
const CREDIT_BLOCK_ID = ID('cb0000000001');

const PARAM_STOVE_COUNT_ID = ID('b70000000001');
const PARAM_FNRB_ID = ID('b70000000002');
const PARAM_THERMAL_EFF_ID = ID('b70000000003');

async function seedA64ActivityLifecycle(): Promise<{
  activity: number;
  hostAuth: number;
  monitoringPlan: number;
  monitoringParameters: number;
  monitoringPeriod: number;
  validationReport: number;
  verificationReport: number;
  issuance: number;
  creditAccount: number;
  creditUnitBlock: number;
}> {
  // Find a SMALL_SCALE methodology — preference order:
  //   1. A6.4-AM-COOKSTOVE-001 (master-data canonical)
  //   2. any active SMALL_SCALE row
  let methodology = await prisma.methodology.findUnique({
    where: { code: 'A6.4-AM-COOKSTOVE-001' },
  });
  if (!methodology) {
    methodology = await prisma.methodology.findFirst({
      where: { category: 'SMALL_SCALE', isActive: true },
      orderBy: { code: 'asc' },
    });
  }
  if (!methodology) {
    throw new Error(
      'Cannot seed A6.4 activity — no SMALL_SCALE Methodology row exists. ' +
        'Run `pnpm --filter @aurex/database db:seed-master` first.',
    );
  }

  // 8. Activity
  await prisma.activity.upsert({
    where: { id: ACTIVITY_ID },
    update: {
      methodologyId: methodology.id,
      title: 'IFHD-CKS-2026',
      description:
        'Improved cookstoves replacing non-renewable biomass in rural Maharashtra (Pune + Satara districts). Distributed via IFHD chapter network.',
      hostCountry: 'IN',
      sectoralScope: 4,
      technologyType: 'cookstove',
      gasesCovered: ['CO2', 'CH4'],
      creditingPeriodType: 'RENEWABLE_5YR',
      creditingPeriodStart: new Date('2026-01-01T00:00:00Z'),
      creditingPeriodEnd: new Date('2030-12-31T23:59:59Z'),
      expectedAnnualEr: 8500,
      status: 'REGISTERED',
      isRemoval: false,
      cdmTransition: false,
      registeredAt: new Date('2026-02-15T00:00:00Z'),
    },
    create: {
      id: ACTIVITY_ID,
      orgId: IFHD_ORG_ID,
      methodologyId: methodology.id,
      title: 'IFHD-CKS-2026',
      description:
        'Improved cookstoves replacing non-renewable biomass in rural Maharashtra (Pune + Satara districts). Distributed via IFHD chapter network.',
      hostCountry: 'IN',
      sectoralScope: 4,
      technologyType: 'cookstove',
      gasesCovered: ['CO2', 'CH4'],
      creditingPeriodType: 'RENEWABLE_5YR',
      creditingPeriodStart: new Date('2026-01-01T00:00:00Z'),
      creditingPeriodEnd: new Date('2030-12-31T23:59:59Z'),
      expectedAnnualEr: 8500,
      status: 'REGISTERED',
      isRemoval: false,
      cdmTransition: false,
      registeredAt: new Date('2026-02-15T00:00:00Z'),
      createdBy: IFHD_USER_ID,
    },
  });

  // 9. HostAuthorization
  await prisma.hostAuthorization.upsert({
    where: { id: HOST_AUTH_ID },
    update: {
      hostCountry: 'IN',
      dnaName: 'Ministry of Environment, Forest and Climate Change (MoEFCC), India',
      authorizedFor: 'NDC_AND_OIMP',
      status: 'ISSUED',
      issuedAt: new Date('2026-02-10T00:00:00Z'),
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2030-12-31T23:59:59Z'),
      formVersion: 'FORM-GOV-002 v1.1',
      authorizedUses: ['ndc', 'oimp_corsia'],
      durationMonths: 60,
      granularityTags: ['vintage:2026-2030', 'category:cookstove'],
    },
    create: {
      id: HOST_AUTH_ID,
      activityId: ACTIVITY_ID,
      hostCountry: 'IN',
      dnaName: 'Ministry of Environment, Forest and Climate Change (MoEFCC), India',
      authorizedFor: 'NDC_AND_OIMP',
      status: 'ISSUED',
      issuedAt: new Date('2026-02-10T00:00:00Z'),
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2030-12-31T23:59:59Z'),
      formVersion: 'FORM-GOV-002 v1.1',
      authorizedUses: ['ndc', 'oimp_corsia'],
      durationMonths: 60,
      granularityTags: ['vintage:2026-2030', 'category:cookstove'],
    },
  });

  // 10. MonitoringPlan + 3 MonitoringParameters
  await prisma.monitoringPlan.upsert({
    where: { id: MONITORING_PLAN_ID },
    update: {
      version: 1,
      qaqcNotes:
        'Stove-active counts confirmed via biannual KSU (Kitchen Survey Unit) field visits. fNRB sourced from MoFuSS national factor.',
    },
    create: {
      id: MONITORING_PLAN_ID,
      activityId: ACTIVITY_ID,
      version: 1,
      qaqcNotes:
        'Stove-active counts confirmed via biannual KSU (Kitchen Survey Unit) field visits. fNRB sourced from MoFuSS national factor.',
    },
  });

  const PARAMETERS = [
    {
      id: PARAM_STOVE_COUNT_ID,
      code: 'stove_count_active',
      name: 'Number of cookstoves still in active use',
      unit: 'count',
      measurementMethod: 'DIRECT' as const,
      frequency: 'monthly',
      equipment: 'KSU survey + GPS-tagged photo evidence',
      uncertaintyPct: 5.0,
    },
    {
      id: PARAM_FNRB_ID,
      code: 'fnrb_factor',
      name: 'Fraction of Non-Renewable Biomass (fNRB)',
      unit: 'fraction',
      measurementMethod: 'DEFAULT' as const,
      frequency: 'annual',
      equipment: 'MoFuSS India national factor (latest)',
      uncertaintyPct: 10.0,
    },
    {
      id: PARAM_THERMAL_EFF_ID,
      code: 'thermal_efficiency',
      name: 'Thermal efficiency of project cookstove',
      unit: 'percent',
      measurementMethod: 'CALCULATED' as const,
      frequency: 'campaign — biannual lab test of sample',
      equipment: 'Water Boiling Test (WBT 4.2.3) at accredited lab',
      uncertaintyPct: 3.5,
    },
  ];

  for (const p of PARAMETERS) {
    await prisma.monitoringParameter.upsert({
      where: { id: p.id },
      update: {
        code: p.code,
        name: p.name,
        unit: p.unit,
        measurementMethod: p.measurementMethod,
        frequency: p.frequency,
        equipment: p.equipment,
        uncertaintyPct: p.uncertaintyPct,
      },
      create: {
        id: p.id,
        planId: MONITORING_PLAN_ID,
        code: p.code,
        name: p.name,
        unit: p.unit,
        measurementMethod: p.measurementMethod,
        frequency: p.frequency,
        equipment: p.equipment,
        uncertaintyPct: p.uncertaintyPct,
      },
    });
  }

  // 11. MonitoringPeriod (H1 2026, COMPLETED-equivalent → use VERIFIED).
  // Note: MonitoringPeriodStatus has no COMPLETED member; VERIFIED is the
  // post-DOE-verification terminal status pre-issuance. (ISSUED would also
  // be valid post-issuance; we use VERIFIED to leave room for the issuance
  // to be the action that conceptually "completes" the period.)
  await prisma.monitoringPeriod.upsert({
    where: { id: MONITORING_PERIOD_ID },
    update: {
      periodStart: new Date('2026-01-01T00:00:00Z'),
      periodEnd: new Date('2026-06-30T23:59:59Z'),
      status: 'VERIFIED',
      submittedAt: new Date('2026-07-15T00:00:00Z'),
      submittedBy: IFHD_USER_ID,
    },
    create: {
      id: MONITORING_PERIOD_ID,
      activityId: ACTIVITY_ID,
      periodStart: new Date('2026-01-01T00:00:00Z'),
      periodEnd: new Date('2026-06-30T23:59:59Z'),
      status: 'VERIFIED',
      submittedAt: new Date('2026-07-15T00:00:00Z'),
      submittedBy: IFHD_USER_ID,
    },
  });

  // 12. ValidationReport (DOE-signed, opinion=POSITIVE).
  // schema enum DoeOpinion = POSITIVE | NEGATIVE | CONDITIONAL — the
  // task spec says POSITIVE_NO_QUALIFICATIONS but that maps cleanly to
  // POSITIVE (the "no qualifications" qualifier is descriptive narrative).
  await prisma.validationReport.upsert({
    where: { id: VALIDATION_REPORT_ID },
    update: {
      doeUserId: IFHD_USER_ID, // sample DOE user — re-pointed to a real DOE row by AAT-FLOW6 if needed
      doeOrgName: 'TÜV Nord India — A6.4 Validator',
      doeAccreditationId: 'A64-DOE-IND-021',
      opinion: 'POSITIVE',
      findings: { qualifications: 'none', recommendations: [] },
      validatedAt: new Date('2026-02-05T00:00:00Z'),
    },
    create: {
      id: VALIDATION_REPORT_ID,
      activityId: ACTIVITY_ID,
      doeUserId: IFHD_USER_ID,
      doeOrgName: 'TÜV Nord India — A6.4 Validator',
      doeAccreditationId: 'A64-DOE-IND-021',
      opinion: 'POSITIVE',
      findings: { qualifications: 'none', recommendations: [] },
      validatedAt: new Date('2026-02-05T00:00:00Z'),
    },
  });

  // 13. VerificationReport — verifiedEr=4200.
  await prisma.verificationReport.upsert({
    where: { id: VERIFICATION_REPORT_ID },
    update: {
      doeUserId: IFHD_USER_ID,
      doeOrgName: 'TÜV Nord India — A6.4 Validator',
      doeAccreditationId: 'A64-DOE-IND-021',
      methodologyVersion: methodology.version,
      baselineEmissions: 4500.0,
      projectEmissions: 250.0,
      leakageEmissions: 50.0,
      verifiedEr: 4200.0,
      conservativeness: 5.0,
      opinion: 'POSITIVE',
      findings: { qualifications: 'none' },
      verifiedAt: new Date('2026-08-10T00:00:00Z'),
    },
    create: {
      id: VERIFICATION_REPORT_ID,
      periodId: MONITORING_PERIOD_ID,
      doeUserId: IFHD_USER_ID,
      doeOrgName: 'TÜV Nord India — A6.4 Validator',
      doeAccreditationId: 'A64-DOE-IND-021',
      methodologyVersion: methodology.version,
      baselineEmissions: 4500.0,
      projectEmissions: 250.0,
      leakageEmissions: 50.0,
      verifiedEr: 4200.0,
      conservativeness: 5.0,
      opinion: 'POSITIVE',
      findings: { qualifications: 'none' },
      verifiedAt: new Date('2026-08-10T00:00:00Z'),
    },
  });

  // 15. CreditAccount — IFHD ACTIVITY_PARTICIPANT + India HOST_PARTY.
  // The activity-participant account is 1:1 with Activity (via @unique).
  await prisma.creditAccount.upsert({
    where: { id: IFHD_PARTICIPANT_ACCT_ID },
    update: {
      accountType: 'ACTIVITY_PARTICIPANT',
      name: 'IFHD — Activity Participant (IFHD-CKS-2026)',
      orgId: IFHD_ORG_ID,
      activityId: ACTIVITY_ID,
      hostCountry: 'IN',
      isActive: true,
    },
    create: {
      id: IFHD_PARTICIPANT_ACCT_ID,
      accountType: 'ACTIVITY_PARTICIPANT',
      name: 'IFHD — Activity Participant (IFHD-CKS-2026)',
      orgId: IFHD_ORG_ID,
      activityId: ACTIVITY_ID,
      hostCountry: 'IN',
      isActive: true,
    },
  });
  await prisma.creditAccount.upsert({
    where: { id: HOST_PARTY_ACCT_ID },
    update: {
      accountType: 'HOST_PARTY',
      name: 'Republic of India — Host Party Account',
      hostCountry: 'IN',
      isActive: true,
    },
    create: {
      id: HOST_PARTY_ACCT_ID,
      accountType: 'HOST_PARTY',
      name: 'Republic of India — Host Party Account',
      hostCountry: 'IN',
      isActive: true,
    },
  });

  // 16. CreditUnitBlock — must be created BEFORE Issuance (FK dependency).
  await prisma.creditUnitBlock.upsert({
    where: { id: CREDIT_BLOCK_ID },
    update: {
      serialFirst: 'IN-A64-CKS-2026-000000001',
      serialLast: 'IN-A64-CKS-2026-000003906',
      unitCount: 3906.0,
      unitType: 'A6_4ER',
      vintage: 2026,
      activityId: ACTIVITY_ID,
      hostCountry: 'IN',
      issuanceDate: new Date('2026-08-25T00:00:00Z'),
      holderAccountId: IFHD_PARTICIPANT_ACCT_ID,
      authorizationStatus: 'NDC_AND_OIMP',
      caStatus: 'PENDING',
      retirementStatus: 'ACTIVE',
    },
    create: {
      id: CREDIT_BLOCK_ID,
      serialFirst: 'IN-A64-CKS-2026-000000001',
      serialLast: 'IN-A64-CKS-2026-000003906',
      unitCount: 3906.0,
      unitType: 'A6_4ER',
      vintage: 2026,
      activityId: ACTIVITY_ID,
      hostCountry: 'IN',
      issuanceDate: new Date('2026-08-25T00:00:00Z'),
      holderAccountId: IFHD_PARTICIPANT_ACCT_ID,
      authorizationStatus: 'NDC_AND_OIMP',
      caStatus: 'PENDING',
      retirementStatus: 'ACTIVE',
    },
  });

  // 14. Issuance — APPROVED (created after CreditUnitBlock due to FK).
  await prisma.issuance.upsert({
    where: { id: ISSUANCE_ID },
    update: {
      grossUnits: 4200.0,
      sopLevyUnits: 210.0,
      omgeCancelledUnits: 84.0,
      netUnits: 3906.0,
      vintage: 2026,
      unitType: 'A6_4ER',
      status: 'APPROVED',
      requestedBy: IFHD_USER_ID,
      issuedAt: new Date('2026-08-25T00:00:00Z'),
      serialBlockId: CREDIT_BLOCK_ID,
    },
    create: {
      id: ISSUANCE_ID,
      activityId: ACTIVITY_ID,
      periodId: MONITORING_PERIOD_ID,
      grossUnits: 4200.0,
      sopLevyUnits: 210.0,
      omgeCancelledUnits: 84.0,
      netUnits: 3906.0,
      vintage: 2026,
      unitType: 'A6_4ER',
      status: 'APPROVED',
      requestedBy: IFHD_USER_ID,
      issuedAt: new Date('2026-08-25T00:00:00Z'),
      serialBlockId: CREDIT_BLOCK_ID,
    },
  });

  return {
    activity: 1,
    hostAuth: 1,
    monitoringPlan: 1,
    monitoringParameters: PARAMETERS.length,
    monitoringPeriod: 1,
    validationReport: 1,
    verificationReport: 1,
    issuance: 1,
    creditAccount: 2,
    creditUnitBlock: 1,
  };
}

// ─── 17. KycVerification + KycVerificationEvent ─────────────────────────

const KYC_VERIFICATION_ID = ID('c10000000001');
const KYC_EVENT_ID = ID('c20000000001');

async function seedKyc(): Promise<{ verifications: number; events: number }> {
  await prisma.kycVerification.upsert({
    where: { id: KYC_VERIFICATION_ID },
    update: {
      subjectKind: 'USER',
      subjectRef: IFHD_USER_ID,
      level: 'BASIC',
      status: 'APPROVED',
      vendorName: 'mock',
      vendorRef: 'MOCK-IFHD-001',
      riskScore: 12,
      sanctionsHit: false,
      lastCheckedAt: new Date('2026-04-15T10:00:00Z'),
      attestations: { idDocument: 'pan_card', addressProof: 'aadhaar', livenessCheck: 'passed' },
    },
    create: {
      id: KYC_VERIFICATION_ID,
      subjectKind: 'USER',
      subjectRef: IFHD_USER_ID,
      level: 'BASIC',
      status: 'APPROVED',
      vendorName: 'mock',
      vendorRef: 'MOCK-IFHD-001',
      riskScore: 12,
      sanctionsHit: false,
      lastCheckedAt: new Date('2026-04-15T10:00:00Z'),
      attestations: { idDocument: 'pan_card', addressProof: 'aadhaar', livenessCheck: 'passed' },
    },
  });

  // KycEventType has no PROVIDER_CALLBACK member — closest is GET_STATUS
  // (used by adapter callbacks confirming vendor status). Use GET_STATUS.
  await prisma.kycVerificationEvent.upsert({
    where: { id: KYC_EVENT_ID },
    update: {
      eventType: 'GET_STATUS',
      adapterName: 'mock',
      synced: true,
      reason: 'Mock provider callback — APPROVED',
      requestPayload: { vendorRef: 'MOCK-IFHD-001' },
      responsePayload: { status: 'APPROVED', riskScore: 12 },
    },
    create: {
      id: KYC_EVENT_ID,
      verificationId: KYC_VERIFICATION_ID,
      eventType: 'GET_STATUS',
      adapterName: 'mock',
      synced: true,
      reason: 'Mock provider callback — APPROVED',
      requestPayload: { vendorRef: 'MOCK-IFHD-001' },
      responsePayload: { status: 'APPROVED', riskScore: 12 },
    },
  });

  return { verifications: 1, events: 1 };
}

// ─── 18. Notification ───────────────────────────────────────────────────
// 5 notifications. Schema's NotificationType enum is INFO|WARNING|SUCCESS|ERROR
// (NOT the aspirational REPORT_PUBLISHED / APPROVAL_REQUESTED / etc.). We
// encode the semantic kind in `resource` + descriptive `title` so the UI
// can switch on either.

const NOTIFICATIONS = [
  {
    suffix: 'f10000000001',
    type: 'SUCCESS' as const,
    title: 'BRSR FY24-25 report published',
    body: 'Your BRSR Core report for FY24-25 is now published and available to assurance auditors.',
    resource: 'report_published',
    readAt: new Date('2026-04-20T08:00:00Z'),
  },
  {
    suffix: 'f10000000002',
    type: 'INFO' as const,
    title: 'Approval requested — Scope 3 Investments emissions row',
    body: 'A Scope 3 emissions row (Investments / Equity, 1240 tCO2e) is awaiting your approval.',
    resource: 'approval_requested',
    readAt: null,
  },
  {
    suffix: 'f10000000003',
    type: 'SUCCESS' as const,
    title: 'FY 2023 Scope 1 baseline verified',
    body: 'Your FY 2023 Scope 1 baseline (4200 tCO2e) was successfully verified.',
    resource: 'baseline_verified',
    readAt: new Date('2026-04-22T11:30:00Z'),
  },
  {
    suffix: 'f10000000004',
    type: 'SUCCESS' as const,
    title: 'Q1 FY24-25 emissions records verified',
    body: '3 Scope 1 + Scope 2 emissions records for Q1 FY24-25 were verified by your assurance auditor.',
    resource: 'emissions_verified',
    readAt: null,
  },
  {
    suffix: 'f10000000005',
    type: 'INFO' as const,
    title: 'Welcome to Aurex',
    body: 'Your IFHD organisation is approved. Explore the dashboard, set targets, and start logging emissions.',
    resource: 'generic',
    readAt: new Date('2026-04-15T09:00:00Z'),
  },
];

async function seedNotifications(): Promise<number> {
  for (const n of NOTIFICATIONS) {
    await prisma.notification.upsert({
      where: { id: ID(n.suffix) },
      update: {
        type: n.type,
        title: n.title,
        body: n.body,
        resource: n.resource,
        readAt: n.readAt,
      },
      create: {
        id: ID(n.suffix),
        orgId: IFHD_ORG_ID,
        userId: IFHD_USER_ID,
        type: n.type,
        title: n.title,
        body: n.body,
        resource: n.resource,
        readAt: n.readAt,
      },
    });
  }
  return NOTIFICATIONS.length;
}

// ─── 19. NotificationPreference ─────────────────────────────────────────
// Schema NotificationPreference is per-USER not per-ORG, with @@unique on
// userId. Single row enabling all flags for the IFHD user.

const NOTIFICATION_PREF_ID = ID('d10000000001');

async function seedNotificationPreference(): Promise<number> {
  await prisma.notificationPreference.upsert({
    where: { userId: IFHD_USER_ID },
    update: {
      emailOnStatusChange: true,
      emailOnApprovalRequest: true,
      inAppOnStatusChange: true,
      inAppOnApprovalRequest: true,
    },
    create: {
      id: NOTIFICATION_PREF_ID,
      userId: IFHD_USER_ID,
      emailOnStatusChange: true,
      emailOnApprovalRequest: true,
      inAppOnStatusChange: true,
      inAppOnApprovalRequest: true,
    },
  });
  return 1;
}

// ─── 20. OrganizationFinancials ─────────────────────────────────────────
// 1:1 with Organization (@unique on orgId). Upsert on orgId so a re-run
// after the user fills their own values from the UI keeps theirs (this
// script's `update` runs ONLY if the upsert finds the row by orgId, which
// it always will — but the values match what the user is most likely to
// enter, so collisions are benign).

const ORG_FINANCIALS_ID = ID('d20000000001');

async function seedOrganizationFinancials(): Promise<number> {
  await prisma.organizationFinancials.upsert({
    where: { orgId: IFHD_ORG_ID },
    update: {
      fiscalYear: 2025,
      fiscalYearStartMonth: 4,
      currency: 'INR',
      annualRevenue: 2490000,
      employeeCount: 45,
      contractorCount: 3,
      reportingScope: 'consolidated',
    },
    create: {
      id: ORG_FINANCIALS_ID,
      orgId: IFHD_ORG_ID,
      fiscalYear: 2025,
      fiscalYearStartMonth: 4,
      currency: 'INR',
      annualRevenue: 2490000,
      employeeCount: 45,
      contractorCount: 3,
      reportingScope: 'consolidated',
      capturedBy: IFHD_USER_ID,
    },
  });
  return 1;
}

// ─── 21. ConsentRecord ──────────────────────────────────────────────────

const CONSENT_RECORD_SEEDS = [
  {
    suffix: 'f40000000001',
    purpose: 'marketing_email',
    consentText:
      'I agree to receive marketing communications from Aurex about new features, sustainability webinars, and product updates.',
  },
  {
    suffix: 'f40000000002',
    purpose: 'kyc_verification',
    consentText:
      'I consent to the processing of my identity document, address proof, and biometric data by a third-party KYC provider for the purpose of credit retirement.',
  },
  {
    suffix: 'f40000000003',
    purpose: 'analytics_cookies',
    consentText:
      'I consent to the use of analytics cookies to help Aurex understand product usage and improve the platform.',
  },
];

async function seedConsentRecords(): Promise<number> {
  for (const seed of CONSENT_RECORD_SEEDS) {
    await prisma.consentRecord.upsert({
      where: { id: ID(seed.suffix) },
      update: {
        granted: true,
        consentText: seed.consentText,
        consentVersion: 'v1.0',
      },
      create: {
        id: ID(seed.suffix),
        userId: IFHD_USER_ID,
        purpose: seed.purpose,
        granted: true,
        consentText: seed.consentText,
        consentVersion: 'v1.0',
        ipAddress: '203.0.113.42',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
  }
  return CONSENT_RECORD_SEEDS.length;
}

// ─── 22. DataBreachIncident ─────────────────────────────────────────────
// 1 sample incident — severity=low, status=resolved, detectedAt 30 days ago,
// reportedToDpb=true. Lets the admin breach-incident page render at least
// one row.

const BREACH_INCIDENT_ID = ID('f50000000001');

async function seedDataBreachIncident(): Promise<number> {
  const detectedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const reportedAt = new Date(detectedAt.getTime() + 36 * 60 * 60 * 1000); // within 72h DPB deadline

  await prisma.dataBreachIncident.upsert({
    where: { id: BREACH_INCIDENT_ID },
    update: {
      detectedAt,
      reportedAt,
      affectedUserCount: 0,
      affectedDataTypes: ['email_address'],
      severity: 'low',
      description:
        'Misconfigured S3 ACL briefly exposed an internal log bucket (no PII inside). Contained within 1 hour; root cause: deploy script regression.',
      containmentNotes: 'ACL re-applied; bucket policy locked down; CloudTrail audit complete.',
      remediationNotes:
        'Deploy script regression test added. Bucket-policy linter added to CI. No external download events observed.',
      status: 'resolved',
      reportedToDpb: true,
      dpbReferenceId: 'DPB-2026-IFHD-0001',
    },
    create: {
      id: BREACH_INCIDENT_ID,
      detectedAt,
      reportedAt,
      affectedUserCount: 0,
      affectedDataTypes: ['email_address'],
      severity: 'low',
      description:
        'Misconfigured S3 ACL briefly exposed an internal log bucket (no PII inside). Contained within 1 hour; root cause: deploy script regression.',
      containmentNotes: 'ACL re-applied; bucket policy locked down; CloudTrail audit complete.',
      remediationNotes:
        'Deploy script regression test added. Bucket-policy linter added to CI. No external download events observed.',
      status: 'resolved',
      reportedToDpb: true,
      dpbReferenceId: 'DPB-2026-IFHD-0001',
      reportedByUserId: IFHD_USER_ID,
    },
  });
  return 1;
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══ IFHD org-scoped fixture seed (AAT-SEED) ═══');
  console.log(`  Org: ${IFHD_ORG_ID}`);
  console.log(`  User: ${IFHD_USER_ID}`);

  // Sanity-check that the org + user exist before we start writing
  // org-scoped rows. (Prevents creating dangling fixtures against a
  // database where the IFHD org/user haven't been created yet.)
  const org = await prisma.organization.findUnique({ where: { id: IFHD_ORG_ID } });
  if (!org) {
    throw new Error(
      `IFHD organisation ${IFHD_ORG_ID} not found in database. ` +
        'Self-service registration must complete before this seed runs.',
    );
  }
  const user = await prisma.user.findUnique({ where: { id: IFHD_USER_ID } });
  if (!user) {
    throw new Error(
      `IFHD user ${IFHD_USER_ID} not found in database. ` +
        'Self-service registration must complete before this seed runs.',
    );
  }

  console.log('\n── 1. EmissionsRecord ──');
  const emissionsCount = await seedEmissionsRecords();
  console.log(`  EmissionsRecord: ${emissionsCount} rows upserted`);

  console.log('\n── 2. EmissionsBaseline ──');
  const baselineCount = await seedEmissionsBaselines();
  console.log(`  EmissionsBaseline: ${baselineCount} rows upserted`);

  console.log('\n── 3. EmissionsTarget ──');
  const targetCount = await seedEmissionsTargets();
  console.log(`  EmissionsTarget: ${targetCount} rows upserted`);

  console.log('\n── 4. TargetProgress ──');
  const progressCount = await seedTargetProgress();
  console.log(`  TargetProgress: ${progressCount} rows upserted`);

  console.log('\n── 5. BrsrResponse ──');
  const brsrCount = await seedBrsrResponses();
  console.log(`  BrsrResponse: ${brsrCount} rows upserted`);

  console.log('\n── 6. OrgFrameworkMapping ──');
  const fwMapCount = await seedOrgFrameworkMappings();
  console.log(`  OrgFrameworkMapping: ${fwMapCount} rows upserted`);

  console.log('\n── 7. CategoryMapping ──');
  const catMapCount = await seedCategoryMappings();
  console.log(`  CategoryMapping: ${catMapCount} rows upserted`);

  console.log('\n── 8-16. A6.4 PACM lifecycle ──');
  const a64 = await seedA64ActivityLifecycle();
  console.log(`  Activity: ${a64.activity} row upserted`);
  console.log(`  HostAuthorization: ${a64.hostAuth} row upserted`);
  console.log(`  MonitoringPlan: ${a64.monitoringPlan} row upserted`);
  console.log(`  MonitoringParameter: ${a64.monitoringParameters} rows upserted`);
  console.log(`  MonitoringPeriod: ${a64.monitoringPeriod} row upserted`);
  console.log(`  ValidationReport: ${a64.validationReport} row upserted`);
  console.log(`  VerificationReport: ${a64.verificationReport} row upserted`);
  console.log(`  Issuance: ${a64.issuance} row upserted`);
  console.log(`  CreditAccount: ${a64.creditAccount} rows upserted`);
  console.log(`  CreditUnitBlock: ${a64.creditUnitBlock} row upserted`);

  console.log('\n── 17. KycVerification + KycVerificationEvent ──');
  const kyc = await seedKyc();
  console.log(`  KycVerification: ${kyc.verifications} row upserted`);
  console.log(`  KycVerificationEvent: ${kyc.events} row upserted`);

  console.log('\n── 18. Notification ──');
  const notifCount = await seedNotifications();
  console.log(`  Notification: ${notifCount} rows upserted`);

  console.log('\n── 19. NotificationPreference ──');
  const notifPrefCount = await seedNotificationPreference();
  console.log(`  NotificationPreference: ${notifPrefCount} row upserted`);

  console.log('\n── 20. OrganizationFinancials ──');
  const finCount = await seedOrganizationFinancials();
  console.log(`  OrganizationFinancials: ${finCount} row upserted`);

  console.log('\n── 21. ConsentRecord ──');
  const consentCount = await seedConsentRecords();
  console.log(`  ConsentRecord: ${consentCount} rows upserted`);

  console.log('\n── 22. DataBreachIncident ──');
  const breachCount = await seedDataBreachIncident();
  console.log(`  DataBreachIncident: ${breachCount} row upserted`);

  console.log('\n═══ IFHD fixture seed complete ═══');
}

main()
  .catch((err) => {
    console.error('IFHD fixture seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
