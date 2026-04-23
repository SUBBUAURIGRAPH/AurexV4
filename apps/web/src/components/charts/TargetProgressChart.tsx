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

interface ProgressPoint {
  year: number;
  actual: number | string;
  projected?: number | string | null;
  variance?: number | string | null;
}

interface TargetProgressChartProps {
  data: ProgressPoint[];
  loading?: boolean;
  title?: string;
}

interface NormalizedPoint {
  year: number;
  actual: number;
  expected: number | null;
}

const ACTUAL_COLOR = '#1a5d3d';
const EXPECTED_COLOR = '#94a3b8';
const GRID_COLOR = '#e2e8f0';
const TEXT_COLOR = '#64748b';

const skeletonStyle: React.CSSProperties = {
  width: '100%',
  height: 260,
  borderRadius: '0.5rem',
  background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

function normalize(p: ProgressPoint): NormalizedPoint {
  const actual = Number(p.actual);
  // Expected = actual − variance. Falls back to `projected` when variance is null.
  let expected: number | null = null;
  if (p.variance !== null && p.variance !== undefined) {
    expected = actual - Number(p.variance);
  } else if (p.projected !== null && p.projected !== undefined) {
    expected = Number(p.projected);
  }
  return { year: p.year, actual, expected };
}

export function TargetProgressChart({
  data,
  loading = false,
  title = 'Target Progress',
}: TargetProgressChartProps) {
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
        <EmptyState title="No progress data" description="Record progress to see tracking here." />
      </Card>
    );
  }

  const normalized = data.map(normalize);

  return (
    <Card>
      <h3 style={titleStyle}>{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={normalized} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: TEXT_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: TEXT_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            label={{
              value: 'tCO₂e',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: TEXT_COLOR },
            }}
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
                actual: 'Actual',
                expected: 'Expected',
              };
              if (value === null || value === undefined) return ['—', labels[name] || name];
              return [`${Number(value).toLocaleString()} tCO₂e`, labels[name] || name];
            }) as never}
          />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                actual: 'Actual',
                expected: 'Expected',
              };
              return labels[value] || value;
            }}
          />
          <Bar dataKey="expected" fill={EXPECTED_COLOR} radius={[4, 4, 0, 0]} barSize={24} />
          <Bar dataKey="actual" fill={ACTUAL_COLOR} radius={[4, 4, 0, 0]} barSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
