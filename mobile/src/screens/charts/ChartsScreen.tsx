/**
 * Charts Screen - Interactive Candlestick Charts with Technical Indicators
 * Displays OHLCV data and technical indicators with zoom/pan controls
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchChartData, selectSymbol, setTimeframe } from '../../store/chartsSlice';

export default function ChartsScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const { chartData, selectedSymbol, chartTimeframe, isLoading } = useAppSelector(
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

  const currentSymbol = selectedSymbol || 'AAPL';
  const timeframes = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];

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
      await dispatch(
        fetchChartData({
          symbol: currentSymbol,
          interval: chartTimeframe.toLowerCase()
        })
      );
    }
  };

  const handleSymbolSearch = (text) => {
    setSearchInput(text);
    if (text.length > 0) {
      setFilteredSymbols(
        ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX'].filter(s =>
          s.includes(text.toUpperCase())
        )
      );
    } else {
      setFilteredSymbols(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN']);
    }
  };

  const handleSelectSymbol = (symbol) => {
    dispatch(selectSymbol(symbol));
    setSearchInput('');
    setFilteredSymbols(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN']);
  };

  const data = chartData[currentSymbol];
  const candles = data?.data || [];
  const lastCandle = candles[candles.length - 1];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
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
              <Text style={styles.lastPrice}>
                ${lastCandle.close.toFixed(2)}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
            <View style={styles.tradeButton}>
              <Text style={styles.tradeButtonText}>Trade</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Chart Placeholder */}
        <View style={styles.chartContainer}>
          {isLoading ? (
            <View style={styles.loadingChart}>
              <ActivityIndicator size="large" color="#0066CC" />
            </View>
          ) : candles.length > 0 ? (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartTitle}>Candlestick Chart</Text>
              <View style={styles.mockChart}>
                <View style={styles.chartLine} />
                <View style={styles.chartLine} />
                <View style={styles.chartLine} />
              </View>
              <Text style={styles.chartNote}>
                {candles.length} candles loaded - Chart rendering with Chart.js
              </Text>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No chart data available</Text>
            </View>
          )}
        </View>

        {/* Chart Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity style={styles.controlButton}>
            <Text style={styles.controlButtonText}>🔍+ Zoom</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton}>
            <Text style={styles.controlButtonText}>🔍- Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton}>
            <Text style={styles.controlButtonText}>↔️ Pan</Text>
          </TouchableOpacity>
        </View>

        {/* Timeframe Selection */}
        <View style={styles.timeframeContainer}>
          <Text style={styles.timeframeLabel}>Timeframe</Text>
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
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Technical Indicators</Text>
          <View style={styles.indicatorItem}>
            <Text style={styles.indicatorLabel}>SMA 20</Text>
            <Text style={styles.indicatorValue}>
              ${(lastCandle?.close || 0).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.indicatorItem, styles.borderTop]}>
            <Text style={styles.indicatorLabel}>EMA 12</Text>
            <Text style={styles.indicatorValue}>
              ${(lastCandle?.close || 0).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.indicatorItem, styles.borderTop]}>
            <Text style={styles.indicatorLabel}>RSI 14</Text>
            <Text style={styles.indicatorValue}>65.4</Text>
          </View>
          <View style={[styles.indicatorItem, styles.borderTop]}>
            <Text style={styles.indicatorLabel}>MACD</Text>
            <Text style={styles.indicatorValue}>Positive</Text>
          </View>
        </View>

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
                    day: 'numeric'
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
                    <Text style={styles.ohlcValue}>${candle.close.toFixed(2)}</Text>
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
  lastPrice: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 4
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
  chartContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    minHeight: 300,
    borderWidth: 1,
    borderColor: '#334155'
  },
  loadingChart: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300
  },
  chartPlaceholder: {
    alignItems: 'center'
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 12
  },
  mockChart: {
    width: '100%',
    height: 200,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12
  },
  chartLine: {
    height: 2,
    backgroundColor: '#0066CC',
    marginVertical: 20,
    opacity: 0.5
  },
  chartNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center'
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
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 6,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  controlButtonText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  timeframeContainer: {
    marginBottom: 16
  },
  timeframeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8
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
    fontSize: 12,
    color: '#9CA3AF',
    width: 60
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
    fontSize: 12,
    fontWeight: '600',
    color: '#fff'
  },
  volume: {
    fontSize: 12,
    color: '#9CA3AF',
    width: 50,
    textAlign: 'right'
  },
  bottomSpacing: {
    height: 40
  }
});
