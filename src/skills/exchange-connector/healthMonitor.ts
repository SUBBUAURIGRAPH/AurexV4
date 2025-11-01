/**
 * Health Monitor
 * Monitors exchange health, latency, and uptime
 * Provides real-time status and diagnostic reports
 * Version: 1.0.0
 */

import { ExchangeHealth, HealthCheckResult, HealthMonitorConfig } from './types';

interface HealthMetrics {
  exchange: string;
  latencies: number[];
  errors: Array<{ timestamp: Date; message: string }>;
  uptime: number;
  lastSuccessful?: Date;
  consecutiveErrors: number;
}

export class HealthMonitor {
  private health: Map<string, ExchangeHealth>;
  private metrics: Map<string, HealthMetrics>;
  private config: HealthMonitorConfig;
  private checkInterval?: NodeJS.Timer;
  private healthChecks: Array<() => Promise<ExchangeHealth>>;

  constructor(config?: HealthMonitorConfig) {
    this.health = new Map();
    this.metrics = new Map();
    this.healthChecks = [];
    this.config = {
      checkInterval: config?.checkInterval || 60000,
      metricsExport: config?.metricsExport || false,
      metricsPort: config?.metricsPort || 9090,
      alertOnLatency: config?.alertOnLatency || 500,
      alertOnErrorRate: config?.alertOnErrorRate || 0.05,
    };
  }

  /**
   * Register a health check function
   */
  registerHealthCheck(check: () => Promise<ExchangeHealth>): void {
    this.healthChecks.push(check);
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.performHealthChecks(); // Initial check

    this.checkInterval = setInterval(
      () => this.performHealthChecks(),
      this.config.checkInterval || 60000
    );
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    const results = await Promise.allSettled(
      this.healthChecks.map(check => check())
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.updateHealth(result.value);
      }
    }
  }

  /**
   * Update health status for an exchange
   */
  updateHealth(health: ExchangeHealth): void {
    this.health.set(health.name, health);

    // Update metrics
    if (!this.metrics.has(health.name)) {
      this.metrics.set(health.name, {
        exchange: health.name,
        latencies: [],
        errors: [],
        uptime: 100,
        consecutiveErrors: 0,
      });
    }

    const metrics = this.metrics.get(health.name)!;

    // Record latency
    metrics.latencies.push(health.latency);
    if (metrics.latencies.length > 1000) {
      metrics.latencies.shift(); // Keep last 1000
    }

    // Record error if failed
    if (health.status === 'failed' || health.status === 'degraded') {
      metrics.errors.push({
        timestamp: new Date(),
        message: health.errorMessage || 'Unknown error',
      });
      metrics.consecutiveErrors++;

      if (metrics.errors.length > 100) {
        metrics.errors.shift(); // Keep last 100
      }
    } else {
      if (metrics.consecutiveErrors > 0) {
        metrics.lastSuccessful = new Date();
      }
      metrics.consecutiveErrors = 0;
    }

    // Check for alerts
    this.checkAlerts(health);
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(health: ExchangeHealth): void {
    // Alert on high latency
    if (health.latency > (this.config.alertOnLatency || 500) && health.status !== 'failed') {
      this.triggerAlert(`High latency detected for ${health.name}: ${health.latency}ms`);
    }

    // Alert on consecutive errors
    const metrics = this.metrics.get(health.name);
    if (metrics && metrics.consecutiveErrors >= 3) {
      this.triggerAlert(`${metrics.consecutiveErrors} consecutive errors for ${health.name}`);
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(message: string): void {
    console.warn(`[ALERT] ${message}`);
    // In production, integrate with Slack, PagerDuty, etc.
  }

  /**
   * Get health status for all exchanges
   */
  getHealthStatus(): ExchangeHealth[] {
    return Array.from(this.health.values());
  }

  /**
   * Get health status for a specific exchange
   */
  getHealth(exchange: string): ExchangeHealth | null {
    return this.health.get(exchange) || null;
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
    unknown: number;
    overallHealth: number;
  } {
    const statuses = Array.from(this.health.values());
    const healthy = statuses.filter(h => h.status === 'healthy').length;
    const degraded = statuses.filter(h => h.status === 'degraded').length;
    const failed = statuses.filter(h => h.status === 'failed').length;
    const unknown = statuses.filter(h => h.status === 'unknown').length;

    return {
      total: statuses.length,
      healthy,
      degraded,
      failed,
      unknown,
      overallHealth: statuses.length > 0
        ? ((healthy + (degraded * 0.5)) / statuses.length) * 100
        : 0,
    };
  }

  /**
   * Get detailed metrics for an exchange
   */
  getMetrics(exchange: string): HealthMetrics | null {
    return this.metrics.get(exchange) || null;
  }

  /**
   * Get latency statistics
   */
  getLatencyStats(exchange: string): {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    stdDev: number;
  } | null {
    const metrics = this.metrics.get(exchange);
    if (!metrics || metrics.latencies.length === 0) {
      return null;
    }

    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;

    // Calculate standard deviation
    const variance = sorted.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);

    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      avg: Math.round(avg * 100) / 100,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
      stdDev: Math.round(stdDev * 100) / 100,
    };
  }

  /**
   * Get error rate
   */
  getErrorRate(exchange: string): {
    rate: number;
    errors: number;
    total: number;
  } | null {
    const metrics = this.metrics.get(exchange);
    if (!metrics) {
      return null;
    }

    const errorCount = metrics.errors.length;
    const totalChecks = metrics.latencies.length;

    return {
      rate: totalChecks > 0 ? errorCount / totalChecks : 0,
      errors: errorCount,
      total: totalChecks,
    };
  }

  /**
   * Check if exchange is degraded
   */
  isDegraded(exchange: string): boolean {
    const health = this.health.get(exchange);
    return health?.status === 'degraded' || health?.status === 'failed' || false;
  }

  /**
   * Check if exchange is down
   */
  isDown(exchange: string): boolean {
    const health = this.health.get(exchange);
    return health?.status === 'failed' || false;
  }

  /**
   * Get uptime percentage (24h)
   */
  getUptime(exchange: string): number | null {
    const metrics = this.metrics.get(exchange);
    if (!metrics) {
      return null;
    }

    const errorCount = metrics.errors.length;
    const totalChecks = metrics.latencies.length;

    if (totalChecks === 0) {
      return 100;
    }

    return ((totalChecks - errorCount) / totalChecks) * 100;
  }

  /**
   * Generate health report
   */
  generateHealthReport(): string {
    const summary = this.getHealthSummary();
    const statuses = this.getHealthStatus();

    let report = `
================================================================================
                        EXCHANGE HEALTH REPORT
================================================================================

SUMMARY
-------
Total Exchanges: ${summary.total}
Healthy: ${summary.healthy}
Degraded: ${summary.degraded}
Failed: ${summary.failed}
Unknown: ${summary.unknown}
Overall Health: ${summary.overallHealth.toFixed(2)}%

DETAILED STATUS
---------------
`;

    for (const status of statuses) {
      const latencyStats = this.getLatencyStats(status.name);
      const errorRate = this.getErrorRate(status.name);
      const uptime = this.getUptime(status.name);

      report += `
${status.name.toUpperCase()}
  Status: ${status.status}
  Connected: ${status.connected}
  Latency: ${status.latency}ms
  Last Check: ${status.lastCheck.toISOString()}
  ${latencyStats ? `  Avg Latency: ${latencyStats.avg}ms (p95: ${latencyStats.p95}ms)` : ''}
  ${uptime !== null ? `  Uptime: ${uptime.toFixed(2)}%` : ''}
  ${errorRate ? `  Error Rate: ${(errorRate.rate * 100).toFixed(2)}%` : ''}
  ${status.errorMessage ? `  Error: ${status.errorMessage}` : ''}
`;
    }

    report += `
================================================================================
Generated: ${new Date().toISOString()}
================================================================================
`;

    return report;
  }

  /**
   * Clear metrics
   */
  clearMetrics(exchange?: string): void {
    if (exchange) {
      this.metrics.delete(exchange);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Destroy monitor
   */
  destroy(): void {
    this.stopHealthChecks();
    this.health.clear();
    this.metrics.clear();
    this.healthChecks = [];
  }
}

export default HealthMonitor;
