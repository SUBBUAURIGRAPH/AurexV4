import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

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
      { label: 'Add Entry', path: '/emissions/new' },
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
    label: 'Teams',
    path: '/teams',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" />
      </svg>
    ),
  },
  {
    label: 'Operations',
    path: '/integrations',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="8" height="8" /><rect x="14" y="2" width="8" height="8" /><rect x="2" y="14" width="8" height="8" /><rect x="14" y="14" width="8" height="8" />
      </svg>
    ),
    children: [
      { label: 'Integrations', path: '/integrations' },
      { label: 'Compliance', path: '/compliance' },
      { label: 'Audit Logs', path: '/audit-logs' },
      { label: 'Billing', path: '/billing' },
      { label: 'Support', path: '/support' },
    ],
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
  {
    label: 'Admin',
    path: '/admin/users',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    children: [
      { label: 'Users', path: '/admin/users' },
      { label: 'Organization', path: '/admin/organization' },
    ],
  },
];

export function DashboardSidebar() {
  const location = useLocation();
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
    <nav
      style={{
        position: 'sticky',
        top: '4rem',
        zIndex: 35,
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      <div
        style={{
          maxWidth: '100%',
          padding: '0.5rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          overflowX: 'auto',
        }}
      >
        {navItems.map((item) => (
          <div key={item.label} style={{ position: 'relative', flexShrink: 0 }}>
            {item.children ? (
              <>
                <button
                  onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: isParentActive(item) ? 'rgba(26, 93, 61, 0.08)' : 'transparent',
                    color: isParentActive(item) ? '#1a5d3d' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: isParentActive(item) ? 600 : 500,
                    fontFamily: 'inherit',
                    transition: 'all 150ms',
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: expanded === item.label ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
                    <path d="M4 5.5L7 8.5L10 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {expanded === item.label && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 0.375rem)',
                      left: 0,
                      minWidth: '220px',
                      padding: '0.375rem',
                      borderRadius: '0.625rem',
                      border: '1px solid var(--border-primary)',
                      backgroundColor: 'var(--bg-card)',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  >
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setExpanded(null)}
                        style={{
                          display: 'block',
                          padding: '0.5rem 0.625rem',
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
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
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
  );
}
