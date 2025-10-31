/**
 * Analytics WebSocket Handler
 * Real-time analytics updates via WebSocket
 * @version 1.0.0
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { AnalyticsService } from './analyticsService';
import { AnalyticsAlert } from '../../analytics';

export interface AnalyticsSocketData {
  userId: string;
  strategyId?: string;
  subscriptions: Set<string>;
}

export class AnalyticsWebSocket {
  private io: SocketIOServer;
  private service: AnalyticsService;
  private userConnections: Map<string, Socket[]> = new Map();
  private socketData: Map<Socket, AnalyticsSocketData> = new Map();

  constructor(httpServer: HTTPServer, service?: AnalyticsService) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.service = service || new AnalyticsService();
    this.setupHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[Analytics WS] Client connected: ${socket.id}`);

      // Initialize socket data
      const socketData: AnalyticsSocketData = {
        userId: '',
        subscriptions: new Set()
      };
      this.socketData.set(socket, socketData);

      // Authentication
      socket.on('authenticate', (data) =>
        this.handleAuthenticate(socket, data)
      );

      // Subscription events
      socket.on('subscribe:performance', (data) =>
        this.handleSubscribe(socket, 'performance', data)
      );
      socket.on('subscribe:risk', (data) =>
        this.handleSubscribe(socket, 'risk', data)
      );
      socket.on('subscribe:portfolio', (data) =>
        this.handleSubscribe(socket, 'portfolio', data)
      );
      socket.on('subscribe:alerts', (data) =>
        this.handleSubscribe(socket, 'alerts', data)
      );

      // Unsubscription
      socket.on('unsubscribe', (data) =>
        this.handleUnsubscribe(socket, data)
      );

      // Analytics queries
      socket.on('query:performance', (data) =>
        this.handlePerformanceQuery(socket, data)
      );
      socket.on('query:risk', (data) =>
        this.handleRiskQuery(socket, data)
      );
      socket.on('query:portfolio', () =>
        this.handlePortfolioQuery(socket)
      );
      socket.on('query:summary', () =>
        this.handleSummaryQuery(socket)
      );

      // Disconnect
      socket.on('disconnect', () =>
        this.handleDisconnect(socket)
      );
    });
  }

  /**
   * Handle authentication
   */
  private handleAuthenticate(socket: Socket, data: any): void {
    try {
      const { userId, token } = data;

      // In production, would verify token
      if (!userId) {
        socket.emit('error', { message: 'Authentication failed' });
        return;
      }

      const socketData = this.socketData.get(socket)!;
      socketData.userId = userId;

      // Add socket to user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, []);
      }
      this.userConnections.get(userId)!.push(socket);

      socket.emit('authenticated', {
        userId,
        timestamp: new Date()
      });

      console.log(`[Analytics WS] User authenticated: ${userId}`);
    } catch (error) {
      socket.emit('error', {
        message: 'Authentication error'
      });
    }
  }

  /**
   * Handle subscription
   */
  private handleSubscribe(
    socket: Socket,
    type: string,
    data: any
  ): void {
    const socketData = this.socketData.get(socket);
    if (!socketData) return;

    const { strategyId } = data;
    const channel = `${type}${strategyId ? `:${strategyId}` : ''}`;

    socketData.subscriptions.add(channel);
    socket.join(channel);

    socket.emit('subscribed', {
      type,
      strategyId,
      channel,
      timestamp: new Date()
    });

    console.log(
      `[Analytics WS] ${socketData.userId} subscribed to ${channel}`
    );
  }

  /**
   * Handle unsubscription
   */
  private handleUnsubscribe(socket: Socket, data: any): void {
    const socketData = this.socketData.get(socket);
    if (!socketData) return;

    const { type, strategyId } = data;
    const channel = `${type}${strategyId ? `:${strategyId}` : ''}`;

    socketData.subscriptions.delete(channel);
    socket.leave(channel);

    socket.emit('unsubscribed', {
      type,
      channel,
      timestamp: new Date()
    });
  }

  /**
   * Handle performance query
   */
  private async handlePerformanceQuery(
    socket: Socket,
    data: any
  ): Promise<void> {
    try {
      const socketData = this.socketData.get(socket);
      if (!socketData) return;

      const { strategyId, startDate, endDate } = data;

      const metrics = await this.service.getPerformanceMetrics(
        socketData.userId,
        strategyId || 'all',
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      socket.emit('performance:data', {
        data: metrics,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', {
        message: 'Performance query failed'
      });
    }
  }

  /**
   * Handle risk query
   */
  private async handleRiskQuery(
    socket: Socket,
    data: any
  ): Promise<void> {
    try {
      const socketData = this.socketData.get(socket);
      if (!socketData) return;

      const { strategyId, startDate, endDate } = data;

      const risks = await this.service.getRiskMetrics(
        socketData.userId,
        strategyId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      socket.emit('risk:data', {
        data: risks,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', {
        message: 'Risk query failed'
      });
    }
  }

  /**
   * Handle portfolio query
   */
  private async handlePortfolioQuery(socket: Socket): Promise<void> {
    try {
      const socketData = this.socketData.get(socket);
      if (!socketData) return;

      const portfolio = await this.service.getPortfolioAnalytics(
        socketData.userId
      );

      socket.emit('portfolio:data', {
        data: portfolio,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', {
        message: 'Portfolio query failed'
      });
    }
  }

  /**
   * Handle summary query
   */
  private async handleSummaryQuery(socket: Socket): Promise<void> {
    try {
      const socketData = this.socketData.get(socket);
      if (!socketData) return;

      const summary = await this.service.getAnalyticsSummary(
        socketData.userId
      );

      socket.emit('summary:data', {
        data: summary,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', {
        message: 'Summary query failed'
      });
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const socketData = this.socketData.get(socket);
    if (!socketData) return;

    // Remove from user connections
    const connections = this.userConnections.get(socketData.userId) || [];
    const index = connections.indexOf(socket);
    if (index > -1) {
      connections.splice(index, 1);
    }

    // Clean up
    this.socketData.delete(socket);

    console.log(
      `[Analytics WS] Client disconnected: ${socket.id} (${socketData.userId})`
    );
  }

  /**
   * Broadcast performance update to subscribed clients
   */
  broadcastPerformanceUpdate(
    userId: string,
    strategyId: string,
    data: any
  ): void {
    const channel = strategyId ? `performance:${strategyId}` : 'performance';
    this.io.to(channel).emit('performance:update', {
      data,
      strategyId,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast risk update to subscribed clients
   */
  broadcastRiskUpdate(
    userId: string,
    strategyId: string,
    data: any
  ): void {
    const channel = strategyId ? `risk:${strategyId}` : 'risk';
    this.io.to(channel).emit('risk:update', {
      data,
      strategyId,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast portfolio update to subscribed clients
   */
  broadcastPortfolioUpdate(userId: string, data: any): void {
    const connections = this.userConnections.get(userId) || [];
    connections.forEach(socket => {
      socket.emit('portfolio:update', {
        data,
        timestamp: new Date()
      });
    });
  }

  /**
   * Broadcast alert to subscribed clients
   */
  broadcastAlert(userId: string, alert: AnalyticsAlert): void {
    const channel = alert.strategyId
      ? `alerts:${alert.strategyId}`
      : 'alerts';
    this.io.to(channel).emit('alert:new', {
      alert,
      timestamp: new Date()
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.userConnections.size;
  }

  /**
   * Get user connections
   */
  getUserConnections(userId: string): number {
    return this.userConnections.get(userId)?.length || 0;
  }

  /**
   * Get io instance (for advanced usage)
   */
  getIO(): SocketIOServer {
    return this.io;
  }
}

export function createAnalyticsWebSocket(
  httpServer: HTTPServer,
  service?: AnalyticsService
): AnalyticsWebSocket {
  return new AnalyticsWebSocket(httpServer, service);
}
