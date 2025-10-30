/**
 * Real-time Progress Tracker
 * WebSocket-based real-time progress tracking for backtests and optimizations
 *
 * Features:
 * - Live progress updates
 * - Real-time metrics
 * - Cancellation support
 * - Event streaming
 * - Multiple concurrent sessions
 */

const EventEmitter = require('events');

/**
 * Progress Event Types
 */
const ProgressEventType = {
  STARTED: 'progress:started',
  PROGRESS: 'progress:progress',
  BAR_PROCESSED: 'progress:bar_processed',
  TRADE_EXECUTED: 'progress:trade_executed',
  COMPLETED: 'progress:completed',
  FAILED: 'progress:failed',
  CANCELLED: 'progress:cancelled'
};

/**
 * Real-time Progress Tracker
 */
class RealtimeProgressTracker extends EventEmitter {
  constructor(config = {}) {
    super();

    this.sessions = new Map();  // session_id -> session data
    this.wsConnections = new Map();  // user_id -> ws connections
    this.logger = config.logger || console;
  }

  /**
   * Create new progress session
   * @param {Object} sessionParams - Session parameters
   * @returns {Object} Session object
   */
  createSession(sessionParams) {
    const {
      id = Math.random().toString(36).substr(2, 9),
      userId,
      type = 'backtest',  // backtest, optimization
      taskName,
      totalSteps,
      startTime = new Date()
    } = sessionParams;

    const session = {
      id,
      userId,
      type,
      taskName,
      totalSteps,
      completedSteps: 0,
      progress: 0,
      startTime,
      status: 'running',
      metrics: {
        barsProcessed: 0,
        tradesExecuted: 0,
        ordersSubmitted: 0,
        errorsOccurred: 0
      },
      events: [],
      eta: null,
      speed: 0  // steps per second
    };

    this.sessions.set(id, session);

    this.logger.info(`📊 Progress session created: ${id} (${type} - ${taskName})`);
    this.emit(ProgressEventType.STARTED, session);
    this._broadcastToUser(userId, ProgressEventType.STARTED, session);

    return session;
  }

  /**
   * Update progress for session
   * @param {string} sessionId - Session ID
   * @param {Object} update - Progress update
   */
  updateProgress(sessionId, update) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    const {
      completedSteps,
      metrics,
      status = 'running'
    } = update;

    if (completedSteps !== undefined) {
      session.completedSteps = completedSteps;
      session.progress = (completedSteps / session.totalSteps) * 100;

      // Calculate ETA
      const elapsedSeconds = (new Date() - session.startTime) / 1000;
      const stepsPerSecond = completedSteps / elapsedSeconds;
      const remainingSteps = session.totalSteps - completedSteps;
      const etaSeconds = remainingSteps / stepsPerSecond;
      const eta = new Date(Date.now() + etaSeconds * 1000);

      session.speed = stepsPerSecond;
      session.eta = eta;
    }

    if (metrics) {
      session.metrics = { ...session.metrics, ...metrics };
    }

    session.status = status;
    session.lastUpdate = new Date();

    // Record event
    session.events.push({
      type: ProgressEventType.PROGRESS,
      timestamp: new Date(),
      progress: session.progress,
      completedSteps: session.completedSteps,
      metrics: session.metrics
    });

    this.logger.debug(
      `📈 Progress: ${session.taskName} - ${session.progress.toFixed(1)}% (${session.completedSteps}/${session.totalSteps})`
    );

    this.emit(ProgressEventType.PROGRESS, session);
    this._broadcastToUser(session.userId, ProgressEventType.PROGRESS, session);
  }

  /**
   * Record trade execution event
   * @param {string} sessionId - Session ID
   * @param {Object} tradeData - Trade data
   */
  recordTradeExecution(sessionId, tradeData) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.metrics.tradesExecuted++;

    const event = {
      type: ProgressEventType.TRADE_EXECUTED,
      timestamp: new Date(),
      trade: tradeData
    };

    session.events.push(event);

    this.logger.debug(`📍 Trade executed: ${tradeData.side} ${tradeData.quantity} ${tradeData.symbol}`);
    this.emit(ProgressEventType.TRADE_EXECUTED, { sessionId, trade: tradeData });
    this._broadcastToUser(session.userId, ProgressEventType.TRADE_EXECUTED, {
      sessionId,
      trade: tradeData
    });
  }

  /**
   * Record bar processed event
   * @param {string} sessionId - Session ID
   * @param {Object} barData - Bar data
   */
  recordBarProcessed(sessionId, barData) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.metrics.barsProcessed++;

    const event = {
      type: ProgressEventType.BAR_PROCESSED,
      timestamp: new Date(),
      bar: barData
    };

    session.events.push(event);

    // Emit less frequently to avoid flooding
    if (session.metrics.barsProcessed % 10 === 0) {
      this.logger.debug(`📊 Bars processed: ${session.metrics.barsProcessed}`);
      this.emit(ProgressEventType.BAR_PROCESSED, { sessionId, barCount: session.metrics.barsProcessed });
    }
  }

  /**
   * Complete session
   * @param {string} sessionId - Session ID
   * @param {Object} result - Final result
   */
  completeSession(sessionId, result) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.endTime = new Date();
    session.duration = (session.endTime - session.startTime) / 1000;
    session.result = result;

    this.logger.info(
      `✅ Session completed: ${session.taskName} (${session.duration.toFixed(1)}s)`
    );

    this.emit(ProgressEventType.COMPLETED, session);
    this._broadcastToUser(session.userId, ProgressEventType.COMPLETED, session);
  }

  /**
   * Fail session
   * @param {string} sessionId - Session ID
   * @param {Error} error - Error information
   */
  failSession(sessionId, error) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'failed';
    session.endTime = new Date();
    session.duration = (session.endTime - session.startTime) / 1000;
    session.error = error.message;

    this.logger.error(
      `❌ Session failed: ${session.taskName} - ${error.message}`
    );

    this.emit(ProgressEventType.FAILED, session);
    this._broadcastToUser(session.userId, ProgressEventType.FAILED, session);
  }

  /**
   * Cancel session
   * @param {string} sessionId - Session ID
   */
  cancelSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session not found for cancellation: ${sessionId}`);
      return false;
    }

    if (session.status !== 'running') {
      this.logger.warn(`Cannot cancel non-running session: ${sessionId}`);
      return false;
    }

    session.status = 'cancelled';
    session.endTime = new Date();
    session.duration = (session.endTime - session.startTime) / 1000;

    this.logger.info(`🚫 Session cancelled: ${sessionId}`);

    this.emit(ProgressEventType.CANCELLED, session);
    this._broadcastToUser(session.userId, ProgressEventType.CANCELLED, session);

    return true;
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Object} Session data
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions for user
   * @param {number} userId - User ID
   * @returns {Array} Active sessions
   */
  getUserActiveSessions(userId) {
    const activeSessions = [];

    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.status === 'running') {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  /**
   * Register WebSocket connection for user
   * @param {number} userId - User ID
   * @param {Object} ws - WebSocket connection
   */
  registerConnection(userId, ws) {
    if (!this.wsConnections.has(userId)) {
      this.wsConnections.set(userId, []);
    }

    this.wsConnections.get(userId).push(ws);

    this.logger.info(`📡 WebSocket connected for user ${userId}`);

    // Send all active sessions to new connection
    const activeSessions = this.getUserActiveSessions(userId);
    activeSessions.forEach(session => {
      this._sendToConnection(ws, {
        type: 'session:state',
        session: this._serializeSession(session)
      });
    });
  }

  /**
   * Unregister WebSocket connection
   * @param {number} userId - User ID
   * @param {Object} ws - WebSocket connection
   */
  unregisterConnection(userId, ws) {
    const connections = this.wsConnections.get(userId);
    if (connections) {
      const index = connections.indexOf(ws);
      if (index > -1) {
        connections.splice(index, 1);
      }

      if (connections.length === 0) {
        this.wsConnections.delete(userId);
      }
    }

    this.logger.info(`📡 WebSocket disconnected for user ${userId}`);
  }

  /**
   * Get progress summary for dashboard
   * @param {number} userId - User ID
   * @returns {Object} Progress summary
   */
  getProgressSummary(userId) {
    const userSessions = Array.from(this.sessions.values()).filter(s => s.userId === userId);

    const summary = {
      totalSessions: userSessions.length,
      activeSessions: userSessions.filter(s => s.status === 'running').length,
      completedSessions: userSessions.filter(s => s.status === 'completed').length,
      failedSessions: userSessions.filter(s => s.status === 'failed').length,
      cancelledSessions: userSessions.filter(s => s.status === 'cancelled').length,
      recentSessions: userSessions.slice(-5).reverse(),
      averageCompletion: this._calculateAverageCompletion(userSessions)
    };

    return summary;
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Broadcast event to user's WebSocket connections
   * @private
   */
  _broadcastToUser(userId, eventType, data) {
    const connections = this.wsConnections.get(userId) || [];

    connections.forEach(ws => {
      this._sendToConnection(ws, {
        type: eventType,
        data: this._serializeData(data)
      });
    });
  }

  /**
   * Send message to WebSocket connection
   * @private
   */
  _sendToConnection(ws, message) {
    try {
      if (ws && ws.readyState === 1) {  // WebSocket.OPEN
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      this.logger.warn('Error sending WebSocket message:', error);
    }
  }

  /**
   * Serialize session for transmission
   * @private
   */
  _serializeSession(session) {
    return {
      id: session.id,
      userId: session.userId,
      type: session.type,
      taskName: session.taskName,
      progress: session.progress,
      status: session.status,
      metrics: session.metrics,
      eta: session.eta,
      speed: session.speed.toFixed(2),
      duration: session.duration
    };
  }

  /**
   * Serialize data for transmission
   * @private
   */
  _serializeData(data) {
    if (data.id && data.userId) {
      // It's a session
      return this._serializeSession(data);
    }
    return data;
  }

  /**
   * Calculate average completion time
   * @private
   */
  _calculateAverageCompletion(sessions) {
    const completedSessions = sessions.filter(s => s.status === 'completed' && s.duration);
    if (completedSessions.length === 0) return null;

    const totalDuration = completedSessions.reduce((sum, s) => sum + s.duration, 0);
    return (totalDuration / completedSessions.length).toFixed(1);
  }
}

// Export
module.exports = {
  RealtimeProgressTracker,
  ProgressEventType
};
