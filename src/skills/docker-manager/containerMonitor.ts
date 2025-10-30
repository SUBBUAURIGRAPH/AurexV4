/**
 * Container Monitor - Real-time Container Health & Metrics Monitoring
 * Monitors container health, collects metrics, executes health checks, and manages alerts
 *
 * @module docker-manager/containerMonitor
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import * as Logger from 'winston';
import {
  Metrics,
  Alert,
  AlertConfig,
  AlertLevel,
  AlertAction,
  LifecycleEvent,
  ContainerState,
  HealthCheckType,
  HealthResult,
} from './types';
import { ContainerManager } from './containerManager';

/**
 * ContainerMonitor - Monitors container health and metrics
 * Provides real-time metrics collection, health checking, and alerting
 */
export class ContainerMonitor extends EventEmitter {
  private containerManager: ContainerManager;
  private logger: Logger.Logger;
  private alerts: Map<string, AlertConfig> = new Map();
  private metricsHistory: Map<string, Metrics[]> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private maxHistorySize: number = 1000; // Keep last 1000 metrics

  /**
   * Creates a new ContainerMonitor instance
   *
   * @param containerManager - Container manager instance
   * @param logger - Winston logger instance
   * @param maxHistorySize - Maximum metrics history to keep (default: 1000)
   */
  constructor(containerManager: ContainerManager, logger: Logger.Logger, maxHistorySize: number = 1000) {
    super();
    this.containerManager = containerManager;
    this.logger = logger;
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Start monitoring a container
   *
   * @param containerId - Container ID to monitor
   * @param interval - Monitoring interval in milliseconds (default: 5000)
   */
  async monitorContainer(containerId: string, interval: number = 5000): Promise<void> {
    try {
      this.logger.info(`Starting monitoring for container: ${containerId} (interval: ${interval}ms)`);

      // Get initial status to validate container exists
      await this.containerManager.getContainerStatus(containerId);

      // Initialize metrics history
      if (!this.metricsHistory.has(containerId)) {
        this.metricsHistory.set(containerId, []);
      }

      // Stop existing interval if one exists
      const existingInterval = this.monitoringIntervals.get(containerId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      // Start monitoring interval
      const monitoringInterval = setInterval(async () => {
        try {
          const metrics = await this.containerManager.getMetrics(containerId);

          // Store metrics
          const history = this.metricsHistory.get(containerId)!;
          history.push(metrics);

          // Keep history size under control
          if (history.length > this.maxHistorySize) {
            history.shift();
          }

          // Emit metrics event
          this.emit('metrics-collected', {
            containerId,
            metrics,
          });

          // Check alerts
          await this.checkAlerts(containerId, metrics);
        } catch (error) {
          this.logger.warn(`Failed to collect metrics for ${containerId}`, error);
        }
      }, interval);

      this.monitoringIntervals.set(containerId, monitoringInterval);

      this.emit('monitoring-started', { containerId });
    } catch (error) {
      this.logger.error(`Failed to start monitoring for ${containerId}`, error);
      throw new Error(`Failed to start monitoring: ${error.message}`);
    }
  }

  /**
   * Stop monitoring a container
   *
   * @param containerId - Container ID to stop monitoring
   */
  async stopMonitoring(containerId: string): Promise<void> {
    try {
      const interval = this.monitoringIntervals.get(containerId);
      if (interval) {
        clearInterval(interval);
        this.monitoringIntervals.delete(containerId);
      }

      this.logger.info(`Stopped monitoring for container: ${containerId}`);

      this.emit('monitoring-stopped', { containerId });
    } catch (error) {
      this.logger.error(`Failed to stop monitoring for ${containerId}`, error);
    }
  }

  /**
   * Get metrics for a container
   *
   * @param containerId - Container ID
   * @param duration - Duration in milliseconds (default: last metric)
   * @returns Metrics snapshot or array
   */
  async getMetrics(containerId: string, duration?: number): Promise<Metrics | Metrics[]> {
    try {
      const history = this.metricsHistory.get(containerId);

      if (!history || history.length === 0) {
        throw new Error(`No metrics available for container: ${containerId}`);
      }

      if (!duration) {
        // Return latest metric
        return history[history.length - 1];
      }

      // Filter metrics within duration
      const now = Date.now();
      const filtered = history.filter((m) => now - m.timestamp.getTime() <= duration);

      return filtered.length > 0 ? filtered : [history[history.length - 1]];
    } catch (error) {
      this.logger.error(`Failed to get metrics for ${containerId}`, error);
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  /**
   * Execute health check on container
   *
   * @param containerId - Container ID
   * @returns Health check result
   */
  async executeHealthCheck(containerId: string): Promise<HealthResult> {
    try {
      const startTime = Date.now();
      const status = await this.containerManager.getContainerStatus(containerId);

      const duration = Date.now() - startTime;

      let checkStatus: 'healthy' | 'unhealthy' = status.running ? 'healthy' : 'unhealthy';
      let message = status.running ? 'Container is running' : `Container is not running (state: ${status.state})`;

      // For HTTP health checks, could add actual health endpoint testing
      if (status.exitCode && status.exitCode !== 0) {
        checkStatus = 'unhealthy';
        message = `Container exited with code ${status.exitCode}`;
      }

      const result: HealthResult = {
        timestamp: new Date(),
        status: checkStatus,
        failureCount: checkStatus === 'unhealthy' ? 1 : 0,
        message,
        duration,
      };

      this.emit('health-check-executed', {
        containerId,
        result,
      });

      this.logger.debug(`Health check for ${containerId}: ${checkStatus} (${duration}ms)`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to execute health check for ${containerId}`, error);

      return {
        timestamp: new Date(),
        status: 'unhealthy',
        failureCount: 1,
        message: `Health check failed: ${error.message}`,
        duration: 0,
      };
    }
  }

  /**
   * Set alert configuration
   *
   * @param containerId - Container ID
   * @param alert - Alert configuration
   * @returns Alert ID
   */
  async setAlert(containerId: string, alert: AlertConfig): Promise<string> {
    try {
      const alertId = alert.id || `alert-${containerId}-${Date.now()}`;

      this.alerts.set(alertId, {
        ...alert,
        id: alertId,
        containerId,
      });

      this.logger.info(`Alert configured: ${alertId} for container ${containerId}`);

      this.emit('alert-set', {
        alertId,
        containerId,
        condition: alert.condition,
      });

      return alertId;
    } catch (error) {
      this.logger.error(`Failed to set alert for ${containerId}`, error);
      throw new Error(`Failed to set alert: ${error.message}`);
    }
  }

  /**
   * Get alerts for a container
   *
   * @param containerId - Container ID
   * @returns Array of alerts
   */
  async getAlerts(containerId: string): Promise<AlertConfig[]> {
    const containerAlerts: AlertConfig[] = [];

    this.alerts.forEach((alert) => {
      if (alert.containerId === containerId) {
        containerAlerts.push(alert);
      }
    });

    return containerAlerts;
  }

  /**
   * Check alerts for a container based on metrics
   * @private
   */
  private async checkAlerts(containerId: string, metrics: Metrics): Promise<void> {
    const containerAlerts = await this.getAlerts(containerId);

    for (const alert of containerAlerts) {
      if (!alert.enabled) continue;

      try {
        const triggered = this.evaluateAlertCondition(alert.condition, metrics);

        if (triggered) {
          this.handleAlert(alert, metrics);
        }
      } catch (error) {
        this.logger.warn(`Failed to evaluate alert ${alert.id}`, error);
      }
    }
  }

  /**
   * Evaluate alert condition
   * @private
   */
  private evaluateAlertCondition(condition: string, metrics: Metrics): boolean {
    // Parse simple conditions like "cpu > 80 for 5m"
    // For now, support basic CPU/memory thresholds
    try {
      if (condition.includes('cpu')) {
        const threshold = parseInt(condition.match(/\d+/)?.[0] || '80', 10);
        return metrics.cpu.usage > threshold;
      }

      if (condition.includes('memory')) {
        const threshold = parseInt(condition.match(/\d+/)?.[0] || '80', 10);
        return metrics.memory.percentageUsed > threshold;
      }

      return false;
    } catch (error) {
      this.logger.warn(`Failed to parse alert condition: ${condition}`, error);
      return false;
    }
  }

  /**
   * Handle triggered alert
   * @private
   */
  private async handleAlert(alert: AlertConfig, metrics: Metrics): Promise<void> {
    this.logger.warn(`Alert triggered: ${alert.id}`);

    // Execute alert actions
    for (const action of alert.actions) {
      try {
        switch (action.type) {
          case 'webhook':
            await this.callWebhook(action, alert, metrics);
            break;
          case 'slack':
            await this.sendSlackMessage(action, alert, metrics);
            break;
          case 'email':
            await this.sendEmail(action, alert, metrics);
            break;
          case 'pagerduty':
            await this.triggerPagerDuty(action, alert, metrics);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to execute alert action ${action.type}`, error);
      }
    }

    this.emit('alert-triggered', {
      alertId: alert.id,
      containerId: alert.containerId,
      message: `Alert condition met: ${alert.condition}`,
      metrics: {
        cpu: metrics.cpu.usage,
        memory: metrics.memory.percentageUsed,
      },
    });
  }

  /**
   * Call webhook
   * @private
   */
  private async callWebhook(action: AlertAction, alert: AlertConfig, metrics: Metrics): Promise<void> {
    // In real implementation, would use fetch or axios
    this.logger.info(`Would send webhook to ${action.target}`);
  }

  /**
   * Send Slack message
   * @private
   */
  private async sendSlackMessage(action: AlertAction, alert: AlertConfig, metrics: Metrics): Promise<void> {
    // In real implementation, would use Slack API
    this.logger.info(`Would send Slack message to ${action.target}`);
  }

  /**
   * Send email
   * @private
   */
  private async sendEmail(action: AlertAction, alert: AlertConfig, metrics: Metrics): Promise<void> {
    // In real implementation, would use email service
    this.logger.info(`Would send email to ${action.target}`);
  }

  /**
   * Trigger PagerDuty
   * @private
   */
  private async triggerPagerDuty(action: AlertAction, alert: AlertConfig, metrics: Metrics): Promise<void> {
    // In real implementation, would use PagerDuty API
    this.logger.info(`Would trigger PagerDuty alert`);
  }

  /**
   * Track container lifecycle events
   *
   * @param containerId - Container ID
   * @returns Async iterator of lifecycle events
   */
  async *trackContainerLifecycle(containerId: string): AsyncIterable<LifecycleEvent> {
    const listener = (event: any) => {
      if (event.containerId === containerId) {
        yield event as LifecycleEvent;
      }
    };

    // Listen to container events
    this.on('container-event', listener);

    // Clean up when done
    try {
      yield* (async function* () {
        // Would yield events here
      })();
    } finally {
      this.off('container-event', listener);
    }
  }

  /**
   * Get resource usage for a container
   *
   * @param containerId - Container ID
   * @returns Current resource usage
   */
  async getResourceUsage(containerId: string): Promise<Metrics | null> {
    const history = this.metricsHistory.get(containerId);

    if (!history || history.length === 0) {
      return null;
    }

    // Return latest metrics
    return history[history.length - 1];
  }

  /**
   * Get metrics statistics for a container
   *
   * @param containerId - Container ID
   * @returns Statistics including averages and peaks
   */
  async getMetricsStatistics(
    containerId: string
  ): Promise<{
    avgCpu: number;
    maxCpu: number;
    avgMemory: number;
    maxMemory: number;
    sampleCount: number;
  }> {
    const history = this.metricsHistory.get(containerId) || [];

    if (history.length === 0) {
      return {
        avgCpu: 0,
        maxCpu: 0,
        avgMemory: 0,
        maxMemory: 0,
        sampleCount: 0,
      };
    }

    let totalCpu = 0;
    let maxCpu = 0;
    let totalMemory = 0;
    let maxMemory = 0;

    history.forEach((m) => {
      totalCpu += m.cpu.usage;
      maxCpu = Math.max(maxCpu, m.cpu.usage);
      totalMemory += m.memory.percentageUsed;
      maxMemory = Math.max(maxMemory, m.memory.percentageUsed);
    });

    return {
      avgCpu: totalCpu / history.length,
      maxCpu,
      avgMemory: totalMemory / history.length,
      maxMemory,
      sampleCount: history.length,
    };
  }

  /**
   * Cleanup monitor resources
   */
  async cleanup(): Promise<void> {
    try {
      // Stop all monitoring intervals
      this.monitoringIntervals.forEach((interval) => clearInterval(interval));
      this.monitoringIntervals.clear();

      // Clear data
      this.metricsHistory.clear();
      this.alerts.clear();

      this.logger.info('ContainerMonitor cleanup complete');
    } catch (error) {
      this.logger.error('Error during monitor cleanup', error);
    }
  }
}

export default ContainerMonitor;
