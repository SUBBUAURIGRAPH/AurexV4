import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useEmissions } from '../../hooks/useEmissions';
import { useReports } from '../../hooks/useReports';
import { useFinancials } from '../../hooks/useFinancials';
import { useOrganizationTree } from '../../hooks/useOrganization';
import { useUsers } from '../../hooks/useUsers';

/**
 * FLOW-REWORK / Sprint 5: 6-step onboarding journey on the dashboard.
 *
 * Linear sequence the platform expects:
 *   1. Register the organisation (= onboarding wizard step 1)
 *   2. Add subsidiaries (skip if single-org)
 *   3. Invite users + assign RBAC roles
 *   4. Upload organisational financials
 *   5. Add the first emission entry
 *   6. Generate the first report
 *
 * Steps gate downstream items (e.g. financials only become "available"
 * once org+users are set up). The widget hides itself once all six are
 * complete and renders the compact "Set up complete" line instead.
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
  const { user } = useAuth();
  const onboarding = useOnboarding();
  const orgTree = useOrganizationTree();
  const users = useUsers({});
  const financials = useFinancials();
  const emissions = useEmissions({ page: 1, pageSize: 1 });
  const reports = useReports();

  const isLoading =
    onboarding.isLoading ||
    orgTree.isLoading ||
    users.isLoading ||
    financials.isLoading ||
    emissions.isLoading ||
    reports.isLoading;

  // Membership guard — a step is only "their" step if THIS user actually
  // belongs to an org. Without a membership, the org-scoped queries can
  // still come back populated (e.g. SUPER_ADMIN sees all orgs), which
  // would otherwise mark borrowed state as ✓ for a brand-new user.
  const hasMembership = !!user?.organization;

  // Step 1 — org registered: onboarding row exists with non-empty stepData.step1.
  const step1 = (onboarding.data?.data?.stepData as Record<string, unknown> | null)?.step1 as
    | Record<string, unknown>
    | undefined;
  const orgRegisteredRaw =
    !!step1?.name ||
    onboarding.data?.data?.status === 'COMPLETED' ||
    onboarding.data?.data?.status === 'SKIPPED';
  const orgRegistered = hasMembership && orgRegisteredRaw;

  // Step 2 — subsidiaries set up OR explicitly skipped (single-org tenant).
  const tree = orgTree.data?.data ?? [];
  const hasChildren = tree.some((node) => (node.children?.length ?? 0) > 0);
  const subsidiariesAcknowledged = !!(
    onboarding.data?.data?.stepData as Record<string, unknown> | null
  )?.step4; // step 4 in legacy backend numbering carries the subsidiaries journal entry
  const subsidiariesDone = hasMembership && (hasChildren || subsidiariesAcknowledged);

  // Step 3 — users + roles: more than 1 active user in org or invites recorded.
  const usersList = (users.data as { data?: unknown[] } | undefined)?.data ?? [];
  const hasMultipleUsers = usersList.length > 1;
  const inviteEntry = (onboarding.data?.data?.stepData as Record<string, unknown> | null)
    ?.step3 as { additionalInvites?: unknown[] } | undefined;
  const hasInvites = (inviteEntry?.additionalInvites?.length ?? 0) > 0;
  const usersConfigured = hasMembership && (hasMultipleUsers || hasInvites);

  // Step 4 — financials uploaded.
  const hasFinancials = hasMembership && !!financials.data?.data?.fiscalYear;

  // Step 5 — emissions entries.
  const emissionsTotal = emissions.data?.total ?? 0;
  const hasEmission = hasMembership && emissionsTotal > 0;

  // Step 6 — reports.
  const reportsCount = (reports.data as { data?: unknown[] } | undefined)?.data?.length ?? 0;
  const hasReport = hasMembership && reportsCount > 0;

  const steps: Step[] = [
    {
      key: 'org',
      done: !!orgRegistered,
      available: true,
      title: 'Register your organisation',
      body: 'Captures the org name, region, sector, and slug — the root of every record in Aurex.',
      href: '/onboarding',
      cta: 'Open wizard',
    },
    {
      key: 'subsidiaries',
      done: subsidiariesDone,
      available: !!orgRegistered,
      title: 'Add subsidiaries',
      body: 'Set up any child entities you need to track separately. Skip if you only have one org.',
      href: '/dashboard/admin/organizations',
      cta: 'Manage hierarchy',
    },
    {
      key: 'users',
      done: usersConfigured,
      available: !!orgRegistered,
      title: 'Invite users and assign roles',
      body: 'RBAC: ORG_ADMIN, MAKER, CHECKER, APPROVER, AUDITOR, VIEWER. Set least-privilege early.',
      href: '/dashboard/teams',
      cta: 'Manage team',
    },
    {
      key: 'financials',
      done: hasFinancials,
      available: usersConfigured,
      title: 'Upload organisational financials',
      body: 'Annual revenue, employees, fiscal year. Required for BRSR/CSRD intensity reports.',
      href: '/dashboard/settings/financials',
      cta: 'Add financials',
    },
    {
      key: 'first-emission',
      done: hasEmission,
      available: hasFinancials,
      title: 'Add your first emission entry',
      body: 'Logs a single greenhouse-gas activity record so analytics start populating.',
      href: '/emissions/new',
      cta: 'Add entry',
    },
    {
      key: 'first-report',
      done: hasReport,
      available: hasEmission,
      title: 'Generate your first report',
      body: 'Produces a TCFD/GRI/CDP/BRSR/CSRD-aligned export from your live data.',
      href: '/reports',
      cta: 'Open reports',
    },
  ];

  const allDone = steps.every((s) => s.done);

  if (isLoading) {
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
          <span style={{ color: 'var(--text-tertiary)' }}>
            You're ready to use every Aurex feature.
          </span>
        </div>
      </Card>
    );
  }

  const completedCount = steps.filter((s) => s.done).length;

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
          Get started — {completedCount} of {steps.length} steps complete
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
          Aurex works best when these are set up in order: organisation → users → financials →
          emissions → reports.
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
        {steps.map((step, i) => (
          <li key={step.key}>
            <StepRow step={step} number={i + 1} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StepRow({ step, number }: { step: Step; number: number }) {
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
        {step.done ? '✓' : number}
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
