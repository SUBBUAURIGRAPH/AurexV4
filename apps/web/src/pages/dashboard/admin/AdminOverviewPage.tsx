import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { useOrganizationsList } from '../../../hooks/useOrganization';
import { useUsers } from '../../../hooks/useUsers';
import { usePendingOrgApprovals } from '../../../hooks/useOrgApproval';

/**
 * FLOW-REWORK / Sprint 5 — Enterprise admin overview.
 *
 * Single landing page for every admin sub-section. Each card shows a live
 * stat + links into the dedicated sub-page (or notes "API-only — UI
 * coming soon" where no UI exists yet). Links resolve regardless of the
 * caller's super_admin/org_admin posture; the destination route's
 * RoleGuard handles the actual permission check.
 */

interface AdminCard {
  title: string;
  description: string;
  stat?: string | number;
  statLabel?: string;
  href: string | null;
  apiPath?: string;
  status: 'live' | 'api-only';
  badge?: string;
}

export function AdminOverviewPage() {
  const orgs = useOrganizationsList(true);
  const users = useUsers({});
  const pending = usePendingOrgApprovals(false);

  const orgsCount = orgs.data?.data?.length ?? 0;
  const usersCount = ((users.data as { data?: unknown[] } | undefined)?.data?.length) ?? 0;
  const pendingCount = pending.data?.data?.length ?? 0;

  const cards: AdminCard[] = [
    {
      title: 'Organisations',
      description: 'Top-level organisations + subsidiary hierarchy. Create, edit, deactivate.',
      stat: orgsCount,
      statLabel: 'orgs',
      href: '/admin/organizations',
      status: 'live',
    },
    {
      title: 'Org approvals',
      description: 'Self-service registrations awaiting Aurex review. Approve or reject with reason.',
      stat: pendingCount,
      statLabel: pendingCount === 1 ? 'pending review' : 'pending review',
      href: '/admin/org-approvals',
      status: 'live',
      badge: pendingCount > 0 ? `${pendingCount} pending` : undefined,
    },
    {
      title: 'Users',
      description: 'All platform users + global roles. Promote, demote, deactivate.',
      stat: usersCount,
      statLabel: 'users',
      href: '/admin/users',
      status: 'live',
    },
    {
      title: 'Tier quotas',
      description: 'Per-tier monthly limits (emissions entries, reports, retirements). Adjust + audit.',
      href: '/admin/quotas',
      status: 'live',
    },
    {
      title: 'Signup coupons',
      description: 'Voucher codes (HEF-PUNE-2026, etc.). 2-tier discount, redemption tracking.',
      href: '/admin/coupons',
      status: 'live',
    },
    {
      title: 'Federation keys',
      description: 'S2S RS256 JWT keys for Aurex ↔ AWD2 / HCE2 / Aurigraph federation.',
      href: null,
      apiPath: '/api/v1/admin/federation/*',
      status: 'api-only',
    },
    {
      title: 'Retention policies',
      description: '≥ 2yr post-crediting-period (A6.4 cat archive). Datapoint archival jobs.',
      href: null,
      apiPath: '/api/v1/admin/retention/*',
      status: 'api-only',
    },
    {
      title: 'Regulatory research runs',
      description: 'Gemini Deep Research scans for BCR / A6.4 / BRSR / etc. Weekly cron.',
      href: null,
      apiPath: '/api/v1/admin/research/*',
      status: 'api-only',
    },
    {
      title: 'BRSR assurance status',
      description: 'Set per-response assurance level (unaudited → reasonable assurance).',
      href: null,
      apiPath: '/api/v1/admin/brsr/responses/:id/assurance',
      status: 'api-only',
    },
    {
      title: 'CSRD retirement export',
      description: 'ESRS E1-7 column-mapped CSV; backfill granularity for legacy retirements.',
      href: null,
      apiPath: '/api/v1/admin/retirements/csrd-export',
      status: 'api-only',
    },
    {
      title: 'DPDP — DSAR + breach',
      description: 'Data Principal Subject Access Requests + 72-hour breach incident tracking.',
      href: null,
      apiPath: '/api/v1/admin/dpdp/*',
      status: 'api-only',
    },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Admin overview</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', margin: '0.25rem 0 0' }}>
          Operations + compliance + tenant management. Click any card to drill in.
        </p>
      </div>

      {/* Top-of-page action banner: pending approvals get prominent CTA. */}
      {pendingCount > 0 && (
        <Card padding="md" style={{ marginBottom: '1.5rem', border: '2px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                ⏳ {pendingCount} organisation{pendingCount === 1 ? '' : 's'} awaiting your review
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Self-service registrations queued for approval. Each blocks the org's regulatory writes until you decide.
              </div>
            </div>
            <Link
              to="/admin/org-approvals"
              style={{
                padding: '0.625rem 1rem',
                borderRadius: '0.5rem',
                backgroundColor: '#f59e0b',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Review queue →
            </Link>
          </div>
        </Card>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        {cards.map((card) => (
          <AdminCardView key={card.title} card={card} />
        ))}
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1.25rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.5rem',
          fontSize: '0.8125rem',
          color: 'var(--text-tertiary)',
        }}
      >
        <strong style={{ color: 'var(--text-secondary)' }}>API-only surfaces</strong>: the
        endpoints listed in cards above already work via direct API call (curl / Postman) but
        don't yet have a dashboard UI. Track requests for additional UI in Jira (label:{' '}
        <code>admin-ui</code>).
      </div>
    </div>
  );
}

function AdminCardView({ card }: { card: AdminCard }) {
  const isLive = card.status === 'live' && card.href;
  const inner = (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.5rem',
        padding: '1.25rem',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        opacity: isLive ? 1 : 0.7,
        cursor: isLive ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          {card.title}
        </h3>
        {card.badge && (
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              padding: '0.125rem 0.5rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(245,158,11,0.18)',
              color: '#f59e0b',
              whiteSpace: 'nowrap',
            }}
          >
            {card.badge}
          </span>
        )}
      </div>

      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
        {card.description}
      </p>

      {card.stat !== undefined && (
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {card.stat}
          </span>
          {card.statLabel && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {card.statLabel}
            </span>
          )}
        </div>
      )}

      {!isLive && card.apiPath && (
        <div
          style={{
            marginTop: 'auto',
            fontSize: '0.6875rem',
            color: 'var(--text-tertiary)',
            fontFamily: 'monospace',
          }}
        >
          {card.apiPath}{' '}
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '0.0625rem 0.375rem',
              borderRadius: '0.25rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-tertiary)',
              marginLeft: '0.375rem',
            }}
          >
            API only
          </span>
        </div>
      )}
    </div>
  );

  return isLive ? (
    <Link to={card.href!} style={{ textDecoration: 'none', color: 'inherit' }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}
