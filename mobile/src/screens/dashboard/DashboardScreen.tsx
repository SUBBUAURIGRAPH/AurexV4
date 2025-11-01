/**
 * Dashboard Screen - Portfolio Overview and Quick Actions
 * Shows portfolio summary, key metrics, portfolio value history, P&L visualization,
 * and quick access to trading features
 */

import React, { useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchPortfolio, fetchPositions } from '../../store/tradingSlice';
import { fetchPortfolioCharts } from '../../store/chartsSlice';
import { LineChart, AreaChart, DonutChart } from '../../components/charts';

export default function DashboardScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const { portfolio, isLoading } = useAppSelector(state => state.trading);
  const { portfolioCharts } = useAppSelector(state => state.charts);
  const { user } = useAppSelector(state => state.auth);

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadPortfolioData();
  }, []);

  const loadPortfolioData = async () => {
    await Promise.all([
      dispatch(fetchPortfolio()),
      dispatch(fetchPositions()),
      dispatch(fetchPortfolioCharts())
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPortfolioData();
    setRefreshing(false);
  }, []);

  if (isLoading && !portfolio) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Loading portfolio...</Text>
      </View>
    );
  }

  const portfolioValue = portfolio?.totalValue || 0;
  const unrealizedPL = portfolio?.unrealizedPL || 0;
  const unrealizedPLPercent = portfolio?.unrealizedPLPercent || 0;
  const realizedPL = portfolio?.realizedPL || 0;
  const cash = portfolio?.cash || 0;
  const buyingPower = portfolio?.buyingPower || 0;
  const positions = portfolio?.positions || [];

  const isPositive = unrealizedPL >= 0;

  // Generate mock portfolio history data (in production, this comes from API)
  const generatePortfolioHistory = () => {
    const baseValue = portfolioValue;
    const days = 30;
    const history = [];

    for (let i = days; i >= 0; i--) {
      const variance = (Math.random() - 0.5) * (baseValue * 0.05); // 5% variance
      const value = baseValue + variance - (i * 100); // Trending up
      history.push({
        x: days - i,
        y: Math.max(value, baseValue * 0.9) // Ensure minimum value
      });
    }

    return history;
  };

  const portfolioHistory = generatePortfolioHistory();

  // Generate P&L breakdown for donut chart
  const plBreakdown = positions.length > 0
    ? positions.slice(0, 5).map(pos => ({
        x: pos.symbol,
        y: Math.abs(pos.unrealizedPL),
        color: pos.unrealizedPL >= 0 ? '#10B981' : '#EF4444'
      }))
    : [
        { x: 'No Positions', y: 1, color: '#334155' }
      ];

  // Calculate allocation percentages
  const allocationData = positions.length > 0
    ? positions.map(pos => ({
        x: pos.symbol,
        y: pos.totalValue
      }))
    : [{ x: 'Cash', y: cash }];

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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Welcome back, {user?.firstName || 'Trader'}
            </Text>
            <Text style={styles.timestamp}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Portfolio Value Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Portfolio Value</Text>
          <Text style={styles.portfolioValue}>
            ${portfolioValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </Text>

          {/* P&L Summary */}
          <View style={styles.plSummary}>
            <View style={styles.plItem}>
              <Text style={styles.plLabel}>Unrealized P&L</Text>
              <Text style={[styles.plValue, { color: isPositive ? '#10B981' : '#EF4444' }]}>
                {isPositive ? '+' : ''}${Math.abs(unrealizedPL).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.plPercent, { color: isPositive ? '#10B981' : '#EF4444' }]}>
                {isPositive ? '+' : ''}{unrealizedPLPercent.toFixed(2)}%
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.plItem}>
              <Text style={styles.plLabel}>Cash Available</Text>
              <Text style={styles.plValue}>
                ${cash.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.plItem}>
              <Text style={styles.plLabel}>Buying Power</Text>
              <Text style={styles.plValue}>
                ${buyingPower.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        {/* Portfolio Value History Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Portfolio Performance (30 Days)</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Charts')}>
              <Text style={styles.seeMoreLink}>Details →</Text>
            </TouchableOpacity>
          </View>
          <AreaChart
            data={portfolioHistory}
            height={220}
            fillColor="rgba(16, 185, 129, 0.2)"
            strokeColor="#10B981"
            yAxisLabel="Value ($)"
          />
        </View>

        {/* P&L Visualization */}
        {positions.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>P&L by Position</Text>
            <DonutChart
              data={plBreakdown}
              height={280}
              showLegend={true}
              showLabels={false}
            />
          </View>
        )}

        {/* Portfolio Allocation */}
        {positions.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Portfolio Allocation</Text>
              <Text style={styles.chartSubtitle}>{positions.length} positions</Text>
            </View>
            <DonutChart
              data={allocationData}
              height={280}
              showLegend={true}
              showLabels={true}
            />
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Orders')}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>Trade</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Charts')}
          >
            <Text style={styles.actionIcon}>📈</Text>
            <Text style={styles.actionLabel}>Charts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Positions')}
          >
            <Text style={styles.actionIcon}>💼</Text>
            <Text style={styles.actionLabel}>Positions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Orders')}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>Orders</Text>
          </TouchableOpacity>
        </View>

        {/* Top Positions */}
        {positions.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Top Positions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Positions')}>
                <Text style={styles.seeAllLink}>See All →</Text>
              </TouchableOpacity>
            </View>

            {positions.slice(0, 3).map((position, index) => (
              <View key={index} style={[styles.positionItem, index > 0 && styles.borderTop]}>
                <View style={styles.positionInfo}>
                  <Text style={styles.symbol}>{position.symbol}</Text>
                  <Text style={styles.quantity}>
                    {position.quantity} shares @ ${position.averageCost.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.positionValue}>
                  <Text style={styles.value}>
                    ${position.totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </Text>
                  <Text
                    style={[
                      styles.positionPercent,
                      { color: position.unrealizedPLPercent >= 0 ? '#10B981' : '#EF4444' }
                    ]}
                  >
                    {position.unrealizedPLPercent >= 0 ? '+' : ''}
                    {position.unrealizedPLPercent.toFixed(2)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Performance Metrics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance Metrics</Text>

          <View style={styles.metricRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Total Return</Text>
              <Text style={[
                styles.metricValue,
                { color: unrealizedPL >= 0 ? '#10B981' : '#EF4444' }
              ]}>
                {unrealizedPL >= 0 ? '+' : ''}
                {unrealizedPLPercent.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Realized P&L</Text>
              <Text style={[
                styles.metricValue,
                { color: realizedPL >= 0 ? '#10B981' : '#EF4444' }
              ]}>
                ${realizedPL.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={[styles.metricRow, styles.borderTop]}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Total Invested</Text>
              <Text style={styles.metricValue}>
                ${portfolio?.totalCost?.toFixed(2) || '0.00'}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Positions</Text>
              <Text style={styles.metricValue}>
                {positions.length}
              </Text>
            </View>
          </View>
        </View>

        {/* Market Alerts */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Market Alerts</Text>
          <View style={styles.newsItem}>
            <Text style={styles.newsTime}>09:30 AM</Text>
            <Text style={styles.newsText}>Markets open - Ready to trade!</Text>
          </View>
          <View style={[styles.newsItem, styles.borderTop]}>
            <Text style={styles.newsTime}>08:00 AM</Text>
            <Text style={styles.newsText}>No economic events scheduled today</Text>
          </View>
        </View>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    gap: 12
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  settingsIcon: {
    fontSize: 24
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  chartCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 12
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  seeMoreLink: {
    color: '#0066CC',
    fontSize: 12,
    fontWeight: '600'
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 12
  },
  portfolioValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16
  },
  plSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  plItem: {
    flex: 1,
    alignItems: 'center'
  },
  plLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4
  },
  plValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2
  },
  plPercent: {
    fontSize: 12,
    fontWeight: '600'
  },
  divider: {
    width: 1,
    backgroundColor: '#334155'
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E5E7EB'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  seeAllLink: {
    color: '#0066CC',
    fontSize: 12,
    fontWeight: '600'
  },
  positionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  positionInfo: {
    flex: 1
  },
  symbol: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2
  },
  quantity: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  positionValue: {
    alignItems: 'flex-end'
  },
  value: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2
  },
  positionPercent: {
    fontSize: 12,
    fontWeight: '600'
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  metric: {
    flex: 1,
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff'
  },
  newsItem: {
    flexDirection: 'row',
    paddingVertical: 12
  },
  newsTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginRight: 12,
    fontWeight: '500'
  },
  newsText: {
    flex: 1,
    fontSize: 12,
    color: '#E5E7EB'
  },
  bottomSpacing: {
    height: 40
  }
});
