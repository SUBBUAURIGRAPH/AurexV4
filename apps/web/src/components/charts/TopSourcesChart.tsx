import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface TopSourceItem {
  source: string;
  category: string;
  value: number;
}

interface TopSourcesChartProps {
  data: TopSourceItem[];
  loading?: boolean;
  title?: string;
}

const BAR_COLOR = '#1a5d3d';
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

export function TopSourcesChart({
  data,
  loading = false,
  title = 'Top Emission Sources',
}: TopSourcesChartProps) {
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
        <EmptyState title="No source data" description="Top emission sources data is not yet available." />
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={titleStyle}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: TEXT_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={{ stroke: GRID_COLOR }}
          />
          <YAxis
            type="category"
            dataKey="source"
            tick={{ fontSize: 12, fill: TEXT_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={{ stroke: GRID_COLOR }}
            width={75}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any) => [`${Number(value).toLocaleString()} tCO₂e`, 'Emissions']) as never}
          />
          <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
