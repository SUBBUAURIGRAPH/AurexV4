import { Link } from 'react-router-dom';

const footerLinks = {
  Products: [
    { label: 'Neutralis', path: '/products/neutralis' },
    { label: 'CarbonTrace', path: '/products/carbontrace' },
    { label: 'HydroPulse', path: '/products/hydropulse' },
    { label: 'Sylvagraph', path: '/products/sylvagraph' },
  ],
  Company: [
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/about' },
    { label: 'Careers', path: '/about' },
  ],
  Resources: [
    { label: 'Documentation', path: '#' },
    { label: 'API Reference', path: '#' },
    { label: 'Status', path: '#' },
    { label: 'Changelog', path: '#' },
  ],
  Legal: [
    { label: 'Legal Overview', path: '/legal' },
    { label: 'Privacy Policy', path: '/legal/privacy' },
    { label: 'Terms and Conditions', path: '/legal/terms' },
    { label: 'EULA', path: '/legal/eula' },
    { label: 'Disclaimer', path: '/legal/disclaimer' },
  ],
};

export function PublicFooter() {
  return (
    <footer style={{
      backgroundColor: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-primary)',
      padding: '4rem 0 2rem',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
        {/* Main footer grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '2.5rem',
          marginBottom: '3rem',
        }}>
          {/* Brand column */}
          <div style={{ gridColumn: 'span 1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{
                width: '2rem', height: '2rem', borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #1a5d3d, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: '0.875rem',
              }}>
                A
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Aurex</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', lineHeight: 1.7, maxWidth: '240px' }}>
              Enterprise-grade sustainability intelligence. Powering the transition to a net-zero economy through verifiable carbon accounting.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                {title}
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                        transition: 'color 150ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#10b981')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '1px solid var(--border-primary)',
          paddingTop: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            &copy; {new Date().getFullYear()} Aurigraph DLT Corp. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>Built on Distributed Ledger Technology</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
