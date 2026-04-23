import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const stats = [
  { value: '500K+', label: 'Tonnes Tracked' },
  { value: '150+', label: 'Enterprise Clients' },
  { value: '99.9%', label: 'Platform Uptime' },
  { value: '60+', label: 'Compliance Schemas' },
];

const products = [
  {
    name: 'Neutralis',
    path: '/products/neutralis',
    desc: 'End-to-end carbon credit lifecycle management. Issue, trade, retire, and verify carbon credits on a distributed ledger with full provenance.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a5d3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
    color: '#1a5d3d',
  },
  {
    name: 'CarbonTrace',
    path: '/products/carbontrace',
    desc: 'Precision emissions measurement, reporting, and verification. Track Scope 1, 2, and 3 emissions with DMRV-grade accuracy across your entire value chain.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    color: '#10b981',
  },
  {
    name: 'HydroPulse',
    path: '/products/hydropulse',
    desc: 'Water stewardship and resource consumption analytics. Monitor, report, and optimize water usage across facilities with IoT-integrated dashboards.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
    color: '#14b8a6',
  },
  {
    name: 'Sylvagraph',
    path: '/products/sylvagraph',
    desc: 'Satellite-powered forest and land-use change monitoring. Detect deforestation, measure biomass carbon stocks, and generate REDD+ compliance data.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22755a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 18a5 5 0 0 0-10 0" /><line x1="12" y1="9" x2="12" y2="18" /><path d="M12 9a4 4 0 0 0 4-4c0-2-2-4-4-6-2 2-4 4-4 6a4 4 0 0 0 4 4z" />
      </svg>
    ),
    color: '#22755a',
  },
];

const features = [
  {
    title: 'Real-Time Analytics',
    desc: 'Live dashboards with granular emissions data across all scopes. Drill down from portfolio-level to individual asset performance.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: 'DMRV Platform',
    desc: 'Digital Measurement, Reporting, and Verification engine backed by cryptographic proofs. Every data point is auditable and tamper-evident.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: 'Tokenization',
    desc: 'Convert verified carbon reductions into tradeable digital assets. Fractional ownership, automated settlement, and transparent pricing.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    title: 'ESG Compliance',
    desc: 'Auto-generate reports aligned with GHG Protocol, TCFD, CDP, CSRD, and 60+ regulatory frameworks. Always audit-ready.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l2 2 4-4" />
      </svg>
    ),
  },
];

export function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1a5d3d 45%, #10b981 100%)',
        padding: '8rem 1.5rem 6rem',
        marginTop: '-4rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 70% 30%, rgba(16, 185, 129, 0.15), transparent 60%), radial-gradient(circle at 20% 80%, rgba(20, 184, 166, 0.1), transparent 50%)',
        }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '720px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              padding: '0.375rem 1rem',
              borderRadius: '9999px',
              marginBottom: '1.5rem',
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Platform v4 Now Available</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.1,
              marginBottom: '1.25rem',
              letterSpacing: '-0.02em',
            }}>
              Enterprise Sustainability{' '}
              <span style={{ color: '#34d399' }}>Intelligence</span>
            </h1>

            <p style={{
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              color: 'rgba(255,255,255,0.8)',
              lineHeight: 1.7,
              marginBottom: '2.5rem',
              maxWidth: '600px',
            }}>
              The unified platform for carbon accounting, environmental compliance, and regulatory reporting. Built on distributed ledger technology for verifiable, tamper-proof sustainability data.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem' }}>
              <Link to="/register" style={{ textDecoration: 'none' }}>
                <Button size="lg" style={{ backgroundColor: '#ffffff', color: '#1a5d3d', borderColor: '#ffffff', fontWeight: 700, fontSize: '1rem', padding: '0.875rem 2rem' }}>
                  Start Free Trial
                </Button>
              </Link>
              <Link to="/about" style={{ textDecoration: 'none' }}>
                <Button variant="outline" size="lg" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff', fontSize: '1rem', padding: '0.875rem 2rem' }}>
                  Schedule Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section style={{
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-primary)',
        padding: '0 1.5rem',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1.5rem',
          padding: '2.5rem 0',
        }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, color: '#1a5d3d', lineHeight: 1.2 }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Products */}
      <section style={{ padding: '5rem 1.5rem', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.01em' }}>
              The Aurex Product Suite
            </h2>
            <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.7 }}>
              Four interconnected modules covering the full spectrum of environmental intelligence, from carbon credits to forest monitoring.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}>
            {products.map((p) => (
              <Card key={p.name} padding="lg" hover>
                <div style={{
                  width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem',
                  backgroundColor: `${p.color}10`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '1.25rem',
                }}>
                  {p.icon}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.625rem', color: 'var(--text-primary)' }}>
                  {p.name}
                </h3>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                  {p.desc}
                </p>
                <Link
                  to={p.path}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: p.color,
                    textDecoration: 'none',
                  }}
                >
                  Learn More
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="8" x2="13" y2="8" /><polyline points="9 4 13 8 9 12" />
                  </svg>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '5rem 1.5rem', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, marginBottom: '0.75rem' }}>
              Built for Enterprise Scale
            </h2>
            <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', maxWidth: '580px', margin: '0 auto', lineHeight: 1.7 }}>
              Aurex combines cutting-edge distributed ledger technology with enterprise-grade analytics to deliver sustainability intelligence you can trust.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}>
            {features.map((f) => (
              <Card key={f.title} padding="lg" hover>
                <div style={{
                  width: '3rem', height: '3rem', borderRadius: '0.625rem',
                  background: 'linear-gradient(135deg, rgba(26, 93, 61, 0.1), rgba(16, 185, 129, 0.1))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#1a5d3d',
                  marginBottom: '1rem',
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {f.desc}
                </p>
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
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: '1rem',
          }}>
            Ready to start your net-zero journey?
          </h2>
          <p style={{
            fontSize: '1.0625rem',
            color: 'rgba(255,255,255,0.75)',
            marginBottom: '2rem',
            lineHeight: 1.7,
          }}>
            Join 150+ enterprises already using Aurex to measure, reduce, and report their environmental impact with confidence.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.875rem' }}>
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Button size="lg" style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontWeight: 700, padding: '0.875rem 2rem' }}>
                Start Free Trial
              </Button>
            </Link>
            <Link to="/about" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="lg" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff', padding: '0.875rem 2rem' }}>
                Talk to Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
