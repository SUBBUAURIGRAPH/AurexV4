/**
 * Analytics Dashboard Screen
 * Mobile real-time analytics dashboard
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
  Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { AnalyticsService } from '@/services/analyticsService';
import DashboardHeader from '@/components/analytics/DashboardHeader';
import SummaryCard from '@/components/analytics/SummaryCard';
import PerformanceChart from '@/components/analytics/PerformanceChart';
import RiskCard from '@/components/analytics/RiskCard';
import PortfolioCard from '@/components/analytics/PortfolioCard';
import AlertsList from '@/components/analytics/AlertsList';
import { colors, typography, spacing } from '@/theme';

interface AnalyticsDashboardScreenProps {
  navigation: any;
}

export const AnalyticsDashboardScreen: React.FC<
  AnalyticsDashboardScreenProps
> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { userId } = useAppSelector(state => state.auth);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const analyticsService = AnalyticsService.getInstance(userId);

  /**
   * Load analytics data
   */
  const loadAnalytics = async (): Promise<void> => {
    try {
      setError(null);
      const data = await analyticsService.getAnalyticsSummary(
        selectedStrategy
      );
      setAnalytics(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Load data on screen focus
   */
  useFocusEffect(
    React.useCallback(() => {
      loadAnalytics();
    }, [selectedStrategy])
  );

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = (): void => {
    setRefreshing(true);
    loadAnalytics();
  };

  /**
   * Handle strategy selection
   */
  const handleStrategyChange = (strategyId: string | null): void => {
    setSelectedStrategy(strategyId);
    setLoading(true);
  };

  /**
   * Navigate to detailed performance
   */
  const handleViewPerformance = (): void => {
    navigation.navigate('AnalyticsPerformance', {
      strategyId: selectedStrategy
    });
  };

  /**
   * Navigate to risk analysis
   */
  const handleViewRisk = (): void => {
    navigation.navigate('AnalyticsRisk', {
      strategyId: selectedStrategy
    });
  };

  /**
   * Navigate to portfolio details
   */
  const handleViewPortfolio = (): void => {
    navigation.navigate('AnalyticsPortfolio');
  };

  if (loading && !analytics) {
    return (
      <View style={styles.container}>
        <DashboardHeader
          selectedStrategy={selectedStrategy}
          onStrategyChange={handleStrategyChange}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader
        selectedStrategy={selectedStrategy}
        onStrategyChange={handleStrategyChange}
        onRefresh={handleRefresh}
      />

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
            <AlertsList
              alerts={[{
                id: 0,
                type: 'error',
                message: error,
                dismissed: false
              }]}
              onDismiss={() => setError(null)}
            />
          </View>
        )}

        {analytics && (
          <>
            {/* Summary Cards */}
            <View style={styles.section}>
              <View style={styles.summaryGrid}>
                <SummaryCard
                  label="Total Value"
                  value={analytics.summary?.totalValue}
                  icon="💰"
                  onPress={handleViewPortfolio}
                />
                <SummaryCard
                  label="Return"
                  value={analytics.summary?.return}
                  icon="📈"
                  trend="up"
                  onPress={handleViewPerformance}
                />
              </View>

              <View style={styles.summaryGrid}>
                <SummaryCard
                  label="Sharpe Ratio"
                  value={analytics.summary?.sharpeRatio}
                  icon="🎯"
                  onPress={handleViewPerformance}
                />
                <SummaryCard
                  label="Risk Level"
                  value={analytics.summary?.riskLevel}
                  icon="⚠️"
                  onPress={handleViewRisk}
                />
              </View>
            </View>

            {/* Performance Chart */}
            <View style={styles.section}>
              <PerformanceChart
                title="Performance Trend"
                onPress={handleViewPerformance}
              />
            </View>

            {/* Risk Card */}
            <View style={styles.section}>
              <RiskCard
                data={analytics.risk}
                onPress={handleViewRisk}
              />
            </View>

            {/* Portfolio Card */}
            <View style={styles.section}>
              <PortfolioCard
                data={analytics.portfolio}
                onPress={handleViewPortfolio}
              />
            </View>

            {/* Recent Alerts */}
            {analytics.recentAlerts && analytics.recentAlerts.length > 0 && (
              <View style={styles.section}>
                <AlertsList
                  alerts={analytics.recentAlerts}
                  onDismiss={(alertId) => {
                    analyticsService.acknowledgeAlert(alertId);
                  }}
                  limit={5}
                />
              </View>
            )}
          </>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.md
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  section: {
    marginVertical: spacing.md
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  errorContainer: {
    marginVertical: spacing.md
  },
  spacer: {
    height: spacing.lg
  }
});

export default AnalyticsDashboardScreen;
