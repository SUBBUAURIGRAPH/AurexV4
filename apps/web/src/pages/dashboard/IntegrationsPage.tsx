import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const integrations = [
  { name: 'SAP S/4HANA', category: 'ERP', status: 'connected', lastSync: '2 min ago' },
  { name: 'Oracle NetSuite', category: 'Finance', status: 'connected', lastSync: '11 min ago' },
  { name: 'AWS S3 Data Lake', category: 'Storage', status: 'connected', lastSync: '27 min ago' },
  { name: 'Microsoft Entra ID', category: 'SSO', status: 'connected', lastSync: '1 hour ago' },
  { name: 'ServiceNow', category: 'ITSM', status: 'attention', lastSync: 'Sync failed' },
];

export function IntegrationsPage() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Integrations</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Connect enterprise systems and monitor integration health.</p>
        </div>
        <Button>Connect Integration</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {integrations.map((item) => (
          <Card key={item.name} padding="lg" hover>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</h3>
              <Badge variant={item.status === 'connected' ? 'success' : 'warning'}>
                {item.status === 'connected' ? 'Connected' : 'Attention'}
              </Badge>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>{item.category}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Last sync: {item.lastSync}</p>
            <Button size="sm" variant="outline">Configure</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
