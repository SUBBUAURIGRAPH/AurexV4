import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const invoices = [
  { id: 'INV-2026-041', period: 'Apr 2026', amount: '$42,500', status: 'paid' },
  { id: 'INV-2026-031', period: 'Mar 2026', amount: '$42,500', status: 'paid' },
  { id: 'INV-2026-021', period: 'Feb 2026', amount: '$38,000', status: 'paid' },
  { id: 'INV-2026-011', period: 'Jan 2026', amount: '$38,000', status: 'open' },
];

export function BillingPage() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Billing and Subscription</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Plan usage, contract status, invoices, and payment controls.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <Card padding="lg">
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Current Plan</p>
          <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>Enterprise Plus</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Unlimited business units, SSO, and premium support.</p>
        </Card>
        <Card padding="lg">
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Renewal Date</p>
          <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>2026-12-31</h3>
          <Button size="sm" variant="outline" style={{ marginTop: '0.75rem' }}>View Contract</Button>
        </Card>
      </div>

      <Card padding="none">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Invoice', 'Period', 'Amount', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice, i) => (
                <tr key={invoice.id} style={{ borderBottom: i < invoices.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{invoice.id}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>{invoice.period}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{invoice.amount}</td>
                  <td style={{ padding: '0.875rem 1rem' }}><Badge variant={invoice.status === 'paid' ? 'success' : 'warning'}>{invoice.status === 'paid' ? 'Paid' : 'Open'}</Badge></td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}><Button size="sm" variant="ghost">Download PDF</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
