/**
 * Advanced Analytics Charts
 * Interactive visualizations using Recharts
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  AreaChart,
  BarChart,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot
} from 'recharts';
import './AdvancedCharts.css';

interface ChartData {
  timestamp?: string;
  date?: string;
  [key: string]: any;
}

interface ChartProps {
  title: string;
  data: ChartData[];
  dataKey: string;
  secondaryKey?: string;
  type: 'line' | 'area' | 'bar' | 'composed';
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  onDataPointClick?: (data: any) => void;
  customTooltip?: React.ComponentType<any>;
  referenceLines?: Array<{ value: number; label: string; color?: string }>;
}

/**
 * Performance Metrics Chart
 */
export const PerformanceChart: React.FC<ChartProps> = ({
  title,
  data,
  dataKey,
  type = 'line',
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  onDataPointClick,
  referenceLines
}) => {
  const chartData = useMemo(() => {
    return data.map((d, i) => ({
      ...d,
      timestamp:
        d.timestamp || d.date || new Date(i * 86400000).toLocaleDateString()
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="tooltip-date">{data.timestamp}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="advanced-chart">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {type === 'line' && (
          <LineChart
            data={chartData}
            onClick={(state) => {
              if (onDataPointClick && state.activeTooltipIndex !== undefined) {
                onDataPointClick(chartData[state.activeTooltipIndex]);
              }
            }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="timestamp" />
            <YAxis />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {referenceLines?.map((ref, idx) => (
              <ReferenceLine
                key={idx}
                y={ref.value}
                label={ref.label}
                stroke={ref.color || '#ccc'}
              />
            ))}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="#8884d8"
              dot={{ r: 2 }}
              activeDot={{ r: 6 }}
              isAnimationActive={true}
            />
          </LineChart>
        )}

        {type === 'area' && (
          <AreaChart data={chartData}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="timestamp" />
            <YAxis />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {referenceLines?.map((ref, idx) => (
              <ReferenceLine
                key={idx}
                y={ref.value}
                label={ref.label}
                stroke={ref.color || '#ccc'}
              />
            ))}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.6}
              isAnimationActive={true}
            />
          </AreaChart>
        )}

        {type === 'bar' && (
          <BarChart data={chartData}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="timestamp" />
            <YAxis />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {referenceLines?.map((ref, idx) => (
              <ReferenceLine
                key={idx}
                y={ref.value}
                label={ref.label}
                stroke={ref.color || '#ccc'}
              />
            ))}
            <Bar dataKey={dataKey} fill="#8884d8" isAnimationActive={true} />
          </BarChart>
        )}

        {type === 'composed' && (
          <ComposedChart data={chartData}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="timestamp" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
            {referenceLines?.map((ref, idx) => (
              <ReferenceLine
                key={idx}
                y={ref.value}
                label={ref.label}
                stroke={ref.color || '#ccc'}
              />
            ))}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey={dataKey}
              stroke="#8884d8"
            />
            {/* Add more series as needed */}
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Multi-Series Chart
 */
export const MultiSeriesChart: React.FC<{
  title: string;
  data: ChartData[];
  series: Array<{ key: string; name: string; color: string }>;
  type?: 'line' | 'area' | 'bar' | 'composed';
  height?: number;
}> = ({ title, data, series, type = 'line', height = 300 }) => {
  return (
    <div className="advanced-chart">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {type === 'line' && (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            {series.map((s, idx) => (
              <Line
                key={idx}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                name={s.name}
              />
            ))}
          </LineChart>
        )}

        {type === 'area' && (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            {series.map((s, idx) => (
              <Area
                key={idx}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.6}
                name={s.name}
              />
            ))}
          </AreaChart>
        )}

        {type === 'bar' && (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            {series.map((s, idx) => (
              <Bar key={idx} dataKey={s.key} fill={s.color} name={s.name} />
            ))}
          </BarChart>
        )}

        {type === 'composed' && (
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            {series.slice(0, 2).map((s, idx) => (
              <Line
                key={idx}
                yAxisId={idx === 0 ? 'left' : 'right'}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                name={s.name}
              />
            ))}
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Drawdown Chart
 */
export const DrawdownChart: React.FC<{
  title?: string;
  data: ChartData[];
  height?: number;
}> = ({ title = 'Drawdown Analysis', data, height = 300 }) => {
  return (
    <div className="advanced-chart">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis label={{ value: 'Drawdown (%)', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value) => `${(value * 100).toFixed(2)}%`} />
          <Legend />
          <ReferenceLine y={0} stroke="#000" />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="#ef4444"
            fill="#fecaca"
            fillOpacity={0.7}
            name="Drawdown"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Volatility Chart
 */
export const VolatilityChart: React.FC<{
  title?: string;
  data: ChartData[];
  height?: number;
}> = ({ title = 'Volatility Trend', data, height = 300 }) => {
  return (
    <div className="advanced-chart">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis label={{ value: 'Volatility', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value) => `${(value * 100).toFixed(2)}%`} />
          <Legend />
          <Bar
            dataKey="volatility"
            fill="#f59e0b"
            name="Volatility"
            radius={[8, 8, 0, 0]}
          />
          <ReferenceLine
            y={0.3}
            stroke="#ef4444"
            label="Alert Threshold"
            strokeDasharray="5 5"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Cumulative Returns Chart
 */
export const CumulativeReturnsChart: React.FC<{
  title?: string;
  data: ChartData[];
  benchmarkData?: ChartData[];
  height?: number;
}> = ({ title = 'Cumulative Returns', data, benchmarkData, height = 300 }) => {
  return (
    <div className="advanced-chart">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis label={{ value: 'Return (%)', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value) => `${(value * 100).toFixed(2)}%`} />
          <Legend />
          <ReferenceLine y={0} stroke="#000" />
          <Line
            type="monotone"
            dataKey="return"
            stroke="#10b981"
            strokeWidth={2}
            name="Strategy"
            dot={false}
          />
          {benchmarkData && (
            <Line
              type="monotone"
              dataKey="benchmarkReturn"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Benchmark"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Risk-Return Scatter Plot
 */
export const RiskReturnScatter: React.FC<{
  title?: string;
  strategies: Array<{ name: string; return: number; risk: number; color: string }>;
  height?: number;
}> = ({ title = 'Risk-Return Profile', strategies, height = 300 }) => {
  const data = strategies.map((s, idx) => ({
    x: s.risk,
    y: s.return,
    name: s.name,
    color: s.color,
    id: idx
  }));

  return (
    <div className="advanced-chart">
      <h3>{title}</h3>
      <div className="scatter-plot">
        {/* Manual scatter plot implementation or use a library like visx */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          {strategies.map((s, idx) => (
            <div key={idx} className="scatter-point" style={{ borderColor: s.color }}>
              <strong>{s.name}</strong>
              <p>Return: {(s.return * 100).toFixed(2)}%</p>
              <p>Risk: {(s.risk * 100).toFixed(2)}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default {
  PerformanceChart,
  MultiSeriesChart,
  DrawdownChart,
  VolatilityChart,
  CumulativeReturnsChart,
  RiskReturnScatter
};
