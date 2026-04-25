/**
 * AAT-ν / AV4-356 — Minimal public chrome for the BioCarbon marketplace.
 *
 * Distinct from the marketing-site `layouts/PublicLayout.tsx` (which carries
 * Products/About/Footer for aurex.in's home pages). This layout is for the
 * NO-AUTH BioCarbon marketplace surface only, with B13 attribution baked
 * into the header per BCR binding requirement.
 */
import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';

const BCR_REGISTRY_URL = 'https://biocarbonstandard.com';

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  const headerStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: 'var(--bg-primary)',
    borderBottom: '1px solid var(--border-primary)',
  };

  const navStyle: React.CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '4rem',
    gap: '1rem',
  };

  const linkStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    fontSize: '0.9375rem',
    fontWeight: 500,
    textDecoration: 'none',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    transition: 'all 150ms ease',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={headerStyle} data-testid="public-layout-header">
        <nav style={navStyle}>
          {/* Wordmark */}
          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
          >
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #1a5d3d, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.875rem',
              }}
            >
              A
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Aurex
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="public-desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link to="/biocarbon/marketplace" style={linkStyle}>
              BioCarbon Marketplace
            </Link>
          </div>

          {/* Right actions */}
          <div className="public-desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              to="/login"
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: '#1a5d3d',
                color: '#ffffff',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 150ms',
              }}
            >
              Sign in
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="public-mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: 'var(--text-primary)',
            }}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </nav>

        {/* B13 attribution strip */}
        <div
          data-testid="biocarbon-attribution-strip"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-primary)',
            padding: '0.4375rem 1.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
          }}
        >
          Listings issued under the{' '}
          <a
            href={BCR_REGISTRY_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#1a5d3d', fontWeight: 600, textDecoration: 'none' }}
          >
            BioCarbon Standard
          </a>
          .
        </div>

        {/* Mobile menu drawer */}
        {menuOpen && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderBottom: '1px solid var(--border-primary)',
              padding: '1rem 1.5rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link
                to="/biocarbon/marketplace"
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: '0.75rem 0',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                }}
              >
                BioCarbon Marketplace
              </Link>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                style={{
                  marginTop: '0.5rem',
                  textAlign: 'center',
                  padding: '0.625rem',
                  backgroundColor: '#1a5d3d',
                  color: '#fff',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-primary)',
          padding: '1.5rem',
          fontSize: '0.8125rem',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}
      >
        &copy; {new Date().getFullYear()} Aurigraph DLT Corp. BioCarbon-tokenised credits surfaced
        under the{' '}
        <a
          href={BCR_REGISTRY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1a5d3d', fontWeight: 600, textDecoration: 'none' }}
        >
          BioCarbon Standard
        </a>
        .
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .public-desktop-nav { display: none !important; }
          .public-mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
