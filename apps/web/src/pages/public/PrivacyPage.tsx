import { LegalPageTemplate } from './LegalPageTemplate';

const privacySections = [
  {
    title: 'Information We Collect',
    content:
      'We collect information you provide directly (such as account details and sustainability datasets), operational telemetry needed to run the service, and limited technical metadata required for security monitoring and performance.',
  },
  {
    title: 'How We Use Information',
    content:
      'Aurex uses personal and organizational data to provide platform functionality, generate compliance reports, improve reliability, detect abuse, and communicate critical account or security notices.',
  },
  {
    title: 'Legal Basis and Processing',
    content:
      'Processing is performed under contractual necessity, legitimate interest, legal obligations, or consent, depending on the relevant data category and jurisdiction.',
  },
  {
    title: 'Data Sharing',
    content:
      'We do not sell personal data. Data may be shared with vetted service providers, infrastructure partners, or regulators only as necessary to provide services or satisfy legal requirements.',
  },
  {
    title: 'Data Retention and Security',
    content:
      'Data is retained only for as long as needed to satisfy contractual, regulatory, and operational requirements. Aurex applies administrative, technical, and organizational safeguards to protect data confidentiality and integrity.',
  },
  {
    title: 'Your Rights',
    content:
      'Depending on applicable law, you may have rights to access, correct, delete, restrict, or export personal data and to object to certain processing activities. Requests can be submitted to privacy@aurex.in.',
  },
];

export function PrivacyPage() {
  return (
    <LegalPageTemplate
      title="Privacy Policy"
      subtitle="This policy explains how Aurex collects, uses, and protects personal and operational data."
      lastUpdated="April 23, 2026"
      sections={privacySections}
    />
  );
}
