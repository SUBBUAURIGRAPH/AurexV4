import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: 'Emissions',
    path: '/emissions',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20" /><path d="M20 16l-4-4 4-4" /><path d="M4 8l4 4-4 4" />
      </svg>
    ),
    children: [
      { label: 'Scope 1 - Direct', path: '/emissions?scope=1' },
      { label: 'Scope 2 - Indirect', path: '/emissions?scope=2' },
      { label: 'Scope 3 - Value Chain', path: '/emissions?scope=3' },
    ],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function DashboardSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState<string | null>('Emissions');

  const isActive = (path: string) => {
    if (path.includes('?')) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };

  const isParentActive = (item: NavItem) => {
    if (isActive(item.path)) return true;
    return item.children?.some((c) => isActive(c.path)) ?? false;
  };

  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-primary)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
      }}>
        <div style={{
          width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem',
          background: 'linear-gradient(135deg, #1a5d3d, #10b981)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: '1rem',
        }}>
          A
        </div>
        <div>
          <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>Aurex</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: '0.375rem' }}>v4</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {navItems.map((item) => (
            <div key={item.label}>
              {item.children ? (
                <>
                  <button
                    onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.625rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: isParentActive(item) ? 'rgba(26, 93, 61, 0.08)' : 'transparent',
                      color: isParentActive(item) ? '#1a5d3d' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      transition: 'all 150ms',
                      textAlign: 'left',
                    }}
                  >
                    {item.icon}
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: expanded === item.label ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
                      <path d="M4 5.5L7 8.5L10 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {expanded === item.label && (
                    <div style={{ paddingLeft: '2.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem', marginTop: '0.125rem' }}>
                      {item.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          style={{
                            display: 'block',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.8125rem',
                            fontWeight: isActive(child.path) ? 600 : 400,
                            color: isActive(child.path) ? '#1a5d3d' : 'var(--text-tertiary)',
                            textDecoration: 'none',
                            backgroundColor: isActive(child.path) ? 'rgba(26, 93, 61, 0.06)' : 'transparent',
                            transition: 'all 150ms',
                          }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: isActive(item.path) ? 600 : 500,
                    color: isActive(item.path) ? '#1a5d3d' : 'var(--text-secondary)',
                    backgroundColor: isActive(item.path) ? 'rgba(26, 93, 61, 0.08)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 150ms',
                  }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* User section */}
      <div style={{
        padding: '1rem 1rem',
        borderTop: '1px solid var(--border-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <div style={{
          width: '2.25rem', height: '2.25rem', borderRadius: '9999px',
          backgroundColor: 'rgba(26, 93, 61, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1a5d3d', fontWeight: 600, fontSize: '0.8125rem',
          flexShrink: 0,
        }}>
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name || 'User'}
          </p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || ''}
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0.375rem', borderRadius: '0.375rem',
            color: 'var(--text-tertiary)',
            display: 'flex', alignItems: 'center',
            transition: 'color 150ms',
          }}
          title="Sign out"
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
