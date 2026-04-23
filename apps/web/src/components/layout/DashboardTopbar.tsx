import { useState } from 'react';
import { useTheme } from '@aurigraph/aurex-theme-kit';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/emissions': 'Emissions Tracking',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export function DashboardTopbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const pageTitle = pageTitles[location.pathname] || 'Dashboard';

  return (
    <header style={{
      height: '4rem',
      backgroundColor: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backdropFilter: 'blur(12px)',
    }}>
      {/* Left - Page title */}
      <div>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {pageTitle}
        </h1>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4375rem 0.875rem',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          minWidth: '200px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>Search...</span>
          <kbd style={{
            marginLeft: 'auto',
            fontSize: '0.6875rem',
            padding: '0.125rem 0.375rem',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '0.25rem',
            color: 'var(--text-tertiary)',
            border: '1px solid var(--border-primary)',
          }}>/</kbd>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0.5rem', borderRadius: '0.5rem',
            color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center',
          }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          )}
        </button>

        {/* Notifications */}
        <button
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0.5rem', borderRadius: '0.5rem',
            color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center',
            position: 'relative',
          }}
          aria-label="Notifications"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <div style={{
            position: 'absolute', top: '6px', right: '6px',
            width: '7px', height: '7px', borderRadius: '50%',
            backgroundColor: '#10b981',
          }} />
        </button>

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.375rem',
              borderRadius: '0.5rem',
            }}
          >
            <div style={{
              width: '2rem', height: '2rem', borderRadius: '9999px',
              backgroundColor: 'rgba(26, 93, 61, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#1a5d3d', fontWeight: 600, fontSize: '0.75rem',
            }}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                onClick={() => setUserMenuOpen(false)}
              />
              <div style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '0.5rem',
                width: '220px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                borderRadius: '0.75rem',
                boxShadow: 'var(--shadow-xl)',
                padding: '0.5rem',
                zIndex: 100,
              }}>
                <div style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid var(--border-primary)', marginBottom: '0.25rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{user?.email}</p>
                </div>
                <button
                  onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.625rem 0.75rem',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderRadius: '0.375rem', fontSize: '0.875rem',
                    color: 'var(--text-secondary)', fontFamily: 'inherit',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Settings
                </button>
                <button
                  onClick={() => { logout(); setUserMenuOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.625rem 0.75rem',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderRadius: '0.375rem', fontSize: '0.875rem',
                    color: '#ef4444', fontFamily: 'inherit',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
