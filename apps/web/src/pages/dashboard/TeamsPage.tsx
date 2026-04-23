import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const teams = [
  { name: 'Sustainability Office', members: 12, owner: 'Nina Rao', role: 'Admin', status: 'active' },
  { name: 'Plant Operations - North', members: 34, owner: 'Arjun Patel', role: 'Editor', status: 'active' },
  { name: 'Procurement and Scope 3', members: 18, owner: 'Mia Chen', role: 'Editor', status: 'active' },
  { name: 'Investor Reporting', members: 7, owner: 'Rahul Menon', role: 'Viewer', status: 'review' },
];

export function TeamsPage() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Teams and Access</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Manage departments, user roles, and workspace access policies.</p>
        </div>
        <Button>Add Team</Button>
      </div>

      <Card padding="none">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Team', 'Owner', 'Members', 'Default Role', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((team, i) => (
                <tr key={team.name} style={{ borderBottom: i < teams.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{team.name}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>{team.owner}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{team.members}</td>
                  <td style={{ padding: '0.875rem 1rem' }}><Badge variant="neutral">{team.role}</Badge></td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <Badge variant={team.status === 'active' ? 'success' : 'warning'}>{team.status === 'active' ? 'Active' : 'In Review'}</Badge>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}><Button size="sm" variant="outline">Manage</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
