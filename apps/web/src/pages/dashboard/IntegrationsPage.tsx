/**
 * AAT-FLOW6 — Integrations page rewrite.
 *
 * Was a hardcoded mock list of "SAP S/4HANA / Oracle NetSuite / …" cards
 * that suggested working ERP connectors that don't exist. Now reads
 * `GET /integrations/status` and renders two honest sections:
 *
 *   1. Federation partners — Aurigraph DLT / AWD2 / HCE2 trust roster
 *      from FederationKey rows. Empty state explains how a super admin
 *      registers a key.
 *   2. Services — Razorpay / email transport / Sumsub configuration
 *      status sourced from env-var presence checks.
 */
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useIntegrationsStatus, type FederationPartnerRow, type ServiceStatus } from '../../hooks/useIntegrations';

const PARTNER_LABEL: Record<string, string> = {
  AURIGRAPH: 'Aurigraph DLT',
  AWD2: 'Aurigraph Web Distribution v2',
  HCE2: 'HC Earthcare 2',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function IntegrationsPage() {
  const { data, isLoading, error } = useIntegrationsStatus();

  const federationPartners = data?.federationPartners ?? [];
  const services = data?.services ?? [];

  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Integrations
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Federation partners and external service status. ERP / data-lake connectors are tracked under the integrations marketplace roadmap.
        </p>
      </div>

      {error && (
        <Card padding="md" style={{ marginBottom: '1rem', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)' }}>
          <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>
            Failed to load integration status. Try refreshing the page.
          </p>
        </Card>
      )}

      {/* ── Federation partners ───────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Federation partners
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '0.875rem' }}>
          Trusted public keys for service-to-service identity federation (AAT-367).
        </p>

        {isLoading ? (
          <Card padding="lg">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Loading…</p>
          </Card>
        ) : federationPartners.length === 0 ? (
          <Card padding="lg">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              No active federation keys registered.
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
              A super admin can register a partner key via{' '}
              <code style={{ fontSize: '0.75rem' }}>POST /api/v1/admin/federation/keys</code>.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {federationPartners.map((p) => (
              <FederationCard key={`${p.partner}-${p.keyId}`} row={p} />
            ))}
          </div>
        )}
      </section>

      {/* ── Service status ────────────────────────────────────────────── */}
      <section>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          External services
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '0.875rem' }}>
          Configuration status for the SaaS dependencies wired into this deployment.
        </p>

        {isLoading ? (
          <Card padding="lg">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Loading…</p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {services.map((s) => (
              <ServiceCard key={s.code} svc={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FederationCard({ row }: { row: FederationPartnerRow }) {
  return (
    <Card padding="lg" hover>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {PARTNER_LABEL[row.partner] ?? row.partner}
        </h4>
        <Badge variant={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
        {row.keyId}
      </p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
        Expires: {formatDate(row.expiresAt)}
      </p>
      {row.rotatedAt && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          Last rotated: {formatDate(row.rotatedAt)}
        </p>
      )}
    </Card>
  );
}

function ServiceCard({ svc }: { svc: ServiceStatus }) {
  return (
    <Card padding="lg" hover>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{svc.name}</h4>
        <Badge variant={svc.configured ? 'success' : 'warning'}>
          {svc.configured ? 'Configured' : 'Not set'}
        </Badge>
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>{svc.category}</p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{svc.detail}</p>
    </Card>
  );
}
