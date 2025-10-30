/**
 * Redux Notifications Slice - Notifications and Alerts State Management
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NotificationsState, Notification } from '../types';
import { v4 as uuidv4 } from 'uuid';

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  settings: {
    orderNotifications: true,
    priceAlerts: true,
    positionUpdates: true,
    portfolioAlerts: true,
    systemAlerts: true,
    pushEnabled: true
  }
};

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'createdAt' | 'isRead'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        isRead: false
      };
      state.notifications.unshift(notification);
      state.unreadCount += 1;
    },
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllAsRead: (state) => {
      state.notifications.forEach(n => n.isRead = true);
      state.unreadCount = 0;
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.isRead) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    updateNotificationSetting: (state, action: PayloadAction<{ key: keyof typeof initialState.settings; value: boolean }>) => {
      (state.settings[action.payload.key] as boolean) = action.payload.value;
    }
  }
});

export const {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearNotifications,
  updateNotificationSetting
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
