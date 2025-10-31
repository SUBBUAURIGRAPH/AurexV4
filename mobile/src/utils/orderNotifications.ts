/**
 * Order Notifications Manager
 * Manages order status notifications and alerts
 */

import { OrderUpdate } from '../hooks/useOrderUpdates';
import { OrderNotification } from '../components/OrderStatusNotification';

// ==================== Types ====================

export interface NotificationAction {
  type: 'ADD' | 'REMOVE' | 'DISMISS' | 'CLEAR';
  payload?: any;
}

// ==================== Notification Manager ====================

export class OrderNotificationManager {
  private notifications: Map<string, OrderNotification> = new Map();
  private notificationId = 0;

  /**
   * Create a new notification from order update
   */
  createNotificationFromUpdate(update: OrderUpdate): OrderNotification {
    const id = `notification_${this.notificationId++}_${Date.now()}`;

    return {
      ...update,
      id,
      dismissed: false,
    };
  }

  /**
   * Add a notification
   */
  addNotification(notification: OrderNotification): string {
    this.notifications.set(notification.id, notification);
    return notification.id;
  }

  /**
   * Remove a notification
   */
  removeNotification(notificationId: string): boolean {
    return this.notifications.delete(notificationId);
  }

  /**
   * Dismiss a notification (mark as dismissed but keep in history)
   */
  dismissNotification(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.dismissed = true;
      return true;
    }
    return false;
  }

  /**
   * Get all notifications
   */
  getAllNotifications(): OrderNotification[] {
    return Array.from(this.notifications.values());
  }

  /**
   * Get active (non-dismissed) notifications
   */
  getActiveNotifications(): OrderNotification[] {
    return Array.from(this.notifications.values()).filter((n) => !n.dismissed);
  }

  /**
   * Get notifications for a specific order
   */
  getOrderNotifications(orderId: string): OrderNotification[] {
    return Array.from(this.notifications.values()).filter((n) => n.orderId === orderId);
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notifications.clear();
  }

  /**
   * Clear dismissed notifications
   */
  clearDismissed(): void {
    const toDelete: string[] = [];
    this.notifications.forEach((notification, id) => {
      if (notification.dismissed) {
        toDelete.push(id);
      }
    });
    toDelete.forEach((id) => this.removeNotification(id));
  }

  /**
   * Get notification count
   */
  getCount(): number {
    return this.notifications.size;
  }

  /**
   * Get active notification count
   */
  getActiveCount(): number {
    return this.getActiveNotifications().length;
  }
}

// ==================== Helper Functions ====================

/**
 * Determine notification priority based on event type
 */
export function getNotificationPriority(event: string): number {
  switch (event) {
    case 'rejection':
    case 'expiry':
      return 3; // High priority
    case 'fill_update':
      return 2; // Medium priority
    case 'status_change':
      return 1; // Low priority
    case 'price_update':
      return 0; // Lowest priority
    default:
      return 1;
  }
}

/**
 * Check if notification should be shown based on user preferences
 */
export function shouldShowNotification(
  event: string,
  preferences?: {
    showFillUpdates?: boolean;
    showRejections?: boolean;
    showExpirations?: boolean;
    showStatusChanges?: boolean;
    showPriceAlerts?: boolean;
  }
): boolean {
  const defaultPrefs = {
    showFillUpdates: true,
    showRejections: true,
    showExpirations: true,
    showStatusChanges: true,
    showPriceAlerts: true,
  };

  const prefs = { ...defaultPrefs, ...preferences };

  switch (event) {
    case 'fill_update':
      return prefs.showFillUpdates;
    case 'rejection':
      return prefs.showRejections;
    case 'expiry':
      return prefs.showExpirations;
    case 'status_change':
      return prefs.showStatusChanges;
    case 'price_update':
      return prefs.showPriceAlerts;
    default:
      return true;
  }
}

/**
 * Sound notification strategy
 */
export const NotificationSounds = {
  FILL: 'fill_notification.wav',
  ERROR: 'error_notification.wav',
  WARNING: 'warning_notification.wav',
  INFO: 'info_notification.wav',
};

/**
 * Get sound for event type
 */
export function getSoundForEvent(event: string): string | null {
  switch (event) {
    case 'fill_update':
      return NotificationSounds.FILL;
    case 'rejection':
    case 'expiry':
      return NotificationSounds.ERROR;
    case 'price_update':
      return NotificationSounds.WARNING;
    case 'status_change':
      return NotificationSounds.INFO;
    default:
      return null;
  }
}

/**
 * Format notification timestamp
 */
export function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else {
    return date.toLocaleTimeString();
  }
}

/**
 * Batch notifications by order for summary display
 */
export function batchNotificationsByOrder(
  notifications: OrderNotification[]
): Map<string, OrderNotification[]> {
  const batched = new Map<string, OrderNotification[]>();

  notifications.forEach((notification) => {
    if (!batched.has(notification.orderId)) {
      batched.set(notification.orderId, []);
    }
    batched.get(notification.orderId)!.push(notification);
  });

  return batched;
}

/**
 * Create a summary notification for multiple updates
 */
export function createSummaryNotification(
  orderId: string,
  updates: OrderNotification[]
): OrderNotification | null {
  if (updates.length === 0) return null;

  const latestUpdate = updates[updates.length - 1];

  return {
    ...latestUpdate,
    message: `${updates.length} update(s) received for ${orderId}`,
  };
}
