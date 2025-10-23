/**
 * SPI Routes
 * REST API endpoints for managing Service Providers
 */

import { Router } from 'express';
import { AuthRequest } from '../../types';
import { SPIRegistry } from './registry';
import { SPILoader } from './loader';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  autoCreateUserSPI,
  getUserSPI,
  enrichSPIContext,
  validateSPIRequest
} from './middleware';

export function createSPIRoutes(registry: SPIRegistry): Router {
  const router = Router();
  const loader = new SPILoader(registry);

  /**
   * POST /api/v1/spi/generate
   * Generate/create SPI for current user from email
   */
  router.post(
    '/generate',
    authenticate,
    asyncHandler(async (req: AuthRequest, res) => {
      const user = req.user!;
      const { name, description } = req.body;

      // Load or create SPI from email
      const provider = await loader.loadFromEmail(user.email, {
        name: name || `${user.username}-service`,
        description: description || `Service for ${user.username}`
      });

      const service = registry.getService(user.email);

      res.status(201).json({
        success: true,
        data: {
          id: service?.id,
          name: provider.name,
          email: provider.email,
          version: provider.version,
          description: provider.description,
          capabilities: provider.capabilities,
          metadata: provider.getMetadata()
        },
        meta: {
          timestamp: new Date().toISOString(),
          message: 'SPI generated from user email'
        }
      });
    })
  );

  /**
   * GET /api/v1/spi/me
   * Get current user's SPI
   */
  router.get(
    '/me',
    authenticate,
    autoCreateUserSPI(registry),
    getUserSPI(),
    asyncHandler(async (req: AuthRequest & any, res) => {
      const service = req.userSPI;

      res.json({
        success: true,
        data: {
          id: service.id,
          email: service.email,
          name: service.metadata.name,
          version: service.metadata.version,
          description: service.metadata.description,
          capabilities: service.metadata.capabilities,
          isActive: service.metadata.isActive,
          createdAt: service.registeredAt,
          lastHealthCheck: service.lastHealthCheck,
          healthStatus: service.healthStatus
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    })
  );

  /**
   * GET /api/v1/spi/discover
   * Discover services by email, capability, or name
   */
  router.get(
    '/discover',
    authenticate,
    asyncHandler(async (req: AuthRequest & any, res) => {
      const { email, capability, name } = req.query;

      const result = await registry.discoverServices({
        email: email as string | undefined,
        capability: capability as string | undefined,
        name: name as string | undefined
      });

      res.json({
        success: true,
        data: {
          found: result.found,
          count: result.services.length,
          services: result.services.map(entry => ({
            id: entry.id,
            email: entry.email,
            name: entry.metadata.name,
            version: entry.metadata.version,
            capabilities: entry.metadata.capabilities,
            isActive: entry.metadata.isActive
          })),
          criteria: result.matchedCriteria
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    })
  );

  /**
   * GET /api/v1/spi/health/:email
   * Get health status of a service
   */
  router.get(
    '/health/:email',
    authenticate,
    asyncHandler(async (req: AuthRequest & any, res) => {
      const { email } = req.params;

      try {
        const health = await registry.healthCheck(email);

        res.json({
          success: true,
          data: {
            email,
            health: {
              status: health.status,
              message: health.message,
              uptime: health.uptime,
              metrics: health.metrics
            }
          },
          meta: {
            timestamp: health.timestamp
          }
        });
      } catch (error) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Service not found: ${email}`
          }
        });
      }
    })
  );

  /**
   * GET /api/v1/spi/stats
   * Get SPI registry statistics
   */
  router.get(
    '/stats',
    authenticate,
    asyncHandler(async (req: AuthRequest & any, res) => {
      const stats = registry.getStats();

      res.json({
        success: true,
        data: {
          totalServices: stats.totalServices,
          activeServices: stats.activeServices,
          servicesByCapability: stats.servicesByCapability,
          servicesByEmail: stats.servicesByEmail,
          capabilities: Object.keys(stats.servicesByCapability)
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    })
  );

  /**
   * GET /api/v1/spi/all
   * Get all registered services (admin only)
   */
  router.get(
    '/all',
    authenticate,
    asyncHandler(async (req: AuthRequest & any, res) => {
      // Optional: add role check for admin
      const services = registry.getAllServices();

      res.json({
        success: true,
        data: {
          count: services.length,
          services: services.map(entry => ({
            id: entry.id,
            email: entry.email,
            name: entry.metadata.name,
            version: entry.metadata.version,
            description: entry.metadata.description,
            capabilities: entry.metadata.capabilities,
            isActive: entry.metadata.isActive,
            createdAt: entry.registeredAt
          }))
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    })
  );

  /**
   * GET /api/v1/spi/by-email/:email
   * Get all services for a specific email
   */
  router.get(
    '/by-email/:email',
    authenticate,
    asyncHandler(async (req: AuthRequest & any, res) => {
      const { email } = req.params;
      const services = registry.getServicesByEmail(email);

      res.json({
        success: true,
        data: {
          email,
          count: services.length,
          services: services.map(entry => ({
            id: entry.id,
            name: entry.metadata.name,
            version: entry.metadata.version,
            capabilities: entry.metadata.capabilities,
            isActive: entry.metadata.isActive
          }))
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    })
  );

  /**
   * PATCH /api/v1/spi/:email
   * Update service configuration
   */
  router.patch(
    '/:email',
    authenticate,
    asyncHandler(async (req: AuthRequest & any, res) => {
      const { email } = req.params;
      const { name, description, isActive } = req.body;

      try {
        const service = await registry.updateService(email, {
          name,
          description,
          isActive,
          updatedAt: new Date()
        });

        res.json({
          success: true,
          data: {
            id: service.id,
            email: service.email,
            name: service.metadata.name,
            description: service.metadata.description,
            isActive: service.metadata.isActive
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Service not found: ${email}`
          }
        });
      }
    })
  );

  /**
   * DELETE /api/v1/spi/:email
   * Unregister/delete a service
   */
  router.delete(
    '/:email',
    authenticate,
    asyncHandler(async (req: AuthRequest & any, res) => {
      const { email } = req.params;

      try {
        await registry.unregisterService(email);

        res.json({
          success: true,
          data: {
            message: `Service unregistered: ${email}`
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Service not found: ${email}`
          }
        });
      }
    })
  );

  /**
   * POST /api/v1/spi/:email/health-check
   * Manually trigger health check
   */
  router.post(
    '/:email/health-check',
    authenticate,
    asyncHandler(async (req: AuthRequest & any, res) => {
      const { email } = req.params;

      try {
        const health = await registry.healthCheck(email);

        res.json({
          success: true,
          data: {
            email,
            health: {
              status: health.status,
              message: health.message,
              uptime: health.uptime,
              metrics: health.metrics
            }
          },
          meta: {
            timestamp: health.timestamp
          }
        });
      } catch (error) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Service not found: ${email}`
          }
        });
      }
    })
  );

  return router;
}
