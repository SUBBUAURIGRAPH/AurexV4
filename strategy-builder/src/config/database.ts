/**
 * Database Configuration
 * MongoDB connection setup with retry logic and connection pooling
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/strategy-builder';
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 5000;

export const connectDatabase = async (): Promise<void> => {
  let attempts = 0;

  const connect = async (): Promise<void> => {
    try {
      await mongoose.connect(MONGODB_URI, {
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
        family: 4
      });

      logger.info('MongoDB connected successfully', {
        uri: MONGODB_URI.replace(/\/\/.*@/, '//***@'), // Mask credentials
        database: mongoose.connection.name
      });

      // Setup indexes
      await setupIndexes();

    } catch (error) {
      attempts++;
      logger.error(`MongoDB connection failed (attempt ${attempts}/${MAX_RETRY_ATTEMPTS})`, {
        error: error instanceof Error ? error.message : String(error)
      });

      if (attempts < MAX_RETRY_ATTEMPTS) {
        logger.info(`Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return connect();
      } else {
        logger.error('Max retry attempts reached. Exiting...');
        process.exit(1);
      }
    }
  };

  await connect();

  // Handle connection events
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Attempting to reconnect...');
  });

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB error', { error: error.message });
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Setup database indexes for optimal query performance
 */
async function setupIndexes(): Promise<void> {
  try {
    const db = mongoose.connection.db;

    // Strategies collection indexes
    await db.collection('strategies').createIndexes([
      { key: { userId: 1, status: 1 }, name: 'userId_status' },
      { key: { userId: 1, createdAt: -1 }, name: 'userId_created' },
      { key: { tags: 1 }, name: 'tags' },
      { key: { name: 'text', description: 'text' }, name: 'text_search' }
    ]);

    // Backtests collection indexes
    await db.collection('backtests').createIndexes([
      { key: { strategyId: 1, createdAt: -1 }, name: 'strategy_created' },
      { key: { userId: 1, status: 1 }, name: 'userId_status' },
      { key: { status: 1, createdAt: -1 }, name: 'status_created' }
    ]);

    // Optimizations collection indexes
    await db.collection('optimizations').createIndexes([
      { key: { strategyId: 1, createdAt: -1 }, name: 'strategy_created' },
      { key: { userId: 1, status: 1 }, name: 'userId_status' }
    ]);

    // Deployments collection indexes
    await db.collection('deployments').createIndexes([
      { key: { strategyId: 1, status: 1 }, name: 'strategy_status' },
      { key: { userId: 1, status: 1 }, name: 'userId_status' },
      { key: { status: 1, createdAt: -1 }, name: 'status_created' }
    ]);

    // Users collection indexes
    await db.collection('users').createIndexes([
      { key: { email: 1 }, unique: true, name: 'email_unique' },
      { key: { username: 1 }, unique: true, name: 'username_unique' }
    ]);

    logger.info('Database indexes created successfully');
  } catch (error) {
    logger.warn('Error creating indexes', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export { mongoose };
