/**
 * Candlestick Chart Component
 * Displays OHLC (Open, High, Low, Close) data in candlestick format
 * Used for stock price visualization with bullish/bearish coloring
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryCandlestick,
  VictoryAxis,
  VictoryTheme,
  VictoryZoomContainer
} from 'victory-native';
import { OHLCV } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CandlestickChartProps {
  data: OHLCV[];
  width?: number;
  height?: number;
  enableZoom?: boolean;
  showVolume?: boolean;
  title?: string;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  width = SCREEN_WIDTH - 32,
  height = 300,
  enableZoom = true,
  showVolume = false,
  title
}) => {
  // Transform data for Victory format
  const chartData = useMemo(() => {
    return data.map((candle, index) => ({
      x: index + 1,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      timestamp: candle.timestamp,
      // Determine candle color
      fill: candle.close >= candle.open ? '#10B981' : '#EF4444'
    }));
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Calculate price range for better scaling
  const prices = data.flatMap(d => [d.high, d.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.1;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <VictoryChart
        width={width}
        height={height}
        theme={VictoryTheme.material}
        domainPadding={{ x: 20 }}
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
        {/* Y-Axis (Price) */}
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: '#334155' },
            tickLabels: { fill: '#9CA3AF', fontSize: 10 },
            grid: { stroke: '#334155', strokeDasharray: '4, 4' }
          }}
          tickFormat={(t) => `$${t.toFixed(0)}`}
          domain={[minPrice - padding, maxPrice + padding]}
        />

        {/* X-Axis (Time) */}
        <VictoryAxis
          style={{
            axis: { stroke: '#334155' },
            tickLabels: { fill: '#9CA3AF', fontSize: 10, angle: -45, textAnchor: 'end' },
            grid: { stroke: 'transparent' }
          }}
          tickFormat={(t) => {
            const index = Math.floor(t) - 1;
            if (index >= 0 && index < data.length) {
              const date = new Date(data[index].timestamp);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }
            return '';
          }}
          tickCount={Math.min(8, data.length)}
        />

        {/* Candlestick Data */}
        <VictoryCandlestick
          data={chartData}
          candleColors={{ positive: '#10B981', negative: '#EF4444' }}
          candleWidth={8}
          wickStrokeWidth={1}
          style={{
            data: {
              strokeWidth: 0.5
            }
          }}
        />
      </VictoryChart>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>Bullish</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Bearish</Text>
        </View>
        <Text style={styles.legendInfo}>{data.length} candles</Text>
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
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 16
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 2
  },
  legendText: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  legendInfo: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 8
  }
});
