import { LegalPageTemplate } from './LegalPageTemplate';

const termsSections = [
  {
    title: 'Acceptance of Terms',
    content:
      'By accessing or using Aurex services, you agree to be bound by these Terms and Conditions, our Privacy Policy, and applicable laws. If you do not agree, do not use the platform.',
  },
  {
    title: 'Use of Services',
    content:
      'You may use Aurex only for lawful business purposes related to environmental intelligence, reporting, and sustainability operations. You agree not to misuse the platform, interfere with system integrity, or attempt unauthorized access.',
  },
  {
    title: 'Accounts and Security',
    content:
      'You are responsible for maintaining account confidentiality, including credentials and access tokens. You must promptly notify Aurex of unauthorized access or suspected credential compromise.',
  },
  {
    title: 'Subscription and Fees',
    content:
      'Paid features may require an active subscription. Billing terms, renewal periods, and payment obligations are governed by your commercial order form or master services agreement.',
  },
  {
    title: 'Termination',
    content:
      'Aurex may suspend or terminate access for material violations of these terms, unlawful behavior, or security threats. Termination does not relieve obligations that accrued prior to termination.',
  },
  {
    title: 'Limitation of Liability',
    content:
      'To the maximum extent permitted by law, Aurex is not liable for indirect, incidental, special, consequential, or punitive damages arising from platform use, including loss of data, profits, or business opportunity.',
  },
];

export function TermsPage() {
  return (
    <LegalPageTemplate
      title="Terms and Conditions"
      subtitle="These terms govern use of the Aurex platform and related digital services."
      lastUpdated="April 23, 2026"
      sections={termsSections}
    />
  );
}
