/**
 * Histogram Chart Component
 * Displays frequency distribution of data in bins
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

interface HistogramChartProps {
  data: number[];
  width?: number;
  height?: number;
  bins?: number;
  barColor?: string;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export const HistogramChart: React.FC<HistogramChartProps> = ({
  data,
  width = SCREEN_WIDTH - 32,
  height = 300,
  bins = 10,
  barColor = '#0066CC',
  title,
  xAxisLabel = 'Value Range',
  yAxisLabel = 'Frequency'
}) => {
  // Calculate histogram bins
  const histogramData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / bins;

    // Initialize bins
    const binCounts: { x: string; y: number; range: [number, number] }[] = [];

    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const binLabel = `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`;

      binCounts.push({
        x: binLabel,
        y: 0,
        range: [binStart, binEnd]
      });
    }

    // Count data points in each bin
    data.forEach(value => {
      const binIndex = Math.min(
        Math.floor((value - min) / binWidth),
        bins - 1
      );
      binCounts[binIndex].y += 1;
    });

    return binCounts;
  }, [data, bins]);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  const maxFrequency = Math.max(...histogramData.map(b => b.y));
  const totalCount = data.length;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <VictoryChart
        width={width}
        height={height}
        theme={VictoryTheme.material}
        domainPadding={{ x: 20 }}
        padding={{ top: 20, bottom: 80, left: 60, right: 20 }}
      >
        {/* Y-Axis (Frequency) */}
        <VictoryAxis
          dependentAxis
          label={yAxisLabel}
          style={{
            axis: { stroke: '#334155' },
            axisLabel: { fill: '#9CA3AF', fontSize: 12, padding: 40 },
            tickLabels: { fill: '#9CA3AF', fontSize: 10 },
            grid: { stroke: '#334155', strokeDasharray: '4, 4' }
          }}
          domain={[0, maxFrequency + 1]}
        />

        {/* X-Axis (Bins) */}
        <VictoryAxis
          label={xAxisLabel}
          style={{
            axis: { stroke: '#334155' },
            axisLabel: { fill: '#9CA3AF', fontSize: 12, padding: 50 },
            tickLabels: {
              fill: '#9CA3AF',
              fontSize: 8,
              angle: -45,
              textAnchor: 'end'
            },
            grid: { stroke: 'transparent' }
          }}
        />

        {/* Bars */}
        <VictoryBar
          data={histogramData}
          style={{
            data: {
              fill: barColor,
              width: (width - 80) / bins * 0.8
            }
          }}
          cornerRadius={{ top: 4 }}
        />
      </VictoryChart>

      {/* Statistics */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{totalCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Mean</Text>
          <Text style={styles.statValue}>
            {(data.reduce((sum, val) => sum + val, 0) / totalCount).toFixed(2)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Bins</Text>
          <Text style={styles.statValue}>{bins}</Text>
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
