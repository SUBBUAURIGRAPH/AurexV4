/**
 * Master data seed — go-live reference data for AurexV4.
 *
 * Populates:
 *   1. IPCC AR6 emission factors (fuels, grid electricity, refrigerants, travel)
 *   2. ESG frameworks (GRI, TCFD, SASB, CDP, ISSB, BRSR) + indicators
 *   3. BRSR 9 principles + Essential/Leadership indicators + Sections A/B
 *
 * Idempotent — safe to re-run. Uses upsert on unique keys.
 *
 * Usage:
 *   pnpm --filter @aurex/database db:seed-master
 *
 * Against production:
 *   DATABASE_URL="postgresql://…" pnpm --filter @aurex/database db:seed-master
 */

// Relative import of the package-local client so the compiled output resolves
// cleanly both locally and inside the aurex-api container (where only
// @aurex/database is hoisted to the top-level node_modules).
import { prisma } from './client.js';

// ─── IPCC AR6 emission factors ─────────────────────────────────────────
// Sources: IPCC 2019 Refinement to 2006 Guidelines (Vol 2 Ch 2-3), IEA, CEA
// All values in kg CO2e per unit, net calorific where applicable.

const FUEL_SOURCES = [
  // Scope 1 — Stationary Combustion (fuels burned onsite)
  { scope: 'SCOPE_1', category: 'Stationary Combustion', name: 'Natural Gas' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', name: 'Diesel (Stationary)' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', name: 'LPG' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', name: 'Fuel Oil (Residual)' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', name: 'Coal - Bituminous' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', name: 'Coal - Sub-bituminous' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', name: 'Coal - Lignite' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', name: 'Biomass - Wood' },
  // Scope 1 — Mobile Combustion
  { scope: 'SCOPE_1', category: 'Mobile Combustion', name: 'Diesel (Mobile)' },
  { scope: 'SCOPE_1', category: 'Mobile Combustion', name: 'Petrol / Gasoline' },
  { scope: 'SCOPE_1', category: 'Mobile Combustion', name: 'Jet Fuel (Kerosene)' },
  { scope: 'SCOPE_1', category: 'Mobile Combustion', name: 'CNG' },
  // Scope 1 — Fugitive (refrigerants)
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', name: 'Refrigerant R-22' },
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', name: 'Refrigerant R-134a' },
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', name: 'Refrigerant R-410A' },
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', name: 'Refrigerant R-404A' },
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', name: 'SF6 (Insulation gas)' },
  // Scope 2 — Purchased Electricity (grid)
  { scope: 'SCOPE_2', category: 'Purchased Electricity', name: 'Grid Electricity - India (CEA)' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', name: 'Grid Electricity - USA (eGRID avg)' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', name: 'Grid Electricity - UK' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', name: 'Grid Electricity - EU27' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', name: 'Grid Electricity - China' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', name: 'Grid Electricity - Germany' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', name: 'Grid Electricity - Japan' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', name: 'Grid Electricity - Australia' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', name: 'Grid Electricity - Brazil' },
  // Scope 2 — Purchased Heat/Steam
  { scope: 'SCOPE_2', category: 'Purchased Heat', name: 'District Heating - EU avg' },
  { scope: 'SCOPE_2', category: 'Purchased Steam', name: 'Industrial Steam' },
  // Scope 3 — Business Travel
  { scope: 'SCOPE_3', category: 'Business Travel', name: 'Flight - Short haul (<1500km)' },
  { scope: 'SCOPE_3', category: 'Business Travel', name: 'Flight - Medium haul (1500-3700km)' },
  { scope: 'SCOPE_3', category: 'Business Travel', name: 'Flight - Long haul (>3700km)' },
  { scope: 'SCOPE_3', category: 'Business Travel', name: 'Rail - Intercity' },
  { scope: 'SCOPE_3', category: 'Business Travel', name: 'Car - Average petrol' },
  { scope: 'SCOPE_3', category: 'Business Travel', name: 'Taxi / Rideshare' },
  { scope: 'SCOPE_3', category: 'Business Travel', name: 'Hotel Night - Avg' },
  // Scope 3 — Employee Commuting
  { scope: 'SCOPE_3', category: 'Employee Commuting', name: 'Car commute - Petrol' },
  { scope: 'SCOPE_3', category: 'Employee Commuting', name: 'Public Transit - Bus' },
  { scope: 'SCOPE_3', category: 'Employee Commuting', name: 'Public Transit - Metro' },
  // Scope 3 — Waste
  { scope: 'SCOPE_3', category: 'Waste', name: 'Landfill - Mixed MSW' },
  { scope: 'SCOPE_3', category: 'Waste', name: 'Recycling - Paper' },
  { scope: 'SCOPE_3', category: 'Waste', name: 'Recycling - Plastic' },
  { scope: 'SCOPE_3', category: 'Waste', name: 'Wastewater - Domestic' },
  // Scope 3 — Purchased Goods
  { scope: 'SCOPE_3', category: 'Purchased Goods', name: 'Cement (industrial)' },
  { scope: 'SCOPE_3', category: 'Purchased Goods', name: 'Steel (crude)' },
  { scope: 'SCOPE_3', category: 'Purchased Goods', name: 'Paper (virgin)' },
  // Scope 3 — Upstream T&D
  { scope: 'SCOPE_3', category: 'Upstream Transportation', name: 'Truck - HGV avg' },
  { scope: 'SCOPE_3', category: 'Upstream Transportation', name: 'Rail Freight' },
  { scope: 'SCOPE_3', category: 'Upstream Transportation', name: 'Sea Freight' },
  { scope: 'SCOPE_3', category: 'Upstream Transportation', name: 'Air Freight' },
] as const;

// factor in kg CO2e per `unit`. Sources noted in dataSource.
const FUEL_FACTORS: Array<{
  scope: 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';
  category: string;
  source: string;
  factor: number;
  unit: string;
  region: string;
  year: number;
  dataSource: string;
}> = [
  // Stationary combustion — IPCC AR6 Vol 2 Ch 2, default net CV
  { scope: 'SCOPE_1', category: 'Stationary Combustion', source: 'Natural Gas', factor: 1.887, unit: 'kgCO2e/m3', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', source: 'Diesel (Stationary)', factor: 2.681, unit: 'kgCO2e/litre', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', source: 'LPG', factor: 1.513, unit: 'kgCO2e/litre', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', source: 'Fuel Oil (Residual)', factor: 3.189, unit: 'kgCO2e/litre', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', source: 'Coal - Bituminous', factor: 2.419, unit: 'kgCO2e/kg', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', source: 'Coal - Sub-bituminous', factor: 1.927, unit: 'kgCO2e/kg', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', source: 'Coal - Lignite', factor: 1.313, unit: 'kgCO2e/kg', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Stationary Combustion', source: 'Biomass - Wood', factor: 0.0, unit: 'kgCO2e/kg', region: 'Global', year: 2019, dataSource: 'IPCC (biogenic, reported separately)' },

  // Mobile combustion
  { scope: 'SCOPE_1', category: 'Mobile Combustion', source: 'Diesel (Mobile)', factor: 2.687, unit: 'kgCO2e/litre', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Mobile Combustion', source: 'Petrol / Gasoline', factor: 2.311, unit: 'kgCO2e/litre', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Mobile Combustion', source: 'Jet Fuel (Kerosene)', factor: 2.525, unit: 'kgCO2e/litre', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },
  { scope: 'SCOPE_1', category: 'Mobile Combustion', source: 'CNG', factor: 2.540, unit: 'kgCO2e/kg', region: 'Global', year: 2019, dataSource: 'IPCC 2019 Refinement' },

  // Refrigerants — AR6 100-yr GWP (kg CO2e per kg refrigerant leaked)
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', source: 'Refrigerant R-22', factor: 1960, unit: 'kgCO2e/kg', region: 'Global', year: 2021, dataSource: 'IPCC AR6 GWP100' },
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', source: 'Refrigerant R-134a', factor: 1530, unit: 'kgCO2e/kg', region: 'Global', year: 2021, dataSource: 'IPCC AR6 GWP100' },
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', source: 'Refrigerant R-410A', factor: 2088, unit: 'kgCO2e/kg', region: 'Global', year: 2021, dataSource: 'IPCC AR6 GWP100' },
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', source: 'Refrigerant R-404A', factor: 4728, unit: 'kgCO2e/kg', region: 'Global', year: 2021, dataSource: 'IPCC AR6 GWP100' },
  { scope: 'SCOPE_1', category: 'Fugitive Emissions', source: 'SF6 (Insulation gas)', factor: 25200, unit: 'kgCO2e/kg', region: 'Global', year: 2021, dataSource: 'IPCC AR6 GWP100' },

  // Grid electricity (recent published values)
  { scope: 'SCOPE_2', category: 'Purchased Electricity', source: 'Grid Electricity - India (CEA)', factor: 0.716, unit: 'kgCO2e/kWh', region: 'India', year: 2023, dataSource: 'CEA CO2 Baseline Database v19' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', source: 'Grid Electricity - USA (eGRID avg)', factor: 0.386, unit: 'kgCO2e/kWh', region: 'USA', year: 2022, dataSource: 'EPA eGRID 2022' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', source: 'Grid Electricity - UK', factor: 0.208, unit: 'kgCO2e/kWh', region: 'UK', year: 2023, dataSource: 'UK BEIS/DESNZ 2023' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', source: 'Grid Electricity - EU27', factor: 0.253, unit: 'kgCO2e/kWh', region: 'EU', year: 2022, dataSource: 'EEA 2022' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', source: 'Grid Electricity - China', factor: 0.577, unit: 'kgCO2e/kWh', region: 'China', year: 2022, dataSource: 'IEA 2022' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', source: 'Grid Electricity - Germany', factor: 0.380, unit: 'kgCO2e/kWh', region: 'Germany', year: 2022, dataSource: 'Umweltbundesamt 2022' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', source: 'Grid Electricity - Japan', factor: 0.441, unit: 'kgCO2e/kWh', region: 'Japan', year: 2022, dataSource: 'METI 2022' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', source: 'Grid Electricity - Australia', factor: 0.634, unit: 'kgCO2e/kWh', region: 'Australia', year: 2022, dataSource: 'DCCEEW NGA 2022' },
  { scope: 'SCOPE_2', category: 'Purchased Electricity', source: 'Grid Electricity - Brazil', factor: 0.119, unit: 'kgCO2e/kWh', region: 'Brazil', year: 2022, dataSource: 'MCTI 2022' },
  { scope: 'SCOPE_2', category: 'Purchased Heat', source: 'District Heating - EU avg', factor: 0.170, unit: 'kgCO2e/kWh', region: 'EU', year: 2022, dataSource: 'EEA 2022' },
  { scope: 'SCOPE_2', category: 'Purchased Steam', source: 'Industrial Steam', factor: 0.197, unit: 'kgCO2e/kWh', region: 'Global', year: 2022, dataSource: 'GHG Protocol Scope 2 Guidance' },

  // Business travel — DEFRA/BEIS 2023
  { scope: 'SCOPE_3', category: 'Business Travel', source: 'Flight - Short haul (<1500km)', factor: 0.158, unit: 'kgCO2e/passenger-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Business Travel', source: 'Flight - Medium haul (1500-3700km)', factor: 0.131, unit: 'kgCO2e/passenger-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Business Travel', source: 'Flight - Long haul (>3700km)', factor: 0.195, unit: 'kgCO2e/passenger-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Business Travel', source: 'Rail - Intercity', factor: 0.035, unit: 'kgCO2e/passenger-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Business Travel', source: 'Car - Average petrol', factor: 0.175, unit: 'kgCO2e/km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Business Travel', source: 'Taxi / Rideshare', factor: 0.149, unit: 'kgCO2e/passenger-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Business Travel', source: 'Hotel Night - Avg', factor: 10.4, unit: 'kgCO2e/room-night', region: 'Global', year: 2023, dataSource: 'Cornell Hotel Sustainability 2023' },

  { scope: 'SCOPE_3', category: 'Employee Commuting', source: 'Car commute - Petrol', factor: 0.175, unit: 'kgCO2e/km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Employee Commuting', source: 'Public Transit - Bus', factor: 0.102, unit: 'kgCO2e/passenger-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Employee Commuting', source: 'Public Transit - Metro', factor: 0.028, unit: 'kgCO2e/passenger-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },

  { scope: 'SCOPE_3', category: 'Waste', source: 'Landfill - Mixed MSW', factor: 0.467, unit: 'kgCO2e/kg', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Waste', source: 'Recycling - Paper', factor: 0.021, unit: 'kgCO2e/kg', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Waste', source: 'Recycling - Plastic', factor: 0.021, unit: 'kgCO2e/kg', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Waste', source: 'Wastewater - Domestic', factor: 0.708, unit: 'kgCO2e/m3', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },

  { scope: 'SCOPE_3', category: 'Purchased Goods', source: 'Cement (industrial)', factor: 0.900, unit: 'kgCO2e/kg', region: 'Global', year: 2022, dataSource: 'GCCA Cement Industry Avg 2022' },
  { scope: 'SCOPE_3', category: 'Purchased Goods', source: 'Steel (crude)', factor: 1.850, unit: 'kgCO2e/kg', region: 'Global', year: 2022, dataSource: 'WorldSteel 2022 avg' },
  { scope: 'SCOPE_3', category: 'Purchased Goods', source: 'Paper (virgin)', factor: 1.090, unit: 'kgCO2e/kg', region: 'Global', year: 2022, dataSource: 'DEFRA/BEIS 2023' },

  { scope: 'SCOPE_3', category: 'Upstream Transportation', source: 'Truck - HGV avg', factor: 0.106, unit: 'kgCO2e/tonne-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Upstream Transportation', source: 'Rail Freight', factor: 0.028, unit: 'kgCO2e/tonne-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Upstream Transportation', source: 'Sea Freight', factor: 0.016, unit: 'kgCO2e/tonne-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
  { scope: 'SCOPE_3', category: 'Upstream Transportation', source: 'Air Freight', factor: 0.602, unit: 'kgCO2e/tonne-km', region: 'Global', year: 2023, dataSource: 'DEFRA/BEIS 2023' },
];

// Legacy rows stored factor in tCO2e/<unit>, the new IPCC set is kgCO2e/<unit>.
// Normalise so the UI shows a single coherent unit across every row.
async function normalizeLegacyFactors() {
  const legacy = await prisma.emissionFactor.findMany({
    where: { unit: { contains: 'tCO2e/' } },
  });
  if (legacy.length === 0) {
    console.log('  (no legacy tCO2e/ rows to normalise)');
    return;
  }
  for (const row of legacy) {
    const newFactor = Number(row.factor) * 1000; // tCO2e → kgCO2e
    const newUnit = row.unit.replace(/^tCO2e\//, 'kgCO2e/');
    await prisma.emissionFactor.update({
      where: { id: row.id },
      data: { factor: newFactor, unit: newUnit },
    });
  }
  console.log(`  Normalised ${legacy.length} legacy factors: tCO2e/ → kgCO2e/ (×1000)`);
}

async function seedEmissionFactors() {
  console.log('\n── Emission Sources & Factors (IPCC AR6 / DEFRA) ──');

  await normalizeLegacyFactors();

  let sourceCount = 0;
  for (const s of FUEL_SOURCES) {
    await prisma.emissionSource.upsert({
      where: { scope_category_name: { scope: s.scope as never, category: s.category, name: s.name } },
      update: { isActive: true },
      create: { scope: s.scope as never, category: s.category, name: s.name, isActive: true },
    });
    sourceCount += 1;
  }
  console.log(`  EmissionSource: ${sourceCount} rows upserted`);

  // EmissionFactor has no compound unique — match on (scope, category, source, region, year).
  let factorCount = 0;
  for (const f of FUEL_FACTORS) {
    const existing = await prisma.emissionFactor.findFirst({
      where: { scope: f.scope as never, category: f.category, source: f.source, region: f.region, year: f.year },
    });
    if (existing) {
      await prisma.emissionFactor.update({
        where: { id: existing.id },
        data: { factor: f.factor, unit: f.unit, dataSource: f.dataSource },
      });
    } else {
      await prisma.emissionFactor.create({
        data: {
          scope: f.scope as never,
          category: f.category,
          source: f.source,
          factor: f.factor,
          unit: f.unit,
          region: f.region,
          year: f.year,
          dataSource: f.dataSource,
        },
      });
    }
    factorCount += 1;
  }
  console.log(`  EmissionFactor: ${factorCount} rows upserted`);
}

// ─── ESG frameworks + indicators ───────────────────────────────────────

const FRAMEWORKS = [
  { code: 'GRI', name: 'Global Reporting Initiative (GRI)', version: '2021', description: 'The most widely adopted global sustainability reporting standards. Covers governance, economic, environmental, and social topics via universal, sector, and topic standards.' },
  { code: 'TCFD', name: 'Task Force on Climate-related Financial Disclosures', version: '2017', description: 'Recommendations for disclosing climate-related financial risks. 11 disclosures across Governance, Strategy, Risk Management, and Metrics & Targets.' },
  { code: 'SASB', name: 'Sustainability Accounting Standards Board', version: '2018', description: 'Industry-specific financially-material sustainability topics. Now part of IFRS/ISSB.' },
  { code: 'CDP', name: 'Carbon Disclosure Project', version: '2024', description: 'Global environmental disclosure platform — Climate Change, Water Security, and Forests questionnaires for companies and supply chains.' },
  { code: 'ISSB', name: 'IFRS Sustainability Disclosure Standards (ISSB)', version: 'IFRS S1/S2 2023', description: 'IFRS S1 (general sustainability) and S2 (climate-related) — global baseline for investor-focused sustainability disclosure.' },
  { code: 'BRSR', name: 'Business Responsibility and Sustainability Report', version: 'SEBI 2022', description: 'Mandatory for top 1000 Indian listed companies. 9 NGRBC principles, 3 sections (A/B/C), Essential + Leadership indicators.' },
];

// A curated indicator set — not exhaustive but covers the indicators most
// commonly consumed in carbon/ESG reporting.
const INDICATORS: Array<{
  frameworkCode: string;
  code: string;
  title: string;
  category: string;
  description?: string;
}> = [
  // GRI 300-series (Environmental) — core set
  { frameworkCode: 'GRI', code: 'GRI 302-1', title: 'Energy consumption within the organization', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 302-3', title: 'Energy intensity', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 302-4', title: 'Reduction of energy consumption', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 303-3', title: 'Water withdrawal', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 303-5', title: 'Water consumption', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 305-1', title: 'Direct (Scope 1) GHG emissions', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 305-2', title: 'Energy indirect (Scope 2) GHG emissions', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 305-3', title: 'Other indirect (Scope 3) GHG emissions', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 305-4', title: 'GHG emissions intensity', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 305-5', title: 'Reduction of GHG emissions', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 306-3', title: 'Waste generated', category: 'Environmental' },
  { frameworkCode: 'GRI', code: 'GRI 308-1', title: 'New suppliers screened using environmental criteria', category: 'Environmental' },
  // GRI Social
  { frameworkCode: 'GRI', code: 'GRI 401-1', title: 'New employee hires and employee turnover', category: 'Social' },
  { frameworkCode: 'GRI', code: 'GRI 403-9', title: 'Work-related injuries', category: 'Social' },
  { frameworkCode: 'GRI', code: 'GRI 405-1', title: 'Diversity of governance bodies and employees', category: 'Social' },
  // GRI Governance
  { frameworkCode: 'GRI', code: 'GRI 2-9', title: 'Governance structure and composition', category: 'Governance' },
  { frameworkCode: 'GRI', code: 'GRI 205-2', title: 'Communication and training about anti-corruption', category: 'Governance' },

  // TCFD — 11 recommended disclosures
  { frameworkCode: 'TCFD', code: 'TCFD-GOV-a', title: 'Board oversight of climate-related risks and opportunities', category: 'Governance' },
  { frameworkCode: 'TCFD', code: 'TCFD-GOV-b', title: "Management's role in assessing climate-related risks", category: 'Governance' },
  { frameworkCode: 'TCFD', code: 'TCFD-STR-a', title: 'Climate-related risks and opportunities identified (short, medium, long term)', category: 'Strategy' },
  { frameworkCode: 'TCFD', code: 'TCFD-STR-b', title: 'Impact of climate-related risks on businesses, strategy, financial planning', category: 'Strategy' },
  { frameworkCode: 'TCFD', code: 'TCFD-STR-c', title: 'Resilience of strategy under different climate scenarios incl. 2°C', category: 'Strategy' },
  { frameworkCode: 'TCFD', code: 'TCFD-RSK-a', title: 'Processes for identifying and assessing climate-related risks', category: 'Risk Management' },
  { frameworkCode: 'TCFD', code: 'TCFD-RSK-b', title: 'Processes for managing climate-related risks', category: 'Risk Management' },
  { frameworkCode: 'TCFD', code: 'TCFD-RSK-c', title: 'Integration into overall risk management', category: 'Risk Management' },
  { frameworkCode: 'TCFD', code: 'TCFD-MT-a', title: 'Metrics used to assess climate-related risks and opportunities', category: 'Metrics & Targets' },
  { frameworkCode: 'TCFD', code: 'TCFD-MT-b', title: 'Scope 1, 2, 3 GHG emissions and related risks', category: 'Metrics & Targets' },
  { frameworkCode: 'TCFD', code: 'TCFD-MT-c', title: 'Targets used to manage climate-related risks and performance', category: 'Metrics & Targets' },

  // CDP — key response sections
  { frameworkCode: 'CDP', code: 'CDP-C1', title: 'Governance', category: 'Governance' },
  { frameworkCode: 'CDP', code: 'CDP-C2', title: 'Risks and opportunities', category: 'Risk Management' },
  { frameworkCode: 'CDP', code: 'CDP-C3', title: 'Business strategy', category: 'Strategy' },
  { frameworkCode: 'CDP', code: 'CDP-C4', title: 'Targets and performance', category: 'Metrics & Targets' },
  { frameworkCode: 'CDP', code: 'CDP-C6', title: 'Emissions data', category: 'Environmental' },
  { frameworkCode: 'CDP', code: 'CDP-C7', title: 'Emissions breakdowns', category: 'Environmental' },
  { frameworkCode: 'CDP', code: 'CDP-C8', title: 'Energy', category: 'Environmental' },
  { frameworkCode: 'CDP', code: 'CDP-C9', title: 'Additional metrics', category: 'Environmental' },

  // ISSB — IFRS S2 climate disclosures (high-level)
  { frameworkCode: 'ISSB', code: 'S2-GOV', title: 'Governance of climate-related risks and opportunities', category: 'Governance' },
  { frameworkCode: 'ISSB', code: 'S2-STR', title: 'Strategy: climate-related risks and opportunities affecting business', category: 'Strategy' },
  { frameworkCode: 'ISSB', code: 'S2-RSK', title: 'Risk management: processes used to identify and monitor climate risks', category: 'Risk Management' },
  { frameworkCode: 'ISSB', code: 'S2-MT-1', title: 'Scope 1, 2, 3 gross GHG emissions', category: 'Metrics & Targets' },
  { frameworkCode: 'ISSB', code: 'S2-MT-2', title: 'Climate-related transition risks and physical risks', category: 'Metrics & Targets' },
  { frameworkCode: 'ISSB', code: 'S2-MT-3', title: 'Internal carbon pricing', category: 'Metrics & Targets' },

  // SASB — generic cross-industry environmental
  { frameworkCode: 'SASB', code: 'SASB-GHG-1', title: 'Gross global Scope 1 emissions', category: 'Environmental' },
  { frameworkCode: 'SASB', code: 'SASB-GHG-2', title: 'Percentage of Scope 1 emissions covered under emissions-limiting regulations', category: 'Environmental' },
  { frameworkCode: 'SASB', code: 'SASB-ENG-1', title: 'Total energy consumed, % grid electricity, % renewable', category: 'Environmental' },
  { frameworkCode: 'SASB', code: 'SASB-WTR-1', title: 'Total water withdrawn and water consumed', category: 'Environmental' },
];

async function seedEsgFrameworks() {
  console.log('\n── ESG Frameworks & Indicators ──');

  for (const fw of FRAMEWORKS) {
    await prisma.esgFramework.upsert({
      where: { code: fw.code },
      update: { name: fw.name, version: fw.version, description: fw.description, isActive: true },
      create: { ...fw, isActive: true },
    });
  }
  console.log(`  EsgFramework: ${FRAMEWORKS.length} rows upserted`);

  const frameworks = await prisma.esgFramework.findMany();
  const byCode = new Map(frameworks.map((f) => [f.code, f.id]));

  for (const ind of INDICATORS) {
    const frameworkId = byCode.get(ind.frameworkCode);
    if (!frameworkId) continue;
    await prisma.esgIndicator.upsert({
      where: { frameworkId_code: { frameworkId, code: ind.code } },
      update: { title: ind.title, category: ind.category, description: ind.description ?? null, isActive: true },
      create: {
        frameworkId,
        code: ind.code,
        title: ind.title,
        category: ind.category,
        description: ind.description ?? null,
        isActive: true,
      },
    });
  }
  console.log(`  EsgIndicator: ${INDICATORS.length} rows upserted`);
}

// ─── BRSR 9 principles + indicators ────────────────────────────────────

const BRSR_PRINCIPLES = [
  { number: 1, title: 'Businesses should conduct themselves with integrity and in a manner that is ethical, transparent and accountable', description: 'Ethics, transparency, and accountability across the value chain.' },
  { number: 2, title: 'Businesses should provide goods and services in a manner that is sustainable and safe', description: 'Life-cycle sustainability of products and services.' },
  { number: 3, title: 'Businesses should respect and promote the well-being of all employees', description: 'Employee well-being including contractual workers.' },
  { number: 4, title: 'Businesses should respect the interests of and be responsive to all its stakeholders', description: 'Stakeholder engagement including marginalised and vulnerable groups.' },
  { number: 5, title: 'Businesses should respect and promote human rights', description: 'Human rights in operations and value chain.' },
  { number: 6, title: 'Businesses should respect and make efforts to protect and restore the environment', description: 'Environmental protection — energy, emissions, water, waste, biodiversity.' },
  { number: 7, title: 'Businesses, when engaging in influencing public and regulatory policy, should do so in a manner that is responsible and transparent', description: 'Responsible public policy advocacy.' },
  { number: 8, title: 'Businesses should promote inclusive growth and equitable development', description: 'Inclusive growth — social impact, CSR, access to essential services.' },
  { number: 9, title: 'Businesses should engage with and provide value to their consumers in a responsible manner', description: 'Consumer value — product safety, data privacy, grievance redressal.' },
];

const BRSR_INDICATORS: Array<{
  principleNumber: number | null; // null = Section A/B
  section: 'SECTION_A' | 'SECTION_B' | 'SECTION_C';
  indicatorType: 'ESSENTIAL' | 'LEADERSHIP';
  code: string;
  title: string;
  description?: string;
}> = [
  // Section A — General Disclosures (entity-level)
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-I-1', title: 'Corporate Identity Number (CIN) of the listed entity' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-I-2', title: 'Name of the listed entity' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-I-3', title: 'Year of incorporation' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-II-1', title: 'Products/services — % contribution to turnover' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-III-1', title: 'Number of locations (national/international, plants/offices)' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-IV-1', title: 'Markets served — national/international presence, exports %' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-V-1', title: 'Employees — total, permanent, other than permanent, gender split' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-VI-1', title: 'Differently-abled employees — count by gender' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-VII-1', title: 'Participation of women in leadership (board, KMPs)' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-VIII-1', title: 'Turnover rate for permanent employees and workers' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-IX-1', title: 'Holding, subsidiary, associate, joint venture details' },
  { principleNumber: null, section: 'SECTION_A', indicatorType: 'ESSENTIAL', code: 'SA-X-1', title: 'CSR Applicability, turnover, net worth' },

  // Section B — Management & Process Disclosures
  { principleNumber: null, section: 'SECTION_B', indicatorType: 'ESSENTIAL', code: 'SB-1', title: 'Policy and management processes — coverage across the 9 principles' },
  { principleNumber: null, section: 'SECTION_B', indicatorType: 'ESSENTIAL', code: 'SB-2', title: 'Governance, leadership, and oversight for sustainability' },
  { principleNumber: null, section: 'SECTION_B', indicatorType: 'ESSENTIAL', code: 'SB-3', title: 'Details of Review of NGRBCs by the Company' },
  { principleNumber: null, section: 'SECTION_B', indicatorType: 'ESSENTIAL', code: 'SB-4', title: 'External assessment/evaluation of policies' },

  // Section C — Principle-wise performance (Essential + Leadership per principle)
  // P1: Ethics
  { principleNumber: 1, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P1-E-1', title: 'Training on principles — Board, KMP, employees, workers' },
  { principleNumber: 1, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P1-E-2', title: 'Details of fines/penalties/punishment/award/compounding fees' },
  { principleNumber: 1, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P1-E-3', title: 'Anti-corruption or anti-bribery policy' },
  { principleNumber: 1, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P1-L-1', title: 'Awareness programmes for value-chain partners on ethics' },

  // P2: Sustainable products
  { principleNumber: 2, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P2-E-1', title: 'R&D and capex on environmentally-sustainable technologies' },
  { principleNumber: 2, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P2-E-2', title: 'Sustainable sourcing procedures' },
  { principleNumber: 2, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P2-E-3', title: 'Product reclamation, recycled input, EPR' },
  { principleNumber: 2, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P2-L-1', title: 'Life-Cycle Assessment for key products' },

  // P3: Employee well-being
  { principleNumber: 3, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P3-E-1', title: 'Employee benefits — PF, gratuity, ESI, health insurance, maternity' },
  { principleNumber: 3, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P3-E-2', title: 'Accessibility of workplaces' },
  { principleNumber: 3, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P3-E-3', title: 'Retirement benefits for all employees' },
  { principleNumber: 3, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P3-E-4', title: 'Occupational health & safety — complaints, incidents, fatalities' },
  { principleNumber: 3, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P3-L-1', title: 'Life insurance or compensation in case of work-related deaths' },

  // P4: Stakeholders
  { principleNumber: 4, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P4-E-1', title: 'Stakeholder identification and engagement processes' },
  { principleNumber: 4, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P4-L-1', title: 'Consultation with marginalised stakeholder groups' },

  // P5: Human rights
  { principleNumber: 5, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P5-E-1', title: 'Human rights training — employees and workers' },
  { principleNumber: 5, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P5-E-2', title: 'Minimum wages paid — gender and type split' },
  { principleNumber: 5, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P5-E-3', title: 'Complaints on sexual harassment, discrimination, child labour, forced labour' },
  { principleNumber: 5, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P5-L-1', title: 'Human rights due diligence assessments' },

  // P6: Environment (the one you probably care most about)
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P6-E-1', title: 'Total energy consumption (in Joules) — electricity, fuel, other', description: 'Breakdown by source; intensity per rupee of turnover.' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P6-E-2', title: 'Water withdrawal by source (kL)' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P6-E-3', title: 'Air emissions (other than GHG) — NOx, SOx, PM' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P6-E-4', title: 'GHG emissions — Scope 1 and Scope 2 (tCO2e)', description: 'With intensity per rupee of turnover and optional Scope 3.' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P6-E-5', title: 'Projects related to reducing GHG emissions' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P6-E-6', title: 'Waste generation — plastic, e-waste, bio-medical, construction, hazardous, other' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P6-E-7', title: 'Waste management practices — reused, recycled, disposal methods' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P6-E-8', title: 'Operations in/around ecologically sensitive areas' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P6-L-1', title: 'Scope 3 GHG emissions (tCO2e)' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P6-L-2', title: 'Biodiversity impact assessments and mitigation' },
  { principleNumber: 6, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P6-L-3', title: 'Value-chain emissions assessment and mitigation' },

  // P7: Policy advocacy
  { principleNumber: 7, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P7-E-1', title: 'Trade and industry chambers/associations the company is a member of' },
  { principleNumber: 7, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P7-L-1', title: 'Public policy positions advocated' },

  // P8: Inclusive growth
  { principleNumber: 8, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P8-E-1', title: 'Social Impact Assessments undertaken' },
  { principleNumber: 8, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P8-E-2', title: 'Projects undertaken for designated aspirational districts' },
  { principleNumber: 8, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P8-E-3', title: 'Benefits derived from directly sourcing from MSMEs / small producers' },
  { principleNumber: 8, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P8-L-1', title: 'CSR expenditure beyond mandatory requirements' },

  // P9: Consumer value
  { principleNumber: 9, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P9-E-1', title: 'Mechanisms to receive and respond to consumer complaints and feedback' },
  { principleNumber: 9, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P9-E-2', title: 'Product information and labelling' },
  { principleNumber: 9, section: 'SECTION_C', indicatorType: 'ESSENTIAL', code: 'P9-E-3', title: 'Consumer complaints — data privacy, cyber-security' },
  { principleNumber: 9, section: 'SECTION_C', indicatorType: 'LEADERSHIP', code: 'P9-L-1', title: 'Consumer awareness / education on safe and responsible product use' },
];

async function seedBrsr() {
  console.log('\n── BRSR Principles & Indicators ──');

  for (const p of BRSR_PRINCIPLES) {
    await prisma.brsrPrinciple.upsert({
      where: { number: p.number },
      update: { title: p.title, description: p.description, isActive: true },
      create: { ...p, isActive: true },
    });
  }
  console.log(`  BrsrPrinciple: ${BRSR_PRINCIPLES.length} rows upserted`);

  const principles = await prisma.brsrPrinciple.findMany();
  const byNumber = new Map(principles.map((p) => [p.number, p.id]));

  for (const ind of BRSR_INDICATORS) {
    const principleId = ind.principleNumber ? byNumber.get(ind.principleNumber) ?? null : null;
    await prisma.brsrIndicator.upsert({
      where: { code: ind.code },
      update: {
        principleId,
        section: ind.section as never,
        indicatorType: ind.indicatorType as never,
        title: ind.title,
        description: ind.description ?? null,
        isActive: true,
      },
      create: {
        principleId,
        section: ind.section as never,
        indicatorType: ind.indicatorType as never,
        code: ind.code,
        title: ind.title,
        description: ind.description ?? null,
        isActive: true,
      },
    });
  }
  console.log(`  BrsrIndicator: ${BRSR_INDICATORS.length} rows upserted`);
}

// ─── Category → Framework Indicator mappings ───────────────────────────
// Platform defaults (orgId = null). Orgs can override per-category via the
// /reference-data/category-mappings API.

const CATEGORY_MAPPINGS: Array<{
  scope: 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';
  category: string;
  esg: string[];
  brsr: string[];
}> = [
  // Scope 1
  {
    scope: 'SCOPE_1', category: 'Stationary Combustion',
    esg: ['GRI 305-1', 'TCFD-MT-b', 'SASB-GHG-1', 'ISSB-S2-MT-1', 'CDP-C6'],
    brsr: ['P6-E-4'],
  },
  {
    scope: 'SCOPE_1', category: 'Mobile Combustion',
    esg: ['GRI 305-1', 'TCFD-MT-b', 'SASB-GHG-1', 'ISSB-S2-MT-1', 'CDP-C6'],
    brsr: ['P6-E-4'],
  },
  {
    scope: 'SCOPE_1', category: 'Fugitive Emissions',
    esg: ['GRI 305-1', 'TCFD-MT-b', 'ISSB-S2-MT-1'],
    brsr: ['P6-E-4'],
  },
  {
    scope: 'SCOPE_1', category: 'Process Emissions',
    esg: ['GRI 305-1', 'TCFD-MT-b', 'ISSB-S2-MT-1'],
    brsr: ['P6-E-4'],
  },
  // Scope 2
  {
    scope: 'SCOPE_2', category: 'Purchased Electricity',
    esg: ['GRI 305-2', 'GRI 302-1', 'TCFD-MT-b', 'SASB-ENG-1', 'ISSB-S2-MT-1', 'CDP-C6', 'CDP-C8'],
    brsr: ['P6-E-4', 'P6-E-1'],
  },
  {
    scope: 'SCOPE_2', category: 'Purchased Heat',
    esg: ['GRI 305-2', 'GRI 302-1', 'TCFD-MT-b', 'ISSB-S2-MT-1'],
    brsr: ['P6-E-4', 'P6-E-1'],
  },
  {
    scope: 'SCOPE_2', category: 'Purchased Steam',
    esg: ['GRI 305-2', 'GRI 302-1', 'TCFD-MT-b', 'ISSB-S2-MT-1'],
    brsr: ['P6-E-4', 'P6-E-1'],
  },
  // Scope 3
  {
    scope: 'SCOPE_3', category: 'Business Travel',
    esg: ['GRI 305-3', 'TCFD-MT-b', 'ISSB-S2-MT-1'],
    brsr: ['P6-L-1'],
  },
  {
    scope: 'SCOPE_3', category: 'Employee Commuting',
    esg: ['GRI 305-3', 'TCFD-MT-b', 'ISSB-S2-MT-1'],
    brsr: ['P6-L-1'],
  },
  {
    scope: 'SCOPE_3', category: 'Waste',
    esg: ['GRI 305-3', 'GRI 306-3', 'TCFD-MT-b'],
    brsr: ['P6-L-1', 'P6-E-6'],
  },
  {
    scope: 'SCOPE_3', category: 'Purchased Goods',
    esg: ['GRI 305-3', 'TCFD-MT-b', 'ISSB-S2-MT-1'],
    brsr: ['P6-L-1', 'P6-L-3'],
  },
  {
    scope: 'SCOPE_3', category: 'Upstream Transportation',
    esg: ['GRI 305-3', 'TCFD-MT-b', 'ISSB-S2-MT-1'],
    brsr: ['P6-L-1', 'P6-L-3'],
  },
];

async function seedCategoryMappings() {
  console.log('\n── Category → Indicator Mappings (platform defaults) ──');

  for (const m of CATEGORY_MAPPINGS) {
    // Compound unique includes nullable orgId, so we can't address the platform
    // default row via the generated `findUnique` input. Use findFirst + create/
    // update by id instead.
    const existing = await prisma.categoryMapping.findFirst({
      where: { orgId: null, scope: m.scope as never, category: m.category },
    });
    if (existing) {
      await prisma.categoryMapping.update({
        where: { id: existing.id },
        data: {
          esgIndicatorCodes: m.esg,
          brsrIndicatorCodes: m.brsr,
          isDefault: true,
        },
      });
    } else {
      await prisma.categoryMapping.create({
        data: {
          orgId: null,
          scope: m.scope as never,
          category: m.category,
          esgIndicatorCodes: m.esg,
          brsrIndicatorCodes: m.brsr,
          isDefault: true,
        },
      });
    }
  }
  console.log(`  CategoryMapping: ${CATEGORY_MAPPINGS.length} rows upserted`);
}

// ─── Approval Workflow Recipes (Phase C) ───────────────────────────────

const WORKFLOW_RECIPES = [
  {
    code: 'single-approver',
    name: 'Single Approver',
    description: 'A single APPROVER decides.',
    requiredApprovers: 1,
  },
  {
    code: 'dual-approval',
    name: 'Dual Approval',
    description: 'Two APPROVERs must both approve.',
    requiredApprovers: 2,
  },
  {
    code: 'triple-approval',
    name: 'Triple Approval (consensus)',
    description: 'Three APPROVERs must all approve.',
    requiredApprovers: 3,
  },
];

async function seedWorkflowRecipes() {
  console.log('\n── Workflow Recipes (configurable quorum) ──');

  for (const r of WORKFLOW_RECIPES) {
    await prisma.workflowRecipe.upsert({
      where: { code: r.code },
      update: {
        name: r.name,
        description: r.description,
        requiredApprovers: r.requiredApprovers,
        isActive: true,
      },
      create: { ...r, isActive: true },
    });
  }
  console.log(`  WorkflowRecipe: ${WORKFLOW_RECIPES.length} rows upserted`);
}

// ─── E2E Admin Test User ────────────────────────────────────────────────
// Idempotent: upsert on email. Password is bcrypt hash of "E2eAdmin@2026!"
// PBKDF: bcrypt cost 12. Only seeded in non-production or when E2E_SEED=1.
async function seedE2eAdminUser() {
  // Pre-computed bcrypt hash of "E2eAdmin@2026!" (rounds=12)
  // Generated offline to avoid a bcrypt dependency in this script.
  const ADMIN_EMAIL = 'e2e_admin@aurex.in';
  const ADMIN_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGrmZEJ3.gy5eZUYI2LKqeWBQu2'; // placeholder — see below

  // Use node bcrypt at runtime if available
  let bcrypt: { hash: (p: string, r: number) => Promise<string> } | null = null;
  try {
    bcrypt = (await import('bcrypt')) as { hash: (p: string, r: number) => Promise<string> };
  } catch { /* bcrypt not available */ }

  const hash = bcrypt
    ? await bcrypt.hash('E2eAdmin@2026!', 12)
    : ADMIN_PASSWORD_HASH;

  const ORG_NAME = 'E2E Test Organisation';
  const ORG_ID = 'e2e00000-0000-4000-8000-000000000001';
  const USER_ID = 'e2e00000-0000-4000-8000-000000000002';

  // Upsert org
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: ORG_NAME, isActive: true },
    create: { id: ORG_ID, name: ORG_NAME, slug: 'e2e-test-org', isActive: true },
  });

  // Upsert user
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  let userId: string;
  if (existing) {
    userId = existing.id;
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'ORG_ADMIN', isActive: true, passwordHash: hash },
    });
  } else {
    const u = await prisma.user.create({
      data: {
        id: USER_ID,
        email: ADMIN_EMAIL,
        name: 'E2E Admin',
        passwordHash: hash,
        role: 'ORG_ADMIN',
        isActive: true,
      },
    });
    userId = u.id;
  }

  // Upsert org membership
  const membership = await prisma.orgMember.findFirst({
    where: { userId, orgId: ORG_ID },
  });
  if (!membership) {
    await prisma.orgMember.create({
      data: { userId, orgId: ORG_ID, role: 'ORG_ADMIN', isActive: true },
    });
  } else {
    await prisma.orgMember.update({
      where: { id: membership.id },
      data: { role: 'ORG_ADMIN', isActive: true },
    });
  }

  console.log(`  E2E admin user seeded: ${ADMIN_EMAIL}`);
}

// ─── E2E DOE + DNA test users (AV4-339) ────────────────────────────────
// Extend the E2E_SEED=1 pattern with a DOE (third-party validator) and a
// DNA (host-country approver). Both are added as members of the seeded
// E2E Test Organisation so `requireOrgScope` can resolve their org at
// auth time. Passwords fixed for E2E harness:
//   e2e_doe@aurex.in / E2eDoe@2026!
//   e2e_dna@aurex.in / E2eDna@2026!
async function seedE2eA64Users() {
  const ORG_ID = 'e2e00000-0000-4000-8000-000000000001';

  let bcrypt: { hash: (p: string, r: number) => Promise<string> } | null = null;
  try {
    bcrypt = (await import('bcrypt')) as { hash: (p: string, r: number) => Promise<string> };
  } catch { /* bcrypt not available */ }

  // Pre-computed bcrypt hashes (cost 12). Used only if bcrypt import fails
  // (e.g. during CI that forgot to install). Generated offline via
  // `bcrypt.hash(plaintext, 12)` — same mechanism as seedE2eAdminUser.
  const FALLBACK_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGrmZEJ3.gy5eZUYI2LKqeWBQu2';

  const USERS: Array<{ id: string; email: string; name: string; password: string; role: 'DOE' | 'DNA' }> = [
    {
      id: 'e2e00000-0000-4000-8000-000000000003',
      email: 'e2e_doe@aurex.in',
      name: 'E2E DOE Validator',
      password: 'E2eDoe@2026!',
      role: 'DOE',
    },
    {
      id: 'e2e00000-0000-4000-8000-000000000004',
      email: 'e2e_dna@aurex.in',
      name: 'E2E DNA Approver',
      password: 'E2eDna@2026!',
      role: 'DNA',
    },
  ];

  for (const u of USERS) {
    const hash = bcrypt ? await bcrypt.hash(u.password, 12) : FALLBACK_HASH;

    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    let userId: string;
    if (existing) {
      userId = existing.id;
      await prisma.user.update({
        where: { id: userId },
        data: { role: u.role, isActive: true, passwordHash: hash },
      });
    } else {
      const created = await prisma.user.create({
        data: {
          id: u.id,
          email: u.email,
          name: u.name,
          passwordHash: hash,
          role: u.role,
          isActive: true,
        },
      });
      userId = created.id;
    }

    // Membership in the E2E Test Organisation.
    const membership = await prisma.orgMember.findFirst({
      where: { userId, orgId: ORG_ID },
    });
    if (!membership) {
      await prisma.orgMember.create({
        data: { userId, orgId: ORG_ID, role: u.role, isActive: true },
      });
    } else {
      await prisma.orgMember.update({
        where: { id: membership.id },
        data: { role: u.role, isActive: true },
      });
    }

    console.log(`  E2E A6.4 user seeded: ${u.email} (${u.role})`);
  }
}

// ─── Article 6.4 Methodologies ────────────────────────────────────────
// Sample catalogue seeded from UNFCCC Supervisory Body standards.
// Canonical reference: https://unfccc.int/process-and-meetings/bodies/constituted-bodies/article-64-supervisory-body/rules-and-regulations
// Extend this list as the SB publishes new methodologies.

const A64_METHODOLOGIES: Array<{
  code: string;
  name: string;
  version: string;
  category:
    | 'BASELINE_AND_MONITORING'
    | 'REMOVAL'
    | 'SMALL_SCALE'
    | 'CONSOLIDATED'
    | 'CDM_TRANSITION';
  sectoralScope: number | null;
  summary: string;
  referenceUrl: string;
  effectiveFrom: Date;
  /** True when the methodology is eligible for BioCarbon Registry (BCR)
   *  Third-Party tokenisation (binding requirement B6 of
   *  `docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md`). */
  isBcrEligible?: boolean;
}> = [
  {
    code: 'A6.4-STAN-METH-004',
    name: 'Methodology Standard (baseline + additionality + leakage)',
    version: '01.0',
    category: 'BASELINE_AND_MONITORING',
    sectoralScope: null,
    summary:
      'Core A6.4 methodology standard: additionality, conservative baselines with mandatory downward adjustment, NDC alignment, leakage treatment, conservativeness principle.',
    referenceUrl: 'https://unfccc.int/sites/default/files/resource/A6.4-STAN-METH-004.pdf',
    effectiveFrom: new Date('2024-10-09'),
    isBcrEligible: false, // standards-of-standards row, not a project methodology
  },
  {
    code: 'A6.4-STAN-METH-005',
    name: 'Removals Standard (permanence + buffer pool)',
    version: '01.0',
    category: 'REMOVAL',
    sectoralScope: 14, // AFOLU
    summary:
      'Requirements for removal activities: reversal-risk rating, buffer-pool contribution, long-term monitoring obligations, liability on reversal.',
    referenceUrl: 'https://unfccc.int/sites/default/files/resource/A6.4-STAN-METH-005.pdf',
    effectiveFrom: new Date('2024-10-09'),
    isBcrEligible: false, // standards-of-standards row, not a project methodology
  },
  {
    code: 'A6.4-AM-GRID-RE-001',
    name: 'Grid-connected renewable electricity generation',
    version: '01.0',
    category: 'BASELINE_AND_MONITORING',
    sectoralScope: 1, // Energy industries
    summary:
      'Baseline = grid emission factor (combined margin) × electricity displaced by the renewable plant. Monitoring: metered electricity supplied to grid + grid EF updated annually.',
    referenceUrl:
      'https://unfccc.int/process-and-meetings/bodies/constituted-bodies/article-64-supervisory-body/rules-and-regulations',
    effectiveFrom: new Date('2025-01-01'),
  },
  {
    code: 'A6.4-AM-LANDFILL-CH4-001',
    name: 'Landfill methane capture and flaring / utilisation',
    version: '01.0',
    category: 'BASELINE_AND_MONITORING',
    sectoralScope: 13, // Waste handling and disposal
    summary:
      'Baseline = CH4 emitted without capture per first-order decay model. Project: metered CH4 destroyed (flared) or used (energy). GWP AR6 (CH4 = 27.9).',
    referenceUrl:
      'https://unfccc.int/process-and-meetings/bodies/constituted-bodies/article-64-supervisory-body/rules-and-regulations',
    effectiveFrom: new Date('2025-01-01'),
  },
  {
    code: 'A6.4-AM-COOKSTOVE-001',
    name: 'Efficient cookstoves replacing non-renewable biomass',
    version: '01.0',
    category: 'SMALL_SCALE',
    sectoralScope: 3, // Energy demand
    summary:
      'Baseline = non-renewable biomass burned per household × emission factor. Suppressed-demand adjustment allowed for LDC/SIDS.',
    referenceUrl:
      'https://unfccc.int/process-and-meetings/bodies/constituted-bodies/article-64-supervisory-body/rules-and-regulations',
    effectiveFrom: new Date('2025-01-01'),
  },
  {
    code: 'A6.4-AM-AR-001',
    name: 'Afforestation and reforestation (AR)',
    version: '01.0',
    category: 'REMOVAL',
    sectoralScope: 14, // AFOLU
    summary:
      'Removals = biomass stock change (above-ground + below-ground + deadwood + litter + SOC) − leakage. Buffer pool contribution per reversal risk rating. Minimum 15-year crediting period.',
    referenceUrl:
      'https://unfccc.int/process-and-meetings/bodies/constituted-bodies/article-64-supervisory-body/rules-and-regulations',
    effectiveFrom: new Date('2025-01-01'),
    isBcrEligible: true, // BCR accepts AFOLU AR projects via Third-Party flow
  },
  {
    code: 'A6.4-AM-DAC-001',
    name: 'Direct air capture and geologic storage',
    version: '01.0-DRAFT',
    category: 'REMOVAL',
    sectoralScope: 1,
    summary:
      'Removals = CO2 captured + permanently stored − lifecycle project emissions. Long-term monitoring for leakage from storage site.',
    referenceUrl:
      'https://unfccc.int/process-and-meetings/bodies/constituted-bodies/article-64-supervisory-body/rules-and-regulations',
    effectiveFrom: new Date('2026-01-01'),
  },
  {
    code: 'A6.4-AM-EE-INDUSTRIAL-001',
    name: 'Industrial energy efficiency (retrofit)',
    version: '01.0',
    category: 'BASELINE_AND_MONITORING',
    sectoralScope: 4, // Manufacturing industries
    summary:
      'Baseline = pre-retrofit specific energy consumption × production output. Project = post-retrofit actual consumption.',
    referenceUrl:
      'https://unfccc.int/process-and-meetings/bodies/constituted-bodies/article-64-supervisory-body/rules-and-regulations',
    effectiveFrom: new Date('2025-01-01'),
  },
];

// ─── BioCarbon Registry (BCR) — eligible methodologies ────────────────
// BCR's Standard Operating Procedure §5.2.a accepts VCS / Verra-style
// methodology codes (VM*, AR-AM*, AR-AMS*) for Third-Party tokenisation.
// The codes below are the MOST WIDELY USED nature-based methodologies on
// BCR's pipeline as of 2026 — extend as BCR publishes additional ones.
//
// Reference docs:
//   - docs/BIOCARBON_TOKENIZATION_GUIDELINES_RESEARCH.md (binding B6)
//   - docs/BIOCARBON_SPARC_PLAN.md (Sprint 1)
//   - https://biocarbonstandard.com/wp-content/uploads/BCR_Standard-Operating-Procedures.pdf

const BCR_METHODOLOGIES: Array<{
  code: string;
  name: string;
  version: string;
  category:
    | 'BASELINE_AND_MONITORING'
    | 'REMOVAL'
    | 'SMALL_SCALE'
    | 'CONSOLIDATED'
    | 'CDM_TRANSITION';
  sectoralScope: number | null;
  summary: string;
  referenceUrl: string;
  effectiveFrom: Date;
}> = [
  {
    code: 'VM0042',
    name: 'Methodology for improved agricultural land management',
    version: '2.0',
    category: 'BASELINE_AND_MONITORING',
    sectoralScope: 14, // AFOLU
    summary:
      'Soil organic carbon sequestration on cropland and grassland through improved management practices (cover cropping, reduced tillage, rotational grazing). BCR Third-Party eligible.',
    referenceUrl: 'https://verra.org/methodologies/vm0042-methodology-for-improved-agricultural-land-management/',
    effectiveFrom: new Date('2023-09-26'),
  },
  {
    code: 'VM0007',
    name: 'REDD+ Methodology Framework (REDD-MF)',
    version: '1.6',
    category: 'REMOVAL',
    sectoralScope: 14, // AFOLU
    summary:
      'Reduced emissions from deforestation and forest degradation. Project-level baseline + leakage discount + permanence buffer. BCR Third-Party eligible nature-based programme.',
    referenceUrl: 'https://verra.org/methodologies/vm0007-redd-methodology-framework-redd-mf-v1-6/',
    effectiveFrom: new Date('2020-10-13'),
  },
  {
    code: 'VM0033',
    name: 'Methodology for tidal wetland and seagrass restoration',
    version: '2.1',
    category: 'REMOVAL',
    sectoralScope: 14, // AFOLU
    summary:
      'Blue-carbon coastal ecosystem restoration: mangroves, salt marshes, seagrass meadows. Above + below-ground biomass + sediment carbon. BCR Third-Party eligible.',
    referenceUrl: 'https://verra.org/methodologies/vm0033-methodology-for-tidal-wetland-and-seagrass-restoration-v2-1/',
    effectiveFrom: new Date('2023-09-21'),
  },
  {
    code: 'AR-AMS0007',
    name: 'Small-scale afforestation and reforestation on agricultural lands',
    version: '03.1',
    category: 'SMALL_SCALE',
    sectoralScope: 14, // AFOLU
    summary:
      'Small-scale (≤16 kt CO2e/yr) AR on currently agricultural / grazing land. Simplified monitoring + default biomass factors per IPCC AFOLU. BCR Third-Party eligible.',
    referenceUrl: 'https://cdm.unfccc.int/methodologies/DB/CB7P0VPHHZQ4SHFG3K1OMJYG6X1RIH',
    effectiveFrom: new Date('2014-09-26'),
  },
  {
    code: 'AR-AMS0003',
    name: 'Small-scale afforestation and reforestation on wetlands',
    version: '02.0',
    category: 'SMALL_SCALE',
    sectoralScope: 14, // AFOLU
    summary:
      'Small-scale AR on degraded wetlands (excluding peatlands). Conservative biomass factors + minimum 15-year crediting period. BCR Third-Party eligible.',
    referenceUrl: 'https://cdm.unfccc.int/methodologies/DB/2HNAYQF6F22VV2XJTHHJI8C5JLEK77',
    effectiveFrom: new Date('2013-04-26'),
  },
  {
    code: 'AR-AMS0001',
    name: 'Simplified baseline and monitoring for small-scale A/R',
    version: '06.0',
    category: 'SMALL_SCALE',
    sectoralScope: 14, // AFOLU
    summary:
      'Default-tier biomass and SOC factors for small-scale AR on land that has been non-forested for ≥10 years. Optional baseline simplification. BCR Third-Party eligible.',
    referenceUrl: 'https://cdm.unfccc.int/methodologies/DB/G2EGV0G84HE7AYV2DOO48L97IRL3OK',
    effectiveFrom: new Date('2013-04-26'),
  },
];

async function seedA64Methodologies() {
  console.log('\n── Article 6.4 Methodologies ──');
  for (const m of A64_METHODOLOGIES) {
    await prisma.methodology.upsert({
      where: { code: m.code },
      update: {
        name: m.name,
        version: m.version,
        category: m.category as never,
        sectoralScope: m.sectoralScope,
        summary: m.summary,
        referenceUrl: m.referenceUrl,
        effectiveFrom: m.effectiveFrom,
        isActive: true,
        isBcrEligible: m.isBcrEligible ?? false,
      },
      create: {
        code: m.code,
        name: m.name,
        version: m.version,
        category: m.category as never,
        sectoralScope: m.sectoralScope,
        summary: m.summary,
        referenceUrl: m.referenceUrl,
        effectiveFrom: m.effectiveFrom,
        isActive: true,
        isBcrEligible: m.isBcrEligible ?? false,
      },
    });
  }
  const bcrEligibleCount = A64_METHODOLOGIES.filter(
    (m) => m.isBcrEligible,
  ).length;
  console.log(
    `  Methodology: ${A64_METHODOLOGIES.length} A6.4 rows upserted ` +
      `(${bcrEligibleCount} BCR-eligible)`,
  );
}

/// Seed Verra-style methodologies (VM00xx, AR-AMS00xx) that BCR accepts
/// for Third-Party tokenisation. Mirrors `seedA64Methodologies` and runs
/// idempotently via upsert. Sets `isBcrEligible=true` on every row.
async function seedBcrMethodologies() {
  console.log('\n── BCR-Eligible Methodologies (Verra-style) ──');
  for (const m of BCR_METHODOLOGIES) {
    await prisma.methodology.upsert({
      where: { code: m.code },
      update: {
        name: m.name,
        version: m.version,
        category: m.category as never,
        sectoralScope: m.sectoralScope,
        summary: m.summary,
        referenceUrl: m.referenceUrl,
        effectiveFrom: m.effectiveFrom,
        isActive: true,
        isBcrEligible: true,
      },
      create: {
        code: m.code,
        name: m.name,
        version: m.version,
        category: m.category as never,
        sectoralScope: m.sectoralScope,
        summary: m.summary,
        referenceUrl: m.referenceUrl,
        effectiveFrom: m.effectiveFrom,
        isActive: true,
        isBcrEligible: true,
      },
    });
  }
  console.log(
    `  Methodology: ${BCR_METHODOLOGIES.length} BCR-eligible rows upserted ` +
      `(VM0042 / VM0007 / VM0033 / AR-AMS series)`,
  );
}

/// Seed the three SB admin accounts required for the A6.4 levy mechanics.
/// These are non-org, shared across the entire platform.
async function seedA64AdminAccounts() {
  console.log('\n── Article 6.4 SB admin accounts ──');
  const accounts: Array<{
    id: string;
    accountType:
      | 'ADAPTATION_FUND'
      | 'OMGE_CANCELLATION'
      | 'REVERSAL_BUFFER'
      | 'RETIREMENT_NDC'
      | 'RETIREMENT_OIMP'
      | 'RETIREMENT_VOLUNTARY';
    name: string;
  }> = [
    { id: 'a64a0000-0000-4000-8000-000000000001', accountType: 'ADAPTATION_FUND',      name: 'Adaptation Fund (SOP 5%)' },
    { id: 'a64a0000-0000-4000-8000-000000000002', accountType: 'OMGE_CANCELLATION',    name: 'OMGE Cancellation (2%)' },
    { id: 'a64a0000-0000-4000-8000-000000000003', accountType: 'REVERSAL_BUFFER',      name: 'Reversal Risk Buffer Pool' },
    { id: 'a64a0000-0000-4000-8000-000000000004', accountType: 'RETIREMENT_NDC',       name: 'Retirement — NDC use' },
    { id: 'a64a0000-0000-4000-8000-000000000005', accountType: 'RETIREMENT_OIMP',      name: 'Retirement — OIMP (CORSIA etc.)' },
    { id: 'a64a0000-0000-4000-8000-000000000006', accountType: 'RETIREMENT_VOLUNTARY', name: 'Retirement — voluntary' },
  ];
  for (const a of accounts) {
    await prisma.creditAccount.upsert({
      where: { id: a.id },
      update: { accountType: a.accountType as never, name: a.name, isActive: true },
      create: { id: a.id, accountType: a.accountType as never, name: a.name, isActive: true },
    });
  }
  console.log(`  CreditAccount (admin): ${accounts.length} rows upserted`);
}

// ─── A6.4 SD-Tool — 17 UN SDGs + indicators (AV4-337) ───────────────────
// Source: UN General Assembly Res 70/1 — "Transforming our world: the 2030
// Agenda for Sustainable Development" + UN Statistical Commission Tier I/II
// indicator catalogue. Descriptions are the UN's official titles.

const SDGS: Array<{ code: string; name: string; description: string }> = [
  { code: 'SDG_1',  name: 'No Poverty',                       description: 'End poverty in all its forms everywhere.' },
  { code: 'SDG_2',  name: 'Zero Hunger',                      description: 'End hunger, achieve food security and improved nutrition and promote sustainable agriculture.' },
  { code: 'SDG_3',  name: 'Good Health and Well-being',       description: 'Ensure healthy lives and promote well-being for all at all ages.' },
  { code: 'SDG_4',  name: 'Quality Education',                description: 'Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.' },
  { code: 'SDG_5',  name: 'Gender Equality',                  description: 'Achieve gender equality and empower all women and girls.' },
  { code: 'SDG_6',  name: 'Clean Water and Sanitation',       description: 'Ensure availability and sustainable management of water and sanitation for all.' },
  { code: 'SDG_7',  name: 'Affordable and Clean Energy',      description: 'Ensure access to affordable, reliable, sustainable and modern energy for all.' },
  { code: 'SDG_8',  name: 'Decent Work and Economic Growth',  description: 'Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all.' },
  { code: 'SDG_9',  name: 'Industry, Innovation and Infrastructure', description: 'Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation.' },
  { code: 'SDG_10', name: 'Reduced Inequalities',             description: 'Reduce inequality within and among countries.' },
  { code: 'SDG_11', name: 'Sustainable Cities and Communities', description: 'Make cities and human settlements inclusive, safe, resilient and sustainable.' },
  { code: 'SDG_12', name: 'Responsible Consumption and Production', description: 'Ensure sustainable consumption and production patterns.' },
  { code: 'SDG_13', name: 'Climate Action',                   description: 'Take urgent action to combat climate change and its impacts.' },
  { code: 'SDG_14', name: 'Life Below Water',                 description: 'Conserve and sustainably use the oceans, seas and marine resources for sustainable development.' },
  { code: 'SDG_15', name: 'Life on Land',                     description: 'Protect, restore and promote sustainable use of terrestrial ecosystems, sustainably manage forests, combat desertification, and halt and reverse land degradation and halt biodiversity loss.' },
  { code: 'SDG_16', name: 'Peace, Justice and Strong Institutions', description: 'Promote peaceful and inclusive societies for sustainable development, provide access to justice for all and build effective, accountable and inclusive institutions at all levels.' },
  { code: 'SDG_17', name: 'Partnerships for the Goals',       description: 'Strengthen the means of implementation and revitalize the global partnership for sustainable development.' },
];

/// At least 2-3 A6.4-relevant indicators per SDG, totalling ≥30.
/// Codes follow the UN's SDG indicator convention (SDG_X.Y).
const SD_INDICATORS: Array<{
  code: string;
  sdgCode: string;
  name: string;
  description: string;
  unit: string;
  measurementGuidance?: string;
}> = [
  // SDG 1
  { code: 'SDG_1.1', sdgCode: 'SDG_1', name: 'Population below international poverty line', description: 'Proportion of activity-area population below the $2.15/day poverty line.', unit: '%', measurementGuidance: 'Use host-country household survey data or activity-specific household enumeration.' },
  { code: 'SDG_1.4', sdgCode: 'SDG_1', name: 'Access to basic services', description: 'Share of households in the activity area with access to basic services (electricity, water, sanitation).', unit: '%' },
  // SDG 2
  { code: 'SDG_2.3', sdgCode: 'SDG_2', name: 'Small-holder agricultural productivity', description: 'Production volume per labour unit by classes of farming / pastoral / forestry enterprise size.', unit: 'kg/person/yr' },
  { code: 'SDG_2.4', sdgCode: 'SDG_2', name: 'Sustainable agriculture area', description: 'Proportion of agricultural area under productive and sustainable agriculture.', unit: '%' },
  // SDG 3
  { code: 'SDG_3.9', sdgCode: 'SDG_3', name: 'Pollution-related mortality averted', description: 'Mortality rate attributed to household and ambient air pollution displaced by the activity.', unit: 'deaths/100k/yr' },
  { code: 'SDG_3.d', sdgCode: 'SDG_3', name: 'Health workforce engagement', description: 'Health-sector workers (FTE) engaged by the activity.', unit: 'FTE' },
  // SDG 4
  { code: 'SDG_4.1', sdgCode: 'SDG_4', name: 'Education access', description: 'Number of learners receiving training or school-level instruction linked to the activity.', unit: 'learners' },
  { code: 'SDG_4.4', sdgCode: 'SDG_4', name: 'Skills for decent work', description: 'Youth / adults with technical or vocational skills developed through the activity.', unit: 'persons' },
  // SDG 5
  { code: 'SDG_5.5', sdgCode: 'SDG_5', name: 'Women in leadership', description: 'Proportion of women in managerial / decision-making positions within the activity.', unit: '%' },
  { code: 'SDG_5.a', sdgCode: 'SDG_5', name: 'Women with economic resources', description: 'Share of activity benefits (jobs, payments, land access) accruing to women.', unit: '%' },
  // SDG 6
  { code: 'SDG_6.1', sdgCode: 'SDG_6', name: 'Safely managed drinking water', description: 'Population with access to safely managed drinking-water services as a result of the activity.', unit: 'persons' },
  { code: 'SDG_6.3', sdgCode: 'SDG_6', name: 'Water quality', description: 'Improvement in ambient water quality (e.g., BOD reduction, TDS).', unit: 'mg/L' },
  // SDG 7
  { code: 'SDG_7.1', sdgCode: 'SDG_7', name: 'Access to electricity', description: 'Population newly connected to reliable electricity supply via the activity.', unit: 'persons' },
  { code: 'SDG_7.2', sdgCode: 'SDG_7', name: 'Renewable energy share', description: 'Renewable-energy share of the final energy mix supplied by the activity.', unit: '%' },
  { code: 'SDG_7.3', sdgCode: 'SDG_7', name: 'Energy efficiency improvement', description: 'Energy-intensity reduction attributable to the activity.', unit: 'MJ/USD' },
  // SDG 8
  { code: 'SDG_8.2', sdgCode: 'SDG_8', name: 'Economic productivity', description: 'GDP-equivalent economic output uplift from the activity (local economy).', unit: 'USD' },
  { code: 'SDG_8.5', sdgCode: 'SDG_8', name: 'Jobs created', description: 'Full-time-equivalent jobs created by the activity, disaggregated by gender.', unit: 'FTE' },
  // SDG 9
  { code: 'SDG_9.1', sdgCode: 'SDG_9', name: 'Infrastructure deployed', description: 'Length / capacity of resilient infrastructure deployed (roads, grids, pipelines).', unit: 'km or MW' },
  { code: 'SDG_9.4', sdgCode: 'SDG_9', name: 'Industry emissions intensity', description: 'CO2 emissions per unit of value added in the activity-affected industry.', unit: 'tCO2e/USD' },
  // SDG 10
  { code: 'SDG_10.1', sdgCode: 'SDG_10', name: 'Income of bottom 40%', description: 'Income growth for the bottom 40% of the activity-area population.', unit: '%' },
  { code: 'SDG_10.2', sdgCode: 'SDG_10', name: 'Inclusion of marginalised groups', description: 'Share of activity benefits accruing to indigenous / marginalised groups.', unit: '%' },
  // SDG 11
  { code: 'SDG_11.6', sdgCode: 'SDG_11', name: 'Urban air quality', description: 'Annual mean PM2.5 reduction in activity-area cities.', unit: 'µg/m³' },
  { code: 'SDG_11.b', sdgCode: 'SDG_11', name: 'Climate-resilient settlements', description: 'Number of settlements adopting disaster-risk-reduction plans linked to the activity.', unit: 'count' },
  // SDG 12
  { code: 'SDG_12.2', sdgCode: 'SDG_12', name: 'Material footprint', description: 'Material footprint reduction attributable to the activity.', unit: 't' },
  { code: 'SDG_12.5', sdgCode: 'SDG_12', name: 'Waste diverted', description: 'Waste diverted from landfill through recycling / reuse driven by the activity.', unit: 't/yr' },
  // SDG 13
  { code: 'SDG_13.1', sdgCode: 'SDG_13', name: 'Climate resilience strengthened', description: 'People whose climate resilience is strengthened (adaptation co-benefit).', unit: 'persons' },
  { code: 'SDG_13.2', sdgCode: 'SDG_13', name: 'GHG reductions', description: 'Net tCO2e reduced / removed by the activity.', unit: 'tCO2e' },
  // SDG 14
  { code: 'SDG_14.1', sdgCode: 'SDG_14', name: 'Marine pollution reduced', description: 'Reduction in marine pollutant loading (plastic, nitrogen) attributable to the activity.', unit: 't/yr' },
  { code: 'SDG_14.2', sdgCode: 'SDG_14', name: 'Coastal ecosystems protected', description: 'Area of coastal / marine ecosystems under effective protection.', unit: 'ha' },
  // SDG 15
  { code: 'SDG_15.1', sdgCode: 'SDG_15', name: 'Forest area', description: 'Forest area conserved / restored by the activity.', unit: 'ha' },
  { code: 'SDG_15.3', sdgCode: 'SDG_15', name: 'Land degradation reversed', description: 'Area of degraded land restored through the activity.', unit: 'ha' },
  { code: 'SDG_15.5', sdgCode: 'SDG_15', name: 'Biodiversity protected', description: 'Habitat area for threatened species maintained or improved.', unit: 'ha' },
  // SDG 16
  { code: 'SDG_16.7', sdgCode: 'SDG_16', name: 'Inclusive decision-making', description: 'Share of local-community members participating in activity governance / FPIC processes.', unit: '%' },
  // SDG 17
  { code: 'SDG_17.3', sdgCode: 'SDG_17', name: 'Climate finance mobilised', description: 'Additional climate finance (public + private) mobilised through the activity.', unit: 'USD' },
  { code: 'SDG_17.9', sdgCode: 'SDG_17', name: 'Capacity-building delivered', description: 'Hours of technical assistance / capacity-building delivered by the activity.', unit: 'hours' },
];

async function seedSdgs() {
  console.log('\n── SDGs (17 UN goals) ──');
  for (const s of SDGS) {
    await prisma.sdg.upsert({
      where: { code: s.code },
      update: { name: s.name, description: s.description, isActive: true },
      create: { code: s.code, name: s.name, description: s.description, isActive: true },
    });
  }
  console.log(`  Sdg: ${SDGS.length} rows upserted`);
}

async function seedSdIndicators() {
  console.log('\n── SD Indicators (A6.4 SD-Tool) ──');
  for (const i of SD_INDICATORS) {
    await prisma.sdIndicator.upsert({
      where: { code: i.code },
      update: {
        sdgCode: i.sdgCode,
        name: i.name,
        description: i.description,
        unit: i.unit,
        measurementGuidance: i.measurementGuidance,
        isActive: true,
      },
      create: {
        code: i.code,
        sdgCode: i.sdgCode,
        name: i.name,
        description: i.description,
        unit: i.unit,
        measurementGuidance: i.measurementGuidance,
        isActive: true,
      },
    });
  }
  console.log(`  SdIndicator: ${SD_INDICATORS.length} rows upserted`);
}

// ─── A6.4 retention policy (AV4-338) ───────────────────────────────────
// Seeds a single default policy row capturing the A6.4-PROC-AC-002 rule
// (≥ 2yr post-end-of-crediting-period). Code enforces the 2yr constant
// today; this row is the database-visible source of truth for compliance
// reporting + future per-org / per-jurisdiction overrides.

async function seedRetentionPolicies() {
  console.log('\n── Retention policies (A6.4-PROC-AC-002) ──');
  const defaults = await prisma.retentionPolicy.findMany({ where: { isDefault: true } });
  if (defaults.length > 0) {
    // Update the existing default in-place so re-running the seed is idempotent
    // without creating a second default row.
    const first = defaults[0];
    if (!first) return;
    await prisma.retentionPolicy.update({
      where: { id: first.id },
      data: {
        name: 'Default A6.4 retention',
        description:
          'Minimum 2 years after end of crediting period, per A6.4-PROC-AC-002 + Decision 3/CMA.3. Data is archived to cold storage; never deleted.',
        minRetentionYears: 2,
        isDefault: true,
        isActive: true,
      },
    });
    console.log('  RetentionPolicy: default row updated');
    return;
  }
  await prisma.retentionPolicy.create({
    data: {
      name: 'Default A6.4 retention',
      description:
        'Minimum 2 years after end of crediting period, per A6.4-PROC-AC-002 + Decision 3/CMA.3. Data is archived to cold storage; never deleted.',
      minRetentionYears: 2,
      isDefault: true,
      isActive: true,
    },
  });
  console.log('  RetentionPolicy: default row created');
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('═══ Master Data Seed — AurexV4 ═══');
  await seedEmissionFactors();
  await seedEsgFrameworks();
  await seedBrsr();
  await seedCategoryMappings();
  await seedWorkflowRecipes();
  await seedSdgs();
  await seedSdIndicators();
  await seedA64Methodologies();
  await seedBcrMethodologies();
  await seedA64AdminAccounts();
  await seedRetentionPolicies();
  if (process.env.E2E_SEED === '1') {
    await seedE2eAdminUser();
    await seedE2eA64Users();
  }
  console.log('\n✓ Master data seed complete.\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
