/**
 * Environment Configuration
 * Type-safe environment variables with defaults
 * @version 1.0.0
 */

/**
 * Application configuration object
 */
const config = {
  // Node environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Server configuration
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || 'localhost',
  API_PREFIX: '/api/v1',

  // Database configuration
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'hermes_db',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'password',

  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  // Logging configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // CORS configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true',

  // API rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Business logic configuration
  MIN_TRADE_AMOUNT: 10,
  MAX_LEVERAGE: 4,
  AI_RISK_SCORE_RANGE: { min: 1, max: 10 },

  // Feature flags
  ENABLE_PAPER_TRADING: process.env.ENABLE_PAPER_TRADING !== 'false',
  ENABLE_AI_SIGNALS: process.env.ENABLE_AI_SIGNALS !== 'false',
  ENABLE_REAL_TIME_UPDATES: process.env.ENABLE_REAL_TIME_UPDATES !== 'false',

  // Slack integration (if configured)
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',
  SLACK_ENABLED: !!process.env.SLACK_WEBHOOK_URL,

  // Application info
  APP_NAME: 'Hermes Trading Platform',
  APP_VERSION: '1.0.0',
  API_VERSION: 'v1',
} as const;

/**
 * Validate critical configuration
 */
export function validateConfig(): void {
  const requiredVars = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
  ];

  const missing = requiredVars.filter(
    key => !process.env[key] && key !== 'JWT_SECRET'
  );

  if (missing.length > 0) {
    console.warn(
      '⚠️ Missing environment variables:',
      missing.join(', ')
    );
  }

  if (config.isProduction && config.JWT_SECRET === 'dev-secret-key-change-in-production') {
    throw new Error(
      '🚨 CRITICAL: JWT_SECRET must be set in production environment'
    );
  }
}

/**
 * Get configuration value with type safety
 */
export function getConfig<K extends keyof typeof config>(key: K): typeof config[K] {
  return config[key];
}

export default config;
