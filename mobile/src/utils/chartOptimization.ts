/**
 * Chart Optimization Utilities
 * Performance utilities for handling large datasets in charts
 * Includes data sampling, memoization helpers, and rendering optimizations
 */

import { OHLCV } from '../types';

/**
 * Downsample OHLCV data for better performance with large datasets
 * Uses LTTB (Largest-Triangle-Three-Buckets) algorithm for intelligent sampling
 *
 * @param data - Original OHLCV data array
 * @param targetPoints - Desired number of data points
 * @returns Downsampled data array
 */
export function downsampleOHLCV(data: OHLCV[], targetPoints: number): OHLCV[] {
  if (data.length <= targetPoints) {
    return data;
  }

  const sampled: OHLCV[] = [];
  const bucketSize = (data.length - 2) / (targetPoints - 2);

  // Always include first point
  sampled.push(data[0]);

  for (let i = 0; i < targetPoints - 2; i++) {
    const bucketStart = Math.floor((i + 0) * bucketSize) + 1;
    const bucketEnd = Math.floor((i + 1) * bucketSize) + 1;
    const bucketLength = bucketEnd - bucketStart;

    // Calculate average for bucket
    let avgTimestamp = 0;
    let avgOpen = 0;
    let avgHigh = 0;
    let avgLow = 0;
    let avgClose = 0;
    let avgVolume = 0;

    for (let j = bucketStart; j < bucketEnd; j++) {
      const point = data[j];
      avgTimestamp += new Date(point.timestamp).getTime();
      avgOpen += point.open;
      avgHigh = Math.max(avgHigh, point.high);
      avgLow = avgLow === 0 ? point.low : Math.min(avgLow, point.low);
      avgClose += point.close;
      avgVolume += point.volume;
    }

    sampled.push({
      timestamp: new Date(avgTimestamp / bucketLength).toISOString(),
      open: avgOpen / bucketLength,
      high: avgHigh,
      low: avgLow,
      close: avgClose / bucketLength,
      volume: avgVolume / bucketLength
    });
  }

  // Always include last point
  sampled.push(data[data.length - 1]);

  return sampled;
}

/**
 * Throttle data updates to prevent excessive re-renders
 * Returns a throttled version of data that only updates at specified interval
 *
 * @param data - Data array
 * @param throttleMs - Throttle interval in milliseconds
 * @returns Throttled data
 */
let lastUpdateTime = 0;
let cachedData: any = null;

export function throttleChartData<T>(data: T[], throttleMs: number = 500): T[] {
  const now = Date.now();

  if (now - lastUpdateTime < throttleMs && cachedData) {
    return cachedData;
  }

  lastUpdateTime = now;
  cachedData = data;
  return data;
}

/**
 * Calculate optimal number of data points for chart rendering
 * Based on screen width and desired density
 *
 * @param screenWidth - Width of the screen in pixels
 * @param dataLength - Total length of dataset
 * @param minPixelsPerPoint - Minimum pixels per data point
 * @returns Optimal number of points
 */
export function calculateOptimalPoints(
  screenWidth: number,
  dataLength: number,
  minPixelsPerPoint: number = 4
): number {
  const maxPoints = Math.floor(screenWidth / minPixelsPerPoint);
  return Math.min(dataLength, maxPoints);
}

/**
 * Batch process large datasets into chunks for progressive rendering
 *
 * @param data - Full dataset
 * @param batchSize - Size of each batch
 * @returns Array of batches
 */
export function batchData<T>(data: T[], batchSize: number = 100): T[][] {
  const batches: T[][] = [];

  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Memoization helper for expensive chart calculations
 */
class ChartCache {
  private cache: Map<string, any> = new Map();
  private maxSize: number = 50;

  set(key: string, value: any): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  get(key: string): any | undefined {
    return this.cache.get(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const chartCache = new ChartCache();

/**
 * Generate cache key for chart data
 */
export function generateCacheKey(
  symbol: string,
  timeframe: string,
  chartType: string
): string {
  return `${symbol}-${timeframe}-${chartType}`;
}

/**
 * Performance monitoring utility
 */
export class ChartPerformanceMonitor {
  private startTime: number = 0;
  private metrics: { [key: string]: number[] } = {};

  startMeasure(label: string): void {
    this.startTime = performance.now();
  }

  endMeasure(label: string): number {
    const duration = performance.now() - this.startTime;

    if (!this.metrics[label]) {
      this.metrics[label] = [];
    }

    this.metrics[label].push(duration);

    // Keep only last 10 measurements
    if (this.metrics[label].length > 10) {
      this.metrics[label].shift();
    }

    return duration;
  }

  getAverageTime(label: string): number {
    const times = this.metrics[label];
    if (!times || times.length === 0) return 0;

    const sum = times.reduce((a, b) => a + b, 0);
    return sum / times.length;
  }

  getMetrics(): { [key: string]: { average: number; last: number } } {
    const result: { [key: string]: { average: number; last: number } } = {};

    Object.keys(this.metrics).forEach(label => {
      const times = this.metrics[label];
      result[label] = {
        average: this.getAverageTime(label),
        last: times[times.length - 1] || 0
      };
    });

    return result;
  }

  logMetrics(): void {
    const metrics = this.getMetrics();
    console.log('Chart Performance Metrics:', metrics);
  }
}

export const performanceMonitor = new ChartPerformanceMonitor();

/**
 * Determine if data should be downsampled based on length
 */
export function shouldDownsample(
  dataLength: number,
  threshold: number = 200
): boolean {
  return dataLength > threshold;
}

/**
 * Optimize chart data for rendering
 * Combines multiple optimization strategies
 */
export function optimizeChartData(
  data: OHLCV[],
  screenWidth: number,
  forceDownsample: boolean = false
): OHLCV[] {
  performanceMonitor.startMeasure('optimizeChartData');

  let optimizedData = data;

  // Check cache first
  const cacheKey = `optimized-${data.length}-${screenWidth}`;
  if (chartCache.has(cacheKey)) {
    performanceMonitor.endMeasure('optimizeChartData');
    return chartCache.get(cacheKey);
  }

  // Downsample if needed
  if (forceDownsample || shouldDownsample(data.length)) {
    const optimalPoints = calculateOptimalPoints(screenWidth, data.length);
    optimizedData = downsampleOHLCV(data, optimalPoints);
  }

  // Cache result
  chartCache.set(cacheKey, optimizedData);

  const duration = performanceMonitor.endMeasure('optimizeChartData');
  console.log(`Chart data optimized in ${duration.toFixed(2)}ms`);

  return optimizedData;
}
