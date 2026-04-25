import { useState } from 'react';
import { useAuditLogs, type AuditLogEntry } from '../../hooks/useAuditLogs';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import type { TableColumn } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../contexts/ToastContext';
import {
  buildAuditCsvUrl,
  type AuditCsvFilters,
} from '../../hooks/useAuditCsvExport';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Match the ISO-ish look of the previous scaffold (YYYY-MM-DD HH:mm UTC)
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function AuditLogsPage() {
  const toast = useToast();
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError } = useAuditLogs({
    action: actionFilter || undefined,
    resource: resourceFilter || undefined,
    userId: userIdFilter || undefined,
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    page,
    pageSize,
  });

  const rows = data?.data ?? [];
  const total = data?.pagination.total ?? 0;

  // AAT-10A (Wave 10a): wire the CSV export. We HEAD the endpoint first
  // so the row-cap 413 surfaces as a toast rather than a blank tab; on
  // success we open the same URL in a new tab and the browser triggers
  // the download via the Content-Disposition header.
  const exportFilters: AuditCsvFilters = {
    action: actionFilter || undefined,
    resource: resourceFilter || undefined,
    userId: userIdFilter || undefined,
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
  };
  const csvUrl = buildAuditCsvUrl(exportFilters);

  async function handleExportCsv(): Promise<void> {
    if (exporting) return;
    setExporting(true);
    try {
      const token = localStorage.getItem('aurex_token');
      const res = await fetch(csvUrl, {
        method: 'HEAD',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 413) {
        toast.error(
          'Too many rows — narrow your filters and try again. CSV export caps at 10,000 rows.',
        );
        return;
      }
      if (!res.ok) {
        toast.error(
          `Export failed (HTTP ${res.status}). Please try again or contact support.`,
        );
        return;
      }
      // Browsers don't pass Authorization on a plain anchor / window.open,
      // so we fetch the body, blob it, and trigger an in-page download.
      const dl = await fetch(csvUrl, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!dl.ok) {
        toast.error(`Export failed (HTTP ${dl.status}).`);
        return;
      }
      const blob = await dl.blob();
      const cd = dl.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `audit-logs-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      toast.error(`CSV export failed: ${msg}`);
    } finally {
      setExporting(false);
    }
  }

  const columns: TableColumn<AuditLogEntry>[] = [
    {
      key: 'createdAt',
      label: 'Timestamp',
      render: (_v, row) => (
        <span
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.8125rem',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {formatTimestamp(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'userEmail',
      label: 'User',
      render: (_v, row) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {row.userEmail ?? (row.userId ? row.userId : 'system')}
          </div>
          {row.userEmail && row.userId ? (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
                marginTop: '0.125rem',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              }}
            >
              {row.userId.slice(0, 8)}…
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (_v, row) => (
        <code
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-primary)',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          }}
        >
          {row.action}
        </code>
      ),
    },
    {
      key: 'resource',
      label: 'Resource',
      render: (_v, row) => (
        <span style={{ color: 'var(--text-secondary)' }}>{row.resource}</span>
      ),
    },
    {
      key: 'resourceId',
      label: 'Resource ID',
      render: (_v, row) =>
        row.resourceId ? (
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}
          >
            {row.resourceId.slice(0, 8)}…
          </span>
        ) : (
          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
        ),
    },
    {
      key: 'ipAddress',
      label: 'IP',
      render: (_v, row) => (
        <span
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-tertiary)',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          }}
        >
          {row.ipAddress ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto' }}>
      <div
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Audit Logs
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-tertiary)',
              marginTop: '0.25rem',
            }}
          >
            Immutable trace of platform and governance actions.
          </p>
        </div>
        {/*
          AAT-10A (Wave 10a): live CSV export. The API streams a CSV file
          with `Content-Disposition: attachment` (mirrors the report
          download pattern). Pre-flighted via HEAD so the 10k row-cap
          surfaces as a toast rather than a blank tab.
        */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.25rem',
          }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            loading={exporting}
            disabled={exporting || rows.length === 0}
            title={
              rows.length === 0
                ? 'No matching audit entries to export'
                : 'Download the current filtered view as CSV'
            }
          >
            Export CSV
          </Button>
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-tertiary)',
            }}
          >
            CSV export caps at 10,000 rows
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <Card padding="sm" style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <Input
            label="Action"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. user.update"
          />
          <Input
            label="Resource"
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. User"
          />
          <Input
            label="User ID"
            value={userIdFilter}
            onChange={(e) => {
              setUserIdFilter(e.target.value);
              setPage(1);
            }}
            placeholder="uuid"
          />
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        {isError ? (
          <EmptyState
            title="Failed to load audit logs"
            description="An error occurred while fetching audit entries. Please try again."
            action={{ label: 'Retry', onClick: () => window.location.reload() }}
          />
        ) : !isLoading && rows.length === 0 ? (
          <EmptyState
            title="No audit entries found"
            description="Try adjusting your filters or widen the date range."
          />
        ) : (
          <>
            <Table columns={columns} data={rows} loading={isLoading} />
            {total > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
