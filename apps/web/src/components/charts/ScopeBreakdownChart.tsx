import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface ScopeBreakdownItem {
  scope: string;
  value: number;
  percentage: number;
}

interface ScopeBreakdownChartProps {
  data: ScopeBreakdownItem[];
  loading?: boolean;
  title?: string;
}

const COLORS = ['#ef4444', '#8b5cf6', '#14b8a6'];

const SCOPE_LABELS: Record<string, string> = {
  '1': 'Scope 1',
  '2': 'Scope 2',
  '3': 'Scope 3',
  scope1: 'Scope 1',
  scope2: 'Scope 2',
  scope3: 'Scope 3',
};

const skeletonStyle: React.CSSProperties = {
  width: '100%',
  height: 300,
  borderRadius: '0.5rem',
  background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

export function ScopeBreakdownChart({
  data,
  loading = false,
  title = 'Scope Breakdown',
}: ScopeBreakdownChartProps) {
  const titleStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 1rem 0',
  };

  if (loading) {
    return (
      <Card>
        <h3 style={titleStyle}>{title}</h3>
        <div style={skeletonStyle} />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 style={titleStyle}>{title}</h3>
        <EmptyState title="No breakdown data" description="Scope breakdown data is not yet available." />
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: SCOPE_LABELS[d.scope] || d.scope,
    value: d.value,
    percentage: d.percentage,
  }));

  return (
    <Card>
      <h3 style={titleStyle}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any) => [`${Number(value).toLocaleString()} tCO₂e`, '']) as never}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
