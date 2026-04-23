import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface CategoryBreakdown {
  category: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

interface CategoryStackedBarProps {
  data: CategoryBreakdown[];
  loading?: boolean;
  title?: string;
}

const SCOPE1_COLOR = '#ef4444';
const SCOPE2_COLOR = '#8b5cf6';
const SCOPE3_COLOR = '#14b8a6';
const GRID_COLOR = '#e2e8f0';
const TEXT_COLOR = '#64748b';

const skeletonStyle: React.CSSProperties = {
  width: '100%',
  height: 300,
  borderRadius: '0.5rem',
  background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

export function CategoryStackedBar({
  data,
  loading = false,
  title = 'Emissions by Category',
}: CategoryStackedBarProps) {
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
        <EmptyState title="No category data" description="Category breakdown data is not yet available." />
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={titleStyle}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 12, fill: TEXT_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={{ stroke: GRID_COLOR }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: TEXT_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={{ stroke: GRID_COLOR }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any, name: string) => {
              const labels: Record<string, string> = {
                scope1: 'Scope 1',
                scope2: 'Scope 2',
                scope3: 'Scope 3',
              };
              return [`${Number(value).toLocaleString()} tCO₂e`, labels[name] || name];
            }) as never}
          />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                scope1: 'Scope 1',
                scope2: 'Scope 2',
                scope3: 'Scope 3',
              };
              return labels[value] || value;
            }}
          />
          <Bar dataKey="scope1" stackId="a" fill={SCOPE1_COLOR} />
          <Bar dataKey="scope2" stackId="a" fill={SCOPE2_COLOR} />
          <Bar dataKey="scope3" stackId="a" fill={SCOPE3_COLOR} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
