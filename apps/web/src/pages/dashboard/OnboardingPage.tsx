import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useOnboarding,
  useSaveOnboardingStep,
  useSkipOnboarding,
  useCompleteOnboarding,
} from '../../hooks/useOnboarding';
import { useMyRedemption, type MyActiveRedemption } from '../../hooks/useCoupons';
import { useToast } from '../../contexts/ToastContext';

/**
 * AAT-ONBOARD: 3-step onboarding wizard.
 *
 * Step 1 — Organisation details (name, region, customer size, slug,
 *          industry sector). Persisted to OnboardingProgress.stepData.step1
 *          via /onboarding/steps/1; the org name is also written to the
 *          Organization row by the existing service.
 * Step 2 — Plan / voucher status. If the caller has an active
 *          CouponRedemption (looked up via /coupons/redemptions/me) we
 *          render the trial card; otherwise we render the 4 plan cards
 *          from PRICING.md with their CTAs disabled (Wave 7 / Razorpay
 *          integration is in flight). Skip-to-continue is always
 *          available.
 * Step 3 — Invite team. Preserves the existing Step3 invite UI.
 *
 * Wave 7 boundary: the plan cards' "Continue" buttons are disabled with
 * a "Billing coming soon" tooltip until /api/v1/billing lands. This is
 * deliberate — checkout wiring is the orchestrator's job.
 */

const REGION_OPTIONS = [
  { value: 'INDIA', label: 'India', currencyHint: '₹ pricing' },
  { value: 'INTERNATIONAL', label: 'International', currencyHint: '$ pricing' },
] as const;

const SIZE_OPTIONS = [
  { value: 'SME_MSME', label: 'SME / MSME', sub: 'Single-site or small org' },
  { value: 'ENTERPRISE', label: 'Enterprise', sub: 'Multi-site / multi-region' },
] as const;

const INDUSTRY_OPTIONS = [
  'Manufacturing',
  'Financial Services',
  'Energy & Utilities',
  'Construction & Real Estate',
  'Retail & Consumer Goods',
  'Transportation & Logistics',
  'Technology',
  'Healthcare',
  'Agriculture',
  'Government & NGO',
  'Other',
];

interface Plan {
  id: 'INDIA_MSME' | 'INDIA_ENTERPRISE' | 'INTL_SME' | 'INTL_ENTERPRISE';
  region: 'INDIA' | 'INTERNATIONAL';
  size: 'SME_MSME' | 'ENTERPRISE';
  label: string;
  price: string;
  scope: string;
}

const PLANS: Plan[] = [
  { id: 'INDIA_MSME', region: 'INDIA', size: 'SME_MSME', label: 'India MSME', price: '₹4,999 / yr', scope: 'Scope 1+2' },
  { id: 'INDIA_ENTERPRISE', region: 'INDIA', size: 'ENTERPRISE', label: 'India Enterprise', price: '₹9,999 / site / yr', scope: 'Scope 1+2' },
  { id: 'INTL_SME', region: 'INTERNATIONAL', size: 'SME_MSME', label: 'International SME', price: '$999 / yr', scope: 'Scope 1+2' },
  { id: 'INTL_ENTERPRISE', region: 'INTERNATIONAL', size: 'ENTERPRISE', label: 'International Enterprise', price: '$1,999 / site / yr', scope: 'Scope 1+2' },
];

// ── Wizard state ──────────────────────────────────────────────────────────

interface Step1State {
  name: string;
  region: 'INDIA' | 'INTERNATIONAL' | '';
  customerSize: 'SME_MSME' | 'ENTERPRISE' | '';
  slug: string;
  industry: string;
}

interface Step2State {
  selectedPlan: Plan['id'] | null;
  trialAcknowledged: boolean;
  skipped: boolean;
}

interface Invite { email: string; role: string }
interface Step3State { invites: Invite[] }

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

// ── Top-level page ────────────────────────────────────────────────────────

export function OnboardingPage() {
  const { data: progressData, isLoading } = useOnboarding();
  const saveStep = useSaveOnboardingStep();
  const skip = useSkipOnboarding();
  const complete = useCompleteOnboarding();
  const { data: redemptionData, isLoading: redemptionLoading } = useMyRedemption();
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();

  const progress = progressData?.data;
  const initial = (progress?.stepData ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const initialStep1 = (initial.step1 ?? {}) as Record<string, unknown>;
  const initialStep2 = (initial.step2 ?? {}) as Record<string, unknown>;
  const initialStep3 = (initial.step3 ?? {}) as Record<string, unknown>;

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [step1, setStep1] = useState<Step1State>({
    name: (initialStep1.name as string) ?? '',
    region: ((initialStep1.region as Step1State['region']) ?? ''),
    customerSize: ((initialStep1.customerSize as Step1State['customerSize']) ?? ''),
    slug: (initialStep1.slug as string) ?? '',
    industry: (initialStep1.industry as string) ?? '',
  });
  const [slugDirty, setSlugDirty] = useState(Boolean(step1.slug));
  const [step2, setStep2] = useState<Step2State>({
    selectedPlan: ((initialStep2.selectedPlan as Plan['id']) ?? null),
    trialAcknowledged: Boolean(initialStep2.trialAcknowledged),
    skipped: Boolean(initialStep2.skipped),
  });
  const [step3, setStep3] = useState<Step3State>({
    invites: ((initialStep3.additionalInvites as Invite[] | undefined) ?? []),
  });

  // Auto-derive slug from name until the user manually edits it.
  useEffect(() => {
    if (!slugDirty) {
      setStep1((prev) => ({ ...prev, slug: slugify(prev.name) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step1.name]);

  // If the user already finished, bounce to dashboard.
  useEffect(() => {
    if (progress?.status === 'COMPLETED') {
      navigate('/dashboard', { replace: true });
    }
  }, [progress?.status, navigate]);

  const trial = redemptionData?.data ?? null;

  if (isLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        Loading…
      </div>
    );
  }
  if (!progress) return null;

  const goNext = (target: 2 | 3) => setActiveStep(target);
  const goBack = (target: 1 | 2) => setActiveStep(target);

  // ── Submit handlers ────────────────────────────────────────────────────

  const submitStep1 = () => {
    if (!step1.name.trim()) {
      toastError('Organisation name is required');
      return;
    }
    saveStep.mutate(
      {
        step: 1,
        data: {
          name: step1.name.trim(),
          industry: step1.industry || undefined,
          region: step1.region || undefined,
          customerSize: step1.customerSize || undefined,
          slug: step1.slug || undefined,
        },
      },
      {
        onSuccess: () => goNext(2),
        onError: (e: Error) => toastError(e.message),
      },
    );
  };

  const submitStep2 = (state: Step2State) => {
    setStep2(state);
    saveStep.mutate(
      {
        step: 2,
        data: {
          selectedPlan: state.selectedPlan,
          trialAcknowledged: state.trialAcknowledged,
          skipped: state.skipped,
        },
      },
      {
        onSuccess: () => goNext(3),
        onError: (e: Error) => toastError(e.message),
      },
    );
  };

  const submitStep3 = (state: Step3State, finalize: boolean) => {
    setStep3(state);
    saveStep.mutate(
      {
        step: 3,
        data: {
          additionalInvites: state.invites.length > 0 ? state.invites : undefined,
        },
      },
      {
        onSuccess: () => {
          if (!finalize) return;
          complete.mutate(undefined, {
            onSuccess: () => {
              toastSuccess('Welcome to Aurex — your workspace is ready.');
              navigate('/dashboard');
            },
            onError: (e: Error) => toastError(e.message),
          });
        },
        onError: (e: Error) => toastError(e.message),
      },
    );
  };

  const handleSkipAll = () => {
    skip.mutate(undefined, {
      onSuccess: () => {
        toastSuccess('Onboarding skipped — you can finish setup any time.');
        navigate('/dashboard');
      },
      onError: (e: Error) => toastError(e.message),
    });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Welcome to Aurex
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Step {activeStep} of 3 — let's get your workspace set up.
          </p>
        </div>
        <button
          onClick={handleSkipAll}
          disabled={skip.isPending}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.8125rem', color: 'var(--text-tertiary)',
            fontFamily: 'inherit', padding: '0.5rem 0.75rem',
          }}
        >
          Skip for now
        </button>
      </div>

      <ProgressBar current={activeStep} />

      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.75rem',
        padding: '1.75rem',
      }}>
        {activeStep === 1 && (
          <Step1Form
            state={step1}
            slugDirty={slugDirty}
            onChange={(next, slugTouched) => {
              setStep1(next);
              if (slugTouched) setSlugDirty(true);
            }}
            onContinue={submitStep1}
            isPending={saveStep.isPending}
          />
        )}
        {activeStep === 2 && (
          <Step2PlanOrTrial
            initial={step2}
            trial={trial}
            trialLoading={redemptionLoading}
            onBack={() => goBack(1)}
            onSubmit={submitStep2}
            isPending={saveStep.isPending}
          />
        )}
        {activeStep === 3 && (
          <Step3Invites
            initial={step3}
            onBack={() => goBack(2)}
            onSubmit={(s, finalize) => submitStep3(s, finalize)}
            isPending={saveStep.isPending || complete.isPending}
          />
        )}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────

function ProgressBar({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { num: 1 as const, label: 'Organisation' },
    { num: 2 as const, label: 'Plan / voucher' },
    { num: 3 as const, label: 'Invite team' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
      {steps.map((s, i) => {
        const done = current > s.num;
        const active = current === s.num;
        return (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.5rem 0.75rem', borderRadius: '9999px',
              backgroundColor: done ? 'rgba(16,185,129,0.1)' : active ? 'rgba(26,93,61,0.1)' : 'var(--bg-secondary)',
              border: `1px solid ${done ? '#10b981' : active ? '#1a5d3d' : 'var(--border-primary)'}`,
            }}>
              <div style={{
                width: '1.5rem', height: '1.5rem', borderRadius: '9999px',
                backgroundColor: done ? '#10b981' : active ? '#1a5d3d' : 'var(--bg-tertiary)',
                color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done ? '✓' : s.num}
              </div>
              <span style={{
                fontSize: '0.8125rem', fontWeight: active || done ? 600 : 500,
                color: done ? '#10b981' : active ? '#1a5d3d' : 'var(--text-tertiary)',
              }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: '1px',
                backgroundColor: done ? '#10b981' : 'var(--border-primary)',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Organisation ──────────────────────────────────────────────────

interface Step1FormProps {
  state: Step1State;
  slugDirty: boolean;
  onChange: (next: Step1State, slugTouched: boolean) => void;
  onContinue: () => void;
  isPending: boolean;
}

function Step1Form({ state, onChange, onContinue, isPending }: Step1FormProps) {
  const update = (patch: Partial<Step1State>, slugTouched = false) =>
    onChange({ ...state, ...patch }, slugTouched);

  const valid = state.name.trim().length > 1;

  return (
    <div>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Organisation details
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Where you operate determines pricing currency; size drives plan eligibility.
      </p>

      <Field label="Organisation name" required>
        <input value={state.name} onChange={(e) => update({ name: e.target.value })} style={inputStyle} placeholder="Acme Corporation" />
      </Field>

      <Field label="Region" required>
        <RadioGroup
          name="region"
          value={state.region}
          options={REGION_OPTIONS.map((o) => ({ value: o.value, label: o.label, sub: o.currencyHint }))}
          onChange={(v) => update({ region: v as Step1State['region'] })}
        />
      </Field>

      <Field label="Customer size" required>
        <RadioGroup
          name="size"
          value={state.customerSize}
          options={SIZE_OPTIONS.map((o) => ({ value: o.value, label: o.label, sub: o.sub }))}
          onChange={(v) => update({ customerSize: v as Step1State['customerSize'] })}
        />
      </Field>

      <Field label="Workspace slug" hint="Used in URLs. Auto-derived from your org name; click to edit.">
        <input
          value={state.slug}
          onChange={(e) => update({ slug: slugify(e.target.value) }, true)}
          style={{ ...inputStyle, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
          placeholder="acme-corp"
        />
      </Field>

      <Field label="Industry sector">
        <select value={state.industry} onChange={(e) => update({ industry: e.target.value })} style={inputStyle}>
          <option value="">Choose one…</option>
          {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>

      <StepActions>
        <PrimaryButton onClick={onContinue} disabled={!valid || isPending} loading={isPending}>
          Continue
        </PrimaryButton>
      </StepActions>
    </div>
  );
}

// ── Step 2: Plan / voucher status ─────────────────────────────────────────

interface Step2Props {
  initial: Step2State;
  trial: MyActiveRedemption | null;
  trialLoading: boolean;
  onBack: () => void;
  onSubmit: (state: Step2State) => void;
  isPending: boolean;
}

function Step2PlanOrTrial({ initial, trial, trialLoading, onBack, onSubmit, isPending }: Step2Props) {
  const [selectedPlan, setSelectedPlan] = useState<Plan['id'] | null>(initial.selectedPlan);

  const trialEndLabel = useMemo(() => {
    if (!trial) return null;
    const end = new Date(trial.trialEnd);
    return end.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }, [trial]);

  if (trialLoading) {
    return (
      <div style={{ padding: '1rem 0', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
        Checking your trial status…
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Plan &amp; pricing
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        {trial
          ? "You're already on a trial — pick it up here, or skip and we'll keep you in trial."
          : 'Pick a plan to upgrade later, or skip and start with the free tier.'}
      </p>

      {trial ? (
        <TrialActiveCard
          trial={trial}
          trialEndLabel={trialEndLabel}
        />
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            {PLANS.map((p) => {
              const isSelected = selectedPlan === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlan(p.id); }}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: `2px solid ${isSelected ? '#1a5d3d' : 'var(--border-primary)'}`,
                    backgroundColor: isSelected ? 'rgba(26,93,61,0.06)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'border-color 150ms',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{p.scope}</span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1a5d3d', marginBottom: '0.5rem' }}>{p.price}</div>
                  <button
                    type="button"
                    disabled
                    title="Billing coming soon"
                    style={{
                      width: '100%',
                      padding: '0.4375rem 0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border-primary)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-tertiary)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'not-allowed',
                    }}
                  >
                    Continue (billing coming soon)
                  </button>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: '0.75rem' }}>
            Scope 3? <a href="mailto:contact@aurex.in" style={{ color: '#10b981', textDecoration: 'none' }}>Contact contact@aurex.in</a>
          </p>
        </div>
      )}

      <StepActions split>
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <SecondaryButton
            onClick={() =>
              onSubmit({
                selectedPlan: null,
                trialAcknowledged: Boolean(trial),
                skipped: !trial,
              })
            }
            disabled={isPending}
          >
            {trial ? 'Skip — continue with trial' : 'Skip — set up later'}
          </SecondaryButton>
        </div>
      </StepActions>
    </div>
  );
}

function TrialActiveCard({ trial, trialEndLabel }: { trial: MyActiveRedemption; trialEndLabel: string | null }) {
  const tierLabel = trial.trialTier.charAt(0) + trial.trialTier.slice(1).toLowerCase();
  return (
    <div
      style={{
        padding: '1.125rem 1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
        <span style={{
          fontSize: '0.6875rem', fontWeight: 700,
          padding: '0.125rem 0.5rem', borderRadius: '9999px',
          backgroundColor: '#10b981', color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Trial active
        </span>
        <span style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontWeight: 700, fontSize: '0.875rem', color: '#047857',
        }}>
          {trial.couponCode}
        </span>
      </div>
      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        {trial.chapterName} · {trial.organizationName}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        {tierLabel} tier · {trial.daysRemaining} {trial.daysRemaining === 1 ? 'day' : 'days'} remaining
        {trialEndLabel ? ` · ends ${trialEndLabel}` : ''}
      </div>
    </div>
  );
}

// ── Step 3: Invite team ───────────────────────────────────────────────────

interface Step3Props {
  initial: Step3State;
  onBack: () => void;
  onSubmit: (state: Step3State, finalize: boolean) => void;
  isPending: boolean;
}

function Step3Invites({ initial, onBack, onSubmit, isPending }: Step3Props) {
  const [invites, setInvites] = useState<Invite[]>(initial.invites);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ANALYST');

  const add = () => {
    if (!email.trim()) return;
    setInvites((prev) => [...prev, { email: email.trim(), role }]);
    setEmail('');
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Invite your team
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Add up to 10 colleagues now, or invite them later from Admin → Users.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="colleague@example.com"
          style={{ ...inputStyle, flex: 1 }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, width: '150px' }}>
          {['ANALYST', 'MANAGER', 'VIEWER', 'MAKER', 'CHECKER', 'APPROVER'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={!email.trim() || invites.length >= 10}
          style={{
            padding: '0.5rem 1rem', borderRadius: '0.5rem',
            border: '1px solid var(--border-primary)', cursor: 'pointer',
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500,
            opacity: (!email.trim() || invites.length >= 10) ? 0.5 : 1,
          }}
        >
          Add
        </button>
      </div>

      {invites.length > 0 && (
        <div style={{ border: '1px solid var(--border-primary)', borderRadius: '0.5rem', overflow: 'hidden', marginBottom: '1rem' }}>
          {invites.map((inv, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.625rem 0.875rem',
              borderBottom: i < invites.length - 1 ? '1px solid var(--border-primary)' : 'none',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              <div>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{inv.email}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: '0.625rem' }}>— {inv.role}</span>
              </div>
              <button
                onClick={() => setInvites((prev) => prev.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.8125rem', fontFamily: 'inherit' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <StepActions split>
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <SecondaryButton
            onClick={() => onSubmit({ invites: [] }, true)}
            disabled={isPending}
          >
            Skip — invite later
          </SecondaryButton>
          <PrimaryButton
            onClick={() => onSubmit({ invites }, true)}
            disabled={isPending}
            loading={isPending}
          >
            Finish setup
          </PrimaryButton>
        </div>
      </StepActions>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.5625rem 0.75rem',
  border: '1px solid var(--border-primary)',
  borderRadius: '0.5rem',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem', fontFamily: 'inherit',
};

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block', fontSize: '0.8125rem', fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: '0.375rem',
      }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>{hint}</p>
      )}
    </div>
  );
}

function RadioGroup({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; label: string; sub?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <label
            key={o.value}
            style={{
              padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
              border: `1.5px solid ${selected ? '#1a5d3d' : 'var(--border-primary)'}`,
              backgroundColor: selected ? 'rgba(26,93,61,0.06)' : 'var(--bg-card)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
            }}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected}
              onChange={() => onChange(o.value)}
              style={{ display: 'none' }}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{o.label}</span>
            {o.sub && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>{o.sub}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function StepActions({ children, split }: { children: React.ReactNode; split?: boolean }) {
  return (
    <div style={{
      marginTop: '1.5rem',
      display: 'flex',
      justifyContent: split ? 'space-between' : 'flex-end',
      gap: '0.75rem',
      alignItems: 'center',
    }}>
      {children}
    </div>
  );
}

function PrimaryButton({
  children, onClick, disabled, loading,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.5625rem 1.25rem', borderRadius: '0.5rem',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: '#1a5d3d', color: '#fff',
        fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {loading ? 'Saving…' : children}
    </button>
  );
}

function SecondaryButton({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.5625rem 1rem', borderRadius: '0.5rem',
        border: '1px solid var(--border-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
        fontWeight: 500, fontSize: '0.875rem', fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
