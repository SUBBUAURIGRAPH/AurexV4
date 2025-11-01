/**
 * Order History Screen
 * Advanced order history viewing with filtering, statistics, and export
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchOrders } from '../../store/tradingSlice';
import OrderHistoryFilter, { OrderFilterCriteria, FilterOption } from '../../components/OrderHistoryFilter';
import {
  applyFilters,
  getOrderStatistics,
  getActiveFilterCount,
  getFilterDescription,
  exportOrdersAsCSV,
  groupOrdersBySymbol,
} from '../../utils/orderHistoryFilters';

// ==================== Types ====================

// ==================== Styles ====================

const COLORS = {
  dark: '#0F172A',
  darkCard: '#1E293B',
  darkBorder: '#334155',
  darkBorderLight: '#475569',
  textPrimary: '#ffffff',
  textSecondary: '#E5E7EB',
  textTertiary: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  primary: '#0066CC',
  primaryLight: '#3B82F6',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.darkBorder,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  filterButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    position: 'relative',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeFiltersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.darkBorder,
  },
  activeFilterTag: {
    backgroundColor: COLORS.primary,
    opacity: 0.2,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeFilterTagText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  removeTagButton: {
    padding: 0,
  },
  removeTagButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  clearAllButtonText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
  },
  statisticsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statisticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statisticCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  statisticLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statisticValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statisticValueSuccess: {
    color: COLORS.success,
  },
  statisticValueError: {
    color: COLORS.error,
  },
  statisticValueWarning: {
    color: COLORS.warning,
  },
  ordersList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  orderCard: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderType: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.darkBorder,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailValueSuccess: {
    color: COLORS.success,
  },
  detailValueError: {
    color: COLORS.error,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButton: {
    backgroundColor: COLORS.primary,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  resultCount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.darkCard,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  resultCountText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

// ==================== Component ====================

interface OrderHistoryScreenProps {
  navigation: any;
}

export default function OrderHistoryScreen({ navigation }: OrderHistoryScreenProps) {
  const dispatch = useAppDispatch();
  const { orders, isLoading } = useAppSelector((state) => state.trading);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<OrderFilterCriteria>({});

  // Load orders on screen focus
  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = useCallback(async () => {
    try {
      await dispatch(fetchOrders()).unwrap();
    } catch (err: any) {
      console.error('Failed to load orders:', err);
    }
  }, [dispatch]);

  // Apply filters to orders
  const filteredOrders = useMemo(() => {
    return applyFilters(orders, filters);
  }, [orders, filters]);

  // Get statistics
  const statistics = useMemo(() => {
    return getOrderStatistics(filteredOrders);
  }, [filteredOrders]);

  // Get filter count
  const filterCount = useMemo(() => {
    return getActiveFilterCount(filters);
  }, [filters]);

  // Get filter descriptions
  const filterDescriptions = useMemo(() => {
    return getFilterDescription(filters);
  }, [filters]);

  // Get unique symbols
  const symbols = useMemo(() => {
    return Array.from(new Set(orders.map((o) => o.symbol))).sort();
  }, [orders]);

  // Get status options with counts
  const statusOptions = useMemo((): FilterOption[] => {
    const statuses = ['filled', 'pending', 'confirmed', 'submitted', 'partial', 'cancelled', 'rejected', 'expired'];
    return statuses.map((status) => ({
      label: status.charAt(0).toUpperCase() + status.slice(1),
      value: status,
      count: orders.filter((o) => o.status === status).length,
    }));
  }, [orders]);

  // Get type options with counts
  const typeOptions = useMemo((): FilterOption[] => {
    const types = ['market', 'limit', 'stop', 'stop-limit', 'trailing-stop'];
    return types.map((type) => ({
      label: type
        .split('-')
        .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
        .join(' '),
      value: type,
      count: orders.filter((o) => o.type === type).length,
    }));
  }, [orders]);

  // Handle filter apply
  const handleApplyFilters = useCallback((criteria: OrderFilterCriteria) => {
    setFilters(criteria);
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Remove single filter
  const handleRemoveFilter = useCallback(
    (description: string) => {
      // Parse the description and remove that filter
      // For simplicity, just reset for now - in production would be more granular
      setFilters({});
    },
    []
  );

  // Export orders as CSV
  const handleExportCSV = useCallback(() => {
    try {
      const csv = exportOrdersAsCSV(filteredOrders);
      const filename = `orders_${new Date().toISOString().split('T')[0]}.csv`;

      // In a real app, would save to file system or share
      Alert.alert(
        'Export',
        `CSV data prepared for ${filename}.\n\nIn production, this would be saved to Files or shared.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Error', 'Failed to export orders');
    }
  }, [filteredOrders]);

  if (isLoading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Order History</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Order History</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={styles.filterButtonText}>Filter</Text>
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filters Display */}
      {filterDescriptions.length > 0 && (
        <ScrollView
          style={styles.activeFiltersContainer}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {filterDescriptions.map((description, index) => (
            <View key={index} style={styles.activeFilterTag}>
              <Text style={styles.activeFilterTagText}>{description}</Text>
              <TouchableOpacity
                style={styles.removeTagButton}
                onPress={() => handleRemoveFilter(description)}
              >
                <Text style={styles.removeTagButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {filterDescriptions.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearAllButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Content */}
      <View style={styles.content}>
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📭</Text>
            <Text style={styles.emptyStateText}>No orders found</Text>
            <Text style={styles.emptyStateSubtext}>
              {filterCount > 0 ? 'Try adjusting your filters' : 'Your order history will appear here'}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Statistics */}
            <View style={styles.statisticsContainer}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textSecondary }}>
                Summary
              </Text>
              <View style={styles.statisticsGrid}>
                <View style={styles.statisticCard}>
                  <Text style={styles.statisticLabel}>Total Orders</Text>
                  <Text style={styles.statisticValue}>{statistics.totalOrders}</Text>
                </View>
                <View style={styles.statisticCard}>
                  <Text style={styles.statisticLabel}>Total Quantity</Text>
                  <Text style={styles.statisticValue}>{statistics.totalQuantity}</Text>
                </View>
                <View style={styles.statisticCard}>
                  <Text style={styles.statisticLabel}>Total Cost</Text>
                  <Text style={styles.statisticValue}>
                    ${statistics.totalCost.toLocaleString('en-US', {
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
                <View style={styles.statisticCard}>
                  <Text style={styles.statisticLabel}>Avg Price</Text>
                  <Text style={styles.statisticValue}>
                    ${statistics.averagePrice.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.statisticCard}>
                  <Text style={styles.statisticLabel}>Filled</Text>
                  <Text style={[styles.statisticValue, styles.statisticValueSuccess]}>
                    {statistics.filledOrders}
                  </Text>
                </View>
                <View style={styles.statisticCard}>
                  <Text style={styles.statisticLabel}>Pending</Text>
                  <Text style={[styles.statisticValue, styles.statisticValueWarning]}>
                    {statistics.pendingOrders}
                  </Text>
                </View>
                <View style={styles.statisticCard}>
                  <Text style={styles.statisticLabel}>Cancelled</Text>
                  <Text style={[styles.statisticValue, styles.statisticValueError]}>
                    {statistics.cancelledOrders}
                  </Text>
                </View>
                <View style={styles.statisticCard}>
                  <Text style={styles.statisticLabel}>Fill %</Text>
                  <Text style={styles.statisticValue}>
                    {statistics.averageFillPercentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Result Count */}
            <View style={styles.resultCount}>
              <Text style={styles.resultCountText}>
                Showing {filteredOrders.length} of {orders.length} orders
              </Text>
              {filterCount > 0 && (
                <Text style={styles.resultCountText}>
                  {filterCount} filter(s) applied
                </Text>
              )}
            </View>

            {/* Orders List */}
            <View style={styles.ordersList}>
              {filteredOrders.map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View>
                      <Text style={styles.orderSymbol}>{order.symbol}</Text>
                      <Text style={styles.orderType}>
                        {order.side.toUpperCase()} {order.type.toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.detailValue,
                        order.status === 'filled'
                          ? styles.detailValueSuccess
                          : order.status === 'cancelled' ||
                            order.status === 'rejected'
                          ? styles.detailValueError
                          : undefined,
                      ]}
                    >
                      {order.status.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.orderDetails}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Qty</Text>
                      <Text style={styles.detailValue}>{order.quantity}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Price</Text>
                      <Text style={styles.detailValue}>
                        ${(order.price || order.averageFillPrice).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Fill</Text>
                      <Text style={styles.detailValue}>
                        {((order.filledQuantity / order.quantity) * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Cost</Text>
                      <Text style={styles.detailValue}>
                        ${order.totalCost.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 11, color: COLORS.textTertiary }}>
                    {new Date(order.createdAt).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Action Buttons */}
      {filteredOrders.length > 0 && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.exportButton]}
            onPress={handleExportCSV}
          >
            <Text style={styles.exportButtonText}>📥 Export CSV</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Modal */}
      <OrderHistoryFilter
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        symbols={symbols}
      />
    </SafeAreaView>
  );
}
