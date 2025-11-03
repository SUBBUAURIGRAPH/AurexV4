/**
 * Winston Logger Configuration
 * Structured logging with JSON format for production
 * Supports console, file, and log aggregation
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '../../logs');

/**
 * Custom log format with correlation ID
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const baseLog = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };
    return JSON.stringify(baseLog);
  })
);

/**
 * Development format with colors
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const corrId = correlationId ? ` [${correlationId}]` : '';
    return `${timestamp} [${level}]${corrId} ${message}${metaStr}`;
  })
);

/**
 * Create logger instance
 */
function createLogger(): winston.Logger {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

  const transports: winston.transport[] = [
    // Console transport
    new winston.transports.Console({
      format: isDevelopment ? devFormat : customFormat,
      level: logLevel,
    }),
  ];

  // File transports (only in production or when enabled)
  if (!isDevelopment || process.env.LOG_TO_FILE === 'true') {
    // All logs
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'app.log'),
        format: customFormat,
        level: logLevel,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      })
    );

    // Error logs only
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        format: customFormat,
        level: 'error',
        maxsize: 10 * 1024 * 1024,
        maxFiles: 10,
      })
    );
  }

  return winston.createLogger({
    level: logLevel,
    format: isDevelopment ? devFormat : customFormat,
    defaultMeta: {
      service: 'hermes-trading-platform',
      version: '2.2.0',
      environment: process.env.NODE_ENV || 'development',
    },
    transports,
    exceptionHandlers: [
      new winston.transports.File({
        filename: path.join(logsDir, 'exceptions.log'),
        format: customFormat,
      }),
    ],
    rejectionHandlers: [
      new winston.transports.File({
        filename: path.join(logsDir, 'rejections.log'),
        format: customFormat,
      }),
    ],
  });
}

/**
 * Global logger instance
 */
export const logger = createLogger();

/**
 * Logger with correlation ID support
 */
export class CorrelationLogger {
  private correlationId: string;

  constructor(correlationId: string) {
    this.correlationId = correlationId;
  }

  private addMeta(meta?: any) {
    return {
      correlationId: this.correlationId,
      ...meta,
    };
  }

  debug(message: string, meta?: any) {
    logger.debug(message, this.addMeta(meta));
  }

  info(message: string, meta?: any) {
    logger.info(message, this.addMeta(meta));
  }

  warn(message: string, meta?: any) {
    logger.warn(message, this.addMeta(meta));
  }

  error(message: string, error?: Error | any, meta?: any) {
    const errorMeta = {
      error: error?.message || String(error),
      stack: error?.stack,
      ...meta,
    };
    logger.error(message, this.addMeta(errorMeta));
  }
}

export default logger;
