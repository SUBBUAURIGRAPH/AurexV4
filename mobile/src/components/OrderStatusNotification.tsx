/**
 * Order Status Notification Component
 * Displays real-time order status updates and notifications
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Animated, TouchableOpacity } from 'react-native';
import { OrderUpdate } from '../hooks/useOrderUpdates';

// ==================== Types ====================

export interface OrderNotification extends OrderUpdate {
  id: string; // Unique notification ID for dismissing
  dismissed: boolean;
}

// ==================== Styles ====================

const COLORS = {
  dark: '#0F172A',
  darkCard: '#1E293B',
  darkBorder: '#334155',
  textPrimary: '#ffffff',
  textSecondary: '#E5E7EB',
  textTertiary: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  primary: '#0066CC',
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  notification: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
  },
  notificationContent: {
    padding: 12,
    gap: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  notificationSymbol: {
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: COLORS.textSecondary,
  },
  notificationMessage: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  notificationDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailItem: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: COLORS.textTertiary,
  },
  // Type-specific colors
  successNotification: {
    backgroundColor: COLORS.success,
    opacity: 0.15,
    borderLeftColor: COLORS.success,
  },
  errorNotification: {
    backgroundColor: COLORS.error,
    opacity: 0.15,
    borderLeftColor: COLORS.error,
  },
  warningNotification: {
    backgroundColor: COLORS.warning,
    opacity: 0.15,
    borderLeftColor: COLORS.warning,
  },
  infoNotification: {
    backgroundColor: COLORS.primary,
    opacity: 0.15,
    borderLeftColor: COLORS.primary,
  },
});

// ==================== Helper Functions ====================

function getNotificationStyle(event: string) {
  switch (event) {
    case 'fill_update':
      return styles.successNotification;
    case 'rejection':
      return styles.errorNotification;
    case 'expiry':
      return styles.errorNotification;
    case 'status_change':
      return styles.infoNotification;
    case 'price_update':
      return styles.warningNotification;
    default:
      return styles.infoNotification;
  }
}

function getTitleForEvent(event: string, symbol: string): string {
  switch (event) {
    case 'fill_update':
      return `${symbol} Order Filled`;
    case 'rejection':
      return `${symbol} Order Rejected`;
    case 'expiry':
      return `${symbol} Order Expired`;
    case 'status_change':
      return `${symbol} Order Status Changed`;
    case 'price_update':
      return `${symbol} Price Alert`;
    default:
      return `${symbol} Order Update`;
  }
}

function getMessageForEvent(event: string, update: OrderNotification): string {
  const symbol = update.orderId.split('-')[0] || 'Order';

  switch (event) {
    case 'fill_update':
      return `${update.filledQuantity} shares filled at $${update.averageFillPrice.toFixed(2)}`;
    case 'rejection':
      return update.message || 'Your order was rejected';
    case 'expiry':
      return 'Your order has expired';
    case 'status_change':
      return `Status: ${update.previousStatus || 'pending'} → ${update.status}`;
    case 'price_update':
      return update.message || 'Price update received';
    default:
      return 'Order update received';
  }
}

function getColorForEvent(event: string): string {
  switch (event) {
    case 'fill_update':
      return COLORS.success;
    case 'rejection':
    case 'expiry':
      return COLORS.error;
    case 'status_change':
      return COLORS.primary;
    case 'price_update':
      return COLORS.warning;
    default:
      return COLORS.primary;
  }
}

// ==================== Component ====================

interface OrderStatusNotificationProps {
  notification: OrderNotification;
  onDismiss: (notificationId: string) => void;
  autoDismissMs?: number;
}

export const OrderStatusNotification: React.FC<OrderStatusNotificationProps> = ({
  notification,
  onDismiss,
  autoDismissMs = 5000,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Animate in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss after delay
    const timer = setTimeout(() => {
      // Animate out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onDismiss(notification.id);
      });
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [fadeAnim, notification.id, onDismiss, autoDismissMs]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={[styles.notification, getNotificationStyle(notification.event)]}>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle}>
              {getTitleForEvent(notification.event, '')}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => onDismiss(notification.id)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.notificationMessage}>
            {getMessageForEvent(notification.event, notification)}
          </Text>

          {(notification.filledQuantity > 0 || notification.totalCost > 0) && (
            <View style={styles.notificationDetails}>
              {notification.filledQuantity > 0 && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Filled</Text>
                  <Text style={styles.detailValue}>{notification.filledQuantity} shares</Text>
                </View>
              )}
              {notification.averageFillPrice > 0 && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Avg Price</Text>
                  <Text style={styles.detailValue}>
                    ${notification.averageFillPrice.toFixed(2)}
                  </Text>
                </View>
              )}
              {notification.totalCost > 0 && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Total</Text>
                  <Text style={styles.detailValue}>
                    ${notification.totalCost.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

// ==================== Notification Stack Component ====================

interface OrderNotificationStackProps {
  notifications: OrderNotification[];
  onDismiss: (notificationId: string) => void;
  autoDismissMs?: number;
  maxVisible?: number;
}

export const OrderNotificationStack: React.FC<OrderNotificationStackProps> = ({
  notifications,
  onDismiss,
  autoDismissMs = 5000,
  maxVisible = 3,
}) => {
  // Only show the most recent notifications
  const visibleNotifications = notifications
    .filter((n) => !n.dismissed)
    .slice(0, maxVisible);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {visibleNotifications.map((notification) => (
        <OrderStatusNotification
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
          autoDismissMs={autoDismissMs}
        />
      ))}
    </View>
  );
};

export default OrderStatusNotification;
