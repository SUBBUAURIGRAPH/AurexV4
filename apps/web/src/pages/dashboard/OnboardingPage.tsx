import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useOnboarding,
  useSaveOnboardingStep,
  useSkipOnboarding,
  useEsgFrameworks,
} from '../../hooks/useOnboarding';
import { useToast } from '../../contexts/ToastContext';

const REPORTING_STANDARDS = [
  { value: 'GHG_PROTOCOL', label: 'GHG Protocol' },
  { value: 'ISO_14064', label: 'ISO 14064' },
  { value: 'GRI', label: 'GRI Standards' },
  { value: 'CUSTOM', label: 'Custom' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STEPS = [
  { num: 1, label: 'Organisation' },
  { num: 2, label: 'Reporting' },
  { num: 3, label: 'Team' },
  { num: 4, label: 'Frameworks' },
];

function StepIndicator({ current, completed }: { current: number; completed: number[] }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem' }}>
      {STEPS.map((s, i) => {
        const done = completed.includes(s.num);
        const active = s.num === current;
        return (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: i < STEPS.length - 1 ? 1 : 0 }}>
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
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: '1px',
                backgroundColor: completed.includes(s.num) ? '#10b981' : 'var(--border-primary)',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface StepProps {
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}

function Step1({ initial, onSubmit, isPending }: StepProps) {
  const [name, setName] = useState((initial?.name as string) ?? '');
  const [industry, setIndustry] = useState((initial?.industry as string) ?? '');
  const [country, setCountry] = useState((initial?.country as string) ?? '');
  const [website, setWebsite] = useState((initial?.website as string) ?? '');

  return (
    <div>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Organisation Profile
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Tell us about your organisation.
      </p>

      <Field label="Organisation Name" required>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Acme Corporation" />
      </Field>
      <Field label="Industry">
        <input value={industry} onChange={(e) => setIndustry(e.target.value)} style={inputStyle} placeholder="Manufacturing, Financial Services…" />
      </Field>
      <Field label="Country">
        <input value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} placeholder="India" />
      </Field>
      <Field label="Website">
        <input value={website} onChange={(e) => setWebsite(e.target.value)} style={inputStyle} placeholder="https://example.com" type="url" />
      </Field>

      <StepActions>
        <PrimaryButton
          onClick={() => onSubmit({ name, industry: industry || undefined, country: country || undefined, website: website || undefined })}
          disabled={!name.trim() || isPending}
          loading={isPending}
        >
          Continue
        </PrimaryButton>
      </StepActions>
    </div>
  );
}

function Step2({ initial, onSubmit, isPending }: StepProps) {
  const [fiscalYearStartMonth, setMonth] = useState((initial?.fiscalYearStartMonth as number) ?? 4);
  const [reportingStandard, setStandard] = useState((initial?.reportingStandard as string) ?? 'GHG_PROTOCOL');
  const [baseYear, setBaseYear] = useState((initial?.baseYear as number) ?? new Date().getFullYear() - 1);

  return (
    <div>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Reporting Configuration
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Configure how your organisation tracks and reports emissions.
      </p>

      <Field label="Fiscal Year Start Month" required>
        <select value={fiscalYearStartMonth} onChange={(e) => setMonth(parseInt(e.target.value, 10))} style={inputStyle}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </Field>
      <Field label="Reporting Standard" required>
        <select value={reportingStandard} onChange={(e) => setStandard(e.target.value)} style={inputStyle}>
          {REPORTING_STANDARDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Base Year" required>
        <input type="number" value={baseYear} onChange={(e) => setBaseYear(parseInt(e.target.value, 10) || 0)} style={inputStyle} min={2000} max={2100} />
      </Field>

      <StepActions>
        <PrimaryButton
          onClick={() => onSubmit({ fiscalYearStartMonth, reportingStandard, baseYear })}
          disabled={!baseYear || isPending}
          loading={isPending}
        >
          Continue
        </PrimaryButton>
      </StepActions>
    </div>
  );
}

interface Invite { email: string; role: string }

function Step3({ initial, onSubmit, isPending }: StepProps) {
  const initialInvites = (initial?.additionalInvites as Invite[]) ?? [];
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
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
        Invite your team (optional)
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Add up to 10 team members. You can also invite people later from Admin → Users.
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

      <StepActions>
        <PrimaryButton
          onClick={() => onSubmit({ additionalInvites: invites.length > 0 ? invites : undefined })}
          disabled={isPending}
          loading={isPending}
        >
          Continue
        </PrimaryButton>
      </StepActions>
    </div>
  );
}

function Step4({ initial, onSubmit, isPending }: StepProps) {
  const initialCodes = (initial?.frameworkCodes as string[]) ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set(initialCodes));
  const { data: frameworksData, isLoading } = useEsgFrameworks();

  const frameworks = frameworksData?.data ?? [];

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Select ESG Frameworks
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Choose the disclosure frameworks your organisation reports against. You can change this later.
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', padding: '1rem 0' }}>Loading frameworks…</p>
      ) : frameworks.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', padding: '1rem 0' }}>
          No frameworks are available yet. You can skip this step and configure them later.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {frameworks.map((fw) => {
            const isSelected = selected.has(fw.code);
            return (
              <button
                key={fw.id}
                onClick={() => toggle(fw.code)}
                style={{
                  textAlign: 'left',
                  padding: '0.875rem 1rem', borderRadius: '0.5rem',
                  border: `2px solid ${isSelected ? '#1a5d3d' : 'var(--border-primary)'}`,
                  backgroundColor: isSelected ? 'rgba(26,93,61,0.06)' : 'var(--bg-card)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 150ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 700,
                    padding: '0.125rem 0.5rem', borderRadius: '0.25rem',
                    backgroundColor: isSelected ? '#1a5d3d' : 'var(--bg-tertiary)',
                    color: isSelected ? '#fff' : 'var(--text-tertiary)',
                  }}>
                    {fw.code}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fw.name}</span>
                </div>
                {fw.description && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.4 }}>
                    {fw.description.slice(0, 100)}{fw.description.length > 100 ? '…' : ''}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <StepActions>
        <PrimaryButton
          onClick={() => onSubmit({ frameworkCodes: Array.from(selected) })}
          disabled={isPending}
          loading={isPending}
        >
          Complete Setup
        </PrimaryButton>
      </StepActions>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.5625rem 0.75rem',
  border: '1px solid var(--border-primary)',
  borderRadius: '0.5rem',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem', fontFamily: 'inherit',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block', fontSize: '0.8125rem', fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: '0.375rem',
      }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function StepActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, loading }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.5625rem 1.25rem', borderRadius: '0.5rem',
        border: 'none', cursor: 'pointer',
        backgroundColor: '#1a5d3d', color: '#fff',
        fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {loading ? 'Saving…' : children}
    </button>
  );
}

export function OnboardingPage() {
  const { data, isLoading } = useOnboarding();
  const saveStep = useSaveOnboardingStep();
  const skip = useSkipOnboarding();
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();

  const progress = data?.data;

  useEffect(() => {
    if (progress?.status === 'COMPLETED') {
      toastSuccess('Onboarding complete — welcome aboard!');
      navigate('/dashboard');
    }
  }, [progress?.status]);

  const handleStep = (step: 1 | 2 | 3 | 4, formData: Record<string, unknown>) => {
    saveStep.mutate(
      { step, data: formData },
      {
        onError: (e: Error) => toastError(e.message),
      },
    );
  };

  const handleSkip = () => {
    skip.mutate(undefined, {
      onSuccess: () => {
        toastSuccess('Onboarding skipped');
        navigate('/dashboard');
      },
      onError: (e: Error) => toastError(e.message),
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        Loading…
      </div>
    );
  }

  if (!progress) return null;

  const currentStep = progress.currentStep as 1 | 2 | 3 | 4;
  const initial = (progress.stepData?.[`step${currentStep}`] as Record<string, unknown>) ?? {};

  return (
    <div style={{ padding: '2rem', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Welcome to Aurex
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Let's get your organisation set up in a few quick steps.
          </p>
        </div>
        <button
          onClick={handleSkip}
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

      <StepIndicator current={currentStep} completed={progress.completedSteps} />

      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.75rem',
        padding: '1.75rem',
      }}>
        {currentStep === 1 && <Step1 initial={initial} onSubmit={(d) => handleStep(1, d)} isPending={saveStep.isPending} />}
        {currentStep === 2 && <Step2 initial={initial} onSubmit={(d) => handleStep(2, d)} isPending={saveStep.isPending} />}
        {currentStep === 3 && <Step3 initial={initial} onSubmit={(d) => handleStep(3, d)} isPending={saveStep.isPending} />}
        {currentStep === 4 && <Step4 initial={initial} onSubmit={(d) => handleStep(4, d)} isPending={saveStep.isPending} />}
      </div>
    </div>
  );
}
