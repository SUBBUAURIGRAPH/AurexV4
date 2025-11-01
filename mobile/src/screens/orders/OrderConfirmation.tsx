/**
 * Order Confirmation Screen
 * Confirms pending orders before execution
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store/index';
import { confirmOrder, fetchOrders } from '../../store/tradingSlice';
import { getOrderDescription } from '../../utils/orderValidation';

// ==================== Types ====================

interface OrderConfirmationScreenProps {
  navigation: any;
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
  scrollView: {
    flexGrow: 1,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textTertiary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.warning,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark,
  },
  section: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.darkBorder,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  rowValueSuccess: {
    color: COLORS.success,
  },
  rowValueError: {
    color: COLORS.error,
  },
  rowValueWarning: {
    color: COLORS.warning,
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  summaryHighlight: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  expirySection: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 2,
    borderColor: COLORS.warning,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  expirySectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.warning,
    textTransform: 'uppercase',
  },
  expiryCountdown: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.warning,
    textAlign: 'center',
  },
  expiryText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  tokenSection: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  tokenLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  tokenValue: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontFamily: 'Menlo',
    backgroundColor: COLORS.dark,
    padding: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  warningBox: {
    backgroundColor: COLORS.warning,
    opacity: 0.1,
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.warning,
  },
  warningText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    backgroundColor: COLORS.success,
  },
  cancelButton: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    backgroundColor: COLORS.error,
    opacity: 0.1,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});

// ==================== Helper Functions ====================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getOrderValueDisplay(order: any): string {
  if (!order.type || order.type === 'market') {
    return 'Market Price';
  }

  if (order.type === 'limit') {
    return `$${order.price?.toFixed(2) || 'N/A'}`;
  }

  if (order.type === 'stop') {
    return `Stop: $${order.stopPrice?.toFixed(2) || 'N/A'}`;
  }

  if (order.type === 'stop-limit') {
    return `Stop: $${order.stopPrice?.toFixed(2) || 'N/A'} → Limit: $${order.limitPrice?.toFixed(2) || 'N/A'}`;
  }

  if (order.type === 'trailing-stop') {
    return `Trailing Stop: $${order.stopPrice?.toFixed(2) || 'N/A'}`;
  }

  return 'N/A';
}

// ==================== Component ====================

export default function OrderConfirmationScreen({ navigation }: OrderConfirmationScreenProps) {
  const dispatch = useAppDispatch();
  const { pendingConfirmation, isLoading, error } = useAppSelector((state) => state.trading);
  const [expiryCountdown, setExpiryCountdown] = useState<number>(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Update countdown timer
  useEffect(() => {
    if (!pendingConfirmation) return;

    const expiryTime = new Date(pendingConfirmation.expiresAt).getTime();
    const updateCountdown = () => {
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));

      setExpiryCountdown(remaining);

      if (remaining === 0) {
        // Token expired
        setConfirmError('Confirmation token has expired. Please create a new order.');
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [pendingConfirmation]);

  // Handle confirm action
  const handleConfirm = useCallback(async () => {
    if (!pendingConfirmation || expiryCountdown <= 0) {
      setConfirmError('Confirmation has expired. Please create a new order.');
      return;
    }

    setIsConfirming(true);
    setConfirmError(null);

    try {
      const result = await dispatch(
        confirmOrder({
          orderId: pendingConfirmation.orderId,
          token: pendingConfirmation.token,
        })
      ).unwrap();

      // Order confirmed successfully
      Alert.alert('Success', 'Order confirmed successfully!', [
        {
          text: 'View Order',
          onPress: () => {
            // Refresh orders and navigate back
            dispatch(fetchOrders());
            navigation.navigate('Orders');
          },
        },
      ]);
    } catch (err: any) {
      setConfirmError(err?.message || 'Failed to confirm order. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  }, [pendingConfirmation, expiryCountdown, dispatch, navigation]);

  // Handle cancel action
  const handleCancel = useCallback(() => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      {
        text: 'Keep Order',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'Cancel Order',
        onPress: () => {
          // Clear pending confirmation and go back
          navigation.goBack();
        },
        style: 'destructive',
      },
    ]);
  }, [navigation]);

  // Show empty state if no pending confirmation
  if (!pendingConfirmation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📋</Text>
          <Text style={styles.emptyStateText}>No pending order confirmation</Text>
        </View>
      </SafeAreaView>
    );
  }

  const order = pendingConfirmation.details;
  const isExpired = expiryCountdown <= 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>⏳ AWAITING CONFIRMATION</Text>
            </View>
            <Text style={styles.title}>Confirm Your Order</Text>
            <Text style={styles.subtitle}>
              Review the order details before confirming. This action cannot be undone.
            </Text>
          </View>

          {/* Expiry Warning */}
          {isExpired && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>⚠️ Confirmation Expired</Text>
              <Text style={styles.errorText}>
                This confirmation token has expired. Please create a new order to proceed.
              </Text>
            </View>
          )}

          {confirmError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorText}>{confirmError}</Text>
            </View>
          )}

          {/* Expiry Countdown */}
          <View style={styles.expirySection}>
            <Text style={styles.expirySectionTitle}>Confirm Within</Text>
            <Text style={styles.expiryCountdown}>{formatTime(expiryCountdown)}</Text>
            <Text style={styles.expiryText}>
              {isExpired ? 'This offer has expired' : 'Token expires at ' + new Date(pendingConfirmation.expiresAt).toLocaleTimeString()}
            </Text>
          </View>

          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER SUMMARY</Text>
            <View style={styles.sectionDivider} />

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Symbol</Text>
              <Text style={styles.rowValue}>{order.symbol}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Side</Text>
              <Text style={[styles.rowValue, order.side === 'buy' ? styles.rowValueSuccess : styles.rowValueError]}>
                {order.side.toUpperCase()}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Type</Text>
              <Text style={styles.rowValue}>{order.type.toUpperCase()}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Quantity</Text>
              <Text style={styles.rowValue}>{order.quantity} shares</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Price</Text>
              <Text style={styles.rowValue}>{getOrderValueDisplay(order)}</Text>
            </View>

            {order.timeInForce && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Time in Force</Text>
                <Text style={styles.rowValue}>{order.timeInForce.toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Order Details Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What You're About to Do</Text>
            <View style={styles.sectionDivider} />
            <Text style={styles.summaryText}>
              {getOrderDescription({
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                quantity: order.quantity,
                price: order.price,
                stopPrice: order.stopPrice,
                limitPrice: order.limitPrice,
              })}
            </Text>
          </View>

          {/* Estimated Cost */}
          {(order.price || order.limitPrice) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Estimated Details</Text>
              <View style={styles.sectionDivider} />

              {order.price && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Price per Share</Text>
                  <Text style={styles.rowValue}>${order.price.toFixed(2)}</Text>
                </View>
              )}

              {(order.price || order.limitPrice) && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Estimated Total</Text>
                  <Text style={styles.rowValue}>
                    ${((order.price || order.limitPrice || 0) * order.quantity).toFixed(2)}
                  </Text>
                </View>
              )}

              {order.commission && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Estimated Commission</Text>
                  <Text style={styles.rowValue}>${order.commission.toFixed(2)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Warnings */}
          {order.notes && (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>📝 Notes</Text>
              <Text style={styles.warningText}>{order.notes}</Text>
            </View>
          )}

          {/* Token Information (for debugging) */}
          <View style={styles.tokenSection}>
            <Text style={styles.tokenLabel}>Confirmation Token</Text>
            <Text style={styles.tokenValue}>{pendingConfirmation.token.substring(0, 20)}...</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={isConfirming}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>CANCEL ORDER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                (isConfirming || isExpired) && { opacity: 0.5 },
              ]}
              onPress={handleConfirm}
              disabled={isConfirming || isExpired}
            >
              {isConfirming && <ActivityIndicator color={COLORS.textPrimary} />}
              <Text style={styles.buttonText}>{isConfirming ? 'CONFIRMING...' : 'CONFIRM ORDER'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
