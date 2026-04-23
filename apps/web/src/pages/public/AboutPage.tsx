import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const values = [
  {
    title: 'Verifiable Truth',
    desc: 'Every data point in Aurex is cryptographically anchored to a distributed ledger. Greenwashing cannot survive when every claim is auditable.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: 'Climate Urgency',
    desc: 'We build with the understanding that the climate crisis requires immediate, measurable action. Speed and accuracy are non-negotiable.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: 'Open Interoperability',
    desc: 'We believe environmental data should flow freely between systems. Aurex supports 60+ compliance schemas and integrates with all major ERPs.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" />
        <line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" />
      </svg>
    ),
  },
  {
    title: 'Enterprise Rigor',
    desc: 'SOC 2 Type II, ISO 27001, GDPR compliant. We meet the security and governance requirements of the world\'s largest organizations.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

const team = [
  { name: 'Sustainability Science', count: '12+', desc: 'Environmental scientists and carbon accounting experts' },
  { name: 'DLT Engineering', count: '18+', desc: 'Distributed systems and cryptography engineers' },
  { name: 'Product & Design', count: '8+', desc: 'Enterprise UX and data visualization specialists' },
  { name: 'Compliance & Legal', count: '6+', desc: 'Regulatory compliance and ESG policy advisors' },
];

export function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{
        padding: '6rem 1.5rem 4rem',
        background: 'var(--bg-primary)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: '1.25rem',
            letterSpacing: '-0.02em',
          }}>
            Building the infrastructure for a{' '}
            <span style={{ color: '#1a5d3d' }}>net-zero economy</span>
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            maxWidth: '580px',
            margin: '0 auto',
          }}>
            Aurigraph DLT Corp develops enterprise-grade distributed ledger solutions for environmental sustainability, carbon markets, and regulatory compliance.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section style={{ padding: '4rem 1.5rem', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Our Mission</div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 }}>
              Make environmental impact verifiable, tradeable, and impossible to fake
            </h2>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '1rem' }}>
              The global carbon market is projected to reach $50 billion by 2030. But trust is the bottleneck. Double-counting, opaque methodologies, and unverifiable claims undermine confidence in environmental commitments.
            </p>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              Aurex solves this by anchoring every measurement, credit, and report to cryptographic proof on a distributed ledger. When your sustainability data is on Aurex, it is verifiable by design.
            </p>
          </div>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: '1rem',
            padding: '2rem',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {[
                { val: '2019', label: 'Founded' },
                { val: '50+', label: 'Team Members' },
                { val: '12', label: 'Countries' },
                { val: '3', label: 'Global Offices' },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a5d3d' }}>{s.val}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontWeight: 500, marginTop: '0.25rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '5rem 1.5rem', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>Our Values</h2>
            <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto' }}>
              The principles that guide every product decision, partnership, and line of code.
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}>
            {values.map((v) => (
              <Card key={v.title} padding="lg" hover>
                <div style={{
                  width: '3rem', height: '3rem', borderRadius: '0.625rem',
                  background: 'linear-gradient(135deg, rgba(26, 93, 61, 0.1), rgba(16, 185, 129, 0.1))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#1a5d3d', marginBottom: '1rem',
                }}>
                  {v.icon}
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>{v.title}</h3>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{v.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section style={{ padding: '5rem 1.5rem', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>Our Team</h2>
            <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto' }}>
              A cross-disciplinary team of climate scientists, engineers, and policy experts building the sustainability infrastructure layer.
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
          }}>
            {team.map((t) => (
              <Card key={t.name} padding="lg" hover>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1a5d3d', marginBottom: '0.5rem' }}>{t.count}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.375rem' }}>{t.name}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{t.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '5rem 1.5rem',
        background: 'linear-gradient(135deg, #0f172a, #1a5d3d)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '1rem' }}>
            Let's build a sustainable future together
          </h2>
          <p style={{ fontSize: '1.0625rem', color: 'rgba(255,255,255,0.75)', marginBottom: '2rem', lineHeight: 1.7 }}>
            Whether you're starting your sustainability journey or scaling an existing program, Aurex has the tools you need.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Button size="lg" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>Get Started</Button>
            </Link>
            <a href="mailto:contact@aurigraph.io" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="lg" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>Contact Us</Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
