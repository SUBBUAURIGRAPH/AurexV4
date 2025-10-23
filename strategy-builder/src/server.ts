/**
 * Strategy Builder API Server
 * Main Express server setup with middleware and routes
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { redisClient } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger, performanceLogger } from './middleware/logging';

// Import routes
import authRoutes from './api/routes/auth.routes';
import strategyRoutes from './api/routes/strategies.routes';
import indicatorRoutes from './api/routes/indicators.routes';
import backtestRoutes from './api/routes/backtests.routes';
import optimizationRoutes from './api/routes/optimizations.routes';
import deploymentRoutes from './api/routes/deployments.routes';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app: Application = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);
app.use(performanceLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});

app.use('/api/', limiter);

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

app.get('/health', async (req, res) => {
  try {
    // Check Redis connection
    await redisClient.ping();

    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        version: '5.0.0',
        services: {
          database: 'connected',
          redis: 'connected'
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Health check failed'
      }
    });
  }
});

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/strategies', strategyRoutes);
app.use('/api/v1/indicators', indicatorRoutes);
app.use('/api/v1/backtests', backtestRoutes);
app.use('/api/v1/optimizations', optimizationRoutes);
app.use('/api/v1/deployments', deploymentRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();

    // Wait for Redis
    await redisClient.ping();
    logger.info('Redis connection verified');

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Strategy Builder API server started`, {
        port: PORT,
        environment: NODE_ENV,
        version: '5.0.0'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

function gracefulShutdown(signal: string): void {
  logger.info(`${signal} received, starting graceful shutdown`);

  // Close server
  server.close(() => {
    logger.info('HTTP server closed');

    // Close database connection
    import('./config/database').then(({ disconnectDatabase }) => {
      disconnectDatabase().then(() => {
        // Close Redis connection
        import('./config/redis').then(({ disconnectRedis }) => {
          disconnectRedis().then(() => {
            logger.info('All connections closed, exiting process');
            process.exit(0);
          });
        });
      });
    });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
const server = app.listen(PORT);
startServer();

export default app;
