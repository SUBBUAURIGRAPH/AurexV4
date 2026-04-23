import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const auditRows = [
  { actor: 'nina.rao@aurex.in', action: 'Updated Scope 2 factors', target: 'Emission Model', time: '2026-04-23 08:42 UTC', result: 'success' },
  { actor: 'arjun.patel@aurex.in', action: 'Submitted Q1 disclosure pack', target: 'CSRD Workflow', time: '2026-04-23 07:18 UTC', result: 'success' },
  { actor: 'system', action: 'Failed sync retry exhausted', target: 'ServiceNow Connector', time: '2026-04-23 06:55 UTC', result: 'warning' },
  { actor: 'mia.chen@aurex.in', action: 'Changed role from Viewer to Editor', target: 'Team: Procurement', time: '2026-04-22 19:32 UTC', result: 'info' },
];

export function AuditLogsPage() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Audit Logs</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Immutable trace of key platform and governance actions.</p>
      </div>

      <Card padding="none">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Actor', 'Action', 'Target', 'Timestamp', 'Result'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditRows.map((row, i) => (
                <tr key={`${row.actor}-${row.time}`} style={{ borderBottom: i < auditRows.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{row.actor}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>{row.action}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>{row.target}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{row.time}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <Badge variant={row.result === 'success' ? 'success' : row.result === 'warning' ? 'warning' : 'info'}>
                      {row.result}
                    </Badge>
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
