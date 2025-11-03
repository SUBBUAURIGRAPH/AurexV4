/**
 * Prometheus Metrics Collection
 * Tracks HTTP requests, database operations, and application performance
 */

import {
  Counter,
  Histogram,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Custom registry for all metrics
 */
const register = new Registry();

/**
 * Collect default Node.js metrics
 */
collectDefaultMetrics({ register });

/**
 * HTTP Request Metrics
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

/**
 * Database Metrics
 */
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const dbQueryTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

export const dbConnectionPoolSize = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Current size of database connection pool',
  registers: [register],
});

export const dbConnectionPoolAvailable = new Gauge({
  name: 'db_connection_pool_available',
  help: 'Number of available connections in pool',
  registers: [register],
});

/**
 * gRPC Metrics
 */
export const grpcRequestDuration = new Histogram({
  name: 'grpc_request_duration_seconds',
  help: 'Duration of gRPC requests in seconds',
  labelNames: ['service', 'method', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const grpcRequestTotal = new Counter({
  name: 'grpc_requests_total',
  help: 'Total number of gRPC requests',
  labelNames: ['service', 'method', 'status'],
  registers: [register],
});

export const grpcMessagesSent = new Counter({
  name: 'grpc_messages_sent_total',
  help: 'Total number of gRPC messages sent',
  labelNames: ['service', 'method'],
  registers: [register],
});

export const grpcMessagesReceived = new Counter({
  name: 'grpc_messages_received_total',
  help: 'Total number of gRPC messages received',
  labelNames: ['service', 'method'],
  registers: [register],
});

/**
 * Cache Metrics
 */
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_name'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_name'],
  registers: [register],
});

export const cacheSize = new Gauge({
  name: 'cache_size_bytes',
  help: 'Current size of cache in bytes',
  labelNames: ['cache_name'],
  registers: [register],
});

/**
 * Business Logic Metrics
 */
export const tradesTotal = new Counter({
  name: 'trades_total',
  help: 'Total number of trades executed',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const ordersTotal = new Counter({
  name: 'orders_total',
  help: 'Total number of orders placed',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const portfolioValue = new Gauge({
  name: 'portfolio_value_usd',
  help: 'Current portfolio value in USD',
  labelNames: ['portfolio_id'],
  registers: [register],
});

export const strategyReturns = new Gauge({
  name: 'strategy_returns_percent',
  help: 'Strategy returns in percent',
  labelNames: ['strategy_id'],
  registers: [register],
});

/**
 * Application Metrics
 */
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register],
});

export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'service'],
  registers: [register],
});

export const warningsTotal = new Counter({
  name: 'warnings_total',
  help: 'Total number of warnings',
  labelNames: ['warning_type', 'service'],
  registers: [register],
});

/**
 * Memory Metrics
 */
export const memoryUsage = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
  registers: [register],
});

export const cpuUsage = new Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage in percent',
  registers: [register],
});

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics metadata (help text and type)
 */
export function getMetricsMetadata(): string {
  return register.getMetricsAsArray()
    .map((m: any) => `# HELP ${m.name} ${m.help}\n# TYPE ${m.name} ${m.type}`)
    .join('\n');
}

export default register;
