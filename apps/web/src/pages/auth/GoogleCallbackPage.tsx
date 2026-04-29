/**
 * Google OAuth callback landing page.
 *
 * The API redirects here after a successful exchange:
 *   /auth/google/callback#access_token=...&refresh_token=...&redirect=/dashboard
 *
 * URL fragments never reach the server — we read them client-side, push
 * the tokens into localStorage (matching the keys used by /login),
 * refresh the user from /auth/me, then route to the post-login target.
 *
 * On any failure the API redirects to /login?google_error=... — that
 * toast is rendered by LoginPage.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function readFragment(): URLSearchParams {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
}

function isSafeRedirect(target: string | null): string {
  if (!target) return '/dashboard';
  if (!target.startsWith('/')) return '/dashboard';
  if (target.startsWith('//')) return '/dashboard';
  return target;
}

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = readFragment();
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const redirect = isSafeRedirect(params.get('redirect'));

    if (!accessToken || !refreshToken) {
      setErrorMessage('Google sign-in did not return valid tokens. Please try again.');
      const t = setTimeout(() => navigate('/login?google_error=missing_tokens', { replace: true }), 1500);
      return () => clearTimeout(t);
    }

    localStorage.setItem('aurex_token', accessToken);
    localStorage.setItem('aurex_refresh_token', refreshToken);

    // Strip the fragment so tokens don't sit in browser history.
    window.history.replaceState(null, '', window.location.pathname);

    (async () => {
      try {
        await refreshUser();
        navigate(redirect, { replace: true });
      } catch {
        setErrorMessage('Could not load your profile after Google sign-in.');
        navigate('/login?google_error=profile_fetch_failed', { replace: true });
      }
    })();
    return undefined;
  }, [navigate, refreshUser]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-secondary)',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '1rem',
        padding: '2rem 2.5rem',
        textAlign: 'center',
        maxWidth: '420px',
      }}>
        {errorMessage ? (
          <>
            <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '0.5rem' }}>
              Sign-in failed
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
              {errorMessage}
            </p>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              Signing you in via Google…
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
              One moment.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
