import { useMyOrgApprovalStatus } from '../../hooks/useOrgApproval';

/**
 * FLOW-REWORK / Sprint 5 — pending-approval banner.
 * Renders above the dashboard for users whose org is awaiting Aurex
 * review or has been rejected.
 */
export function ApprovalStatusBanner() {
  const { data, isLoading } = useMyOrgApprovalStatus();

  if (isLoading) return null;
  const status = data?.data?.approvalStatus;
  if (!status || status === 'APPROVED') return null;

  const isPending = status === 'PENDING_REVIEW';
  const bg = isPending ? 'rgba(251,191,36,0.12)' : 'rgba(220,38,38,0.10)';
  const border = isPending ? 'rgba(251,191,36,0.35)' : 'rgba(220,38,38,0.35)';
  const accent = isPending ? '#f59e0b' : '#dc2626';

  return (
    <div
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: '0.5rem',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
      }}
    >
      <span style={{ color: accent, fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>
        {isPending ? '⏳' : '⚠'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          {isPending ? 'Awaiting Aurex-admin approval' : 'Registration rejected'}
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {isPending
            ? 'Your organisation is in review. You can browse the platform and prep your data — regulatory writes (emissions, retirements, BRSR responses) resume the moment an Aurex admin approves your registration.'
            : 'Contact support to amend and re-submit your registration. Read access remains available.'}
        </div>
      </div>
    </div>
  );
}
