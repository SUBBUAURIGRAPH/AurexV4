/**
 * SPI Middleware
 * Express middleware for SPI integration and request handling
 */

import { Request, Response, NextFunction } from 'express';
import { SPIRegistry } from './registry';
import { AuthRequest } from '../../types';
import { SPIError } from './types';
import { logger } from '../../utils/logger';

/**
 * Attach SPI Registry to request
 */
export function attachSPIRegistry(registry: SPIRegistry) {
  return (req: any, res: Response, next: NextFunction) => {
    req.spiRegistry = registry;
    next();
  };
}

/**
 * Require authenticated user with SPI
 */
export function requireSPIAuth(registry: SPIRegistry) {
  return async (req: AuthRequest & any, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
      }

      const userEmail = req.user.email;

      // Try to load or get existing SPI for user
      try {
        const service = registry.getService(userEmail);
        req.userSPI = service;
      } catch (error) {
        // SPI doesn't exist, will be created on demand
      }

      req.spiRegistry = registry;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`SPI authentication error: ${message}`);

      res.status(500).json({
        success: false,
        error: {
          code: 'SPI_ERROR',
          message: 'Failed to authenticate SPI'
        }
      });
    }
  };
}

/**
 * Auto-create SPI for user if not exists
 */
export function autoCreateUserSPI(registry: SPIRegistry) {
  return async (req: AuthRequest & any, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next();
      }

      const userEmail = req.user.email;

      // Check if service exists
      let service = registry.getService(userEmail);

      // If not, create one
      if (!service) {
        const { SPILoader } = await import('./loader');
        const loader = new SPILoader(registry);

        const provider = await loader.loadFromEmail(userEmail, {
          name: `${req.user.username}-service`,
          description: `Auto-generated SPI for user ${req.user.username}`
        });

        service = registry.getService(userEmail);
      }

      req.userSPI = service;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Auto-create SPI error: ${message}`);

      res.status(500).json({
        success: false,
        error: {
          code: 'SPI_CREATION_ERROR',
          message: 'Failed to create user SPI'
        }
      });
    }
  };
}

/**
 * Get user's SPI or handle error
 */
export function getUserSPI() {
  return (req: AuthRequest & any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required'
        }
      });
    }

    if (!req.userSPI) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SPI_NOT_FOUND',
          message: `SPI not found for user ${req.user.email}`
        }
      });
    }

    next();
  };
}

/**
 * Handle SPI errors
 */
export function spiErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error(`SPI Error: ${error.message}`);

  if (error instanceof SPIError) {
    return res.status(500).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'SPI_ERROR',
      message: 'An error occurred in SPI processing'
    }
  });
}

/**
 * SPI request logging middleware
 */
export function spiRequestLogger() {
  return (req: AuthRequest & any, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const userEmail = req.user?.email || 'anonymous';
      const spiEmail = req.userSPI?.email || 'no-spi';

      logger.info(`SPI Request: ${req.method} ${req.path}`, {
        userEmail,
        spiEmail,
        duration,
        statusCode: res.statusCode
      });
    });

    next();
  };
}

/**
 * Enrich request with SPI context
 */
export function enrichSPIContext(registry: SPIRegistry) {
  return async (req: AuthRequest & any, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.userSPI) {
        return next();
      }

      // Create SPI context
      req.spiContext = {
        userId: req.user._id,
        userEmail: req.user.email,
        serviceEmail: req.userSPI.email,
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        metadata: {
          method: req.method,
          path: req.path,
          ip: req.ip
        }
      };

      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Context enrichment error: ${message}`);
      next();
    }
  };
}

/**
 * Validate SPI request
 */
export function validateSPIRequest() {
  return (req: AuthRequest & any, res: Response, next: NextFunction) => {
    if (!req.spiContext) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'SPI context is missing'
        }
      });
    }

    if (!req.userSPI) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'User SPI is missing'
        }
      });
    }

    next();
  };
}

/**
 * Wrap async SPI handlers
 */
export function asyncSPIHandler(
  handler: (req: AuthRequest & any, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: AuthRequest & any, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
