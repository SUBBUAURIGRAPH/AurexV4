/**
 * Area Chart Component
 * Displays filled area below a line to emphasize volume and trends
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryArea,
  VictoryAxis,
  VictoryTheme,
  VictoryZoomContainer
} from 'victory-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DataPoint {
  x: number | string;
  y: number;
  y0?: number;
}

interface AreaChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  enableZoom?: boolean;
  fillColor?: string;
  strokeColor?: string;
  title?: string;
  yAxisLabel?: string;
}

export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  width = SCREEN_WIDTH - 32,
  height = 300,
  enableZoom = true,
  fillColor = 'rgba(0, 102, 204, 0.3)',
  strokeColor = '#0066CC',
  title,
  yAxisLabel
}) => {
  // Format data for Victory
  const chartData = useMemo(() => {
    return data.map((point, index) => ({
      x: typeof point.x === 'string' ? index + 1 : point.x,
      y: point.y,
      y0: point.y0 || 0
    }));
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Calculate domain
  const yValues = data.map(d => d.y);
  const minY = Math.min(...yValues, 0);
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY;
  const yPadding = yRange * 0.1;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <VictoryChart
        width={width}
        height={height}
        theme={VictoryTheme.material}
        padding={{ top: 20, bottom: 50, left: 60, right: 20 }}
        containerComponent={
          enableZoom ? (
            <VictoryZoomContainer
              zoomDimension="x"
              minimumZoom={{ x: 1, y: 1 }}
            />
          ) : undefined
        }
      >
        {/* Y-Axis */}
        <VictoryAxis
          dependentAxis
          label={yAxisLabel}
          style={{
            axis: { stroke: '#334155' },
            axisLabel: { fill: '#9CA3AF', fontSize: 12, padding: 40 },
            tickLabels: { fill: '#9CA3AF', fontSize: 10 },
            grid: { stroke: '#334155', strokeDasharray: '4, 4' }
          }}
          tickFormat={(t) => `$${t.toFixed(0)}`}
          domain={[minY - yPadding, maxY + yPadding]}
        />

        {/* X-Axis */}
        <VictoryAxis
          style={{
            axis: { stroke: '#334155' },
            tickLabels: { fill: '#9CA3AF', fontSize: 10, angle: -45, textAnchor: 'end' },
            grid: { stroke: 'transparent' }
          }}
          tickCount={Math.min(8, data.length)}
        />

        {/* Area */}
        <VictoryArea
          data={chartData}
          style={{
            data: {
              fill: fillColor,
              stroke: strokeColor,
              strokeWidth: 2
            }
          }}
          interpolation="monotoneX"
        />
      </VictoryChart>

      {/* Statistics */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={[styles.statValue, { color: '#0066CC' }]}>
            ${data[data.length - 1]?.y.toFixed(2) || '0.00'}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Change</Text>
          <Text style={[
            styles.statValue,
            { color: data[data.length - 1]?.y >= data[0]?.y ? '#10B981' : '#EF4444' }
          ]}>
            {data.length > 1
              ? `${((data[data.length - 1].y - data[0].y) / data[0].y * 100).toFixed(2)}%`
              : '0.00%'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center'
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8
  },
  noDataText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
    width: '100%',
    paddingHorizontal: 40
  },
  statItem: {
    alignItems: 'center'
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB'
  }
});
