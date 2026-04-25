import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useEmission, type EmissionEntry } from '../../../hooks/useEmissions';

/**
 * AAT-WORKFLOW (Wave 9a): read-only detail view for a single emission
 * record. Replaces the previous dead-end where the EmissionsPage View
 * button navigated to a 404'd route.
 *
 * Renders the top-level columns (period, scope, category, source, value,
 * status) and any extra fields stashed in `metadata` (emission factor,
 * raw activity value, data quality, notes).
 */

const SCOPE_LABEL: Record<string, string> = {
  SCOPE_1: 'Scope 1 — Direct',
  SCOPE_2: 'Scope 2 — Energy',
  SCOPE_3: 'Scope 3 — Value Chain',
};

function formatPeriod(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(s)} → ${fmt(e)}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function categoryLabel(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function statusBadgeVariant(status: string): 'neutral' | 'warning' | 'success' | 'error' {
  const map: Record<string, 'neutral' | 'warning' | 'success' | 'error'> = {
    DRAFT: 'neutral',
    PENDING: 'warning',
    VERIFIED: 'success',
    REJECTED: 'error',
  };
  return map[status] || 'neutral';
}

function getMetadataString(meta: EmissionEntry['metadata'], key: string): string | null {
  if (!meta) return null;
  const v = (meta as Record<string, unknown>)[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.25rem',
};

const valueStyle: React.CSSProperties = {
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
};

export function EmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useEmission(id);

  const record = data?.data;
  const canEdit =
    record && (record.status === 'DRAFT' || record.status === 'REJECTED');

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <button
            onClick={() => navigate('/emissions')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '0.8125rem',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              marginBottom: '0.5rem',
            }}
          >
            ← Back to inventory
          </button>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.25rem',
            }}
          >
            Emission Record
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            View the recorded greenhouse gas activity, calculation inputs, and review status.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate(`/emissions/${id}/edit`)}>Edit Entry</Button>
        )}
      </div>

      {isLoading && (
        <Card padding="lg">
          <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</p>
        </Card>
      )}

      {isError && (
        <Card padding="lg">
          <div style={{ textAlign: 'center', color: '#dc2626' }}>
            <p style={{ fontWeight: 600 }}>Failed to load this entry</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              {(error as Error)?.message ?? 'Please try again.'}
            </p>
          </div>
        </Card>
      )}

      {record && (
        <Card padding="lg">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.25rem',
            }}
          >
            <Field label="Source">
              <span style={valueStyle}>{record.source}</span>
              <span
                style={{ display: 'block', marginTop: '0.125rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}
              >
                {categoryLabel(record.category)}
              </span>
            </Field>

            <Field label="Scope">
              <Badge variant="info">
                {SCOPE_LABEL[record.scope] ?? record.scope}
              </Badge>
            </Field>

            <Field label="Status">
              <Badge variant={statusBadgeVariant(record.status)}>
                {record.status.charAt(0) + record.status.slice(1).toLowerCase()}
              </Badge>
            </Field>

            <Field label="Period">
              <span style={valueStyle}>{formatPeriod(record.periodStart, record.periodEnd)}</span>
            </Field>

            <Field label="CO2e">
              <span style={{ ...valueStyle, fontVariantNumeric: 'tabular-nums' }}>
                {Number(record.value).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.8125rem' }}>
                  {record.unit}
                </span>
              </span>
            </Field>

            {getMetadataString(record.metadata, 'emissionFactor') && (
              <Field label="Emission Factor">
                <span style={{ ...valueStyle, fontVariantNumeric: 'tabular-nums' }}>
                  {getMetadataString(record.metadata, 'emissionFactor')}
                </span>
              </Field>
            )}

            {getMetadataString(record.metadata, 'activityValue') && (
              <Field label="Activity Value">
                <span style={{ ...valueStyle, fontVariantNumeric: 'tabular-nums' }}>
                  {getMetadataString(record.metadata, 'activityValue')}{' '}
                  {getMetadataString(record.metadata, 'activityUnit') && (
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.8125rem' }}>
                      {getMetadataString(record.metadata, 'activityUnit')}
                    </span>
                  )}
                </span>
              </Field>
            )}

            {getMetadataString(record.metadata, 'dataQuality') && (
              <Field label="Data Quality">
                <span style={{ ...valueStyle, textTransform: 'capitalize' }}>
                  {getMetadataString(record.metadata, 'dataQuality')}
                </span>
              </Field>
            )}
          </div>

          {getMetadataString(record.metadata, 'notes') && (
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-primary)' }}>
              <span style={labelStyle}>Notes</span>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {getMetadataString(record.metadata, 'notes')}
              </p>
            </div>
          )}

          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-primary)',
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <span>Created {new Date(record.createdAt).toLocaleString()}</span>
            <span>·</span>
            <span>Updated {new Date(record.updatedAt).toLocaleString()}</span>
            <span>·</span>
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              ID {record.id.slice(0, 8)}…
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
