import { ProductPageTemplate } from './ProductPageTemplate';

const icon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 18a5 5 0 0 0-10 0" /><line x1="12" y1="9" x2="12" y2="18" /><path d="M12 9a4 4 0 0 0 4-4c0-2-2-4-4-6-2 2-4 4-4 6a4 4 0 0 0 4 4z" />
  </svg>
);

const features = [
  {
    title: 'Satellite-Based Forest Monitoring',
    desc: 'Multi-spectral imagery from Sentinel-2, Landsat-9, and Planet Labs analyzed at 10m resolution. Detect canopy changes, degradation, and regrowth with weekly update cadence.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  },
  {
    title: 'Deforestation Alert System',
    desc: 'Near-real-time deforestation and degradation alerts powered by machine learning. Receive notifications within 72 hours of detected clearing events in monitored areas.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  },
  {
    title: 'Biomass Carbon Stock Estimation',
    desc: 'LiDAR-calibrated allometric models for above-ground and below-ground biomass. Calculate carbon stocks with tier 2/3 accuracy for REDD+ project development.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  },
  {
    title: 'Land-Use Change Detection',
    desc: 'Classify land cover types and track transitions over time. Identify conversion from forest to agriculture, urban expansion into natural areas, and wetland loss patterns.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>,
  },
  {
    title: 'REDD+ MRV Compliance',
    desc: 'Full measurement, reporting, and verification workflows for REDD+ projects. Generate project design documents, monitoring reports, and verification-ready datasets.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  },
  {
    title: 'Biodiversity Overlays',
    desc: 'Integrate IUCN protected areas, key biodiversity areas, and species range maps. Assess biodiversity co-benefits and safeguard compliance for nature-based solutions.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  },
];

const benefits = [
  {
    title: 'Monitor millions of hectares from a single dashboard',
    desc: 'Sylvagraph scales from a single concession to continental-scale monitoring. Track all your forest assets, supply chain sourcing areas, and offset project sites in one view.',
  },
  {
    title: 'Detect illegal deforestation before it spreads',
    desc: 'Early detection means early response. Sylvagraph\'s alert system gives you actionable intelligence to engage with local authorities and halt unauthorized clearing.',
  },
  {
    title: 'Generate high-integrity carbon credits from forests',
    desc: 'Tier 2/3 biomass estimation meets the methodological requirements of Verra VCS, Gold Standard, and ART TREES for forest-based carbon credit development.',
  },
  {
    title: 'Meet deforestation-free supply chain commitments',
    desc: 'With the EU Deforestation Regulation (EUDR) in force, commodity traders and buyers need verifiable proof. Sylvagraph provides plot-level compliance evidence.',
  },
];

export function SylvagraphPage() {
  return (
    <ProductPageTemplate
      name="Sylvagraph"
      tagline="Forest & Land-Use Intelligence"
      description="Satellite-powered monitoring for forests, biodiversity, and land-use change. From deforestation alerts to REDD+ compliance, Sylvagraph is your eyes on the canopy."
      color="#22755a"
      heroIcon={icon}
      features={features}
      benefits={benefits}
    />
  );
}
