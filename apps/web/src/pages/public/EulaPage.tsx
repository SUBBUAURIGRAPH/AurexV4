import { LegalPageTemplate } from './LegalPageTemplate';

const eulaSections = [
  {
    title: 'License Grant',
    content:
      'Subject to your compliance with this Agreement, Aurex grants a limited, non-exclusive, non-transferable, revocable license to access and use the software for internal business purposes.',
  },
  {
    title: 'License Restrictions',
    content:
      'You may not reverse engineer, decompile, modify, create derivative works, sublicense, lease, distribute, or otherwise exploit the software except as expressly permitted by law or written agreement.',
  },
  {
    title: 'Ownership',
    content:
      'Aurex and its licensors retain all right, title, and interest in the software, documentation, interfaces, and related intellectual property. No ownership rights are transferred under this Agreement.',
  },
  {
    title: 'Updates and Support',
    content:
      'Aurex may provide updates, patches, and enhancements. Support availability, service levels, and maintenance windows are governed by your commercial contract and support plan.',
  },
  {
    title: 'Compliance and Export',
    content:
      'You agree to comply with all applicable laws, including export controls, sanctions, data protection obligations, and sector-specific reporting rules relevant to your operations.',
  },
  {
    title: 'Termination of License',
    content:
      'This license terminates automatically if you breach this Agreement. Upon termination, you must cease use of the software and destroy or return materials as required by contract.',
  },
];

export function EulaPage() {
  return (
    <LegalPageTemplate
      title="End User License Agreement (EULA)"
      subtitle="This agreement governs your licensed use of Aurex software and related components."
      lastUpdated="April 23, 2026"
      sections={eulaSections}
    />
  );
}
