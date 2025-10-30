/**
 * WebSocket Service
 * Handles real-time WebSocket connections for trading updates, prices, and notifications
 */

import { WebSocketMessage, WebSocketEventType } from '../types';

interface WebSocketConfig {
  url: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  messageTimeout: number;
}

type EventListener = (data: any) => void;
type ConnectionListener = (connected: boolean) => void;

/**
 * WebSocketService class
 * Manages WebSocket connections with auto-reconnect, subscriptions, and event handling
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private connected: boolean = false;
  private reconnectCount: number = 0;
  private eventListeners: Map<WebSocketEventType, Set<EventListener>> = new Map();
  private connectionListeners: Set<ConnectionListener> = new Set();
  private subscriptions: Set<string> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private accessToken: string = '';

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: config.url || 'wss://apihms.aurex.in',
      reconnectAttempts: config.reconnectAttempts || 10,
      reconnectDelay: config.reconnectDelay || 3000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      messageTimeout: config.messageTimeout || 5000
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(accessToken: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve(true);
        return;
      }

      this.accessToken = accessToken;

      try {
        const wsUrl = `${this.config.url}?token=${accessToken}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectCount = 0;
          this.notifyConnectionListeners(true);
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit(WebSocketEventType.ERROR, { error });
          resolve(false);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.connected = false;
          this.stopHeartbeat();
          this.notifyConnectionListeners(false);
          this.attemptReconnect();
          resolve(false);
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.stopHeartbeat();
      this.ws.close();
      this.ws = null;
      this.connected = false;
      this.subscriptions.clear();
      this.notifyConnectionListeners(false);
    }
  }

  /**
   * Send message through WebSocket
   */
  send(message: WebSocketMessage): void {
    if (!this.connected || !this.ws) {
      // Queue message if not connected
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.messageQueue.push(message);
    }
  }

  /**
   * Subscribe to a channel or topic
   */
  subscribe(channel: string): void {
    if (this.subscriptions.has(channel)) {
      return;
    }

    this.subscriptions.add(channel);

    const message: WebSocketMessage = {
      type: 'subscribe',
      payload: { channel },
      timestamp: new Date().toISOString()
    };

    this.send(message);
  }

  /**
   * Unsubscribe from a channel or topic
   */
  unsubscribe(channel: string): void {
    if (!this.subscriptions.has(channel)) {
      return;
    }

    this.subscriptions.delete(channel);

    const message: WebSocketMessage = {
      type: 'unsubscribe',
      payload: { channel },
      timestamp: new Date().toISOString()
    };

    this.send(message);
  }

  /**
   * Subscribe to order updates
   */
  subscribeToOrderUpdates(orderId: string): void {
    this.subscribe(`order:${orderId}`);
  }

  /**
   * Subscribe to position updates
   */
  subscribeToPositionUpdates(): void {
    this.subscribe('positions');
  }

  /**
   * Subscribe to price updates for a symbol
   */
  subscribeToPrice(symbol: string): void {
    this.subscribe(`price:${symbol}`);
  }

  /**
   * Subscribe to account updates
   */
  subscribeToAccountUpdates(): void {
    this.subscribe('account');
  }

  /**
   * Add event listener
   */
  on(eventType: WebSocketEventType, listener: EventListener): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }

    this.eventListeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Add connection listener
   */
  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      // Handle message based on type
      switch (message.type) {
        case 'order_update':
          this.emit(WebSocketEventType.ORDER_UPDATE, message.payload);
          break;
        case 'trade_update':
          this.emit(WebSocketEventType.TRADE_UPDATE, message.payload);
          break;
        case 'position_update':
          this.emit(WebSocketEventType.POSITION_UPDATE, message.payload);
          break;
        case 'account_update':
          this.emit(WebSocketEventType.ACCOUNT_UPDATE, message.payload);
          break;
        case 'price_update':
          this.emit(WebSocketEventType.PRICE_UPDATE, message.payload);
          break;
        case 'heartbeat':
          this.sendHeartbeatResponse();
          break;
        default:
          console.log('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(eventType: WebSocketEventType, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Notify all connection listeners
   */
  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        const message: WebSocketMessage = {
          type: 'heartbeat',
          payload: {},
          timestamp: new Date().toISOString()
        };
        this.send(message);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send heartbeat response
   */
  private sendHeartbeatResponse(): void {
    const message: WebSocketMessage = {
      type: 'heartbeat_response',
      payload: { timestamp: Date.now() },
      timestamp: new Date().toISOString()
    };
    this.send(message);
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectCount >= this.config.reconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit(WebSocketEventType.ERROR, { error: 'Failed to reconnect' });
      return;
    }

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectCount);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectCount + 1})`);

    setTimeout(() => {
      this.reconnectCount++;
      this.connect(this.accessToken);
    }, delay);
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService({
  url: process.env.EXPO_PUBLIC_WS_URL || 'wss://apihms.aurex.in'
});
