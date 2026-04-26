import { useState, useRef, useEffect, useCallback, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
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
      { label: 'Bulk Upload', path: '/emissions/import' },
      { label: 'Baselines', path: '/emissions/baselines' },
      { label: 'Targets', path: '/emissions/targets' },
    ],
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    children: [
      { label: 'All Reports', path: '/reports' },
      { label: 'Build GHG Report', path: '/reports/build/ghg' },
      { label: 'Build TCFD Report', path: '/reports/build/tcfd' },
      { label: 'Build CDP Report', path: '/reports/build/cdp' },
      { label: 'Build Custom Report', path: '/reports/build/custom' },
    ],
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
      // AAT-10B / Wave 10b: split billing into manage + invoices.
      { label: 'Billing', path: '/billing/manage' },
      { label: 'Invoices', path: '/billing/invoices' },
      { label: 'Support', path: '/support' },
    ],
  },
  {
    label: 'Carbon Markets',
    path: '/activities',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6" />
      </svg>
    ),
    children: [
      { label: 'Activities (Project Pipeline)', path: '/activities' },
      { label: 'Credits (Holdings)', path: '/credits' },
      { label: 'BioCarbon Marketplace (Public)', path: '/biocarbon/marketplace' },
    ],
  },
  {
    label: 'ESG Reporting',
    path: '/frameworks',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    children: [
      { label: 'Frameworks Hub (TCFD/GRI/CDP/SASB/ISSB)', path: '/frameworks' },
      { label: 'BRSR Builder (India)', path: '/brsr' },
    ],
  },
  {
    label: 'Suppliers',
    path: '/suppliers',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    label: 'Approvals',
    path: '/approvals',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    label: 'Get Started',
    path: '/onboarding',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
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
      { label: 'Organizations (Parents & Subsidiaries)', path: '/admin/organizations' },
      { label: 'Signup Coupons', path: '/admin/coupons' },
      { label: 'Tier Quotas', path: '/admin/quotas' },
    ],
  },
];

interface DropdownMenuProps {
  anchor: HTMLElement;
  children: { label: string; path: string }[];
  onClose: () => void;
  isActive: (path: string) => boolean;
}

// Rendered at document.body level so it escapes the scroll container.
// Positioned relative to the anchor button via getBoundingClientRect().
function DropdownMenu({ anchor, children, onClose, isActive }: DropdownMenuProps) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor]);

  // Close on outside click or Escape
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      if (anchor.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);

  const style: CSSProperties = {
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    zIndex: 50,
    minWidth: '220px',
    padding: '0.375rem',
    borderRadius: '0.625rem',
    border: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-card)',
    boxShadow: 'var(--shadow-lg)',
  };

  return createPortal(
    <div ref={menuRef} style={style} role="menu">
      {children.map((child) => (
        <Link
          key={child.path}
          to={child.path}
          onClick={onClose}
          role="menuitem"
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
    </div>,
    document.body,
  );
}

export function DashboardSidebar() {
  const location = useLocation();
  const [expanded, setExpanded] = useState<string | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const isActive = useCallback(
    (path: string) => {
      if (path.includes('?')) {
        return location.pathname + location.search === path;
      }
      return location.pathname === path;
    },
    [location.pathname, location.search],
  );

  const isParentActive = (item: NavItem) => {
    if (isActive(item.path)) return true;
    return item.children?.some((c) => isActive(c.path)) ?? false;
  };

  // Close dropdown on route change
  useEffect(() => {
    setExpanded(null);
  }, [location.pathname, location.search]);

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
          <div key={item.label} style={{ flexShrink: 0 }}>
            {item.children ? (
              <button
                ref={(el) => {
                  buttonRefs.current[item.label] = el;
                }}
                onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                aria-haspopup="menu"
                aria-expanded={expanded === item.label}
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  style={{
                    transform: expanded === item.label ? 'rotate(180deg)' : 'none',
                    transition: 'transform 200ms',
                  }}
                >
                  <path
                    d="M4 5.5L7 8.5L10 5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
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

      {/* Render the active dropdown via portal so the nav's overflow-x:auto
          doesn't clip it. */}
      {navItems.map((item) => {
        if (!item.children || expanded !== item.label) return null;
        const anchor = buttonRefs.current[item.label];
        if (!anchor) return null;
        return (
          <DropdownMenu
            key={item.label}
            anchor={anchor}
            children={item.children}
            onClose={() => setExpanded(null)}
            isActive={isActive}
          />
        );
      })}
    </nav>
  );
}
