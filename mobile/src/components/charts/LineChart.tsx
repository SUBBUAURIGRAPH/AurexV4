/**
 * Line Chart Component
 * Displays continuous line data for price trends and time series
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryTheme,
  VictoryScatter,
  VictoryZoomContainer,
  VictoryTooltip
} from 'victory-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DataPoint {
  x: number | string;
  y: number;
  label?: string;
}

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  enableZoom?: boolean;
  showPoints?: boolean;
  lineColor?: string;
  title?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width = SCREEN_WIDTH - 32,
  height = 300,
  enableZoom = true,
  showPoints = false,
  lineColor = '#0066CC',
  title,
  yAxisLabel,
  xAxisLabel
}) => {
  // Format data for Victory
  const chartData = useMemo(() => {
    return data.map((point, index) => ({
      x: typeof point.x === 'string' ? index + 1 : point.x,
      y: point.y,
      label: point.label || `${point.y.toFixed(2)}`
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
  const minY = Math.min(...yValues);
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
          label={xAxisLabel}
          style={{
            axis: { stroke: '#334155' },
            axisLabel: { fill: '#9CA3AF', fontSize: 12, padding: 30 },
            tickLabels: { fill: '#9CA3AF', fontSize: 10, angle: -45, textAnchor: 'end' },
            grid: { stroke: 'transparent' }
          }}
          tickCount={Math.min(8, data.length)}
        />

        {/* Line */}
        <VictoryLine
          data={chartData}
          style={{
            data: {
              stroke: lineColor,
              strokeWidth: 2
            }
          }}
          interpolation="monotoneX"
        />

        {/* Optional scatter points for interactivity */}
        {showPoints && (
          <VictoryScatter
            data={chartData}
            size={4}
            style={{
              data: {
                fill: lineColor
              }
            }}
          />
        )}
      </VictoryChart>

      {/* Statistics */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>${minY.toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>${maxY.toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Points</Text>
          <Text style={styles.statValue}>{data.length}</Text>
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
