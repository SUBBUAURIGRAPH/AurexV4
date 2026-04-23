import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@aurigraph/aurex-theme-kit';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotifications, useMarkRead, useMarkAllRead } from '../../hooks/useNotifications';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/emissions': 'Emissions Tracking',
  '/emissions/import': 'Bulk Upload',
  '/frameworks': 'ESG Frameworks',
  '/brsr': 'BRSR Builder',
  '/reports': 'Reports',
  '/teams': 'Teams and Access',
  '/integrations': 'Integrations',
  '/compliance': 'Compliance Center',
  '/audit-logs': 'Audit Logs',
  '/approvals': 'Approvals',
  '/billing': 'Billing and Subscription',
  '/support': 'Support Center',
  '/settings': 'Settings',
};

const TYPE_COLORS: Record<string, string> = {
  INFO: '#3b82f6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const { data, isLoading } = useNotifications({ pageSize: 10 });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Compute dropdown position from button bounding rect
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.5rem', borderRadius: '0.5rem',
          color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center',
          position: 'relative',
        }}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            minWidth: '16px', height: '16px',
            backgroundColor: '#ef4444',
            borderRadius: '9999px',
            fontSize: '0.625rem', fontWeight: 700,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: dropPos.top,
            right: dropPos.right,
            width: '360px',
            maxHeight: '480px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: '0.75rem',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border-primary)',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: '0.5rem',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  borderRadius: '9999px',
                  fontSize: '0.6875rem',
                  padding: '1px 6px',
                  fontWeight: 700,
                }}>{unreadCount}</span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', color: '#1a5d3d', fontFamily: 'inherit',
                  padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
                  fontWeight: 500,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {isLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                No notifications
              </div>
            ) : notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => { if (!n.readAt) markRead.mutate(n.id); }}
                style={{
                  display: 'flex', gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  borderBottom: '1px solid var(--border-primary)',
                  cursor: n.readAt ? 'default' : 'pointer',
                  backgroundColor: n.readAt ? 'transparent' : 'rgba(26,93,61,0.04)',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => { if (!n.readAt) e.currentTarget.style.backgroundColor = 'rgba(26,93,61,0.08)'; }}
                onMouseLeave={(e) => { if (!n.readAt) e.currentTarget.style.backgroundColor = 'rgba(26,93,61,0.04)'; }}
              >
                {/* Type dot */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: TYPE_COLORS[n.type] ?? '#6b7280',
                  marginTop: '5px',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.8125rem', fontWeight: n.readAt ? 400 : 600,
                    color: 'var(--text-primary)', margin: 0, lineHeight: 1.4,
                  }}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p style={{
                      fontSize: '0.75rem', color: 'var(--text-secondary)',
                      margin: '2px 0 0', lineHeight: 1.4,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {n.body}
                    </p>
                  )}
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                    {formatTime(n.createdAt)}
                  </p>
                </div>
                {!n.readAt && (
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: '#1a5d3d', flexShrink: 0, marginTop: '6px',
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function DashboardTopbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const orgOptions = useMemo(() => {
    const primary = user?.organization || 'Aurex Global';
    return [primary, `${primary} - APAC`, `${primary} - EMEA`];
  }, [user?.organization]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');

  useEffect(() => {
    const cached = localStorage.getItem('aurex_active_org');
    if (cached && orgOptions.includes(cached)) {
      setSelectedOrg(cached);
      return;
    }
    setSelectedOrg(orgOptions[0] || '');
  }, [orgOptions]);

  useEffect(() => {
    if (selectedOrg) {
      localStorage.setItem('aurex_active_org', selectedOrg);
    }
  }, [selectedOrg]);

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
      {/* Left - Page title + org switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {pageTitle}
        </h1>
        <select
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
          aria-label="Select organization"
          style={{
            border: '1px solid var(--border-primary)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            padding: '0.35rem 0.625rem',
            fontFamily: 'inherit',
          }}
        >
          {orgOptions.map((org) => (
            <option key={org} value={org}>
              {org}
            </option>
          ))}
        </select>
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

        {/* Notifications bell */}
        <NotificationBell />

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
