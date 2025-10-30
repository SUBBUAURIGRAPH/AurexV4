/**
 * Orders Screen - Trading Orders and Order Management
 * Create, confirm, and manage trading orders with real-time updates
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
  Modal,
  Picker
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchOrders } from '../../store/tradingSlice';

export default function OrdersScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const { orders, isLoading } = useAppSelector(state => state.trading);

  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);

  // Order form state
  const [symbol, setSymbol] = useState('AAPL');
  const [orderType, setOrderType] = useState('market');
  const [side, setSide] = useState('buy');
  const [quantity, setQuantity] = useState('100');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    setActiveOrders(orders.filter(o => ['pending', 'confirmed', 'submitted', 'partial'].includes(o.status)));
  }, [orders]);

  const loadOrders = async () => {
    await dispatch(fetchOrders());
  };

  const handleCreateOrder = () => {
    if (!symbol || !quantity) {
      alert('Please fill in all required fields');
      return;
    }

    // In production, this would dispatch createOrder action
    console.log({
      symbol,
      side,
      type: orderType,
      quantity: parseInt(quantity),
      price: price ? parseFloat(price) : undefined,
      stopPrice: stopPrice ? parseFloat(stopPrice) : undefined
    });

    setShowNewOrderModal(false);
    // Reset form
    setSymbol('AAPL');
    setOrderType('market');
    setSide('buy');
    setQuantity('100');
    setPrice('');
    setStopPrice('');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'filled':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#0066CC';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Orders</Text>
          <TouchableOpacity
            style={styles.newOrderButton}
            onPress={() => setShowNewOrderModal(true)}
          >
            <Text style={styles.newOrderButtonText}>+ New Order</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={styles.tabActive}>
            <Text style={styles.tabActiveText}>Active ({activeOrders.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text style={styles.tabText}>Filled</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text style={styles.tabText}>Cancelled</Text>
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
          </View>
        ) : activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📭</Text>
            <Text style={styles.emptyStateText}>No active orders</Text>
            <Text style={styles.emptyStateSubtext}>Create a new order to get started</Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => setShowNewOrderModal(true)}
            >
              <Text style={styles.emptyStateButtonText}>Create Order</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {activeOrders.map(order => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderSymbol}>{order.symbol}</Text>
                    <Text style={styles.orderType}>
                      {order.side.toUpperCase()} {order.type.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.statusContainer}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(order.status) }
                      ]}
                    >
                      <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
                    </View>
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
                      ${(order.price || order.averageFillPrice).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Total Value</Text>
                    <Text style={styles.detailValue}>
                      ${(order.totalCost || 0).toLocaleString('en-US', {
                        maximumFractionDigits: 2
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
                    {['pending', 'confirmed'].includes(order.status) && (
                      <TouchableOpacity style={styles.cancelLink}>
                        <Text style={styles.cancelLinkText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* New Order Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNewOrderModal}
        onRequestClose={() => setShowNewOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Order</Text>
              <TouchableOpacity onPress={() => setShowNewOrderModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              {/* Symbol */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Symbol</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., AAPL"
                  placeholderTextColor="#9CA3AF"
                  value={symbol}
                  onChangeText={setSymbol}
                  autoCapitalize="characters"
                />
              </View>

              {/* Side */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Side</Text>
                <View style={styles.sideButtons}>
                  <TouchableOpacity
                    style={[styles.sideButton, side === 'buy' && styles.sideButtonActive]}
                    onPress={() => setSide('buy')}
                  >
                    <Text
                      style={[
                        styles.sideButtonText,
                        side === 'buy' && styles.sideButtonTextActive
                      ]}
                    >
                      Buy
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sideButton, side === 'sell' && styles.sideButtonActive]}
                    onPress={() => setSide('sell')}
                  >
                    <Text
                      style={[
                        styles.sideButtonText,
                        side === 'sell' && styles.sideButtonTextActive
                      ]}
                    >
                      Sell
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Order Type */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Order Type</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={orderType}
                    onValueChange={setOrderType}
                    style={styles.picker}
                  >
                    <Picker.Item label="Market" value="market" />
                    <Picker.Item label="Limit" value="limit" />
                    <Picker.Item label="Stop Loss" value="stop" />
                    <Picker.Item label="Stop Limit" value="stop-limit" />
                  </Picker>
                </View>
              </View>

              {/* Quantity */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 100"
                  placeholderTextColor="#9CA3AF"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                />
              </View>

              {/* Price (for limit/stop orders) */}
              {(orderType === 'limit' || orderType === 'stop-limit') && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Limit Price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 150.00"
                    placeholderTextColor="#9CA3AF"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* Stop Price (for stop/stop-limit orders) */}
              {(orderType === 'stop' || orderType === 'stop-limit') && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Stop Price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 145.00"
                    placeholderTextColor="#9CA3AF"
                    value={stopPrice}
                    onChangeText={setStopPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* Estimated Cost */}
              <View style={styles.estimateContainer}>
                <Text style={styles.estimateLabel}>Estimated Cost</Text>
                <Text style={styles.estimateValue}>
                  ${(parseInt(quantity) * parseFloat(price || '150')).toLocaleString('en-US', {
                    maximumFractionDigits: 2
                  })}
                </Text>
              </View>

              {/* Buttons */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateOrder}
              >
                <Text style={styles.submitButtonText}>Review Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowNewOrderModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  newOrderButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6
  },
  newOrderButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#334155'
  },
  tabActive: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#0066CC'
  },
  tabText: {
    color: '#9CA3AF',
    fontWeight: '600'
  },
  tabActiveText: {
    color: '#0066CC',
    fontWeight: '600'
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 4
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 20
  },
  emptyStateButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6
  },
  emptyStateButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  orderCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  orderSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  orderType: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2
  },
  statusContainer: {
    alignItems: 'flex-end'
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  detailItem: {
    flex: 1
  },
  detailLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff'
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTopVer: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  orderTime: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  orderActions: {
    flexDirection: 'row',
    gap: 12
  },
  actionLink: {
    paddingVertical: 4
  },
  actionLinkText: {
    color: '#0066CC',
    fontSize: 12,
    fontWeight: '600'
  },
  cancelLink: {
    paddingVertical: 4
  },
  cancelLinkText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600'
  },
  bottomSpacing: {
    height: 40
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  closeButton: {
    fontSize: 24,
    color: '#9CA3AF'
  },
  formContainer: {
    padding: 16
  },
  formGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff'
  },
  sideButtons: {
    flexDirection: 'row',
    gap: 12
  },
  sideButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155'
  },
  sideButtonActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC'
  },
  sideButtonText: {
    color: '#9CA3AF',
    fontWeight: '600'
  },
  sideButtonTextActive: {
    color: '#fff'
  },
  pickerContainer: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    overflow: 'hidden'
  },
  picker: {
    color: '#fff'
  },
  estimateContainer: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  estimateLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4
  },
  estimateValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  submitButton: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  cancelButton: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20
  },
  cancelButtonText: {
    color: '#E5E7EB',
    fontWeight: '600'
  }
});
