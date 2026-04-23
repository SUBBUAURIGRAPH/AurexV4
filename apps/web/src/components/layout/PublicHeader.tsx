import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '@aurigraph/aurex-theme-kit';
import { useAuth } from '../../contexts/AuthContext';

const products = [
  { name: 'Neutralis', path: '/products/neutralis', desc: 'Carbon Credit Management' },
  { name: 'CarbonTrace', path: '/products/carbontrace', desc: 'Emissions Tracking & MRV' },
  { name: 'HydroPulse', path: '/products/hydropulse', desc: 'Water & Resource Management' },
  { name: 'Sylvagraph', path: '/products/sylvagraph', desc: 'Forest & Land-Use Monitoring' },
];

export function PublicHeader() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProductsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setProductsOpen(false);
  }, [location.pathname]);

  const headerStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: isHome ? 'transparent' : 'var(--bg-primary)',
    borderBottom: isHome ? 'none' : '1px solid var(--border-primary)',
    backdropFilter: 'blur(12px)',
    transition: 'all 200ms ease',
  };

  const navStyle: React.CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '4rem',
  };

  const linkStyle: React.CSSProperties = {
    color: isHome ? '#ffffff' : 'var(--text-secondary)',
    fontSize: '0.9375rem',
    fontWeight: 500,
    textDecoration: 'none',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    transition: 'all 150ms ease',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: '0.5rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '0.75rem',
    boxShadow: 'var(--shadow-xl)',
    padding: '0.5rem',
    minWidth: '280px',
    zIndex: 200,
  };

  return (
    <header style={headerStyle}>
      <nav style={navStyle}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{
            width: '2rem', height: '2rem', borderRadius: '0.5rem',
            background: 'linear-gradient(135deg, #1a5d3d, #10b981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '0.875rem',
          }}>
            A
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: isHome ? '#ffffff' : 'var(--text-primary)' }}>
            Aurex
          </span>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="desktop-nav">
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setProductsOpen(!productsOpen)}
              style={{
                ...linkStyle,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontFamily: 'inherit',
              }}
            >
              Products
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: productsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {productsOpen && (
              <div style={dropdownStyle}>
                {products.map((p) => (
                  <Link
                    key={p.path}
                    to={p.path}
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      textDecoration: 'none',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>{p.desc}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link to="/about" style={linkStyle}>About</Link>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={toggleTheme}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              color: isHome ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 150ms',
            }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
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
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    ...linkStyle,
                    padding: '0.5rem 1rem',
                  }}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
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
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: isHome ? '#ffffff' : 'var(--text-primary)',
            }}
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute',
          top: '4rem',
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-primary)',
          padding: '1rem 1.5rem',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {products.map((p) => (
              <Link key={p.path} to={p.path} style={{ padding: '0.75rem 0', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500 }}>
                {p.name}
              </Link>
            ))}
            <Link to="/about" style={{ padding: '0.75rem 0', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500 }}>About</Link>
            <div style={{ borderTop: '1px solid var(--border-primary)', marginTop: '0.5rem', paddingTop: '0.75rem', display: 'flex', gap: '0.75rem' }}>
              {isAuthenticated ? (
                <Link to="/dashboard" style={{ flex: 1, textAlign: 'center', padding: '0.625rem', backgroundColor: '#1a5d3d', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" style={{ flex: 1, textAlign: 'center', padding: '0.625rem', border: '1px solid var(--border-secondary)', borderRadius: '0.5rem', color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>
                    Sign In
                  </Link>
                  <Link to="/register" style={{ flex: 1, textAlign: 'center', padding: '0.625rem', backgroundColor: '#1a5d3d', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
