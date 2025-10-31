/**
 * Analytics Performance Screen
 * Detailed performance analysis and metrics
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Text
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSelector } from '@/store/hooks';
import { AnalyticsService } from '@/services/analyticsService';
import PerformanceChart from '@/components/analytics/PerformanceChart';
import MetricCard from '@/components/analytics/MetricCard';
import MetricTable from '@/components/analytics/MetricTable';
import TabBar from '@/components/common/TabBar';
import { colors, spacing } from '@/theme';

interface PerformanceScreenProps {
  navigation: any;
  route: any;
}

type Tab = 'overview' | 'metrics' | 'returns' | 'trades';

export const AnalyticsPerformanceScreen: React.FC<PerformanceScreenProps> = ({
  navigation,
  route
}) => {
  const { userId } = useAppSelector(state => state.auth);
  const strategyId = route.params?.strategyId;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [performance, setPerformance] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const analyticsService = AnalyticsService.getInstance(userId);

  /**
   * Load performance data
   */
  const loadPerformance = async (): Promise<void> => {
    try {
      setError(null);
      const data = await analyticsService.getPerformanceMetrics(strategyId);
      setPerformance(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Load on focus
   */
  useFocusEffect(
    React.useCallback(() => {
      loadPerformance();
    }, [strategyId])
  );

  /**
   * Handle refresh
   */
  const handleRefresh = (): void => {
    setRefreshing(true);
    loadPerformance();
  };

  if (loading && !performance) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const latestMetrics = performance?.[performance.length - 1];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Performance Analysis</Text>
        <Text style={styles.headerSubtitle}>
          {strategyId || 'All Strategies'}
        </Text>
      </View>

      {/* Tab Bar */}
      <TabBar
        tabs={[
          { label: 'Overview', value: 'overview' },
          { label: 'Metrics', value: 'metrics' },
          { label: 'Returns', value: 'returns' },
          { label: 'Trades', value: 'trades' }
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as Tab)}
      />

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {activeTab === 'overview' && latestMetrics && (
          <>
            {/* Chart */}
            <PerformanceChart
              data={performance}
              height={300}
              style={styles.section}
            />

            {/* KPI Cards */}
            <View style={styles.section}>
              <MetricCard
                label="Cumulative Return"
                value={`${(latestMetrics.cumulativeReturn * 100).toFixed(2)}%`}
                icon="📈"
                trend={latestMetrics.cumulativeReturn >= 0 ? 'up' : 'down'}
              />
            </View>

            <View style={styles.section}>
              <MetricCard
                label="Sharpe Ratio"
                value={latestMetrics.sharpeRatio?.toFixed(2) || 'N/A'}
                icon="🎯"
              />
            </View>

            <View style={styles.section}>
              <MetricCard
                label="Win Rate"
                value={`${(latestMetrics.winRate * 100).toFixed(2)}%`}
                icon="✅"
              />
            </View>
          </>
        )}

        {activeTab === 'metrics' && latestMetrics && (
          <View style={styles.section}>
            <MetricTable
              metrics={[
                {
                  label: 'Sharpe Ratio',
                  value: latestMetrics.sharpeRatio?.toFixed(2) || 'N/A',
                  tooltip: 'Risk-adjusted return'
                },
                {
                  label: 'Sortino Ratio',
                  value: latestMetrics.sortinoRatio?.toFixed(2) || 'N/A',
                  tooltip: 'Downside risk-adjusted return'
                },
                {
                  label: 'Calmar Ratio',
                  value: latestMetrics.calmarRatio?.toFixed(2) || 'N/A',
                  tooltip: 'Return per unit of drawdown'
                },
                {
                  label: 'Daily Volatility',
                  value: `${(latestMetrics.dailyVolatility * 100).toFixed(2)}%`,
                  tooltip: 'Standard deviation of daily returns'
                },
                {
                  label: 'Max Drawdown',
                  value: `${(latestMetrics.maxDrawdown * 100).toFixed(2)}%`,
                  tooltip: 'Largest peak-to-trough decline'
                }
              ]}
            />
          </View>
        )}

        {activeTab === 'returns' && latestMetrics && (
          <View style={styles.section}>
            <MetricTable
              metrics={[
                {
                  label: 'Daily Return',
                  value: `${(latestMetrics.dailyReturn * 100).toFixed(2)}%`,
                  trend: latestMetrics.dailyReturn >= 0 ? 'up' : 'down'
                },
                {
                  label: 'Cumulative Return',
                  value: `${(latestMetrics.cumulativeReturn * 100).toFixed(2)}%`,
                  trend: latestMetrics.cumulativeReturn >= 0 ? 'up' : 'down'
                },
                {
                  label: 'Price Change',
                  value: `$${latestMetrics.priceChange.toFixed(2)}`,
                  trend: latestMetrics.priceChange >= 0 ? 'up' : 'down'
                },
                {
                  label: 'Profit Factor',
                  value: latestMetrics.profitFactor?.toFixed(2) || 'N/A'
                },
                {
                  label: 'Expectancy',
                  value: `$${latestMetrics.expectancy?.toFixed(2) || '0.00'}`
                }
              ]}
            />
          </View>
        )}

        {activeTab === 'trades' && latestMetrics && (
          <View style={styles.section}>
            <MetricTable
              metrics={[
                {
                  label: 'Win Rate',
                  value: `${(latestMetrics.winRate * 100).toFixed(2)}%`,
                  color: latestMetrics.winRate > 0.5 ? colors.success : colors.danger
                },
                {
                  label: 'Profit Factor',
                  value: latestMetrics.profitFactor?.toFixed(2) || 'N/A'
                },
                {
                  label: 'Total Trades',
                  value: latestMetrics.totalTrades?.toString() || '0'
                },
                {
                  label: 'Winning Trades',
                  value: latestMetrics.winningTrades?.toString() || '0'
                },
                {
                  label: 'Losing Trades',
                  value: latestMetrics.losingTrades?.toString() || '0'
                },
                {
                  label: 'Avg Win',
                  value: `$${latestMetrics.avgWin?.toFixed(2) || '0.00'}`,
                  color: colors.success
                },
                {
                  label: 'Avg Loss',
                  value: `$${latestMetrics.avgLoss?.toFixed(2) || '0.00'}`,
                  color: colors.danger
                },
                {
                  label: 'Payoff Ratio',
                  value: latestMetrics.payoffRatio?.toFixed(2) || 'N/A'
                }
              ]}
            />
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    paddingTop: spacing.xl
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: spacing.sm
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)'
  },
  content: {
    flex: 1,
    padding: spacing.md
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  section: {
    marginBottom: spacing.md
  },
  errorContainer: {
    backgroundColor: colors.danger,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md
  },
  errorText: {
    color: 'white',
    fontSize: 14
  },
  spacer: {
    height: spacing.lg
  }
});

export default AnalyticsPerformanceScreen;
