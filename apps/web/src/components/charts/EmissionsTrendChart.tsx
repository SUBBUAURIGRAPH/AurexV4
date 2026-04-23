import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface EmissionsTrendDataPoint {
  month: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

interface EmissionsTrendChartProps {
  data: EmissionsTrendDataPoint[];
  loading?: boolean;
  title?: string;
}

// Brand colors
const SCOPE1_COLOR = '#ef4444'; // red
const SCOPE2_COLOR = '#8b5cf6'; // purple
const SCOPE3_COLOR = '#14b8a6'; // teal
const GRID_COLOR = '#e2e8f0';   // --border-primary fallback
const TEXT_COLOR = '#64748b';    // --text-secondary fallback

const skeletonStyle: React.CSSProperties = {
  width: '100%',
  height: 300,
  borderRadius: '0.5rem',
  background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

const skeletonKeyframes = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

function ChartSkeleton() {
  return (
    <>
      <style>{skeletonKeyframes}</style>
      <div style={skeletonStyle} />
    </>
  );
}

export function EmissionsTrendChart({
  data,
  loading = false,
  title = 'Emissions Trend',
}: EmissionsTrendChartProps) {
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
        <ChartSkeleton />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 style={titleStyle}>{title}</h3>
        <EmptyState
          title="No emissions data"
          description="Emissions trend data is not yet available."
        />
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={titleStyle}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="gradScope1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SCOPE1_COLOR} stopOpacity={0.3} />
              <stop offset="95%" stopColor={SCOPE1_COLOR} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradScope2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SCOPE2_COLOR} stopOpacity={0.3} />
              <stop offset="95%" stopColor={SCOPE2_COLOR} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradScope3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SCOPE3_COLOR} stopOpacity={0.3} />
              <stop offset="95%" stopColor={SCOPE3_COLOR} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} /* --border-primary */ />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: TEXT_COLOR /* --text-secondary */ }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={{ stroke: GRID_COLOR }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: TEXT_COLOR /* --text-secondary */ }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={{ stroke: GRID_COLOR }}
            label={{
              value: 'tCO₂e',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: TEXT_COLOR /* --text-secondary */ },
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
                scope1: 'Scope 1',
                scope2: 'Scope 2',
                scope3: 'Scope 3',
              };
              return [`${Number(value).toLocaleString()} tCO₂e`, labels[name] || name];
            }) as never}
          />
          <Legend
            verticalAlign="bottom"
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                scope1: 'Scope 1',
                scope2: 'Scope 2',
                scope3: 'Scope 3',
              };
              return labels[value] || value;
            }}
          />
          <Area
            type="monotone"
            dataKey="scope1"
            stackId="1"
            stroke={SCOPE1_COLOR}
            fill="url(#gradScope1)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="scope2"
            stackId="1"
            stroke={SCOPE2_COLOR}
            fill="url(#gradScope2)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="scope3"
            stackId="1"
            stroke={SCOPE3_COLOR}
            fill="url(#gradScope3)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
