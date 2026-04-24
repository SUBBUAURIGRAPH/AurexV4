import { useSessions, useRevokeSession, useRevokeAllSessions, type Session } from '../../hooks/useSecurity';
import { useToast } from '../../contexts/ToastContext';

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[1];
  const os = /Windows NT/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
    ? 'macOS'
    : /Linux/.test(ua)
    ? 'Linux'
    : /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iOS/.test(ua)
    ? 'iOS'
    : '';
  return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 60);
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function SessionList() {
  const { data, isLoading } = useSessions();
  const revoke = useRevokeSession();
  const revokeAll = useRevokeAllSessions();
  const { success: toastSuccess, error: toastError } = useToast();

  const sessions: Session[] = data?.data ?? [];

  const handleRevoke = (id: string) => {
    revoke.mutate(id, {
      onSuccess: () => toastSuccess('Session revoked'),
      onError: (e: Error) => toastError(e.message),
    });
  };

  const handleRevokeAll = () => {
    revokeAll.mutate(undefined, {
      onSuccess: (res) => {
        toastSuccess(`${res.data.revoked} session${res.data.revoked === 1 ? '' : 's'} revoked — you'll be signed out momentarily.`);
        setTimeout(() => {
          localStorage.removeItem('aurex_token');
          localStorage.removeItem('aurex_refresh_token');
          window.location.href = '/login';
        }, 1500);
      },
      onError: (e: Error) => toastError(e.message),
    });
  };

  if (isLoading) {
    return <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', padding: '1rem 0' }}>Loading sessions…</p>;
  }

  if (sessions.length === 0) {
    return <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No active sessions.</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        {sessions.map((s, i) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            borderBottom: i < sessions.length - 1 ? '1px solid var(--border-primary)' : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                {parseUserAgent(s.userAgent)}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0.2rem 0 0' }}>
                {s.ipAddress ?? '—'} · signed in {timeAgo(s.createdAt)}
              </p>
            </div>
            <button
              onClick={() => handleRevoke(s.id)}
              disabled={revoke.isPending}
              style={{
                padding: '0.3125rem 0.75rem', borderRadius: '0.375rem',
                border: '1px solid var(--border-primary)', cursor: 'pointer',
                background: 'var(--bg-card)', color: 'var(--text-secondary)',
                fontSize: '0.75rem', fontFamily: 'inherit', fontWeight: 500,
              }}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleRevokeAll}
        disabled={revokeAll.isPending}
        style={{
          padding: '0.4375rem 0.875rem', borderRadius: '0.5rem',
          border: '1px solid #ef4444', cursor: 'pointer',
          background: 'transparent', color: '#ef4444',
          fontSize: '0.8125rem', fontFamily: 'inherit', fontWeight: 600,
          opacity: revokeAll.isPending ? 0.5 : 1,
        }}
      >
        {revokeAll.isPending ? 'Revoking…' : 'Sign out of all sessions'}
      </button>
    </div>
  );
}
