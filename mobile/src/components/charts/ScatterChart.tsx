/**
 * Scatter Chart Component
 * Displays individual data points for correlation and distribution analysis
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryScatter,
  VictoryAxis,
  VictoryTheme,
  VictoryZoomContainer
} from 'victory-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DataPoint {
  x: number;
  y: number;
  size?: number;
  color?: string;
  symbol?: string;
}

interface ScatterChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  enableZoom?: boolean;
  pointColor?: string;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export const ScatterChart: React.FC<ScatterChartProps> = ({
  data,
  width = SCREEN_WIDTH - 32,
  height = 300,
  enableZoom = true,
  pointColor = '#0066CC',
  title,
  xAxisLabel,
  yAxisLabel
}) => {
  // Format data for Victory
  const chartData = useMemo(() => {
    return data.map(point => ({
      x: point.x,
      y: point.y,
      size: point.size || 5,
      fill: point.color || pointColor,
      symbol: point.symbol || 'circle'
    }));
  }, [data, pointColor]);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Calculate domains
  const xValues = data.map(d => d.x);
  const yValues = data.map(d => d.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const xRange = maxX - minX;
  const yRange = maxY - minY;
  const xPadding = xRange * 0.1;
  const yPadding = yRange * 0.1;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <VictoryChart
        width={width}
        height={height}
        theme={VictoryTheme.material}
        padding={{ top: 20, bottom: 60, left: 60, right: 20 }}
        containerComponent={
          enableZoom ? (
            <VictoryZoomContainer
              zoomDimension="xy"
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
          tickFormat={(t) => t.toFixed(1)}
          domain={[minY - yPadding, maxY + yPadding]}
        />

        {/* X-Axis */}
        <VictoryAxis
          label={xAxisLabel}
          style={{
            axis: { stroke: '#334155' },
            axisLabel: { fill: '#9CA3AF', fontSize: 12, padding: 35 },
            tickLabels: { fill: '#9CA3AF', fontSize: 10 },
            grid: { stroke: '#334155', strokeDasharray: '4, 4' }
          }}
          tickFormat={(t) => t.toFixed(1)}
          domain={[minX - xPadding, maxX + xPadding]}
        />

        {/* Scatter Points */}
        <VictoryScatter
          data={chartData}
          style={{
            data: {
              fill: ({ datum }) => datum.fill,
              opacity: 0.7
            }
          }}
        />
      </VictoryChart>

      {/* Statistics */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Points</Text>
          <Text style={styles.statValue}>{data.length}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>X Range</Text>
          <Text style={styles.statValue}>{xRange.toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Y Range</Text>
          <Text style={styles.statValue}>{yRange.toFixed(2)}</Text>
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
    paddingHorizontal: 20
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
    fontSize: 13,
    fontWeight: '600',
    color: '#E5E7EB'
  }
});
