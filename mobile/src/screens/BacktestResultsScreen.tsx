/**
 * Backtest Results Screen
 * Display comprehensive backtest results and metrics
 *
 * Performance Optimizations:
 * - Memoized metric cards to prevent re-renders
 * - Optimized equity curve chart with memoization
 * - Extracted TradeCard as memoized component
 * - Memoized dimension calculations
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList
} from 'react-native';
import { Text, Card, Tabs, Divider, IconButton } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { LineChart, BarChart } from 'react-native-chart-kit';

import {
  getBacktestResults,
  getEquityHistory,
  getBacktestMetrics,
  selectSelectedBacktestResult,
  selectBacktestLoading
} from '../store/backtestingSlice';
import { AppDispatch } from '../store';
import type { BacktestMetrics, BacktestTrade } from '../types/backtesting';

interface BacktestResultsScreenProps {
  route?: any;
  navigation?: any;
}

interface MetricCardProps {
  label: string;
  value: string;
  color: string;
}

// Memoized Metric Card Component - prevents unnecessary re-renders
const MetricCard = React.memo<MetricCardProps>(({ label, value, color }) => (
  <Card style={[styles.metricCard, { borderLeftColor: color }]}>
    <Card.Content>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </Card.Content>
  </Card>
));
MetricCard.displayName = 'MetricCard';

interface TradeCardProps {
  trade: BacktestTrade;
}

// Memoized Trade Card Component - prevents re-renders on parent updates
const TradeCard = React.memo<TradeCardProps>(({ trade }) => (
  <Card style={styles.tradeCard}>
    <Card.Content>
      <View style={styles.tradeHeader}>
        <Text style={[
          styles.tradePnL,
          { color: trade.netPnL >= 0 ? '#4CAF50' : '#F44336' }
        ]}>
          {trade.netPnL >= 0 ? '+' : ''}{trade.netPnL.toFixed(2)}
        </Text>
        <Text style={styles.tradePnLPercent}>
          {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
        </Text>
      </View>

      <Divider style={styles.tradeDivider} />

      <View style={styles.tradeRow}>
        <Text style={styles.tradeLabel}>Entry: {trade.entryDate?.toString().substring(0, 10)}</Text>
        <Text style={styles.tradeValue}>${trade.entryPrice.toFixed(2)}</Text>
      </View>

      <View style={styles.tradeRow}>
        <Text style={styles.tradeLabel}>Exit: {trade.exitDate?.toString().substring(0, 10)}</Text>
        <Text style={styles.tradeValue}>${trade.exitPrice?.toFixed(2) || '—'}</Text>
      </View>

      <View style={styles.tradeRow}>
        <Text style={styles.tradeLabel}>Holding Period</Text>
        <Text style={styles.tradeValue}>{trade.holdingPeriod} days</Text>
      </View>

      <View style={styles.tradeRow}>
        <Text style={styles.tradeLabel}>Commission</Text>
        <Text style={styles.tradeValue}>${trade.totalCommission.toFixed(2)}</Text>
      </View>
    </Card.Content>
  </Card>
));
TradeCard.displayName = 'TradeCard';

const BacktestResultsScreen: React.FC<BacktestResultsScreenProps> = ({
  route,
  navigation
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const result = useSelector(selectSelectedBacktestResult);
  const loading = useSelector(selectBacktestLoading);
  const backtestId = route?.params?.backtestId;

  const [activeTab, setActiveTab] = useState('metrics');

  // Load results on mount
  useEffect(() => {
    if (backtestId) {
      dispatch(getBacktestResults(backtestId));
      dispatch(getEquityHistory(backtestId));
      dispatch(getBacktestMetrics(backtestId));
    }
  }, [backtestId, dispatch]);

  const renderMetricsTab = useCallback(() => {
    if (!result?.metrics) return <Text>No metrics available</Text>;

    const metrics = result.metrics;

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Performance Metrics */}
        <Text variant="titleMedium" style={styles.tabSectionTitle}>
          📈 Performance
        </Text>

        <MetricCard
          label="Total Return"
          value={`${metrics.totalReturn.toFixed(2)}%`}
          color="#4CAF50"
        />
        <MetricCard
          label="Annualized Return"
          value={`${metrics.annualizedReturn.toFixed(2)}%`}
          color="#2196F3"
        />
        <MetricCard
          label="Net Profit"
          value={`$${metrics.totalReturn > 0 ? '+' : ''}${(result.finalEquity - result.initialCapital).toFixed(2)}`}
          color={metrics.totalReturn > 0 ? '#4CAF50' : '#F44336'}
        />

        {/* Risk Metrics */}
        <Text variant="titleMedium" style={styles.tabSectionTitle}>
          ⚠️ Risk
        </Text>

        <MetricCard
          label="Max Drawdown"
          value={`${metrics.maxDrawdown.toFixed(2)}%`}
          color="#F44336"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={`${metrics.sharpeRatio.toFixed(3)}`}
          color="#FF9800"
        />
        <MetricCard
          label="Sortino Ratio"
          value={`${metrics.sortinoRatio.toFixed(3)}`}
          color="#FF9800"
        />
        <MetricCard
          label="Calmar Ratio"
          value={`${metrics.calmarRatio.toFixed(3)}`}
          color="#FF9800"
        />
        <MetricCard
          label="Volatility"
          value={`${(metrics.volatility * 100).toFixed(2)}%`}
          color="#FF5722"
        />

        {/* Trade Statistics */}
        <Text variant="titleMedium" style={styles.tabSectionTitle}>
          🎯 Trading Statistics
        </Text>

        <MetricCard
          label="Total Trades"
          value={`${metrics.totalTrades}`}
          color="#9C27B0"
        />
        <MetricCard
          label="Win Rate"
          value={`${metrics.winRate.toFixed(2)}%`}
          color={metrics.winRate > 50 ? '#4CAF50' : '#F44336'}
        />
        <MetricCard
          label="Profit Factor"
          value={`${metrics.profitFactor.toFixed(2)}`}
          color="#673AB7"
        />
        <MetricCard
          label="Avg Win"
          value={`$${metrics.avgWin.toFixed(2)}`}
          color="#4CAF50"
        />
        <MetricCard
          label="Avg Loss"
          value={`$${Math.abs(metrics.avgLoss).toFixed(2)}`}
          color="#F44336"
        />
      </ScrollView>
    );
  }, [result]);

  // Memoize chart dimension calculations
  const chartDimensions = useMemo(() => ({
    width: Dimensions.get('window').width - 32,
    height: 250
  }), []);

  const renderEquityCurveTab = useCallback(() => {
    if (!result?.equityCurve || result.equityCurve.length === 0) {
      return <Text style={styles.noDataText}>No equity curve data available</Text>;
    }

    // Prepare data for chart (sample every nth point to avoid overcrowding)
    const sampleRate = Math.ceil(result.equityCurve.length / 20);
    const sampledData = result.equityCurve.filter((_, i) => i % sampleRate === 0);

    // Memoize chart data generation
    const chartData = {
      labels: sampledData.map(point =>
        new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      ),
      datasets: [
        {
          data: sampledData.map(point => point.equity),
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`
        }
      ]
    };

    return (
      <View style={styles.chartContainer}>
        <Text variant="titleMedium" style={styles.chartTitle}>
          Equity Curve ({result.equityCurve.length} data points)
        </Text>
        <LineChart
          data={chartData}
          width={chartDimensions.width}
          height={chartDimensions.height}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#f9f9f9',
            decimalPlaces: 0,
            color: () => '#4CAF50',
            labelColor: () => '#666',
            style: {
              borderRadius: 8
            }
          }}
          bezier
        />
      </View>
    );
  }, [result?.equityCurve, chartDimensions]);

  const renderTradesTab = useCallback(() => {
    if (!result?.trades || result.trades.length === 0) {
      return <Text style={styles.noDataText}>No trades executed</Text>;
    }

    const renderTradeItem = useCallback(({ item: trade }: { item: BacktestTrade }) => (
      <TradeCard trade={trade} />
    ), []);

    return (
      <FlatList
        data={result.trades}
        keyExtractor={trade => trade.id}
        renderItem={renderTradeItem}
        scrollEnabled={false}
        ListHeaderComponent={
          <Text variant="titleMedium" style={styles.tabSectionTitle}>
            Trade History ({result.trades.length} trades)
          </Text>
        }
      />
    );
  }, [result?.trades]);

  if (loading && !result) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading results...</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.emptyContainer}>
        <Text>No results available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text variant="headlineMedium" style={styles.title}>
            {result.symbol} Backtest Results
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            {result.startDate?.toString().substring(0, 10)} to{' '}
            {result.endDate?.toString().substring(0, 10)}
          </Text>
        </View>
        <IconButton
          icon="close"
          size={24}
          onPress={() => navigation?.goBack()}
        />
      </View>

      {/* Summary Cards */}
      <ScrollView
        horizontal
        scrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        style={styles.summaryScroll}
        contentContainerStyle={styles.summaryContent}
      >
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.summaryLabel}>Total Return</Text>
            <Text style={[styles.summaryBigValue, { color: '#4CAF50' }]}>
              {result.metrics?.totalReturn.toFixed(2)}%
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.summaryLabel}>Max Drawdown</Text>
            <Text style={[styles.summaryBigValue, { color: '#F44336' }]}>
              {result.metrics?.maxDrawdown.toFixed(2)}%
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.summaryLabel}>Sharpe Ratio</Text>
            <Text style={[styles.summaryBigValue, { color: '#FF9800' }]}>
              {result.metrics?.sharpeRatio.toFixed(3)}
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.summaryLabel}>Win Rate</Text>
            <Text style={[
              styles.summaryBigValue,
              { color: result.metrics?.winRate ?? 0 > 50 ? '#4CAF50' : '#F44336' }
            ]}>
              {result.metrics?.winRate.toFixed(2)}%
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onIndexChange={index => {
          const tabs = ['metrics', 'equity', 'trades'];
          setActiveTab(tabs[index]);
        }}
      >
        <Tabs.Tab label="Metrics" value="metrics" />
        <Tabs.Tab label="Equity" value="equity" />
        <Tabs.Tab label="Trades" value="trades" />
      </Tabs>

      {/* Tab Content */}
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'metrics' && renderMetricsTab()}
        {activeTab === 'equity' && renderEquityCurveTab()}
        {activeTab === 'trades' && renderTradesTab()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },

  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },

  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4
  },

  subtitle: {
    color: '#666',
    fontSize: 12
  },

  summaryScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },

  summaryContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12
  },

  summaryCard: {
    minWidth: 140,
    backgroundColor: '#fafafa'
  },

  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8
  },

  summaryBigValue: {
    fontSize: 18,
    fontWeight: 'bold'
  },

  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },

  tabSectionTitle: {
    marginTop: 16,
    marginBottom: 12,
    fontWeight: '600',
    fontSize: 14
  },

  metricCard: {
    marginBottom: 8,
    borderLeftWidth: 4
  },

  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4
  },

  metricValue: {
    fontSize: 18,
    fontWeight: 'bold'
  },

  chartContainer: {
    marginVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12
  },

  chartTitle: {
    marginBottom: 12,
    fontWeight: '600'
  },

  tradeCard: {
    marginBottom: 8,
    backgroundColor: '#fff'
  },

  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },

  tradePnL: {
    fontSize: 18,
    fontWeight: 'bold'
  },

  tradePnLPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666'
  },

  tradeDivider: {
    marginVertical: 12
  },

  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8
  },

  tradeLabel: {
    fontSize: 12,
    color: '#666'
  },

  tradeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000'
  },

  noDataText: {
    textAlign: 'center',
    marginTop: 32,
    color: '#999',
    fontSize: 14
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  loadingText: {
    marginTop: 16,
    color: '#666'
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});

export default BacktestResultsScreen;
