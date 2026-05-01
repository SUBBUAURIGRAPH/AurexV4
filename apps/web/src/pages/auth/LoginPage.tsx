import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

function googleErrorMessage(code: string): string {
  if (code === 'access_denied') return 'You cancelled the Google sign-in.';
  if (code === 'missing_tokens') return 'Google sign-in did not return valid tokens. Please try again.';
  if (code === 'profile_fetch_failed') return 'Signed in with Google, but loading your profile failed. Try again.';
  // Surface server-side error messages (e.g. "Account is disabled") verbatim.
  return code;
}

export function LoginPage() {
  const { login, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Pull the ?google_error=... and ?reset=ok query params into banners;
  // clear them from the URL so a manual refresh doesn't keep showing them.
  useEffect(() => {
    const googleCode = searchParams.get('google_error');
    const resetOk = searchParams.get('reset') === 'ok';
    if (!googleCode && !resetOk) return;
    if (googleCode) setGoogleError(googleErrorMessage(googleCode));
    if (resetOk) setResetSuccess(true);
    const next = new URLSearchParams(searchParams);
    next.delete('google_error');
    next.delete('reset');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleGoogleSignIn = () => {
    // Pass the post-login redirect target through state so we land on the
    // dashboard (or whichever route the user requested) after the round-trip.
    const target = encodeURIComponent('/dashboard');
    window.location.href = `/api/v1/auth/google/start?redirect=${target}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      // Error handled by context
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      backgroundColor: 'var(--bg-secondary)',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
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

        {/* Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem' }}>Welcome back</h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>Sign in to your Aurex account</p>
          </div>

          {resetSuccess && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              color: '#047857',
            }}>
              Password reset complete. Sign in with your new password.
            </div>
          )}

          {(error || googleError) && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              color: '#dc2626',
            }}>
              {error || googleError}
            </div>
          )}

          {/* Google sign-in — server-side OAuth 2.0 (Authorization Code).
              Click → /api/v1/auth/google/start (302 to Google) → /callback
              → /auth/google/callback#access_token=...&refresh_token=...     */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              border: '1px solid var(--border-primary)',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.9375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.625rem',
              cursor: 'pointer',
              marginBottom: '1.25rem',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            color: 'var(--text-tertiary)',
            fontSize: '0.8125rem',
          }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-primary)' }} />
            <span>or</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-primary)' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
              required
              autoFocus
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              }
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); }}
              required
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.8125rem', color: '#10b981', textDecoration: 'none', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>

            <Button type="submit" fullWidth loading={isLoading} size="lg">
              Sign In
            </Button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
