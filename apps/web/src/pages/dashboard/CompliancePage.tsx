import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const obligations = [
  { framework: 'CSRD / ESRS', dueDate: '2026-05-30', owner: 'Investor Reporting', status: 'on_track' },
  { framework: 'GHG Protocol Annual Filing', dueDate: '2026-06-15', owner: 'Sustainability Office', status: 'at_risk' },
  { framework: 'TCFD Board Review', dueDate: '2026-07-10', owner: 'Executive Office', status: 'on_track' },
  { framework: 'SEBI BRSR Core', dueDate: '2026-05-12', owner: 'Compliance Team', status: 'pending_review' },
];

export function CompliancePage() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Compliance Center</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Track obligations, deadlines, and disclosure readiness across frameworks.</p>
        </div>
        <Button variant="outline">Export Calendar</Button>
      </div>

      <Card padding="none">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Framework', 'Due Date', 'Owner', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {obligations.map((item, i) => (
                <tr key={item.framework} style={{ borderBottom: i < obligations.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.framework}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{item.dueDate}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>{item.owner}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <Badge variant={item.status === 'on_track' ? 'success' : item.status === 'at_risk' ? 'warning' : 'info'}>
                      {item.status === 'on_track' ? 'On Track' : item.status === 'at_risk' ? 'At Risk' : 'Review Pending'}
                    </Badge>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}><Button size="sm" variant="ghost">Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
