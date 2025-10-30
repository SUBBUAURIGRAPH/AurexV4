/**
 * Charts Screen - Interactive Charts with Multiple Visualization Types
 * Displays OHLCV data and technical indicators with 8 different chart types
 * Features: candlestick, line, area, bar, scatter, histogram, pie, donut
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchChartData, selectSymbol, setTimeframe } from '../../store/chartsSlice';
import {
  CandlestickChart,
  LineChart,
  AreaChart,
  BarChart,
  ScatterChart,
  HistogramChart,
  PieChart,
  DonutChart
} from '../../components/charts';

type ChartType = 'candlestick' | 'line' | 'area' | 'bar' | 'scatter' | 'histogram' | 'pie' | 'donut';

export default function ChartsScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const { chartData, selectedSymbol, chartTimeframe, isLoading, error } = useAppSelector(
    state => state.charts
  );

  const [searchInput, setSearchInput] = useState('');
  const [filteredSymbols, setFilteredSymbols] = useState([
    'AAPL',
    'GOOGL',
    'MSFT',
    'TSLA',
    'AMZN'
  ]);
  const [activeChartType, setActiveChartType] = useState<ChartType>('candlestick');
  const [refreshing, setRefreshing] = useState(false);

  const currentSymbol = selectedSymbol || 'AAPL';
  const timeframes = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];
  const chartTypes: { label: string; value: ChartType }[] = [
    { label: 'Candle', value: 'candlestick' },
    { label: 'Line', value: 'line' },
    { label: 'Area', value: 'area' },
    { label: 'Bar', value: 'bar' },
    { label: 'Scatter', value: 'scatter' },
    { label: 'Histogram', value: 'histogram' },
    { label: 'Pie', value: 'pie' },
    { label: 'Donut', value: 'donut' }
  ];

  useEffect(() => {
    if (!selectedSymbol) {
      dispatch(selectSymbol('AAPL'));
    }
    loadChartData();
  }, []);

  useEffect(() => {
    loadChartData();
  }, [selectedSymbol, chartTimeframe]);

  const loadChartData = async () => {
    if (currentSymbol) {
      try {
        await dispatch(
          fetchChartData({
            symbol: currentSymbol,
            interval: chartTimeframe.toLowerCase()
          })
        ).unwrap();
      } catch (err) {
        console.error('Failed to load chart data:', err);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChartData();
    setRefreshing(false);
  }, [currentSymbol, chartTimeframe]);

  const handleSymbolSearch = (text: string) => {
    setSearchInput(text);
    if (text.length > 0) {
      setFilteredSymbols(
        ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC'].filter(s =>
          s.includes(text.toUpperCase())
        )
      );
    } else {
      setFilteredSymbols(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN']);
    }
  };

  const handleSelectSymbol = (symbol: string) => {
    dispatch(selectSymbol(symbol));
    setSearchInput('');
    setFilteredSymbols(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN']);
  };

  const data = chartData[currentSymbol];
  const candles = data?.data || [];
  const lastCandle = candles[candles.length - 1];

  // Transform OHLCV data for different chart types
  const transformDataForChart = (type: ChartType) => {
    if (!candles || candles.length === 0) return [];

    switch (type) {
      case 'candlestick':
        return candles;

      case 'line':
        return candles.map((candle, index) => ({
          x: index + 1,
          y: candle.close
        }));

      case 'area':
        return candles.map((candle, index) => ({
          x: index + 1,
          y: candle.close,
          y0: 0
        }));

      case 'bar':
        return candles.slice(-10).map((candle) => ({
          x: new Date(candle.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          y: candle.close
        }));

      case 'scatter':
        return candles.map((candle) => ({
          x: candle.volume / 1000000,
          y: candle.close
        }));

      case 'histogram':
        return candles.map(candle => candle.close);

      case 'pie':
      case 'donut':
        // Show OHLC as pie slices for the last candle
        if (lastCandle) {
          return [
            { x: 'Open', y: lastCandle.open },
            { x: 'High', y: lastCandle.high },
            { x: 'Low', y: lastCandle.low },
            { x: 'Close', y: lastCandle.close }
          ];
        }
        return [];

      default:
        return candles;
    }
  };

  const renderChart = () => {
    const transformedData = transformDataForChart(activeChartType);

    if (!transformedData || transformedData.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No chart data available</Text>
        </View>
      );
    }

    switch (activeChartType) {
      case 'candlestick':
        return (
          <CandlestickChart
            data={transformedData}
            title={`${currentSymbol} - ${chartTimeframe}`}
            enableZoom={true}
          />
        );

      case 'line':
        return (
          <LineChart
            data={transformedData}
            title={`${currentSymbol} Price Trend`}
            lineColor="#0066CC"
            showPoints={candles.length <= 30}
            yAxisLabel="Price ($)"
          />
        );

      case 'area':
        return (
          <AreaChart
            data={transformedData}
            title={`${currentSymbol} Price Area`}
            fillColor="rgba(0, 102, 204, 0.3)"
            strokeColor="#0066CC"
            yAxisLabel="Price ($)"
          />
        );

      case 'bar':
        return (
          <BarChart
            data={transformedData}
            title={`${currentSymbol} Recent Prices`}
            barColor="#0066CC"
            yAxisLabel="Price ($)"
          />
        );

      case 'scatter':
        return (
          <ScatterChart
            data={transformedData}
            title={`${currentSymbol} Volume vs Price`}
            pointColor="#0066CC"
            xAxisLabel="Volume (M)"
            yAxisLabel="Price ($)"
          />
        );

      case 'histogram':
        return (
          <HistogramChart
            data={transformedData}
            title={`${currentSymbol} Price Distribution`}
            bins={15}
            barColor="#0066CC"
            xAxisLabel="Price Range"
            yAxisLabel="Frequency"
          />
        );

      case 'pie':
        return (
          <PieChart
            data={transformedData}
            title={`${currentSymbol} OHLC Breakdown`}
            showLegend={true}
            showLabels={true}
          />
        );

      case 'donut':
        return (
          <DonutChart
            data={transformedData}
            title={`${currentSymbol} OHLC Distribution`}
            showLegend={true}
            showLabels={true}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0066CC"
            colors={['#0066CC']}
          />
        }
      >
        {/* Symbol Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search symbol (e.g., AAPL)"
            placeholderTextColor="#9CA3AF"
            value={searchInput}
            onChangeText={handleSymbolSearch}
          />
        </View>

        {/* Symbol Suggestions */}
        {searchInput.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {filteredSymbols.map(symbol => (
              <TouchableOpacity
                key={symbol}
                style={styles.suggestionItem}
                onPress={() => handleSelectSymbol(symbol)}
              >
                <Text style={styles.suggestionText}>{symbol}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Current Symbol Header */}
        <View style={styles.symbolHeader}>
          <View>
            <Text style={styles.symbolName}>{currentSymbol}</Text>
            {lastCandle && (
              <View style={styles.priceInfo}>
                <Text style={styles.lastPrice}>
                  ${lastCandle.close.toFixed(2)}
                </Text>
                {candles.length > 1 && (
                  <Text
                    style={[
                      styles.priceChange,
                      {
                        color:
                          lastCandle.close >= candles[0].close
                            ? '#10B981'
                            : '#EF4444'
                      }
                    ]}
                  >
                    {lastCandle.close >= candles[0].close ? '+' : ''}
                    {((lastCandle.close - candles[0].close) / candles[0].close * 100).toFixed(2)}%
                  </Text>
                )}
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
            <View style={styles.tradeButton}>
              <Text style={styles.tradeButtonText}>Trade</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Chart Type Selector */}
        <View style={styles.chartTypeContainer}>
          <Text style={styles.sectionLabel}>Chart Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {chartTypes.map(type => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.chartTypeButton,
                  activeChartType === type.value && styles.chartTypeButtonActive
                ]}
                onPress={() => setActiveChartType(type.value)}
              >
                <Text
                  style={[
                    styles.chartTypeText,
                    activeChartType === type.value && styles.chartTypeTextActive
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Chart Display */}
        <View style={styles.chartContainer}>
          {isLoading && !candles.length ? (
            <View style={styles.loadingChart}>
              <ActivityIndicator size="large" color="#0066CC" />
              <Text style={styles.loadingText}>Loading chart data...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadChartData}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            renderChart()
          )}
        </View>

        {/* Timeframe Selection */}
        <View style={styles.timeframeContainer}>
          <Text style={styles.sectionLabel}>Timeframe</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {timeframes.map(tf => (
              <TouchableOpacity
                key={tf}
                style={[
                  styles.timeframeButton,
                  chartTimeframe === tf && styles.timeframeButtonActive
                ]}
                onPress={() => dispatch(setTimeframe(tf as any))}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    chartTimeframe === tf && styles.timeframeTextActive
                  ]}
                >
                  {tf}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Technical Indicators */}
        {candles.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Technical Summary</Text>
            <View style={styles.indicatorItem}>
              <Text style={styles.indicatorLabel}>Latest Close</Text>
              <Text style={styles.indicatorValue}>
                ${(lastCandle?.close || 0).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.indicatorItem, styles.borderTop]}>
              <Text style={styles.indicatorLabel}>Volume</Text>
              <Text style={styles.indicatorValue}>
                {((lastCandle?.volume || 0) / 1000000).toFixed(2)}M
              </Text>
            </View>
            <View style={[styles.indicatorItem, styles.borderTop]}>
              <Text style={styles.indicatorLabel}>High ({chartTimeframe})</Text>
              <Text style={styles.indicatorValue}>
                ${Math.max(...candles.map(c => c.high)).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.indicatorItem, styles.borderTop]}>
              <Text style={styles.indicatorLabel}>Low ({chartTimeframe})</Text>
              <Text style={styles.indicatorValue}>
                ${Math.min(...candles.map(c => c.low)).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Recent Candles */}
        {candles.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Recent Data</Text>
              <Text style={styles.dataCount}>{candles.length} candles</Text>
            </View>
            {candles.slice(-5).reverse().map((candle, index) => (
              <View key={index} style={[styles.candleItem, index > 0 && styles.borderTop]}>
                <Text style={styles.candleDate}>
                  {new Date(candle.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
                <View style={styles.candleOHLC}>
                  <View style={styles.ohlcPair}>
                    <Text style={styles.ohlcLabel}>O</Text>
                    <Text style={styles.ohlcValue}>${candle.open.toFixed(2)}</Text>
                  </View>
                  <View style={styles.ohlcPair}>
                    <Text style={styles.ohlcLabel}>H</Text>
                    <Text style={styles.ohlcValue}>${candle.high.toFixed(2)}</Text>
                  </View>
                  <View style={styles.ohlcPair}>
                    <Text style={styles.ohlcLabel}>L</Text>
                    <Text style={styles.ohlcValue}>${candle.low.toFixed(2)}</Text>
                  </View>
                  <View style={styles.ohlcPair}>
                    <Text style={styles.ohlcLabel}>C</Text>
                    <Text style={[styles.ohlcValue, {
                      color: candle.close >= candle.open ? '#10B981' : '#EF4444'
                    }]}>
                      ${candle.close.toFixed(2)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.volume}>
                  {(candle.volume / 1000000).toFixed(1)}M
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  content: {
    flex: 1,
    padding: 16
  },
  searchContainer: {
    marginBottom: 12
  },
  searchInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14
  },
  suggestionsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155'
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  suggestionText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500'
  },
  symbolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  symbolName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8
  },
  lastPrice: {
    fontSize: 16,
    color: '#9CA3AF'
  },
  priceChange: {
    fontSize: 14,
    fontWeight: '600'
  },
  tradeButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6
  },
  tradeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
  chartTypeContainer: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8
  },
  chartTypeButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  chartTypeButtonActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC'
  },
  chartTypeText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600'
  },
  chartTypeTextActive: {
    color: '#fff'
  },
  chartContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    minHeight: 320,
    borderWidth: 1,
    borderColor: '#334155'
  },
  loadingChart: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
    gap: 12
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
    gap: 16
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20
  },
  retryButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
  noDataContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300
  },
  noDataText: {
    color: '#9CA3AF',
    fontSize: 14
  },
  timeframeContainer: {
    marginBottom: 16
  },
  timeframeButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  timeframeButtonActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC'
  },
  timeframeText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600'
  },
  timeframeTextActive: {
    color: '#fff'
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 12
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  dataCount: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  indicatorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  indicatorLabel: {
    fontSize: 14,
    color: '#E5E7EB'
  },
  indicatorValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff'
  },
  candleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12
  },
  candleDate: {
    fontSize: 11,
    color: '#9CA3AF',
    width: 80
  },
  candleOHLC: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 8
  },
  ohlcPair: {
    alignItems: 'center'
  },
  ohlcLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 2
  },
  ohlcValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff'
  },
  volume: {
    fontSize: 11,
    color: '#9CA3AF',
    width: 50,
    textAlign: 'right'
  },
  bottomSpacing: {
    height: 40
  }
});
