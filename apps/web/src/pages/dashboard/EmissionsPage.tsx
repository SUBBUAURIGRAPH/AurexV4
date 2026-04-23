import { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { Table, TableColumn } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useEmissions,
  useUpdateEmissionStatus,
  EmissionEntry,
  EmissionStatus,
} from '../../hooks/useEmissions';
import type { Scope } from '../../hooks/useBaselines';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

/* ─── Helpers ─── */

function formatPeriod(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return `${fmt(s)} - ${fmt(e)}`;
  } catch {
    return `${start} - ${end}`;
  }
}

function scopeLabel(scope: string): string {
  const map: Record<string, string> = {
    SCOPE_1: 'Scope 1',
    SCOPE_2: 'Scope 2',
    SCOPE_3: 'Scope 3',
  };
  return map[scope] || scope;
}

function scopeBadgeVariant(scope: string): 'info' | 'warning' | 'success' {
  const map: Record<string, 'info' | 'warning' | 'success'> = {
    SCOPE_1: 'info',
    SCOPE_2: 'warning',
    SCOPE_3: 'success',
  };
  return map[scope] || 'info';
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

function getActivityValue(metadata: EmissionEntry['metadata']): number | null {
  if (!metadata) return null;
  const raw = (metadata as Record<string, unknown>).activityValue;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getActivityUnit(metadata: EmissionEntry['metadata'], fallback: string): string {
  if (!metadata) return fallback;
  const raw = (metadata as Record<string, unknown>).activityUnit;
  return typeof raw === 'string' && raw ? raw : fallback;
}

function categoryLabel(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/* ─── Status filter options ─── */

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
];

/* ─── Component ─── */

export function EmissionsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isManagerOrAbove = user?.role === 'administrator' || user?.role === 'manager';

  /* Filters */
  const [scopeFilter, setScopeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* API */
  const { data: response, isLoading, isError, error } = useEmissions({
    scope: scopeFilter ? (scopeFilter as Scope) : undefined,
    status: statusFilter ? (statusFilter as EmissionStatus) : undefined,
    page,
    pageSize,
  });

  const updateStatus = useUpdateEmissionStatus();

  const emissions = response?.data ?? [];
  const total = response?.total ?? 0;

  /* Scope counts (from current page data — ideally API provides these) */
  const scopeCounts = useMemo(() => {
    const counts = { all: total, SCOPE_1: 0, SCOPE_2: 0, SCOPE_3: 0 };
    emissions.forEach((e) => {
      if (e.scope === 'SCOPE_1') counts.SCOPE_1++;
      else if (e.scope === 'SCOPE_2') counts.SCOPE_2++;
      else if (e.scope === 'SCOPE_3') counts.SCOPE_3++;
    });
    return counts;
  }, [emissions, total]);

  const scopeTabs = useMemo(
    () => [
      { key: '', label: 'All', count: scopeCounts.all },
      { key: 'SCOPE_1', label: 'Scope 1', count: scopeCounts.SCOPE_1 },
      { key: 'SCOPE_2', label: 'Scope 2', count: scopeCounts.SCOPE_2 },
      { key: 'SCOPE_3', label: 'Scope 3', count: scopeCounts.SCOPE_3 },
    ],
    [scopeCounts],
  );

  /* Selection */
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === emissions.length && emissions.length > 0) {
        return new Set();
      }
      return new Set(emissions.map((e) => e.id));
    });
  }, [emissions]);

  /* Bulk actions */
  const handleBulkStatus = useCallback(
    async (status: 'VERIFIED' | 'REJECTED') => {
      const ids = Array.from(selectedIds);
      try {
        await Promise.all(ids.map((id) => updateStatus.mutateAsync({ id, status })));
        toast.success(`${ids.length} item(s) ${status === 'VERIFIED' ? 'approved' : 'rejected'} successfully`);
        setSelectedIds(new Set());
      } catch {
        toast.error(`Failed to update status. Please try again.`);
      }
    },
    [selectedIds, updateStatus, toast],
  );

  /* Single action */
  const handleSingleStatus = useCallback(
    async (id: string, status: 'VERIFIED' | 'REJECTED') => {
      try {
        await updateStatus.mutateAsync({ id, status });
        toast.success(`Entry ${status === 'VERIFIED' ? 'approved' : 'rejected'} successfully`);
      } catch {
        toast.error('Failed to update status.');
      }
    },
    [updateStatus, toast],
  );

  /* Reset page on filter change */
  const handleScopeChange = useCallback((key: string) => {
    setScopeFilter(key);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleStatusChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  /* ─── Table Columns ─── */

  const columns: TableColumn<EmissionEntry>[] = useMemo(() => {
    const cols: TableColumn<EmissionEntry>[] = [
      {
        key: '_select',
        label: '',
        render: (_val, row) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={() => toggleSelect(row.id)}
            style={{ cursor: 'pointer', width: '1rem', height: '1rem', accentColor: '#1a5d3d' }}
          />
        ),
      },
      {
        key: 'period',
        label: 'Period',
        render: (_val, row) => (
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            {formatPeriod(row.periodStart, row.periodEnd)}
          </span>
        ),
      },
      {
        key: 'source',
        label: 'Source',
        render: (_val, row) => (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.source}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>
              {categoryLabel(row.category)}
            </div>
          </div>
        ),
      },
      {
        key: 'scope',
        label: 'Scope',
        render: (_val, row) => (
          <Badge
            variant={scopeBadgeVariant(row.scope)}
            style={{ fontSize: '0.6875rem' }}
          >
            {scopeLabel(row.scope)}
          </Badge>
        ),
      },
      {
        key: 'activity',
        label: 'Activity Data',
        render: (_val, row) => {
          const activity = getActivityValue(row.metadata);
          const activityUnit = getActivityUnit(row.metadata, row.unit);
          if (activity === null) {
            return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
          }
          return (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {activity.toLocaleString()}{' '}
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{activityUnit}</span>
            </span>
          );
        },
      },
      {
        key: 'value',
        label: 'CO2e',
        render: (_val, row) => (
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {Number(row.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{row.unit}</span>
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (_val, row) => (
          <Badge variant={statusBadgeVariant(row.status)}>
            {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
          </Badge>
        ),
      },
      {
        key: '_actions',
        label: 'Actions',
        render: (_val, row) => {
          const canEdit = row.status === 'DRAFT' || row.status === 'REJECTED';
          return (
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'nowrap' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/emissions/${row.id}`)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              >
                View
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/emissions/${row.id}/edit`)}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  Edit
                </Button>
              )}
              {isManagerOrAbove && row.status === 'PENDING' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSingleStatus(row.id, 'VERIFIED')}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#16a34a' }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSingleStatus(row.id, 'REJECTED')}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc2626' }}
                  >
                    Reject
                  </Button>
                </>
              )}
            </div>
          );
        },
      },
    ];
    return cols;
  }, [selectedIds, toggleSelect, navigate, isManagerOrAbove, handleSingleStatus]);

  /* ─── Render ─── */

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Emissions Inventory
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            Track and manage greenhouse gas emissions across all scopes.
          </p>
        </div>
        <Link to="/emissions/new" style={{ textDecoration: 'none' }}>
          <Button
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            Add Entry
          </Button>
        </Link>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.25rem' }}>
        <Tabs
          tabs={scopeTabs}
          activeTab={scopeFilter}
          onTabChange={handleScopeChange}
        />
        <div style={{ minWidth: '180px', marginBottom: '1.5rem' }}>
          <Select
            value={statusFilter}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1.25rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(26, 93, 61, 0.06)',
          border: '1px solid rgba(26, 93, 61, 0.15)',
          borderRadius: '0.625rem',
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1a5d3d' }}>
            {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          {isManagerOrAbove && (
            <>
              <Button
                size="sm"
                variant="primary"
                loading={updateStatus.isPending}
                onClick={() => handleBulkStatus('VERIFIED')}
              >
                Approve Selected
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={updateStatus.isPending}
                onClick={() => handleBulkStatus('REJECTED')}
              >
                Reject Selected
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <Card padding="md" style={{ marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center', color: '#dc2626', padding: '1rem' }}>
            <p style={{ fontWeight: 600 }}>Failed to load emissions data</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              {(error as Error)?.message || 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
        </Card>
      )}

      {/* Table */}
      {!isError && (
        <Card padding="none">
          {!isLoading && emissions.length === 0 ? (
            <EmptyState
              title="No emissions recorded yet"
              description="Start tracking your greenhouse gas emissions by adding your first entry."
              action={{ label: 'Add Entry', onClick: () => navigate('/emissions/new') }}
            />
          ) : (
            <>
              {/* Select-all header checkbox */}
              {!isLoading && emissions.length > 0 && (
                <div style={{
                  padding: '0.5rem 1.25rem',
                  borderBottom: '1px solid var(--border-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === emissions.length && emissions.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: '1rem', height: '1rem', accentColor: '#1a5d3d' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Select all on this page
                  </span>
                </div>
              )}
              <Table<EmissionEntry>
                columns={columns}
                data={emissions}
                loading={isLoading}
              />
              {!isLoading && total > 0 && (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
