/**
 * Orders Screen - Enhanced Trading Orders and Order Management
 * Create, confirm, and manage trading orders with real-time updates, filtering, and sorting
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  Alert,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchOrders, createOrder, cancelOrder } from '../../store/tradingSlice';
import { OrderForm } from '../../components/OrderForm';
import { OrderInput } from '../../utils/orderValidation';

// ==================== Types ====================

type OrderTab = 'active' | 'filled' | 'cancelled';
type SortBy = 'newest' | 'oldest' | 'symbol' | 'quantity';

interface SelectedOrder {
  id: string;
  showModal: boolean;
}

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
  newOrderButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  newOrderButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.darkBorder,
  },
  searchInput: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sortButton: {
    flex: 1,
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sortButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearFilterButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.darkBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    alignItems: 'center',
  },
  tabActive: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabActiveText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyStateButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
  },
  emptyStateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  orderCard: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderSymbolGroup: {
    gap: 4,
  },
  orderSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderType: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
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
    fontSize: 11,
    color: COLORS.textTertiary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionLinkText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  cancelLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelLinkText: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 32,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.dark,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.darkBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.textSecondary,
  },
  detailsModalContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  detailsSection: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  detailsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.darkBorder,
  },
  detailsRowLabel: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  detailsRowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailsRowValueSuccess: {
    color: COLORS.success,
  },
  detailsRowValueError: {
    color: COLORS.error,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  detailsButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailsButtonCancel: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
  },
  detailsButtonDelete: {
    backgroundColor: COLORS.error,
    opacity: 0.2,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  detailsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailsButtonTextDelete: {
    color: COLORS.error,
  },
});

// ==================== Helper Functions ====================

function getStatusColor(status: string): string {
  switch (status) {
    case 'filled':
      return COLORS.success;
    case 'pending':
    case 'confirmed':
      return COLORS.warning;
    case 'submitted':
      return COLORS.primary;
    case 'partial':
      return COLORS.primaryLight;
    case 'cancelled':
    case 'rejected':
      return COLORS.error;
    case 'expired':
      return COLORS.textTertiary;
    default:
      return COLORS.textTertiary;
  }
}

function filterOrders(orders: any[], tab: OrderTab, searchTerm: string, sortBy: SortBy): any[] {
  let filtered = orders;

  // Filter by tab/status
  switch (tab) {
    case 'active':
      filtered = filtered.filter((o) => ['pending', 'confirmed', 'submitted', 'partial'].includes(o.status));
      break;
    case 'filled':
      filtered = filtered.filter((o) => o.status === 'filled');
      break;
    case 'cancelled':
      filtered = filtered.filter((o) => ['cancelled', 'rejected', 'expired'].includes(o.status));
      break;
  }

  // Filter by search term
  if (searchTerm) {
    filtered = filtered.filter((o) =>
      o.symbol.toUpperCase().includes(searchTerm.toUpperCase())
    );
  }

  // Sort
  switch (sortBy) {
    case 'newest':
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'oldest':
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'symbol':
      filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
      break;
    case 'quantity':
      filtered.sort((a, b) => b.quantity - a.quantity);
      break;
  }

  return filtered;
}

// ==================== Component ====================

export default function OrdersScreen({ navigation }: { navigation: any }) {
  const dispatch = useAppDispatch();
  const { orders, isLoading, error, pendingConfirmation } = useAppSelector((state) => state.trading);

  // UI State
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderTab>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrder>({ id: '', showModal: false });
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderCreateError, setOrderCreateError] = useState<string | null>(null);

  // Load orders on screen focus
  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  // Navigate to confirmation screen when order is created
  useEffect(() => {
    if (pendingConfirmation && !isCreatingOrder) {
      setShowNewOrderModal(false);
      navigation.navigate('OrderConfirmation');
    }
  }, [pendingConfirmation, isCreatingOrder, navigation]);

  const loadOrders = useCallback(async () => {
    try {
      await dispatch(fetchOrders()).unwrap();
    } catch (err: any) {
      console.error('Failed to load orders:', err);
    }
  }, [dispatch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadOrders();
    } finally {
      setRefreshing(false);
    }
  }, [loadOrders]);

  // Handle order creation
  const handleCreateOrder = useCallback(
    async (orderData: OrderInput) => {
      setIsCreatingOrder(true);
      setOrderCreateError(null);

      try {
        await dispatch(createOrder(orderData)).unwrap();
      } catch (err: any) {
        setOrderCreateError(err?.message || 'Failed to create order');
        Alert.alert('Error', err?.message || 'Failed to create order');
      } finally {
        setIsCreatingOrder(false);
      }
    },
    [dispatch]
  );

  // Handle order cancellation
  const handleCancelOrder = useCallback(
    (orderId: string) => {
      Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
        {
          text: 'Keep Order',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Cancel Order',
          onPress: async () => {
            try {
              await dispatch(cancelOrder(orderId)).unwrap();
              Alert.alert('Success', 'Order cancelled successfully');
              setSelectedOrder({ id: '', showModal: false });
              loadOrders();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to cancel order');
            }
          },
          style: 'destructive',
        },
      ]);
    },
    [dispatch, loadOrders]
  );

  // Filtered and sorted orders
  const filteredOrders = useMemo(() => {
    return filterOrders(orders, activeTab, searchTerm, sortBy);
  }, [orders, activeTab, searchTerm, sortBy]);

  // Get selected order details
  const selectedOrderData = useMemo(() => {
    return orders.find((o) => o.id === selectedOrder.id);
  }, [selectedOrder.id, orders]);

  // Show loading state
  if (isLoading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Orders</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.detailsRowValue}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <TouchableOpacity style={styles.newOrderButton} onPress={() => setShowNewOrderModal(true)}>
          <Text style={styles.newOrderButtonText}>+ New Order</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by symbol..."
          placeholderTextColor={COLORS.textTertiary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              const options: SortBy[] = ['newest', 'oldest', 'symbol', 'quantity'];
              const nextSort = options[(options.indexOf(sortBy) + 1) % options.length];
              setSortBy(nextSort);
            }}
          >
            <Text style={styles.sortButtonText}>Sort: {sortBy}</Text>
          </TouchableOpacity>
          {(searchTerm || sortBy !== 'newest') && (
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => {
                setSearchTerm('');
                setSortBy('newest');
              }}
            >
              <Text style={styles.clearFilterButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['active', 'filled', 'cancelled'] as OrderTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={activeTab === tab ? styles.tabActive : styles.tab}
            onPress={() => {
              setActiveTab(tab);
              setSearchTerm('');
            }}
          >
            <Text style={activeTab === tab ? styles.tabActiveText : styles.tabText}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({filteredOrders.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📭</Text>
            <Text style={styles.emptyStateText}>
              {searchTerm ? 'No orders found' : `No ${activeTab} orders`}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {activeTab === 'active' ? 'Create a new order to get started' : 'Orders will appear here'}
            </Text>
            {activeTab === 'active' && (
              <TouchableOpacity style={styles.emptyStateButton} onPress={() => setShowNewOrderModal(true)}>
                <Text style={styles.emptyStateButtonText}>Create Order</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            {filteredOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => setSelectedOrder({ id: order.id, showModal: true })}
              >
                <View style={styles.orderHeader}>
                  <View style={styles.orderSymbolGroup}>
                    <Text style={styles.orderSymbol}>{order.symbol}</Text>
                    <Text style={styles.orderType}>
                      {order.side.toUpperCase()} {order.type.toUpperCase()}
                    </Text>
                  </View>
                  <View
                    style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}
                  >
                    <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.orderDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Quantity</Text>
                    <Text style={styles.detailValue}>{order.quantity}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Price</Text>
                    <Text style={styles.detailValue}>
                      ${(order.price || order.averageFillPrice || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Total Value</Text>
                    <Text style={styles.detailValue}>
                      ${(order.totalCost || 0).toLocaleString('en-US', {
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderFooter}>
                  <Text style={styles.orderTime}>
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </Text>
                  <View style={styles.orderActions}>
                    <TouchableOpacity style={styles.actionLink}>
                      <Text style={styles.actionLinkText}>Details</Text>
                    </TouchableOpacity>
                    {['pending', 'confirmed', 'submitted'].includes(order.status) && (
                      <TouchableOpacity
                        style={styles.cancelLink}
                        onPress={() => handleCancelOrder(order.id)}
                      >
                        <Text style={styles.cancelLinkText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <View style={styles.bottomSpacing} />
          </ScrollView>
        )}
      </View>

      {/* New Order Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNewOrderModal}
        onRequestClose={() => setShowNewOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Order</Text>
              <TouchableOpacity onPress={() => setShowNewOrderModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            {orderCreateError && (
              <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                <View
                  style={{
                    backgroundColor: COLORS.error,
                    opacity: 0.1,
                    borderWidth: 1,
                    borderColor: COLORS.error,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontSize: 12, color: COLORS.error, fontWeight: '600' }}>
                    {orderCreateError}
                  </Text>
                </View>
              </View>
            )}
            <OrderForm
              onSubmit={handleCreateOrder}
              isLoading={isCreatingOrder}
              onCancel={() => setShowNewOrderModal(false)}
              showDescription={true}
            />
          </View>
        </View>
      </Modal>

      {/* Order Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={selectedOrder.showModal && !!selectedOrderData}
        onRequestClose={() => setSelectedOrder({ id: '', showModal: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setSelectedOrder({ id: '', showModal: false })}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.detailsModalContent} showsVerticalScrollIndicator={false}>
              {selectedOrderData && (
                <>
                  {/* Order Summary */}
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>Order Summary</Text>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsRowLabel}>Symbol</Text>
                      <Text style={styles.detailsRowValue}>{selectedOrderData.symbol}</Text>
                    </View>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsRowLabel}>Side</Text>
                      <Text
                        style={[
                          styles.detailsRowValue,
                          selectedOrderData.side === 'buy'
                            ? styles.detailsRowValueSuccess
                            : styles.detailsRowValueError,
                        ]}
                      >
                        {selectedOrderData.side.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsRowLabel}>Type</Text>
                      <Text style={styles.detailsRowValue}>{selectedOrderData.type.toUpperCase()}</Text>
                    </View>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsRowLabel}>Status</Text>
                      <Text
                        style={[
                          styles.detailsRowValue,
                          { color: getStatusColor(selectedOrderData.status) },
                        ]}
                      >
                        {selectedOrderData.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Quantity & Price */}
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>Quantity & Price</Text>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsRowLabel}>Quantity</Text>
                      <Text style={styles.detailsRowValue}>{selectedOrderData.quantity}</Text>
                    </View>
                    {selectedOrderData.price && (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsRowLabel}>Price</Text>
                        <Text style={styles.detailsRowValue}>
                          ${selectedOrderData.price.toFixed(2)}
                        </Text>
                      </View>
                    )}
                    {selectedOrderData.filledQuantity > 0 && (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsRowLabel}>Filled Quantity</Text>
                        <Text style={styles.detailsRowValue}>{selectedOrderData.filledQuantity}</Text>
                      </View>
                    )}
                    {selectedOrderData.averageFillPrice > 0 && (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsRowLabel}>Average Fill Price</Text>
                        <Text style={styles.detailsRowValue}>
                          ${selectedOrderData.averageFillPrice.toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Costs & Commission */}
                  {selectedOrderData.totalCost > 0 && (
                    <View style={styles.detailsSection}>
                      <Text style={styles.detailsSectionTitle}>Costs</Text>
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsRowLabel}>Total Cost</Text>
                        <Text style={styles.detailsRowValue}>
                          ${selectedOrderData.totalCost.toFixed(2)}
                        </Text>
                      </View>
                      {selectedOrderData.commission > 0 && (
                        <View style={styles.detailsRow}>
                          <Text style={styles.detailsRowLabel}>Commission</Text>
                          <Text style={styles.detailsRowValue}>
                            ${selectedOrderData.commission.toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Timestamps */}
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>Timeline</Text>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsRowLabel}>Created</Text>
                      <Text style={styles.detailsRowValue}>
                        {new Date(selectedOrderData.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsRowLabel}>Updated</Text>
                      <Text style={styles.detailsRowValue}>
                        {new Date(selectedOrderData.updatedAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Action Buttons */}
            {selectedOrderData && selectedOrder.showModal && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.detailsButton, styles.detailsButtonCancel]}
                  onPress={() => setSelectedOrder({ id: '', showModal: false })}
                >
                  <Text style={styles.detailsButtonText}>Close</Text>
                </TouchableOpacity>
                {['pending', 'confirmed', 'submitted'].includes(selectedOrderData.status) && (
                  <TouchableOpacity
                    style={[styles.detailsButton, styles.detailsButtonDelete]}
                    onPress={() => handleCancelOrder(selectedOrderData.id)}
                  >
                    <Text style={[styles.detailsButtonText, styles.detailsButtonTextDelete]}>
                      Cancel Order
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
