import { Link } from 'react-router-dom';

const legalDocuments = [
  {
    title: 'Terms and Conditions',
    description: 'Rules and contractual terms governing access and use of Aurex services.',
    path: '/legal/terms',
  },
  {
    title: 'Privacy Policy',
    description: 'Details on data collection, processing, retention, and your privacy rights.',
    path: '/legal/privacy',
  },
  {
    title: 'EULA',
    description: 'Software licensing terms for end users and enterprise account holders.',
    path: '/legal/eula',
  },
  {
    title: 'Disclaimer',
    description: 'Important limitations on platform outputs, forecasts, and advisory use.',
    path: '/legal/disclaimer',
  },
];

export function LegalPage() {
  return (
    <section style={{ backgroundColor: 'var(--bg-primary)', padding: '3rem 0 4rem' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 1.5rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Legal
          </h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Review Aurex legal documents and policy commitments. These documents form part of your relationship with Aurex services.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {legalDocuments.map((doc) => (
            <Link
              key={doc.path}
              to={doc.path}
              style={{
                textDecoration: 'none',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'block',
              }}
            >
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {doc.title}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{doc.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
