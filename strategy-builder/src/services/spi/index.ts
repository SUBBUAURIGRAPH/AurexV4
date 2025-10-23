/**
 * SPI (Service Provider Interface) Module
 * Central export for all SPI-related functionality
 */

// Types
export {
  ServiceProvider,
  ServiceMetadata,
  HealthStatus,
  SPIConfiguration,
  SPIFactory,
  SPIRegistryEntry,
  SPIRequestContext,
  SPIResponse,
  SPIEvent,
  SPIEventListener,
  SPICapability,
  SPIDiscoveryResult,
  SPIError,
  EmailSPIIdentifier,
  SPIGeneratorConfig
} from './types';

// Registry
export { SPIRegistry, globalSPIRegistry } from './registry';

// Loader
export {
  BaseServiceProvider,
  EmailSPIProvider,
  SPILoader,
  createEmailSPIFactory,
  DemoEmailSPIProvider
} from './loader';

// Middleware
export {
  attachSPIRegistry,
  requireSPIAuth,
  autoCreateUserSPI,
  getUserSPI,
  spiErrorHandler,
  spiRequestLogger,
  enrichSPIContext,
  validateSPIRequest,
  asyncSPIHandler
} from './middleware';

// Routes
export { createSPIRoutes } from './routes';
