/**
 * VoucherSignupPage — voucher-first signup gate.
 *
 * Mandate (USER, 2026-04-30): "The voucher should be submitted by user
 * BEFORE organization registration." This page is the dedicated path
 * that enforces it — the original /register page keeps a collapsed
 * voucher field for the legacy flow, but every voucher-driven CTA on
 * pricing / marketing surfaces must route here.
 *
 * Two-step UX:
 *   Step 1: voucher code (pre-fillable from ?code= query) → validate
 *           against /api/v1/coupons/validate; on success, render a
 *           coupon success card so the user sees exactly what they're
 *           getting BEFORE they hand over an email + password.
 *   Step 2: name + email + password → POST /auth/register with the
 *           validated couponCode → /onboarding (existing wizard then
 *           handles organisation creation).
 *
 * If the user lands here without a code, they can type one in. If they
 * try to advance to step 2 with an invalid code, the form refuses (the
 * server would auto-create a user with `couponWarning` — that's the
 * legacy /register behaviour, and the whole point of this page is to
 * NOT let a bad voucher silently slide through).
 */
import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useValidateCoupon, type ValidateCouponResult } from '../../hooks/useCoupons';

export function VoucherSignupPage() {
  const { register, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── Step state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1: voucher ────────────────────────────────────────────────
  const initialCode = (searchParams.get('code') ?? '').toUpperCase();
  const [couponCode, setCouponCode] = useState(initialCode);
  const [couponResult, setCouponResult] = useState<ValidateCouponResult | null>(null);
  const validate = useValidateCoupon();

  // ── Step 2: user details ───────────────────────────────────────────
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Auto-validate the pre-filled code so the user lands on a green card
  // rather than an empty step-1 form.
  useEffect(() => {
    if (initialCode && initialCode.length >= 4) {
      validate.mutate(
        { code: initialCode },
        { onSuccess: (data) => setCouponResult(data) },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const couponValid = couponResult?.valid === true && couponResult.coupon != null;

  const handleValidate = (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    const code = couponCode.trim().toUpperCase();
    if (code.length < 4) {
      setLocalError('Enter a voucher code (at least 4 characters).');
      return;
    }
    validate.mutate(
      { code },
      {
        onSuccess: (data) => {
          setCouponResult(data);
          if (data.valid) setLocalError('');
        },
      },
    );
  };

  const handleContinueToDetails = () => {
    if (!couponValid) return;
    setStep(2);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (!couponValid) {
      setLocalError('Voucher is no longer valid — please re-enter.');
      setStep(1);
      return;
    }
    try {
      const result = await register(name, email, password, couponCode.trim().toUpperCase());
      if (result.couponWarning) {
        // Server-side late rejection (rare — race between validate and
        // redeem). Surface it and bounce back to step 1.
        setLocalError(`Voucher couldn't be applied: ${result.couponWarning}`);
        setStep(1);
        setCouponResult(null);
        return;
      }
      navigate('/onboarding');
    } catch {
      // AuthContext owns `error`; we render it below.
    }
  };

  const displayError = localError || error;

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
      <div style={{ width: '100%', maxWidth: '460px' }}>
        {/* Logo */}
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

        {/* Stepper */}
        <Stepper step={step} />

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {step === 1 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem' }}>
                  Enter your voucher
                </h1>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>
                  We'll validate it before you create your account.
                </p>
              </div>

              {displayError && <ErrorBanner>{displayError}</ErrorBanner>}

              <form onSubmit={handleValidate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Input
                  label="Voucher code"
                  type="text"
                  placeholder="HEF-PUNE-2026"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    clearError();
                    setLocalError('');
                  }}
                  required
                  autoFocus
                  hint="We won't use any of your details until the voucher is verified."
                  error={
                    couponResult?.valid === false ? friendlyReason(couponResult.reason) : undefined
                  }
                  style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: '0.05em' }}
                />

                {couponValid && couponResult?.coupon && (
                  <CouponSuccessCard coupon={couponResult.coupon} />
                )}

                {!couponValid ? (
                  <Button type="submit" fullWidth size="lg" loading={validate.isPending}>
                    Validate voucher
                  </Button>
                ) : (
                  <Button type="button" fullWidth size="lg" onClick={handleContinueToDetails}>
                    Continue to account details
                  </Button>
                )}
              </form>

              <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                No voucher?{' '}
                <Link to="/register" style={{ color: '#10b981', fontWeight: 600 }}>
                  Standard signup
                </Link>
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem' }}>
                  Create your account
                </h1>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>
                  Your voucher is locked in below — let's get you signed up.
                </p>
              </div>

              {couponResult?.coupon && <CouponSuccessCard coupon={couponResult.coupon} compact />}

              {displayError && <ErrorBanner>{displayError}</ErrorBanner>}

              <form
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem', marginTop: '1.25rem' }}
              >
                <Input
                  label="Full name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setLocalError('');
                  }}
                  required
                  autoFocus
                />
                <Input
                  label="Work email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setLocalError('');
                  }}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLocalError('');
                  }}
                  required
                  hint="Minimum 8 characters."
                />
                <Input
                  label="Confirm password"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setLocalError('');
                  }}
                  required
                  error={
                    confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined
                  }
                />

                <Button type="submit" fullWidth loading={isLoading} size="lg">
                  Create account &amp; start trial
                </Button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '0.875rem',
                    color: 'var(--text-tertiary)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ← Back to voucher
                </button>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
                  By creating an account, you agree to our{' '}
                  <a href="#" style={{ color: '#10b981', textDecoration: 'none' }}>
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" style={{ color: '#10b981', textDecoration: 'none' }}>
                    Privacy Policy
                  </a>
                  .
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Local components ──────────────────────────────────────────────────

function Stepper({ step }: { step: 1 | 2 }) {
  const styleFor = (active: boolean) => ({
    flex: 1,
    height: '0.25rem',
    borderRadius: '999px',
    backgroundColor: active ? '#10b981' : 'var(--border-primary)',
    transition: 'background-color 0.2s ease',
  });
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
      <div style={styleFor(true)} />
      <div style={styleFor(step === 2)} />
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function friendlyReason(reason: string | undefined): string | undefined {
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

function CouponSuccessCard({
  coupon,
  compact = false,
}: {
  coupon: NonNullable<ValidateCouponResult['coupon']>;
  compact?: boolean;
}) {
  const features = Array.isArray(coupon.metadata?.feature_list)
    ? (coupon.metadata!.feature_list as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const tierLabel = coupon.trialTier.charAt(0) + coupon.trialTier.slice(1).toLowerCase();
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
          {coupon.code}
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {coupon.chapterName} · {coupon.organizationName}
        </span>
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        {coupon.trialDurationDays}-day {tierLabel} trial unlocked
      </div>
      {!compact && features.length > 0 && (
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
