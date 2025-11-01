/**
 * Server Startup
 * Application initialization and server startup
 * @version 1.0.0
 */

import createApp from './app.js';
import { initializeDatabase, closeDatabase, healthCheck } from './config/database.js';
import config, { validateConfig } from './config/env.js';
import { startGrpcServer } from './grpc/server.js';

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
    validateConfig();

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
    // Start HTTP/2 Server
    // ============================================
    const server = app.listen(config.PORT, config.HOST, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                   🎉 SERVER STARTED 🎉                    ║
╚════════════════════════════════════════════════════════════╝

📌 HTTP/2 REST Server:
   • Host: ${config.HOST}
   • Port: ${config.PORT}
   • Environment: ${config.NODE_ENV}
   • API Base: http://${config.HOST}:${config.PORT}${config.API_PREFIX}

🗄️  Database:
   • Host: ${config.DB_HOST}
   • Database: ${config.DB_NAME}
   • Port: ${config.DB_PORT}

📚 REST API Endpoints:
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
    // Start gRPC Server (HTTP/2 Multiplexing)
    // ============================================
    console.log('🚀 Starting gRPC server with HTTP/2 multiplexing...');
    const grpcServer = startGrpcServer(
      parseInt(process.env.GRPC_ANALYTICS_PORT || '50051')
    );

    // ============================================
    // Graceful Shutdown Handlers
    // ============================================
    const shutdown = async (signal: string) => {
      console.log(`\n📢 Received ${signal} signal, shutting down gracefully...`);

      // Close gRPC server
      try {
        console.log('🛑 Closing gRPC server...');
        await new Promise<void>((resolve) => {
          grpcServer.tryShutdown(() => {
            console.log('✅ gRPC server closed');
            resolve();
          });
        });
      } catch (err) {
        console.error('⚠️  Error closing gRPC server:', err);
      }

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

      // Force shutdown after 15 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown - connections did not close gracefully');
        process.exit(1);
      }, 15000);
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

// Start the server
startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

export default startServer;
