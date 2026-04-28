/**
 * AAT-FLOW6 — Compliance page rewrite.
 *
 * Was a hardcoded "obligations" table with fake CSRD / TCFD due dates.
 * Now reads `GET /compliance/posture` and renders four real signals:
 *   1. BRSR Core readiness (response count + assurance breakdown)
 *   2. DPDP consent posture (granted / withdrawn for org members)
 *   3. Active retention policies
 *   4. Recent regulatory-research runs (last 5 successful)
 */
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useCompliancePosture } from '../../hooks/useCompliancePosture';

const ASSURANCE_LABEL: Record<string, string> = {
  unaudited: 'Unaudited',
  internal_review: 'Internal review',
  limited_assurance: 'Limited assurance',
  reasonable_assurance: 'Reasonable assurance',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function CompliancePage() {
  const { data, isLoading, error } = useCompliancePosture();
  const posture = data;

  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Compliance Center
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          BRSR readiness, DPDP consent posture, retention policy, and the regulatory landscape feed.
        </p>
      </div>

      {error && (
        <Card padding="md" style={{ marginBottom: '1rem', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)' }}>
          <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>
            Failed to load compliance posture.
          </p>
        </Card>
      )}

      {isLoading && !posture && (
        <Card padding="lg">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Loading…</p>
        </Card>
      )}

      {posture && (
        <>
          {/* ── Top-line cards ───────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <MetricCard
              label="BRSR Core responses"
              value={String(posture.brsr.responseCount)}
              hint={
                posture.brsr.fiscalYearsCovered.length > 0
                  ? `FY ${posture.brsr.fiscalYearsCovered.join(', ')}`
                  : 'No fiscal year covered'
              }
            />
            <MetricCard
              label="Active org members"
              value={String(posture.dpdp.orgMemberCount)}
              hint={`${posture.dpdp.consentGranted} consents granted`}
            />
            <MetricCard
              label="Consents withdrawn"
              value={String(posture.dpdp.consentWithdrawn)}
              hint="DPDP §11 right to withdraw"
            />
            <MetricCard
              label="Retention policies"
              value={String(posture.retention.activePolicies.length)}
              hint="Active policies (global)"
            />
          </div>

          {/* ── BRSR assurance ───────────────────────────────────────── */}
          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              BRSR Core assurance breakdown
            </h3>
            {Object.keys(posture.brsr.assuranceBreakdown).length === 0 ? (
              <Card padding="md">
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                  No BRSR responses captured yet. Visit the BRSR builder to seed your first response.
                </p>
              </Card>
            ) : (
              <Card padding="md">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {Object.entries(posture.brsr.assuranceBreakdown).map(([status, count]) => (
                    <Badge
                      key={status}
                      variant={
                        status === 'reasonable_assurance'
                          ? 'success'
                          : status === 'limited_assurance'
                            ? 'info'
                            : status === 'internal_review'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {ASSURANCE_LABEL[status] ?? status} · {count}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </section>

          {/* ── Retention policies ────────────────────────────────────── */}
          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Active retention policies
            </h3>
            {posture.retention.activePolicies.length === 0 ? (
              <Card padding="md">
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                  No active retention policies configured.
                </p>
              </Card>
            ) : (
              <Card padding="none">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        {['Policy', 'Min retention', 'Default'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {posture.retention.activePolicies.map((p, i) => (
                        <tr key={p.id} style={{ borderBottom: i < posture.retention.activePolicies.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{p.minRetentionYears} yr</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {p.isDefault ? <Badge variant="info">Default</Badge> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>

          {/* ── Regulatory research timeline ──────────────────────────── */}
          <section>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Recent regulatory research
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
              Last 5 successful runs from the Aurex regulatory-landscape scanner (AAT-DEEPRESEARCH).
            </p>
            {posture.research.runs.length === 0 ? (
              <Card padding="md">
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                  No regulatory-research runs yet. The weekly scanner posts results into this feed.
                </p>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {posture.research.runs.map((r) => (
                  <Card key={r.id} padding="md">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.topic}</h4>
                      <Badge variant="neutral">{r.depth}</Badge>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
                      {formatDate(r.createdAt)}
                    </p>
                    {r.summary && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                        {r.summary.length > 280 ? `${r.summary.slice(0, 280)}…` : r.summary}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card padding="lg">
      <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{value}</p>
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{hint}</p>}
    </Card>
  );
}
