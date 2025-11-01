/**
 * Bar Chart Component
 * Displays vertical bars for comparing discrete data points
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryBar,
  VictoryAxis,
  VictoryTheme
} from 'victory-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DataPoint {
  x: string | number;
  y: number;
  label?: string;
  fill?: string;
}

interface BarChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  barColor?: string;
  title?: string;
  yAxisLabel?: string;
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  width = SCREEN_WIDTH - 32,
  height = 300,
  barColor = '#0066CC',
  title,
  yAxisLabel,
  horizontal = false
}) => {
  // Format data for Victory
  const chartData = useMemo(() => {
    return data.map((point, index) => ({
      x: point.x || index + 1,
      y: point.y,
      label: point.label,
      fill: point.fill || barColor
    }));
  }, [data, barColor]);

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
        domainPadding={{ x: 20 }}
        padding={{ top: 20, bottom: 60, left: 60, right: 20 }}
      >
        {/* Y-Axis */}
        <VictoryAxis
          dependentAxis={!horizontal}
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
            tickLabels: {
              fill: '#9CA3AF',
              fontSize: 10,
              angle: -45,
              textAnchor: 'end'
            },
            grid: { stroke: 'transparent' }
          }}
          tickFormat={(t) => {
            if (typeof t === 'string') return t.length > 8 ? t.substring(0, 8) + '...' : t;
            return t.toString();
          }}
        />

        {/* Bars */}
        <VictoryBar
          data={chartData}
          horizontal={horizontal}
          style={{
            data: {
              fill: ({ datum }) => datum.fill || barColor
            }
          }}
          barWidth={Math.min(20, (width - 80) / data.length * 0.8)}
          cornerRadius={{ top: 4 }}
        />
      </VictoryChart>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>
            ${yValues.reduce((sum, val) => sum + val, 0).toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Average</Text>
          <Text style={styles.summaryValue}>
            ${(yValues.reduce((sum, val) => sum + val, 0) / yValues.length).toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Items</Text>
          <Text style={styles.summaryValue}>{data.length}</Text>
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
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
    width: '100%',
    paddingHorizontal: 20
  },
  summaryItem: {
    alignItems: 'center'
  },
  summaryLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E5E7EB'
  }
});
