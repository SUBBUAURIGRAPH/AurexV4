/**
 * AAT-378 / AV4-378 — Admin tier quota dashboard.
 *
 * Lists every active org with utilisation across the seven tracked
 * resources and surfaces per-org detail in a modal. Default view shows
 * only orgs whose top-utilisation is >= 80% so operators can triage
 * tier-pressure quickly; an "Include all orgs" toggle widens the view.
 *
 * Mounted at /admin/quotas — guarded by the same RoleGuard wrapping
 * the rest of the admin section in App.tsx.
 */
import { useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { Table } from '../../../components/ui/Table';
import type { TableColumn } from '../../../components/ui/Table';
import {
  QUOTA_RESOURCES,
  useAdminOrgQuotas,
  useAdminQuotasList,
  type AdminQuotaListItem,
  type QuotaResourceKey,
} from '../../../hooks/useQuotas';

function formatPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${Math.round(ratio * 100)}%`;
}

/** Returns a color hint for a single utilisation ratio. */
function ratioVariant(ratio: number): 'success' | 'warning' | 'error' | 'neutral' {
  if (!Number.isFinite(ratio) || ratio === 0) return 'neutral';
  if (ratio >= 1) return 'error';
  if (ratio >= 0.8) return 'warning';
  return 'success';
}

interface QuotaBarProps {
  ratio: number;
  used: number;
  limit: number;
  label: string;
}

function QuotaBar({ ratio, used, limit, label }: QuotaBarProps) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const variant = ratioVariant(ratio);
  const colors: Record<typeof variant, string> = {
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    neutral: 'var(--text-tertiary)',
  };
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.8125rem',
          marginBottom: '0.25rem',
          color: 'var(--text-secondary)',
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {used} / {limit} ({formatPct(ratio)})
        </span>
      </div>
      <div
        style={{
          height: '6px',
          width: '100%',
          background: 'var(--bg-tertiary)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          data-testid={`quota-bar-${label}`}
          style={{
            width: `${clamped * 100}%`,
            height: '100%',
            background: colors[variant],
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </div>
  );
}

interface DetailModalProps {
  orgId: string;
  orgName: string;
  isOpen: boolean;
  onClose: () => void;
}

function DetailModal({ orgId, orgName, isOpen, onClose }: DetailModalProps) {
  const { data, isLoading } = useAdminOrgQuotas(isOpen ? orgId : undefined);
  const snap = data?.data;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Quota — ${orgName}`}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {isLoading || !snap ? (
        <p style={{ color: 'var(--text-tertiary)' }}>Loading utilisation…</p>
      ) : (
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Plan: <Badge variant="info">{snap.plan}</Badge>
          </div>
          {QUOTA_RESOURCES.map((r) => (
            <QuotaBar
              key={r.key}
              label={r.label}
              ratio={snap.ratios[r.key] ?? 0}
              used={snap.usage[r.key] ?? 0}
              limit={snap.limits[r.key] ?? 0}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

export function QuotasPage() {
  const [showAll, setShowAll] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data, isLoading } = useAdminQuotasList({ all: showAll, threshold: 0.8 });
  const rows: AdminQuotaListItem[] = data?.data ?? [];

  const columns: TableColumn<AdminQuotaListItem>[] = useMemo(
    () => [
      {
        key: 'orgName',
        label: 'Organization',
        render: (_v, row) => (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {row.orgName ?? '(unnamed)'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {row.orgSlug ?? row.orgId}
            </div>
          </div>
        ),
      },
      {
        key: 'plan',
        label: 'Plan',
        render: (_v, row) => <Badge variant="neutral">{row.plan}</Badge>,
      },
      ...QUOTA_RESOURCES.slice(0, 5).map<TableColumn<AdminQuotaListItem>>((r) => ({
        key: r.key,
        label: r.label,
        render: (_v, row) => {
          const ratio = row.ratios[r.key as QuotaResourceKey] ?? 0;
          const variant = ratioVariant(ratio);
          return (
            <Badge variant={variant === 'neutral' ? 'neutral' : variant}>
              {formatPct(ratio)}
            </Badge>
          );
        },
      })),
      {
        key: 'actions',
        label: 'Detail',
        render: (_v, row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelectedOrg({ id: row.orgId, name: row.orgName ?? row.orgSlug ?? row.orgId })
            }
          >
            View detail
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Tier Quotas
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Per-org utilisation against the configured tier quotas. Defaults to orgs at &gt;= 80% on
            any resource.
          </p>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}
        >
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Include all orgs
        </label>
      </div>

      <Card padding="none">
        {!isLoading && rows.length === 0 ? (
          <EmptyState
            title="Nothing to flag"
            description={
              showAll
                ? 'No active organizations to display.'
                : 'No organization is currently above the 80% utilisation threshold.'
            }
          />
        ) : (
          <Table columns={columns} data={rows} loading={isLoading} />
        )}
      </Card>

      {selectedOrg && (
        <DetailModal
          orgId={selectedOrg.id}
          orgName={selectedOrg.name}
          isOpen={selectedOrg !== null}
          onClose={() => setSelectedOrg(null)}
        />
      )}
    </div>
  );
}
