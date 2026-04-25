/**
 * AAT-10B / Wave 10b: invoice list page.
 *
 * Mounted at `/billing/invoices`. Reads `useInvoices()` (which proxies to
 * GET /api/v1/billing/invoices) and renders a status-filterable +
 * date-filterable table. Each row's "Download" button opens
 * GET /api/v1/billing/invoices/:id/download in a new tab — the backend
 * sends `Content-Disposition: attachment` so the browser saves the file
 * (currently invoice JSON; PDF is a follow-up).
 */
import { useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useInvoices, type Invoice, type InvoiceStatus } from '../../../hooks/useBilling';

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrencyMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  if (currency === 'INR') {
    return `₹${major.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === 'USD') {
    return `$${major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function statusBadgeVariant(s: InvoiceStatus): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (s) {
    case 'PAID':
      return 'success';
    case 'ISSUED':
      return 'info';
    case 'DRAFT':
      return 'warning';
    case 'REFUNDED':
      return 'neutral';
    case 'CANCELLED':
      return 'error';
    default:
      return 'neutral';
  }
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PAID', label: 'Paid' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// Trigger the browser download in a new tab so the auth header is sent via
// the same-origin cookie / token. We can't use a plain <a download> here
// because the API requires the Authorization header on every request — so
// we fetch the file with auth and instantiate a Blob URL on the fly.
async function downloadInvoice(id: string): Promise<void> {
  const token = localStorage.getItem('aurex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api/v1/billing/invoices/${id}/download`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `${id}.json`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ── Page ─────────────────────────────────────────────────────────────────

export function InvoicesPage() {
  const { data, isLoading, error } = useInvoices();
  const invoices = useMemo<Invoice[]>(() => data?.data ?? [], [data]);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      const issued = inv.issuedAt ? new Date(inv.issuedAt) : new Date(inv.createdAt);
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (issued < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        // include the whole day
        to.setHours(23, 59, 59, 999);
        if (issued > to) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, dateFrom, dateTo]);

  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Invoices
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Download paid invoices and review billing history.
        </p>
      </div>

      <Card padding="md" style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >
          <Select
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </Card>

      <Card padding="none">
        {isLoading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            Loading invoices…
          </div>
        )}
        {error && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
            Failed to load invoices.
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && invoices.length === 0 && (
          <EmptyState
            title="No invoices yet"
            description="Your first invoice will appear after your first payment."
          />
        )}
        {!isLoading && !error && filtered.length === 0 && invoices.length > 0 && (
          <EmptyState
            title="No invoices match these filters"
            description="Try widening the date range or clearing the status filter."
          />
        )}
        {!isLoading && filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {['Invoice', 'Period', 'Status', 'Total', 'Issued', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '0.875rem 1rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, i) => (
                  <tr
                    key={inv.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border-primary)' : 'none',
                    }}
                  >
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                      {/*
                       * Period is approximated by the issuedAt month for the
                       * MVP table — a true period range is on the
                       * Subscription, not the Invoice. We surface the issue
                       * month so operators can pivot without a join.
                       */}
                      {formatDate(inv.issuedAt)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <Badge variant={statusBadgeVariant(inv.status)}>{inv.status}</Badge>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatCurrencyMinor(inv.totalMinor, inv.currency)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                      {formatDate(inv.issuedAt)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void downloadInvoice(inv.id).catch((e) => {
                            // Surface a console error rather than swallowing — the
                            // toast context isn't easily reachable from this row
                            // without a prop drill, and the download endpoint
                            // returns clean status codes the browser will surface.
                            console.error('Invoice download failed', e);
                          });
                        }}
                        aria-label={`Download invoice ${inv.invoiceNumber}`}
                      >
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
