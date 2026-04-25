import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

/**
 * AAT-ONBOARD: /verify-email?token=<token>
 *
 * On mount, posts the plaintext token to /api/v1/auth/verify-email and
 * surfaces one of three states:
 *   - success (with a "back to dashboard" CTA)
 *   - already-verified (idempotent success)
 *   - failure (404 unrecognised) or expired (410)
 *
 * No auth needed — the token is the credential. We don't auto-redirect
 * on success so the user can confirm visually before continuing.
 */

type State =
  | { kind: 'pending' }
  | { kind: 'success'; alreadyVerified: boolean }
  | { kind: 'expired' }
  | { kind: 'invalid'; message: string };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>({ kind: 'pending' });

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid', message: 'No verification token in the URL.' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setState({ kind: 'success', alreadyVerified: Boolean(body?.data?.alreadyVerified) });
          return;
        }
        if (res.status === 410) {
          setState({ kind: 'expired' });
          return;
        }
        setState({
          kind: 'invalid',
          message: String(body?.detail ?? body?.message ?? 'Verification failed'),
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'invalid',
          message: err instanceof Error ? err.message : 'Network error',
        });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      backgroundColor: 'var(--bg-secondary)',
    }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem',
              background: 'linear-gradient(135deg, #1a5d3d, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '1.125rem',
            }}>
              A
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Aurex</span>
          </Link>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          borderRadius: '1rem',
          padding: '2.25rem 2rem',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
        }}>
          {state.kind === 'pending' && (
            <>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Verifying your email…</h1>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>
                One moment while we confirm your verification link.
              </p>
            </>
          )}

          {state.kind === 'success' && (
            <>
              <SuccessIcon />
              <h1 style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                {state.alreadyVerified ? 'Already verified' : 'Email verified'}
              </h1>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>
                {state.alreadyVerified
                  ? "Your email was already verified — you're good to go."
                  : "Thanks — your email is verified. You can now access every Aurex feature."}
              </p>
              <Link to="/dashboard" style={{ textDecoration: 'none' }}>
                <Button fullWidth size="lg">Continue to dashboard</Button>
              </Link>
            </>
          )}

          {state.kind === 'expired' && (
            <>
              <WarningIcon />
              <h1 style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                This link has expired
              </h1>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>
                Verification links expire after 24 hours. Sign in and we'll send a fresh one.
              </p>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button fullWidth size="lg">Back to sign in</Button>
              </Link>
            </>
          )}

          {state.kind === 'invalid' && (
            <>
              <ErrorIcon />
              <h1 style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                We couldn't verify that link
              </h1>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>
                {state.message}
              </p>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button fullWidth size="lg" variant="outline">Back to sign in</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessIcon() {
  return (
    <div style={{
      width: '3rem', height: '3rem', borderRadius: '9999px',
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

function WarningIcon() {
  return (
    <div style={{
      width: '3rem', height: '3rem', borderRadius: '9999px',
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
  );
}

function ErrorIcon() {
  return (
    <div style={{
      width: '3rem', height: '3rem', borderRadius: '9999px',
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    </div>
  );
}
