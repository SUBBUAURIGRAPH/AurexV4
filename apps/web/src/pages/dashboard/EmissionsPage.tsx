import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

type ScopeTab = '1' | '2' | '3';

const scopeData: Record<ScopeTab, { title: string; description: string; total: string; entries: Array<{ source: string; category: string; amount: string; unit: string; date: string; status: string }> }> = {
  '1': {
    title: 'Scope 1 - Direct Emissions',
    description: 'Emissions from sources owned or controlled by your organization.',
    total: '3,214 tCO2e',
    entries: [
      { source: 'Fleet Vehicles - Diesel', category: 'Mobile Combustion', amount: '1,245', unit: 'tCO2e', date: '2025-12-15', status: 'verified' },
      { source: 'Natural Gas Boilers', category: 'Stationary Combustion', amount: '892', unit: 'tCO2e', date: '2025-12-14', status: 'verified' },
      { source: 'Refrigerant Leakage (R-410A)', category: 'Fugitive Emissions', amount: '534', unit: 'tCO2e', date: '2025-12-12', status: 'pending' },
      { source: 'Backup Generators - Diesel', category: 'Stationary Combustion', amount: '312', unit: 'tCO2e', date: '2025-12-10', status: 'verified' },
      { source: 'Company Vehicles - Gasoline', category: 'Mobile Combustion', amount: '231', unit: 'tCO2e', date: '2025-12-08', status: 'verified' },
    ],
  },
  '2': {
    title: 'Scope 2 - Indirect Emissions',
    description: 'Emissions from purchased electricity, steam, heating, and cooling.',
    total: '5,891 tCO2e',
    entries: [
      { source: 'Grid Electricity - HQ', category: 'Purchased Electricity', amount: '2,847', unit: 'tCO2e', date: '2025-12-15', status: 'verified' },
      { source: 'Grid Electricity - Data Center', category: 'Purchased Electricity', amount: '1,523', unit: 'tCO2e', date: '2025-12-15', status: 'verified' },
      { source: 'District Heating', category: 'Purchased Heat', amount: '891', unit: 'tCO2e', date: '2025-12-14', status: 'pending' },
      { source: 'Grid Electricity - Branch Offices', category: 'Purchased Electricity', amount: '432', unit: 'tCO2e', date: '2025-12-12', status: 'verified' },
      { source: 'Purchased Steam', category: 'Purchased Steam', amount: '198', unit: 'tCO2e', date: '2025-12-10', status: 'draft' },
    ],
  },
  '3': {
    title: 'Scope 3 - Value Chain Emissions',
    description: 'All other indirect emissions in your upstream and downstream value chain.',
    total: '3,742 tCO2e',
    entries: [
      { source: 'Employee Commuting', category: 'Cat. 7 - Commuting', amount: '1,034', unit: 'tCO2e', date: '2025-12-15', status: 'estimated' },
      { source: 'Business Air Travel', category: 'Cat. 6 - Business Travel', amount: '876', unit: 'tCO2e', date: '2025-12-14', status: 'verified' },
      { source: 'Upstream Freight', category: 'Cat. 4 - Transport', amount: '723', unit: 'tCO2e', date: '2025-12-12', status: 'pending' },
      { source: 'Purchased Goods - IT Equipment', category: 'Cat. 1 - Purchased Goods', amount: '645', unit: 'tCO2e', date: '2025-12-10', status: 'estimated' },
      { source: 'Waste Disposal', category: 'Cat. 5 - Waste', amount: '464', unit: 'tCO2e', date: '2025-12-08', status: 'verified' },
    ],
  },
};

const statusBadge = (status: string) => {
  const map: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    verified: 'success',
    pending: 'warning',
    draft: 'neutral',
    estimated: 'info',
  };
  return <Badge variant={map[status] || 'neutral'}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
};

export function EmissionsPage() {
  const [activeScope, setActiveScope] = useState<ScopeTab>('1');
  const data = scopeData[activeScope];

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Emissions Inventory
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            Track and manage greenhouse gas emissions across all scopes.
          </p>
        </div>
        <Button icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}>
          Add Entry
        </Button>
      </div>

      {/* Scope Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        padding: '0.25rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.625rem',
        marginBottom: '1.5rem',
        width: 'fit-content',
      }}>
        {(['1', '2', '3'] as ScopeTab[]).map((scope) => (
          <button
            key={scope}
            onClick={() => setActiveScope(scope)}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              backgroundColor: activeScope === scope ? '#1a5d3d' : 'transparent',
              color: activeScope === scope ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 150ms',
            }}
          >
            Scope {scope}
          </button>
        ))}
      </div>

      {/* Scope Info */}
      <Card padding="md" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {data.title}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{data.description}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a5d3d' }}>{data.total}</p>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card padding="none">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Source', 'Category', 'Amount', 'Date', 'Status'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '0.875rem 1.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
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
              {data.entries.map((entry, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < data.entries.length - 1 ? '1px solid var(--border-primary)' : 'none',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '0.875rem 1.25rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {entry.source}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-secondary)' }}>
                    {entry.category}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {entry.amount} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>{entry.unit}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {entry.date}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    {statusBadge(entry.status)}
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
