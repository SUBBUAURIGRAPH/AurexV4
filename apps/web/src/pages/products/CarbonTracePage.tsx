import { ProductPageTemplate } from './ProductPageTemplate';

const icon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const features = [
  {
    title: 'Scope 1 Direct Emissions',
    desc: 'Automated capture of fuel combustion, process emissions, and fugitive releases. IoT sensor integration for real-time monitoring of stationary and mobile sources with GHG Protocol-compliant calculations.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20" /></svg>,
  },
  {
    title: 'Scope 2 Energy Emissions',
    desc: 'Dual reporting under location-based and market-based methods. Automatic emission factor matching from IEA, EPA eGRID, and regional grid databases. REC and PPA tracking integrated.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  },
  {
    title: 'Scope 3 Value Chain',
    desc: 'Coverage across all 15 Scope 3 categories. Supplier data collection portals, spend-based and activity-based calculation engines, and hybrid methodology support for progressive data improvement.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  },
  {
    title: 'DMRV Engine',
    desc: 'Digital Measurement, Reporting, and Verification with cryptographic anchoring. Every data point receives a hash-chain proof, creating an unbroken audit trail from sensor to report.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  },
  {
    title: 'Emission Factor Management',
    desc: 'Curated library of 10,000+ emission factors from IPCC, DEFRA, EPA, ecoinvent, and ADEME. Version-controlled factor sets with automatic updates and custom factor support.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>,
  },
  {
    title: 'Multi-Framework Reporting',
    desc: 'One dataset, unlimited outputs. Auto-generate reports for GHG Protocol, TCFD, CDP, CSRD, SASB, GRI, SEC Climate, ISSB, and custom frameworks. Map once, report everywhere.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  },
];

const benefits = [
  {
    title: 'Single source of truth for all emissions data',
    desc: 'No more spreadsheet chaos. CarbonTrace consolidates data from every facility, supplier, and business unit into one auditable platform with role-based access controls.',
  },
  {
    title: 'Reduce reporting preparation time by 80%',
    desc: 'Automated data collection, calculation, and formatting means your sustainability team spends time on strategy instead of manual data wrangling.',
  },
  {
    title: 'Always audit-ready with cryptographic proof',
    desc: 'Every calculation, assumption, and data source is immutably logged. Third-party verifiers can validate your entire footprint in hours, not weeks.',
  },
  {
    title: 'Identify reduction opportunities with AI-powered insights',
    desc: 'Anomaly detection highlights emission spikes. Benchmarking shows where you stand against peers. Scenario modeling helps you plan the most cost-effective decarbonization pathway.',
  },
];

export function CarbonTracePage() {
  return (
    <ProductPageTemplate
      name="CarbonTrace"
      tagline="Emissions Tracking & MRV Platform"
      description="Precision emissions measurement across Scopes 1, 2, and 3. DMRV-grade accuracy, real-time monitoring, and automated compliance reporting for every major framework."
      color="#10b981"
      heroIcon={icon}
      features={features}
      benefits={benefits}
    />
  );
}
