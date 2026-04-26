/**
 * AAT-378 / AV4-378 — caller-org QuotaWidget for the dashboard.
 *
 * Compact card showing the top-3 most-utilised quotas from the
 * caller's tier. Hides when nothing is consumed yet (zero-utilisation
 * is just noise on day-1) and reads from `GET /api/v1/quotas/me`.
 */
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  QUOTA_RESOURCES,
  useMyQuotas,
  type QuotaResourceKey,
} from '../../hooks/useQuotas';

function formatPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${Math.round(ratio * 100)}%`;
}

function variantFor(ratio: number): 'success' | 'warning' | 'error' | 'neutral' {
  if (!Number.isFinite(ratio) || ratio === 0) return 'neutral';
  if (ratio >= 1) return 'error';
  if (ratio >= 0.8) return 'warning';
  return 'success';
}

interface TopQuota {
  key: QuotaResourceKey;
  label: string;
  ratio: number;
  used: number;
  limit: number;
}

export function topThreeQuotas(snapshot: {
  ratios: Record<QuotaResourceKey, number>;
  usage: Record<QuotaResourceKey, number>;
  limits: Record<QuotaResourceKey, number>;
}): TopQuota[] {
  return QUOTA_RESOURCES.map((r) => ({
    key: r.key,
    label: r.label,
    ratio: snapshot.ratios[r.key] ?? 0,
    used: snapshot.usage[r.key] ?? 0,
    limit: snapshot.limits[r.key] ?? 0,
  }))
    .filter((q) => q.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);
}

export function QuotaWidget() {
  const { data, isLoading } = useMyQuotas();
  const snap = data?.data;
  if (isLoading || !snap) return null;

  const top = topThreeQuotas(snap);
  if (top.length === 0) return null;

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <h3
          style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Plan utilisation
        </h3>
        <Badge variant="info">{snap.plan}</Badge>
      </div>
      <div data-testid="quota-widget-list">
        {top.map((q) => (
          <div
            key={q.key}
            data-testid={`quota-widget-row-${q.key}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border-primary)',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>{q.label}</span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                {q.used} / {q.limit}
              </span>
              <Badge variant={variantFor(q.ratio)}>{formatPct(q.ratio)}</Badge>
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
        <Link
          to="/billing/manage"
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-tertiary)',
            textDecoration: 'none',
          }}
        >
          Need more headroom? Upgrade your plan →
        </Link>
      </div>
    </Card>
  );
}
