import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useReports,
  Report,
  ReportStatus,
  downloadReportUrl,
  REPORT_DOWNLOAD_FORMATS,
  type ReportDownloadFormat,
} from '../../hooks/useReports';
import { useToast } from '../../contexts/ToastContext';

/* ============================================
   Report Type Definitions
   ============================================ */

const reportTypes = [
  {
    key: 'ghg',
    name: 'GHG Protocol',
    desc: 'Greenhouse gas inventory report',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8C17 10.76 14.76 13 12 13C9.24 13 7 10.76 7 8" />
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      </svg>
    ),
    color: '#1a5d3d',
  },
  {
    key: 'tcfd',
    name: 'TCFD',
    desc: 'Task Force on Climate Disclosures',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    color: '#10b981',
  },
  {
    key: 'cdp',
    name: 'CDP',
    desc: 'Carbon Disclosure Project submission',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    color: '#14b8a6',
  },
  {
    key: 'custom',
    name: 'Custom',
    desc: 'Custom emissions report',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    color: '#8b5cf6',
  },
];

/* ============================================
   Status helpers
   ============================================ */

function statusBadgeVariant(status: ReportStatus): 'neutral' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'QUEUED': return 'neutral';
    case 'GENERATING': return 'warning';
    case 'COMPLETED': return 'success';
    case 'FAILED': return 'error';
    default: return 'neutral';
  }
}

function statusLabel(status: ReportStatus): string {
  switch (status) {
    case 'QUEUED': return 'Queued';
    case 'GENERATING': return 'Generating';
    case 'COMPLETED': return 'Completed';
    case 'FAILED': return 'Failed';
    default: return status;
  }
}

function describeReport(r: Report): string {
  if (!r.parameters) return r.type.toUpperCase();
  const { year, scopes } = r.parameters;
  const scopeLabel = scopes?.length
    ? scopes.map((s) => s.replace('SCOPE_', 'S')).join('·')
    : 'all scopes';
  return `${r.type.toUpperCase()} — ${year} (${scopeLabel})`;
}

/* ============================================
   Page Component
   ============================================ */

export function ReportsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, isError } = useReports();
  const reports: Report[] = data?.data ?? [];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // AAT-10C (Wave 10c): per-row format selection. JSON is the default
  // so the existing one-click flow stays unchanged for users who don't
  // touch the dropdown.
  const [downloadFormat, setDownloadFormat] = useState<ReportDownloadFormat>('json');

  const paginatedReports = reports.slice((page - 1) * pageSize, page * pageSize);

  // AAT-10C: HEAD-check the URL before opening it so server errors
  // (e.g. unsupported format, report-not-COMPLETED) surface as toasts
  // rather than silently opening a tab with an RFC 7807 problem JSON.
  async function handleDownload(reportId: string): Promise<void> {
    const url = downloadReportUrl(reportId, downloadFormat);
    try {
      const token = localStorage.getItem('aurex_token');
      const head = await fetch(url, {
        method: 'HEAD',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!head.ok) {
        toast.error(
          `Download failed (HTTP ${head.status}). Please try again or contact support.`,
        );
        return;
      }
      // Browsers don't pass Authorization on a plain anchor / window.open,
      // so we fetch the body, blob it, and trigger an in-page download.
      const dl = await fetch(url, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!dl.ok) {
        toast.error(`Download failed (HTTP ${dl.status}).`);
        return;
      }
      const blob = await dl.blob();
      const cd = dl.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(cd);
      const filename =
        match?.[1] ?? `report-${reportId}.${downloadFormat}`;
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
      toast.error(`Report download failed: ${msg}`);
    }
  }

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
      }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Reports
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            Generate compliance reports, disclosures, and analytics across all supported frameworks.
          </p>
        </div>
        <Button onClick={() => navigate('/reports/build/ghg')}>
          Generate Report
        </Button>
      </div>

      {/* Report Types Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1rem',
        marginBottom: '2.5rem',
      }}>
        {reportTypes.map((rt) => (
          <Card key={rt.key} padding="lg" hover>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
              <div style={{
                width: '2.75rem',
                height: '2.75rem',
                borderRadius: '0.625rem',
                backgroundColor: `${rt.color}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: rt.color,
                flexShrink: 0,
              }}>
                {rt.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {rt.name}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {rt.desc}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/reports/build/${rt.key}`)}
                style={{ alignSelf: 'flex-start' }}
              >
                Generate
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Reports */}
      <Card padding="lg">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
          Recent Reports
        </h3>

        {isLoading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
            Loading reports...
          </div>
        )}

        {isError && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-error)', fontSize: '0.875rem' }}>
            Failed to load reports. Please try again later.
          </div>
        )}

        {!isLoading && !isError && reports.length === 0 && (
          <EmptyState
            title="No reports yet"
            description="Generate your first report by selecting a framework above."
            action={{ label: 'Generate Report', onClick: () => navigate('/reports/build/ghg') }}
          />
        )}

        {!isLoading && !isError && reports.length > 0 && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    {['Report', 'Type', 'Status', 'Created', ''].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left',
                        padding: '0.75rem 1rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedReports.map((r, i) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: i < paginatedReports.length - 1 ? '1px solid var(--border-primary)' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {describeReport(r)}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <Badge variant="neutral">{r.type}</Badge>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <Badge variant={statusBadgeVariant(r.status)}>
                          {statusLabel(r.status)}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                        {r.status === 'COMPLETED' && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              justifyContent: 'flex-end',
                            }}
                          >
                            {/* AAT-10C: format dropdown defaults to JSON. */}
                            <select
                              aria-label="Download format"
                              value={downloadFormat}
                              onChange={(e) =>
                                setDownloadFormat(
                                  e.target.value as ReportDownloadFormat,
                                )
                              }
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.375rem',
                                border: '1px solid var(--border-primary)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {REPORT_DOWNLOAD_FORMATS.map((f) => (
                                <option key={f} value={f}>
                                  {f.toUpperCase()}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              style={{ color: '#10b981' }}
                              onClick={() => void handleDownload(r.id)}
                            >
                              Download
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reports.length > pageSize && (
              <div style={{ marginTop: '1rem' }}>
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={reports.length}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
