import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * AAT-ONBOARD: dashboard-wide banner that nudges unverified users to
 * confirm their email. Renders nothing when the user is verified or has
 * dismissed the banner this session. Reappears on the next session
 * (sessionStorage scope) until verified.
 */

const DISMISS_KEY = 'aurex_verify_email_dismissed';

interface ResendState {
  status: 'idle' | 'sending' | 'sent' | 'error';
  message?: string;
  /** Dev-only — surfaced by the API only when NODE_ENV !== 'production'. */
  devToken?: string;
}

export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [resend, setResend] = useState<ResendState>({ status: 'idle' });

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      // sessionStorage may be unavailable (private mode); treat as not dismissed.
    }
  }, []);

  if (!user) return null;
  if (user.emailVerifiedAt) return null;
  if (dismissed) return null;

  const handleResend = async () => {
    setResend({ status: 'sending' });
    try {
      const token = localStorage.getItem('aurex_token');
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResend({
          status: 'error',
          message: String(body?.detail ?? body?.message ?? 'Could not send'),
        });
        return;
      }
      setResend({
        status: 'sent',
        // Dev-only: the API surfaces _devVerificationToken outside prod.
        devToken: body?._devVerificationToken
          ? String(body._devVerificationToken)
          : undefined,
      });
    } catch (err) {
      setResend({
        status: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div
      style={{
        margin: '1rem 1.5rem 0',
        padding: '0.75rem 1rem',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '0.625rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
      }}
    >
      <span style={{ fontSize: '1.125rem' }} aria-hidden="true">✉️</span>
      <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
        <strong>Verify your email</strong>
        <span style={{ color: 'var(--text-secondary)' }}>
          {' '}— we sent a verification link to <strong>{user.email}</strong>.
        </span>
        {resend.status === 'sent' && (
          <span style={{ color: '#047857', marginLeft: '0.5rem' }}>
            Sent! Check your inbox.
          </span>
        )}
        {resend.status === 'error' && (
          <span style={{ color: '#dc2626', marginLeft: '0.5rem' }}>
            {resend.message}
          </span>
        )}
        {/* Dev-only verification link surfaced when API returns devToken. */}
        {resend.devToken && (
          <div style={{ marginTop: '0.375rem' }}>
            <a
              href={`/verify-email?token=${resend.devToken}`}
              style={{ fontSize: '0.75rem', color: '#10b981', textDecoration: 'none', fontWeight: 600 }}
            >
              [dev] Open verification link
            </a>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleResend}
        disabled={resend.status === 'sending' || resend.status === 'sent'}
        style={{
          padding: '0.375rem 0.875rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          backgroundColor: 'transparent',
          color: '#b45309',
          fontSize: '0.8125rem',
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: resend.status === 'sending' ? 'wait' : 'pointer',
          opacity: resend.status === 'sent' ? 0.6 : 1,
        }}
      >
        {resend.status === 'sending' ? 'Sending…' : 'Resend link'}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-tertiary)',
          fontSize: '1rem',
          cursor: 'pointer',
          padding: '0.25rem',
        }}
      >
        ×
      </button>
    </div>
  );
}
