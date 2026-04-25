import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useValidateCoupon, type ValidateCouponResult } from '../../hooks/useCoupons';

/**
 * AAT-ONBOARD: signup form with optional voucher code.
 *
 * Layout: keep the original two-column-ish flow (name, email, password,
 * confirm), then a collapsed "Have a voucher code?" link that expands an
 * input. As the user types, validate-on-debounce hits
 * /api/v1/coupons/validate and renders either a success card (chapter +
 * org + trial duration + metadata badges) or an inline error.
 *
 * Submit posts {name, email, password, couponCode?} to /auth/register.
 * The backend creates the user atomically and surfaces:
 *   - data    : { id, email, name }
 *   - trial?  : { trialStart, trialEnd, trialTier, trialDurationDays, ...}
 *   - couponWarning? : "voucher couldn't be applied" string
 *
 * On success → /onboarding (the wizard).
 */

const VALIDATE_DEBOUNCE_MS = 500;

export function RegisterPage() {
  const { register, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [postSignupNotice, setPostSignupNotice] = useState<string | null>(null);

  // Coupon UI state.
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<ValidateCouponResult | null>(null);
  const validateCoupon = useValidateCoupon();

  // Debounced validate-on-keystroke. The on-blur path uses the same
  // mutation but synchronously instead of via the timer. We also reset
  // the result when the user clears the input.
  useEffect(() => {
    const code = couponCode.trim();
    if (!code) {
      setCouponResult(null);
      return;
    }
    if (code.length < 4) {
      setCouponResult(null);
      return;
    }
    const handle = setTimeout(() => {
      validateCoupon.mutate(
        { code: code.toUpperCase(), email: email.trim() || undefined },
        { onSuccess: (data) => setCouponResult(data) },
      );
    }, VALIDATE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // We deliberately exclude `validateCoupon` (TanStack mutation
    // identity) from the deps to avoid re-firing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponCode, email]);

  const handleCouponBlur = () => {
    const code = couponCode.trim();
    if (!code || code.length < 4) return;
    validateCoupon.mutate(
      { code: code.toUpperCase(), email: email.trim() || undefined },
      { onSuccess: (data) => setCouponResult(data) },
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setPostSignupNotice(null);

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      const couponPayload =
        couponOpen && couponCode.trim().length > 0
          ? couponCode.trim().toUpperCase()
          : undefined;
      const result = await register(name, email, password, couponPayload);

      // If the backend surfaced couponWarning, briefly show it before
      // navigating — the wizard step 2 will also reflect the absence of
      // an active redemption.
      if (result.couponWarning) {
        setPostSignupNotice(
          `Account created, but voucher couldn't be applied: ${result.couponWarning}`,
        );
        // Give the user a moment to read the warning, then proceed.
        setTimeout(() => navigate('/onboarding'), 1500);
        return;
      }
      navigate('/onboarding');
    } catch {
      // Error handled by context.
    }
  };

  const displayError = localError || error;
  const couponValid = couponResult?.valid === true;
  const couponInvalidReason =
    couponResult && couponResult.valid === false ? couponResult.reason : null;
  const submitLabel = couponValid ? 'Create account & start trial' : 'Create account';

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
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem' }}>Create your account</h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>Start your sustainability journey with Aurex</p>
          </div>

          {displayError && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              color: '#dc2626',
            }}>
              {displayError}
            </div>
          )}

          {postSignupNotice && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              color: '#b45309',
            }}>
              {postSignupNotice}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            <Input
              label="Full Name"
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError(); setLocalError(''); }}
              required
              autoFocus
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            />
            <Input
              label="Work Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); setLocalError(''); }}
              required
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
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); setLocalError(''); }}
              required
              hint="Minimum 8 characters"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setLocalError(''); }}
              required
              error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
            />

            {/* Voucher code section — collapsed by default */}
            {!couponOpen ? (
              <button
                type="button"
                onClick={() => setCouponOpen(true)}
                style={{
                  alignSelf: 'flex-start',
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '0.875rem', color: '#10b981', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Have a voucher code?
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <Input
                  label="Voucher code"
                  type="text"
                  placeholder="HEF-PUNE-2026"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onBlur={handleCouponBlur}
                  hint={couponValid ? undefined : 'Optional — unlocks an extended trial.'}
                  error={couponInvalidReason ? friendlyReason(couponInvalidReason) : undefined}
                  style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: '0.05em' }}
                />
                {couponValid && couponResult?.coupon && (
                  <CouponSuccessCard
                    code={couponResult.coupon.code}
                    chapterName={couponResult.coupon.chapterName}
                    organizationName={couponResult.coupon.organizationName}
                    trialDurationDays={couponResult.coupon.trialDurationDays}
                    trialTier={couponResult.coupon.trialTier}
                    metadata={couponResult.coupon.metadata}
                  />
                )}
              </div>
            )}

            <Button type="submit" fullWidth loading={isLoading} size="lg">
              {submitLabel}
            </Button>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
              By creating an account, you agree to our{' '}
              <a href="#" style={{ color: '#10b981', textDecoration: 'none' }}>Terms of Service</a>{' '}
              and{' '}
              <a href="#" style={{ color: '#10b981', textDecoration: 'none' }}>Privacy Policy</a>.
            </p>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function friendlyReason(reason: string): string {
  switch (reason) {
    case 'COUPON_NOT_FOUND':
      return "We couldn't find that voucher code. Double-check it for typos.";
    case 'COUPON_INACTIVE':
      return 'This voucher is no longer active.';
    case 'COUPON_EXPIRED':
      return 'This voucher has expired.';
    case 'COUPON_NOT_YET_VALID':
      return "This voucher isn't valid yet.";
    case 'COUPON_MAX_REDEEMED':
      return 'This voucher has already been fully claimed.';
    case 'EMAIL_ALREADY_USED':
      return 'This email has already redeemed this voucher.';
    case 'IP_BURST_LIMIT':
      return 'Too many checks from this IP — please try again in a few minutes.';
    default:
      return reason;
  }
}

interface CouponSuccessCardProps {
  code: string;
  chapterName: string;
  organizationName: string;
  trialDurationDays: number;
  trialTier: string;
  metadata?: Record<string, unknown>;
}

function CouponSuccessCard({
  code,
  chapterName,
  organizationName,
  trialDurationDays,
  trialTier,
  metadata,
}: CouponSuccessCardProps) {
  const features = Array.isArray(metadata?.feature_list)
    ? (metadata!.feature_list as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const tierLabel = trialTier.charAt(0) + trialTier.slice(1).toLowerCase();
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '0.875rem 1rem',
        borderRadius: '0.625rem',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontWeight: 700,
            fontSize: '0.875rem',
            color: '#047857',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            padding: '0.125rem 0.5rem',
            borderRadius: '0.25rem',
          }}
        >
          {code}
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {chapterName} · {organizationName}
        </span>
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        {trialDurationDays}-day {tierLabel} trial unlocked
      </div>
      {features.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {features.map((f) => (
            <span
              key={f}
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
