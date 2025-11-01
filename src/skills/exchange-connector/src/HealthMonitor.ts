/**
 * HealthMonitor - Real-time Exchange Health Tracking
 *
 * Tracks:
 * - P50, P95, P99 latency percentiles
 * - Error rates and patterns
 * - Uptime percentage
 * - Health status (healthy, degraded, unhealthy)
 */

export class HealthMonitor {
  private exchangeName: string;
  private latencies: number[] = [];
  private errors: number = 0;
  private successes: number = 0;
  private lastCheckTime: Date = new Date();
  private readonly MAX_SAMPLES = 1000;

  constructor(exchangeName: string) {
    this.exchangeName = exchangeName;
  }

  /**
   * Record a successful request with latency
   */
  recordSuccess(latency: number = 0): void {
    this.successes++;
    if (latency > 0) {
      this.recordLatency(latency);
    }
  }

  /**
   * Record latency measurement
   */
  recordLatency(latency: number): void {
    this.latencies.push(latency);
    // Keep only latest samples
    if (this.latencies.length > this.MAX_SAMPLES) {
      this.latencies.shift();
    }
  }

  /**
   * Record an error
   */
  recordError(): void {
    this.errors++;
  }

  /**
   * Get latency percentile
   */
  getLatencyPercentile(percentile: number): number {
    if (this.latencies.length === 0) return 0;

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get health status
   */
  getStatus(): string {
    const errorRate = this.getErrorRate();
    if (errorRate > 10) return 'unhealthy';
    if (errorRate > 5) return 'degraded';
    return 'healthy';
  }

  /**
   * Get error rate percentage
   */
  getErrorRate(): number {
    const total = this.successes + this.errors;
    return total === 0 ? 0 : (this.errors / total) * 100;
  }

  /**
   * Get uptime percentage
   */
  getUptime(): number {
    const total = this.successes + this.errors;
    return total === 0 ? 100 : (this.successes / total) * 100;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.latencies = [];
    this.errors = 0;
    this.successes = 0;
    this.lastCheckTime = new Date();
  }
}

export default HealthMonitor;
