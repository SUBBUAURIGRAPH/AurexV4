import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const tickets = [
  { id: 'SUP-9812', subject: 'Need role-mapping for SAP integration', priority: 'high', status: 'open' },
  { id: 'SUP-9804', subject: 'CSRD export formatting discrepancy', priority: 'medium', status: 'in_progress' },
  { id: 'SUP-9731', subject: 'Quarterly board deck template request', priority: 'low', status: 'resolved' },
];

export function SupportPage() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Support Center</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Track support tickets, SLAs, and technical enablement requests.</p>
        </div>
        {/* AAT-WORKFLOW (Wave 9a): support backend not wired — disabled with tooltip. */}
        <Button disabled title="Coming soon — email support@aurex.in for now">Create Ticket</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <Card padding="lg">
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Support Plan</p>
          <h3 style={{ fontSize: '1.0625rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>Premier 24x7</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Critical response SLA: 30 minutes.</p>
        </Card>
        <Card padding="lg">
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Customer Success</p>
          <h3 style={{ fontSize: '1.0625rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>Ananya Sharma</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>ananya.sharma@aurex.in</p>
        </Card>
      </div>

      <Card padding="none">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Ticket', 'Subject', 'Priority', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket, i) => (
                <tr key={ticket.id} style={{ borderBottom: i < tickets.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{ticket.id}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>{ticket.subject}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <Badge variant={ticket.priority === 'high' ? 'warning' : ticket.priority === 'medium' ? 'info' : 'neutral'}>
                      {ticket.priority}
                    </Badge>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <Badge variant={ticket.status === 'resolved' ? 'success' : ticket.status === 'in_progress' ? 'info' : 'warning'}>
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}><Button size="sm" variant="outline" disabled title="Coming soon — Wave 10">Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
