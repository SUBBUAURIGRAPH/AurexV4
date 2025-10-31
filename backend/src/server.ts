/**
 * Server Startup
 * Application initialization and server startup
 * @version 1.0.0
 */

import createApp from './app';
import { initializeDatabase, closeDatabase, healthCheck } from './config/database';
import config from './config/env';

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    console.log('🚀 Starting HMS Backend Server...');
    console.log(`📋 Environment: ${config.NODE_ENV}`);

    // ============================================
    // Validate Configuration
    // ============================================
    console.log('🔍 Validating configuration...');
    config.validateConfig?.();

    // ============================================
    // Initialize Database
    // ============================================
    console.log('📦 Initializing database...');
    await initializeDatabase();

    // ============================================
    // Create Express App
    // ============================================
    console.log('⚙️  Creating Express app...');
    const app = createApp();

    // ============================================
    // Start HTTP Server
    // ============================================
    const server = app.listen(config.PORT, config.HOST, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                   🎉 SERVER STARTED 🎉                    ║
╚════════════════════════════════════════════════════════════╝

📌 Server Details:
   • Host: ${config.HOST}
   • Port: ${config.PORT}
   • Environment: ${config.NODE_ENV}
   • API Base: http://${config.HOST}:${config.PORT}${config.API_PREFIX}

🗄️  Database:
   • Host: ${config.DB_HOST}
   • Database: ${config.DB_NAME}
   • Port: ${config.DB_PORT}

📚 Available Endpoints:
   • GET    /health - Server health check
   • GET    ${config.API_PREFIX}/health - API health check
   • GET    ${config.API_PREFIX}/portfolio/summary - Portfolio summary
   • GET    ${config.API_PREFIX}/portfolio/allocation - Asset allocation
   • GET    ${config.API_PREFIX}/portfolio/performance/:period - Performance data
   • GET    ${config.API_PREFIX}/trades/recent - Recent trades
   • GET    ${config.API_PREFIX}/trades/holdings - Current holdings
   • GET    ${config.API_PREFIX}/market/status - Market status
   • GET    ${config.API_PREFIX}/analytics/risk-score - Risk analysis
   • GET    ${config.API_PREFIX}/analytics/summary - Analytics summary

🔐 Protected Endpoints: All API endpoints require Bearer token authentication

⏱️  Press Ctrl+C to stop the server
      `);
    });

    // ============================================
    // Graceful Shutdown Handlers
    // ============================================
    const shutdown = async (signal: string) => {
      console.log(`\n📢 Received ${signal} signal, shutting down gracefully...`);

      // Stop accepting new connections
      server.close(async () => {
        try {
          console.log('🛑 Closing database connections...');
          await closeDatabase();
          console.log('✅ Server shutdown complete');
          process.exit(0);
        } catch (err) {
          console.error('❌ Error during shutdown:', err);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown - connections did not close gracefully');
        process.exit(1);
      }, 10000);
    };

    // Handle termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // ============================================
    // Periodic Health Checks
    // ============================================
    setInterval(async () => {
      try {
        const isHealthy = await healthCheck();
        if (!isHealthy) {
          console.warn('⚠️  Database health check failed');
        }
      } catch (err) {
        console.error('❌ Health check error:', err);
      }
    }, 30000); // Every 30 seconds

  } catch (err) {
    console.error('❌ Fatal error during startup:', err);
    process.exit(1);
  }
}

// Start the server if this file is executed directly
if (require.main === module) {
  startServer();
}

export default startServer;
