import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface YoYPoint {
  month: string;
  currentYear: number;
  previousYear: number;
}

interface YoYComparisonChartProps {
  data: YoYPoint[];
  loading?: boolean;
  title?: string;
}

const CURRENT_COLOR = '#1a5d3d';
const PREVIOUS_COLOR = '#94a3b8';
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

export function YoYComparisonChart({
  data,
  loading = false,
  title = 'Year-over-Year Comparison',
}: YoYComparisonChartProps) {
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
        <EmptyState title="No comparison data" description="Year-over-year data is not yet available." />
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={titleStyle}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis
            dataKey="month"
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
                currentYear: 'Current Year',
                previousYear: 'Previous Year',
              };
              return [`${Number(value).toLocaleString()} tCO₂e`, labels[name] || name];
            }) as never}
          />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                currentYear: 'Current Year',
                previousYear: 'Previous Year',
              };
              return labels[value] || value;
            }}
          />
          <Line
            type="monotone"
            dataKey="currentYear"
            stroke={CURRENT_COLOR}
            strokeWidth={2}
            dot={{ r: 4, fill: CURRENT_COLOR }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="previousYear"
            stroke={PREVIOUS_COLOR}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4, fill: PREVIOUS_COLOR }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
