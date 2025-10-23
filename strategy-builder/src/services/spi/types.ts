/**
 * SPI (Service Provider Interface) - Type Definitions
 * Core interfaces for the self-generating Service Provider system
 */

/**
 * Base Service Provider Interface
 * All service providers must implement this interface
 */
export interface ServiceProvider {
  // Service identification
  name: string;
  version: string;
  description: string;

  // Email-based identity
  email: string;

  // Service capabilities
  capabilities: string[];

  // Service lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Health check
  health(): Promise<HealthStatus>;

  // Service metadata
  getMetadata(): ServiceMetadata;
}

/**
 * Service Metadata
 * Information about a service provider
 */
export interface ServiceMetadata {
  id: string;
  email: string;
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  supportedEndpoints: string[];
  configuration: Record<string, unknown>;
}

/**
 * Health Status
 * Service health check response
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: Date;
  uptime: number;
  metrics?: {
    requestsProcessed: number;
    errorsEncountered: number;
    averageResponseTime: number;
  };
}

/**
 * SPI Configuration
 * Configuration for a service provider
 */
export interface SPIConfiguration {
  email: string;
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * SPI Factory Function
 * Used to create service provider instances
 */
export type SPIFactory = (config: SPIConfiguration) => ServiceProvider;

/**
 * SPI Registry Entry
 * Entry stored in the SPI registry
 */
export interface SPIRegistryEntry {
  id: string;
  email: string;
  provider: ServiceProvider;
  metadata: ServiceMetadata;
  registeredAt: Date;
  lastHealthCheck?: Date;
  healthStatus?: HealthStatus;
}

/**
 * SPI Request Context
 * Context information for SPI requests
 */
export interface SPIRequestContext {
  userId: string;
  userEmail: string;
  serviceEmail: string;
  requestId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * SPI Response
 * Standard response from SPI service
 */
export interface SPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    serviceEmail: string;
    processingTime: number;
    timestamp: Date;
  };
}

/**
 * SPI Event
 * Events emitted by SPI services
 */
export interface SPIEvent {
  type: string;
  source: string;
  sourceEmail: string;
  timestamp: Date;
  data?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * SPI Event Listener
 * Function that listens to SPI events
 */
export type SPIEventListener = (event: SPIEvent) => Promise<void>;

/**
 * SPI Capability
 * Definition of a service capability
 */
export interface SPICapability {
  name: string;
  description: string;
  methods: string[];
  requiredPermissions: string[];
}

/**
 * SPI Service Discovery Result
 * Result from service discovery
 */
export interface SPIDiscoveryResult {
  found: boolean;
  services: SPIRegistryEntry[];
  matchedCriteria?: {
    email?: string;
    capability?: string;
    name?: string;
  };
}

/**
 * SPI Error
 * Custom error for SPI operations
 */
export class SPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SPIError';
  }
}

/**
 * Email-based SPI Identifier
 * Unique identifier for SPI using email
 */
export interface EmailSPIIdentifier {
  email: string;
  domain: string;
  localPart: string;
}

/**
 * SPI Generator Configuration
 * Configuration for auto-generating SPIs from email
 */
export interface SPIGeneratorConfig {
  autoGenerate: boolean;
  nameTemplate: string; // e.g., "{localPart}-service"
  versionTemplate: string; // e.g., "1.0.0"
  capabilityPattern: string; // e.g., "email:*"
}
