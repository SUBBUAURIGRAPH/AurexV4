import { LegalPageTemplate } from './LegalPageTemplate';

const disclaimerSections = [
  {
    title: 'Informational Use',
    content:
      'Aurex outputs, dashboards, and analytics are provided for informational and operational support purposes. They do not constitute legal, tax, financial, engineering, or regulatory advice.',
  },
  {
    title: 'No Warranty of Regulatory Outcome',
    content:
      'Use of the platform does not guarantee audit outcomes, certification approvals, carbon credit issuance, or regulator acceptance. Final determinations are made by competent authorities and external verifiers.',
  },
  {
    title: 'Third-Party Data and Integrations',
    content:
      'Aurex may display or process data from external providers and customer-managed sources. Aurex is not responsible for inaccuracies, delays, or availability issues arising from third-party systems.',
  },
  {
    title: 'Forward-Looking Statements',
    content:
      'Any projections, scenario outputs, or forecast indicators are estimates based on assumptions and may differ materially from actual future outcomes.',
  },
  {
    title: 'Professional Consultation',
    content:
      'You are responsible for obtaining independent professional advice before making legal, compliance, investment, or engineering decisions based on platform outputs.',
  },
];

export function DisclaimerPage() {
  return (
    <LegalPageTemplate
      title="Disclaimer"
      subtitle="Important limitations and assumptions regarding use of the Aurex platform."
      lastUpdated="April 23, 2026"
      sections={disclaimerSections}
    />
  );
}
