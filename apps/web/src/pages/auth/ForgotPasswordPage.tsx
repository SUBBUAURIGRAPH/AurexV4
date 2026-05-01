/**
 * ForgotPasswordPage — POST /api/v1/auth/forgot-password.
 *
 * The endpoint always responds 202 with a generic message regardless of
 * whether the email matched a user (no user enumeration per ADM-052).
 * This page mirrors that posture: on submit we always show the same
 * "check your inbox" success card. If the operator is in dev and
 * `_devResetUrl` came back, surface it inline so they can complete the
 * flow without a real email round-trip.
 */
import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface ForgotResponse {
  message?: string;
  _devResetUrl?: string;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [devUrl, setDevUrl] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as ForgotResponse;
      if (!res.ok && res.status >= 500) {
        // Surface only server errors. 4xx (validation) we still treat
        // as success at the UX layer to match the no-enumeration design.
        setErrorMsg('Something went wrong on our side. Please try again.');
        return;
      }
      if (data._devResetUrl) setDevUrl(data._devResetUrl);
      setSubmitted(true);
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
          {!submitted ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem' }}>Forgot your password?</h1>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>
                  Enter the email on your Aurex account and we'll send a reset link.
                </p>
              </div>

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
                  label="Email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg('');
                  }}
                  required
                  autoFocus
                />
                <Button type="submit" fullWidth loading={loading} size="lg">
                  Send reset link
                </Button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    color: '#10b981',
                    fontSize: '1.5rem',
                  }}
                >
                  ✓
                </div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Check your inbox</h1>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  If <strong>{email}</strong> is registered, a password-reset link is on its way. The link expires in 60 minutes.
                </p>
              </div>

              {devUrl && (
                <div
                  style={{
                    marginTop: '1.5rem',
                    padding: '0.875rem 1rem',
                    borderRadius: '0.625rem',
                    border: '1px dashed rgba(16, 185, 129, 0.4)',
                    backgroundColor: 'rgba(16, 185, 129, 0.06)',
                    fontSize: '0.75rem',
                    color: '#047857',
                    wordBreak: 'break-all',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Dev only — reset URL:</div>
                  <a href={devUrl} style={{ color: '#047857', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
                    {devUrl}
                  </a>
                </div>
              )}
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
