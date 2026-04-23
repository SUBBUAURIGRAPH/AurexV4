import { ProductPageTemplate } from './ProductPageTemplate';

const icon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const features = [
  {
    title: 'Credit Issuance Engine',
    desc: 'Issue carbon credits with full provenance tracking. Each credit is minted as a unique digital asset on a distributed ledger with immutable metadata including project ID, vintage, methodology, and verification body.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>,
  },
  {
    title: 'Marketplace & Trading',
    desc: 'Bilateral and exchange-based trading with transparent pricing. Support for spot, forward, and options contracts. Real-time order book and settlement finality in under 3 seconds.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  },
  {
    title: 'Retirement & Offsetting',
    desc: 'Permanent on-chain retirement ensures credits cannot be double-counted. Generate verifiable retirement certificates with QR-code validation for auditors and stakeholders.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  },
  {
    title: 'Registry Integration',
    desc: 'Bidirectional sync with Gold Standard, Verra VCS, ACR, and CAR. Automatic reconciliation prevents discrepancies between on-chain and registry records.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  },
  {
    title: 'Fractional Ownership',
    desc: 'Divide high-value credits into fractional units for broader market participation. Enable SMEs and retail investors to participate in carbon markets with as little as $1.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  },
  {
    title: 'Compliance Automation',
    desc: 'Auto-generate compliance reports for CORSIA, EU ETS, Article 6.4, and voluntary market standards. Built-in corresponding adjustment tracking for Paris Agreement compliance.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l2 2 4-4" /></svg>,
  },
];

const benefits = [
  {
    title: 'Eliminate double-counting with cryptographic proof',
    desc: 'Every credit lifecycle event is recorded on an immutable ledger. Once retired, a credit\'s hash is permanently marked, making it mathematically impossible to re-use.',
  },
  {
    title: 'Reduce settlement time from weeks to seconds',
    desc: 'Traditional carbon credit trades can take 2-4 weeks to settle. Neutralis achieves settlement finality in under 3 seconds with full counterparty verification.',
  },
  {
    title: 'Access a global marketplace with transparent pricing',
    desc: 'Real-time price discovery across all major carbon credit types. Historical pricing data, market depth indicators, and spread analytics for informed decision-making.',
  },
  {
    title: 'Meet evolving regulatory requirements automatically',
    desc: 'As Article 6 rules crystallize and the EU CBAM takes effect, Neutralis adapts automatically. Built-in regulatory tracking keeps you compliant without manual intervention.',
  },
];

export function NeutralisPage() {
  return (
    <ProductPageTemplate
      name="Neutralis"
      tagline="Carbon Credit Lifecycle Management"
      description="The complete platform for issuing, trading, retiring, and verifying carbon credits. Built on distributed ledger technology for provenance you can prove."
      color="#1a5d3d"
      heroIcon={icon}
      features={features}
      benefits={benefits}
    />
  );
}
