/**
 * ResetPasswordPage — POST /api/v1/auth/reset-password.
 *
 * The token comes in via ?token=... query param. Submit posts the token
 * + new password to the API. On 200 → /login?reset=ok with a banner.
 * On 4xx (token invalid/expired/used) we surface the server's `detail`
 * verbatim so the user knows whether to retry or request a new link.
 */
import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  useEffect(() => {
    if (!token || token.length < 16) setTokenMissing(true);
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
      if (!res.ok) {
        setErrorMsg(data.detail || data.message || 'Reset failed. Please request a new link.');
        return;
      }
      // Success — bounce to login with a banner the LoginPage can render.
      navigate('/login?reset=ok', { replace: true });
    } catch {
      setErrorMsg('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.625rem',
                background: 'linear-gradient(135deg, #1a5d3d, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1.125rem',
              }}
            >
              A
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Aurex</span>
          </Link>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem' }}>Set a new password</h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>
              Choose a strong password. You'll be signed out everywhere after the reset.
            </p>
          </div>

          {tokenMissing ? (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                color: '#dc2626',
                marginBottom: '1rem',
              }}
            >
              No reset token in the URL. Open the link from your reset email, or{' '}
              <Link to="/forgot-password" style={{ color: '#dc2626', fontWeight: 600 }}>
                request a new one
              </Link>
              .
            </div>
          ) : (
            <>
              {errorMsg && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '0.5rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.875rem',
                    color: '#dc2626',
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                <Input
                  label="New password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  required
                  autoFocus
                  hint="Minimum 8 characters."
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  required
                  error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
                />

                <Button type="submit" fullWidth loading={loading} size="lg">
                  Set new password
                </Button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>
          <Link to="/login" style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
