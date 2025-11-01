/**
 * useOrderUpdates Hook
 * Real-time order status tracking via WebSocket
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';

// ==================== Types ====================

export interface OrderUpdate {
  orderId: string;
  status: string;
  filledQuantity: number;
  averageFillPrice: number;
  totalCost: number;
  commission: number;
  timestamp: string;
  event: 'status_change' | 'price_update' | 'fill_update' | 'rejection' | 'expiry';
  message?: string;
  previousStatus?: string;
}

export interface OrderWebSocketMessage {
  type: 'order_update' | 'price_alert' | 'connection' | 'error';
  data: OrderUpdate | any;
  timestamp: string;
}

// ==================== Hook ====================

/**
 * Hook to subscribe to real-time order updates via WebSocket
 * Automatically handles connection, reconnection, and cleanup
 */
export function useOrderUpdates(
  onOrderUpdate?: (update: OrderUpdate) => void,
  onError?: (error: Error) => void,
  enabled: boolean = true
) {
  const dispatch = useAppDispatch();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const isConnectingRef = useRef(false);

  const { orders } = useAppSelector((state) => state.trading);

  // WebSocket connection setup
  const connect = useCallback(() => {
    if (!enabled || isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnectingRef.current = true;

    try {
      const wsUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://apihms.aurex.in/ws/orders';
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[OrderUpdates] WebSocket connected');
        isConnectingRef.current = false;

        // Subscribe to all active orders
        orders.forEach((order) => {
          subscribeToOrder(order.id);
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: OrderWebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'order_update':
              handleOrderUpdate(message.data as OrderUpdate);
              break;
            case 'price_alert':
              handlePriceAlert(message.data);
              break;
            case 'error':
              console.error('[OrderUpdates] WebSocket error:', message.data);
              if (onError) onError(new Error(message.data?.message || 'WebSocket error'));
              break;
          }
        } catch (err: any) {
          console.error('[OrderUpdates] Failed to parse message:', err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[OrderUpdates] WebSocket error:', error);
        isConnectingRef.current = false;
        if (onError) onError(new Error('WebSocket connection error'));
      };

      wsRef.current.onclose = () => {
        console.log('[OrderUpdates] WebSocket disconnected');
        isConnectingRef.current = false;

        // Attempt to reconnect after 5 seconds
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    } catch (err: any) {
      console.error('[OrderUpdates] Failed to connect:', err);
      isConnectingRef.current = false;
      if (onError) onError(err);
    }
  }, [enabled, orders, onError]);

  // Subscribe to a specific order
  const subscribeToOrder = useCallback((orderId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (subscriptionsRef.current.has(orderId)) {
      return;
    }

    try {
      wsRef.current.send(
        JSON.stringify({
          action: 'subscribe',
          orderId,
          timestamp: new Date().toISOString(),
        })
      );
      subscriptionsRef.current.add(orderId);
    } catch (err) {
      console.error('[OrderUpdates] Failed to subscribe to order:', err);
    }
  }, []);

  // Unsubscribe from a specific order
  const unsubscribeFromOrder = useCallback((orderId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!subscriptionsRef.current.has(orderId)) {
      return;
    }

    try {
      wsRef.current.send(
        JSON.stringify({
          action: 'unsubscribe',
          orderId,
          timestamp: new Date().toISOString(),
        })
      );
      subscriptionsRef.current.delete(orderId);
    } catch (err) {
      console.error('[OrderUpdates] Failed to unsubscribe from order:', err);
    }
  }, []);

  // Handle order status update
  const handleOrderUpdate = useCallback(
    (update: OrderUpdate) => {
      console.log('[OrderUpdates] Received order update:', update);

      // Call the callback if provided
      if (onOrderUpdate) {
        onOrderUpdate(update);
      }

      // Dispatch action to update Redux state
      // This would be dispatched to a thunk or action that updates the order in state
      dispatch({
        type: 'trading/updateOrderStatus',
        payload: update,
      } as any);
    },
    [onOrderUpdate, dispatch]
  );

  // Handle price alerts
  const handlePriceAlert = useCallback(
    (data: any) => {
      console.log('[OrderUpdates] Price alert:', data);
      // Could dispatch a notification action here
    },
    []
  );

  // Connect to WebSocket on mount
  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect, enabled]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    subscribeToOrder,
    unsubscribeFromOrder,
    reconnect: connect,
  };
}

/**
 * Hook to subscribe to multiple orders
 */
export function useOrderListUpdates(
  orderIds: string[],
  onUpdates?: (updates: OrderUpdate[]) => void,
  enabled: boolean = true
) {
  const updatesRef = useRef<Map<string, OrderUpdate>>(new Map());

  const handleOrderUpdate = useCallback(
    (update: OrderUpdate) => {
      updatesRef.current.set(update.orderId, update);

      if (onUpdates) {
        onUpdates(Array.from(updatesRef.current.values()));
      }
    },
    [onUpdates]
  );

  const { subscribeToOrder, unsubscribeFromOrder, ...rest } = useOrderUpdates(
    handleOrderUpdate,
    undefined,
    enabled
  );

  // Subscribe to all orders
  useEffect(() => {
    orderIds.forEach((orderId) => {
      subscribeToOrder(orderId);
    });

    return () => {
      orderIds.forEach((orderId) => {
        unsubscribeFromOrder(orderId);
      });
    };
  }, [orderIds, subscribeToOrder, unsubscribeFromOrder]);

  return rest;
}
