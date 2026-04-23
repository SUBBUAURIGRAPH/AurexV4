import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const reportTypes = [
  {
    name: 'GHG Protocol Report',
    desc: 'Comprehensive greenhouse gas inventory following the GHG Protocol Corporate Standard. Covers Scopes 1, 2, and 3 with all required disclosures.',
    framework: 'GHG Protocol',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    color: '#1a5d3d',
  },
  {
    name: 'TCFD Disclosure',
    desc: 'Task Force on Climate-related Financial Disclosures report covering governance, strategy, risk management, and metrics & targets.',
    framework: 'TCFD',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    color: '#10b981',
  },
  {
    name: 'CDP Climate Response',
    desc: 'Auto-populated CDP climate change questionnaire response covering governance, risks, emissions data, targets, and verification.',
    framework: 'CDP',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
    color: '#14b8a6',
  },
  {
    name: 'CSRD / ESRS Report',
    desc: 'EU Corporate Sustainability Reporting Directive output with European Sustainability Reporting Standards (ESRS) E1 climate metrics.',
    framework: 'CSRD',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: '#22755a',
  },
  {
    name: 'SEC Climate Disclosure',
    desc: 'US Securities and Exchange Commission climate-related disclosure aligned with final rules for registrants.',
    framework: 'SEC',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    color: '#3b82f6',
  },
  {
    name: 'Custom Analytics Report',
    desc: 'Build a custom report with selected metrics, date ranges, and comparison periods. Export to PDF, Excel, or API integration.',
    framework: 'Custom',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    color: '#8b5cf6',
  },
];

const recentReports = [
  { name: 'Q3 2025 GHG Inventory', framework: 'GHG Protocol', date: '2025-10-15', status: 'completed' },
  { name: 'CDP Climate 2025 Response', framework: 'CDP', date: '2025-07-31', status: 'completed' },
  { name: 'Annual TCFD Disclosure FY2024', framework: 'TCFD', date: '2025-03-30', status: 'completed' },
  { name: 'Q4 2025 GHG Inventory', framework: 'GHG Protocol', date: '2025-12-18', status: 'in_progress' },
];

export function ReportsPage() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Reporting Center
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Generate compliance reports, disclosures, and analytics across all supported frameworks.
        </p>
      </div>

      {/* Report Types Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem',
        marginBottom: '2.5rem',
      }}>
        {reportTypes.map((rt) => (
          <Card key={rt.name} padding="lg" hover>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{
                width: '2.75rem', height: '2.75rem', borderRadius: '0.625rem',
                backgroundColor: `${rt.color}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: rt.color, flexShrink: 0,
              }}>
                {rt.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rt.name}</h3>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                  {rt.desc}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="neutral">{rt.framework}</Badge>
                  <Button size="sm" variant="outline" style={{ marginLeft: 'auto' }}>
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Reports */}
      <Card padding="lg">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
          Recent Reports
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Report Name', 'Framework', 'Date', 'Status', ''].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '0.75rem 1rem',
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentReports.map((r, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: i < recentReports.length - 1 ? '1px solid var(--border-primary)' : 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 500, color: 'var(--text-primary)' }}>{r.name}</td>
                  <td style={{ padding: '0.875rem 1rem' }}><Badge variant="neutral">{r.framework}</Badge></td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{r.date}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <Badge variant={r.status === 'completed' ? 'success' : 'warning'}>
                      {r.status === 'completed' ? 'Completed' : 'In Progress'}
                    </Badge>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <Button size="sm" variant="ghost" style={{ color: '#10b981' }}>
                      {r.status === 'completed' ? 'Download' : 'View'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
