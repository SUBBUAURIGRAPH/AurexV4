/**
 * Pie Chart Component
 * Displays proportional data in a circular format with labeled segments
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  VictoryPie,
  VictoryLegend,
  VictoryContainer
} from 'victory-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DataPoint {
  x: string;
  y: number;
  color?: string;
}

interface PieChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  title?: string;
  showLegend?: boolean;
  showLabels?: boolean;
  innerRadius?: number;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  width = SCREEN_WIDTH - 32,
  height = 300,
  title,
  showLegend = true,
  showLabels = true,
  innerRadius = 0
}) => {
  // Color palette for pie slices
  const colorPalette = [
    '#0066CC',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#84CC16'
  ];

  // Format data and calculate percentages
  const chartData = useMemo(() => {
    const total = data.reduce((sum, point) => sum + point.y, 0);

    return data.map((point, index) => ({
      x: point.x,
      y: point.y,
      percentage: ((point.y / total) * 100).toFixed(1),
      color: point.color || colorPalette[index % colorPalette.length],
      label: showLabels ? `${((point.y / total) * 100).toFixed(1)}%` : undefined
    }));
  }, [data, showLabels]);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  const total = data.reduce((sum, point) => sum + point.y, 0);
  const legendData = chartData.map(point => ({
    name: `${point.x}: ${point.percentage}%`,
    symbol: { fill: point.color }
  }));

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.chartWrapper}>
        <VictoryContainer width={width} height={height - 80}>
          <VictoryPie
            data={chartData}
            width={width}
            height={height - 80}
            colorScale={chartData.map(d => d.color)}
            innerRadius={innerRadius}
            padAngle={2}
            style={{
              labels: {
                fill: '#fff',
                fontSize: 12,
                fontWeight: 'bold'
              },
              data: {
                fillOpacity: 0.9,
                stroke: '#1E293B',
                strokeWidth: 2
              }
            }}
            labelRadius={({ innerRadius }) => innerRadius + 40}
          />
        </VictoryContainer>

        {/* Center Label for Total */}
        {innerRadius > 0 && (
          <View style={styles.centerLabel}>
            <Text style={styles.centerLabelTitle}>Total</Text>
            <Text style={styles.centerLabelValue}>${total.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Legend */}
      {showLegend && (
        <View style={styles.legendContainer}>
          {chartData.map((point, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: point.color }]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {point.x}: {point.percentage}%
              </Text>
            </View>
          ))}
        </View>
      )}
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
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerLabelTitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4
  },
  centerLabelValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E5E7EB'
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
    maxWidth: '45%'
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6
  },
  legendText: {
    fontSize: 11,
    color: '#9CA3AF',
    flex: 1
  }
});
