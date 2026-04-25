import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useEmissions } from '../../hooks/useEmissions';
import { useBaselines } from '../../hooks/useBaselines';
import { useTargets } from '../../hooks/useTargets';
import { useOrgFrameworkMappings } from '../../hooks/useFrameworks';

/**
 * AAT-WORKFLOW (Wave 9a): "Next Steps" widget surfaced on the dashboard.
 *
 * Tester feedback (2026-04-25): "The features created need better
 * understanding how this work in the application". This widget walks the
 * user through the linear sequence the platform actually expects:
 *
 *   1. Complete onboarding wizard
 *   2. Add the first emission entry
 *   3. Set a baseline year
 *   4. Set a reduction target
 *   5. Pick a reporting framework
 *
 * Steps gate downstream items — e.g. baselines only become "actionable"
 * once at least one emission entry exists. The widget hides itself once
 * all five are complete; in that state we render a compact "Set up
 * complete" line instead.
 *
 * No new hooks were needed — every signal comes from existing react-query
 * hooks (useOnboarding, useEmissions, useBaselines, useTargets,
 * useOrgFrameworkMappings).
 */

interface Step {
  key: string;
  done: boolean;
  available: boolean;
  title: string;
  body: string;
  href: string;
  cta: string;
}

export function NextStepsWidget() {
  const onboarding = useOnboarding();
  // Pull a single record just to know if any exists (cheap pageSize=1).
  const emissions = useEmissions({ page: 1, pageSize: 1 });
  const baselines = useBaselines();
  const targets = useTargets();
  const mappings = useOrgFrameworkMappings();

  const isLoading =
    onboarding.isLoading ||
    emissions.isLoading ||
    baselines.isLoading ||
    targets.isLoading ||
    mappings.isLoading;

  const onboardingDone =
    onboarding.data?.data?.status === 'COMPLETED' ||
    onboarding.data?.data?.status === 'SKIPPED';

  const emissionsTotal = emissions.data?.total ?? 0;
  const hasEmission = emissionsTotal > 0;

  const baselinesCount = baselines.data?.data?.length ?? 0;
  const hasBaseline = baselinesCount > 0;

  const targetsCount = targets.data?.data?.length ?? 0;
  const hasTarget = targetsCount > 0;

  const mappingsCount = mappings.data?.data?.length ?? 0;
  const hasFramework = mappingsCount > 0;

  const steps: Step[] = [
    {
      key: 'onboarding',
      done: !!onboardingDone,
      available: true,
      title: 'Complete the onboarding wizard',
      body: 'Tells Aurex which sectors apply to your org and unlocks data entry.',
      href: '/onboarding',
      cta: 'Open wizard',
    },
    {
      key: 'first-emission',
      done: hasEmission,
      available: !!onboardingDone,
      title: 'Add your first emission entry',
      body: 'Logs a single greenhouse-gas activity record so analytics start populating.',
      href: '/emissions/new',
      cta: 'Add entry',
    },
    {
      key: 'baseline',
      done: hasBaseline,
      available: hasEmission,
      title: 'Set a baseline year',
      body: 'Anchors all reductions and target tracking against a known starting point.',
      href: '/emissions/baselines',
      cta: 'Set baseline',
    },
    {
      key: 'target',
      done: hasTarget,
      available: hasBaseline,
      title: 'Set a reduction target',
      body: 'Defines the trajectory you want to track against (1.5°C / well-below 2°C / 2°C).',
      href: '/emissions/targets',
      cta: 'Set target',
    },
    {
      key: 'framework',
      done: hasFramework,
      available: hasEmission,
      title: 'Pick a reporting framework',
      body: 'Maps your emissions categories onto BRSR / GRI / TCFD indicators for compliance reports.',
      href: '/frameworks',
      cta: 'Pick framework',
    },
  ];

  const allDone = steps.every((s) => s.done);

  if (isLoading) {
    // Quiet skeleton — don't flash an empty card on slow connections.
    return null;
  }

  if (allDone) {
    return (
      <Card padding="md" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
          }}
        >
          <span
            style={{
              width: '1.25rem',
              height: '1.25rem',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            ✓
          </span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Set up complete.</span>
          <span style={{ color: 'var(--text-tertiary)' }}>You're ready to use every Aurex feature.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" style={{ marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: '0.25rem',
          }}
        >
          Next steps
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
          Five quick steps to get the most out of Aurex.
        </p>
      </div>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {steps.map((step) => (
          <li key={step.key}>
            <StepRow step={step} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StepRow({ step }: { step: Step }) {
  const dimmed = !step.done && !step.available;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: '0.5rem',
    backgroundColor: step.done ? 'rgba(16,185,129,0.06)' : 'transparent',
    border: '1px solid transparent',
    opacity: dimmed ? 0.55 : 1,
  };

  const iconStyle: React.CSSProperties = {
    width: '1.5rem',
    height: '1.5rem',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    backgroundColor: step.done
      ? '#10b981'
      : step.available
        ? 'rgba(26,93,61,0.12)'
        : 'var(--bg-secondary)',
    color: step.done ? '#fff' : step.available ? '#1a5d3d' : 'var(--text-tertiary)',
    border: step.done ? 'none' : '1px solid var(--border-primary)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: step.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
    textDecoration: step.done ? 'line-through' : 'none',
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
    marginTop: '0.125rem',
  };

  const cta = (
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#1a5d3d',
        whiteSpace: 'nowrap',
      }}
    >
      {step.cta} →
    </span>
  );

  const inner = (
    <>
      <span style={iconStyle} aria-hidden>
        {step.done ? '✓' : ''}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={titleStyle}>{step.title}</div>
        <div style={bodyStyle}>{step.body}</div>
      </div>
      {!step.done && step.available && cta}
    </>
  );

  if (step.done || dimmed) {
    return <div style={rowStyle}>{inner}</div>;
  }

  return (
    <Link
      to={step.href}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
      }}
    >
      <div style={rowStyle}>{inner}</div>
    </Link>
  );
}
