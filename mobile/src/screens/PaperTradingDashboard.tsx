/**
 * Paper Trading Dashboard Screen
 * Main dashboard for paper trading with performance metrics and account management
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Switch,
  Alert
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  fetchPaperAccounts,
  createPaperAccount,
  fetchPaperPerformance,
  syncAllPaperTradingData,
  setActiveAccount,
  togglePaperMode
} from '../store/paperTradingSlice';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

export const PaperTradingDashboard: React.FC = ({ navigation }: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const [refreshing, setRefreshing] = useState(false);

  const {
    accounts,
    activeAccount,
    performance,
    isPaperMode,
    isLoading,
    error,
    lastSync
  } = useSelector((state: RootState) => state.paperTrading);

  // Load data on mount
  useEffect(() => {
    loadPaperTradingData();
  }, []);

  // Auto-refresh every minute when active
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeAccount && isPaperMode) {
        refreshData();
      }
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [activeAccount, isPaperMode]);

  const loadPaperTradingData = async () => {
    try {
      const accountsResult = await dispatch(fetchPaperAccounts()).unwrap();

      if (accountsResult.length > 0) {
        const firstAccount = accountsResult[0];
        dispatch(setActiveAccount(firstAccount.id));
        await dispatch(syncAllPaperTradingData(firstAccount.id));
      }
    } catch (error) {
      console.error('Failed to load paper trading data:', error);
    }
  };

  const refreshData = async () => {
    if (!activeAccount) return;

    setRefreshing(true);
    try {
      await dispatch(syncAllPaperTradingData(activeAccount.id)).unwrap();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateAccount = () => {
    Alert.prompt(
      'Create Paper Trading Account',
      'Enter account name (optional)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (name) => {
            try {
              const account = await dispatch(createPaperAccount({ name })).unwrap();
              dispatch(setActiveAccount(account.id));
              Alert.alert('Success', 'Paper trading account created successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to create account');
            }
          }
        }
      ]
    );
  };

  const handleTogglePaperMode = () => {
    if (!isPaperMode && !activeAccount) {
      Alert.alert(
        'No Paper Account',
        'You need to create a paper trading account first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Account', onPress: handleCreateAccount }
        ]
      );
      return;
    }

    dispatch(togglePaperMode());
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (accounts.length === 0 && !isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Paper Trading Account</Text>
          <Text style={styles.emptyText}>
            Create a paper trading account to practice trading without real money
          </Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateAccount}>
            <Text style={styles.createButtonText}>Create Paper Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshData} />
      }
    >
      {/* Header with Paper Mode Toggle */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Paper Trading</Text>
          <Text style={styles.headerSubtitle}>
            {activeAccount?.name || 'No account selected'}
          </Text>
        </View>
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Paper Mode</Text>
          <Switch
            value={isPaperMode}
            onValueChange={handleTogglePaperMode}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={isPaperMode ? '#007AFF' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Paper Mode Banner */}
      {isPaperMode && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            ⚡ PAPER TRADING MODE - All trades are simulated
          </Text>
        </View>
      )}

      {/* Account Summary */}
      {performance && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Summary</Text>
          <View style={styles.card}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Equity</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(performance.totalEquity)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Return</Text>
                <Text style={[
                  styles.summaryValue,
                  performance.totalReturn >= 0 ? styles.positive : styles.negative
                ]}>
                  {formatPercent(performance.totalReturn)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Cash</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(performance.currentCash)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Position Value</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(performance.positionValue)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* P&L Summary */}
      {performance && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profit & Loss</Text>
          <View style={styles.card}>
            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Total P&L</Text>
              <Text style={[
                styles.plValue,
                performance.totalPl >= 0 ? styles.positive : styles.negative
              ]}>
                {formatCurrency(performance.totalPl)}
              </Text>
            </View>
            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Unrealized P&L</Text>
              <Text style={[
                styles.plValue,
                performance.unrealizedPl >= 0 ? styles.positive : styles.negative
              ]}>
                {formatCurrency(performance.unrealizedPl)}
              </Text>
            </View>
            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Realized P&L</Text>
              <Text style={[
                styles.plValue,
                performance.realizedPl >= 0 ? styles.positive : styles.negative
              ]}>
                {formatCurrency(performance.realizedPl)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Trading Statistics */}
      {performance && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trading Statistics</Text>
          <View style={styles.card}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total Trades</Text>
              <Text style={styles.statValue}>{performance.totalTrades}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Win Rate</Text>
              <Text style={styles.statValue}>{performance.winRate.toFixed(2)}%</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Profit Factor</Text>
              <Text style={styles.statValue}>{performance.profitFactor.toFixed(2)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Max Drawdown</Text>
              <Text style={[styles.statValue, styles.negative]}>
                -{performance.maxDrawdown.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Sharpe Ratio</Text>
              <Text style={styles.statValue}>{performance.sharpeRatio.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Current Positions */}
      {performance && performance.positions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Positions ({performance.positionCount})</Text>
          {performance.positions.map((position, index) => (
            <View key={index} style={styles.positionCard}>
              <View style={styles.positionHeader}>
                <Text style={styles.positionSymbol}>{position.symbol}</Text>
                <Text style={[
                  styles.positionPl,
                  position.unrealizedPl >= 0 ? styles.positive : styles.negative
                ]}>
                  {formatPercent(position.unrealizedPlPercent)}
                </Text>
              </View>
              <View style={styles.positionDetails}>
                <View style={styles.positionDetailItem}>
                  <Text style={styles.positionDetailLabel}>Quantity</Text>
                  <Text style={styles.positionDetailValue}>{position.quantity}</Text>
                </View>
                <View style={styles.positionDetailItem}>
                  <Text style={styles.positionDetailLabel}>Current Price</Text>
                  <Text style={styles.positionDetailValue}>
                    {formatCurrency(position.currentPrice)}
                  </Text>
                </View>
                <View style={styles.positionDetailItem}>
                  <Text style={styles.positionDetailLabel}>Market Value</Text>
                  <Text style={styles.positionDetailValue}>
                    {formatCurrency(position.marketValue)}
                  </Text>
                </View>
                <View style={styles.positionDetailItem}>
                  <Text style={styles.positionDetailLabel}>Unrealized P&L</Text>
                  <Text style={[
                    styles.positionDetailValue,
                    position.unrealizedPl >= 0 ? styles.positive : styles.negative
                  ]}>
                    {formatCurrency(position.unrealizedPl)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('PaperOrders')}
          >
            <Text style={styles.actionButtonText}>View Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('PaperPositions')}
          >
            <Text style={styles.actionButtonText}>View Positions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('PaperPerformance')}
          >
            <Text style={styles.actionButtonText}>Performance</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('PaperSettings')}
          >
            <Text style={styles.actionButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A'
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#657786',
    marginTop: 4
  },
  toggleContainer: {
    alignItems: 'center'
  },
  toggleLabel: {
    fontSize: 12,
    color: '#657786',
    marginBottom: 4
  },
  banner: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C'
  },
  bannerText: {
    textAlign: 'center',
    color: '#856404',
    fontSize: 14,
    fontWeight: '600'
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  summaryItem: {
    flex: 1
  },
  summaryLabel: {
    fontSize: 12,
    color: '#657786',
    marginBottom: 4
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A'
  },
  plRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F7FA'
  },
  plLabel: {
    fontSize: 14,
    color: '#657786'
  },
  plValue: {
    fontSize: 16,
    fontWeight: '600'
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F7FA'
  },
  statLabel: {
    fontSize: 14,
    color: '#657786'
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A'
  },
  positive: {
    color: '#17BF63'
  },
  negative: {
    color: '#E0245E'
  },
  positionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  positionSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A'
  },
  positionPl: {
    fontSize: 16,
    fontWeight: '600'
  },
  positionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  positionDetailItem: {
    width: '50%',
    marginBottom: 8
  },
  positionDetailLabel: {
    fontSize: 12,
    color: '#657786',
    marginBottom: 2
  },
  positionDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A'
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center'
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12
  },
  emptyText: {
    fontSize: 16,
    color: '#657786',
    textAlign: 'center',
    marginBottom: 24
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E0245E'
  },
  errorText: {
    color: '#E0245E',
    fontSize: 14
  },
  bottomSpacer: {
    height: 40
  }
});

export default PaperTradingDashboard;
