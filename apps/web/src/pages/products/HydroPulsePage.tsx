import { ProductPageTemplate } from './ProductPageTemplate';

const icon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const features = [
  {
    title: 'Water Footprint Accounting',
    desc: 'Comprehensive water balance tracking across blue, green, and grey water categories. Measure withdrawal, consumption, and discharge volumes with facility-level granularity.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>,
  },
  {
    title: 'IoT Sensor Integration',
    desc: 'Direct integration with flow meters, quality sensors, and SCADA systems. Real-time data ingestion from hundreds of sensor types with automatic calibration drift detection.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
  },
  {
    title: 'Water Quality Monitoring',
    desc: 'Track pH, BOD, COD, TSS, heavy metals, and 50+ water quality parameters. Automatic threshold alerts and trend analysis for discharge compliance management.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  },
  {
    title: 'Watershed Risk Assessment',
    desc: 'Overlay your operations on WRI Aqueduct water stress maps. Identify physical, regulatory, and reputational water risks across your global portfolio.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  },
  {
    title: 'Circular Water Analytics',
    desc: 'Track water recycling and reuse rates. Model treatment and reclamation scenarios to maximize water efficiency and minimize freshwater dependency.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  },
  {
    title: 'CDP Water Security Reporting',
    desc: 'Auto-populate CDP Water Security questionnaire responses. Coverage includes W1 through W7 modules with data validation and submission-ready export.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  },
];

const benefits = [
  {
    title: 'Understand your true water dependency',
    desc: 'Most companies underestimate water consumption by 30-40%. HydroPulse captures every withdrawal, transfer, and discharge to reveal your actual water footprint.',
  },
  {
    title: 'Proactive risk management in water-stressed basins',
    desc: 'With 2.3 billion people living in water-stressed regions, operational continuity depends on water intelligence. HydroPulse maps your exposure and models mitigation scenarios.',
  },
  {
    title: 'Compliance with tightening discharge regulations',
    desc: 'Real-time monitoring ensures you never exceed permit limits. Automated alerts and corrective action tracking keep you ahead of regulatory enforcement.',
  },
  {
    title: 'Demonstrate water stewardship to stakeholders',
    desc: 'Generate verified water stewardship reports aligned with AWS Standard, CEO Water Mandate, and investor expectations for nature-positive operations.',
  },
];

export function HydroPulsePage() {
  return (
    <ProductPageTemplate
      name="HydroPulse"
      tagline="Water & Resource Management Platform"
      description="End-to-end water stewardship: monitoring, analytics, and reporting. Track consumption, quality, and risk across every facility with IoT-integrated intelligence."
      color="#14b8a6"
      heroIcon={icon}
      features={features}
      benefits={benefits}
    />
  );
}
