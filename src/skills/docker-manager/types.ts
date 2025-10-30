/**
 * Docker Manager Skill - Type Definitions
 * Complete TypeScript type system for container management and orchestration
 *
 * @module docker-manager/types
 * @version 1.0.0
 */

/**
 * Container state enumeration
 */
export enum ContainerState {
  CREATED = 'created',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  EXITED = 'exited',
  DEAD = 'dead',
  RESTARTING = 'restarting',
}

/**
 * Service type enumeration
 */
export enum ServiceType {
  STRATEGY = 'strategy',
  API = 'api',
  WORKER = 'worker',
  MONITOR = 'monitor',
  ANALYTICS = 'analytics',
}

/**
 * Service status enumeration
 */
export enum ServiceStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  TERMINATED = 'terminated',
  ERROR = 'error',
}

/**
 * Deployment strategy enumeration
 */
export enum DeploymentStrategy {
  ROLLING = 'rolling',
  BLUE_GREEN = 'blue_green',
  CANARY = 'canary',
  RECREATE = 'recreate',
}

/**
 * Health check type enumeration
 */
export enum HealthCheckType {
  HTTP = 'http',
  TCP = 'tcp',
  EXEC = 'exec',
  GRPC = 'grpc',
  NONE = 'none',
}

/**
 * Metric type enumeration
 */
export enum MetricType {
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK = 'disk',
  NETWORK = 'network',
  CUSTOM = 'custom',
}

/**
 * Restart policy enumeration
 */
export enum RestartPolicy {
  NO = 'no',
  ALWAYS = 'always',
  ON_FAILURE = 'on-failure',
  UNLESS_STOPPED = 'unless-stopped',
}

/**
 * Alert level enumeration
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Port mapping configuration
 */
export interface PortMapping {
  containerPort: number;
  hostPort?: number;
  protocol?: 'tcp' | 'udp';
  exposedPort?: boolean;
}

/**
 * Volume mount configuration
 */
export interface VolumeMount {
  source: string;
  target: string;
  readOnly?: boolean;
  type?: 'bind' | 'volume' | 'tmpfs';
}

/**
 * Resource limits configuration
 */
export interface ResourceLimits {
  cpuLimit?: number; // millicores (1000 = 1 CPU)
  memoryLimit?: number; // bytes
  cpuRequest?: number;
  memoryRequest?: number;
  gpuLimit?: number;
  storageLimit?: number; // bytes
}

/**
 * Resource usage snapshot
 */
export interface ResourceUsage {
  timestamp: Date;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
}

/**
 * CPU metrics
 */
export interface CPUMetrics {
  usage: number; // percentage 0-100
  userTime: number; // milliseconds
  systemTime: number; // milliseconds
  throttledTime: number; // milliseconds
  cores: number;
}

/**
 * Memory metrics
 */
export interface MemoryMetrics {
  used: number; // bytes
  limit: number; // bytes
  cached: number; // bytes
  rss: number; // resident set size (bytes)
  percentageUsed: number; // percentage 0-100
  pageCache: number; // bytes
}

/**
 * Disk metrics
 */
export interface DiskMetrics {
  used: number; // bytes
  available: number; // bytes
  readOps: number;
  writeOps: number;
  readBytes: number; // bytes
  writeBytes: number; // bytes
  iopsRead: number;
  iopsWrite: number;
}

/**
 * Network metrics
 */
export interface NetworkMetrics {
  bytesIn: number; // total bytes
  bytesOut: number; // total bytes
  packetsIn: number;
  packetsOut: number;
  errors: number;
  dropped: number;
  interfaces: NetworkInterfaceMetrics[];
}

/**
 * Network interface metrics
 */
export interface NetworkInterfaceMetrics {
  name: string;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

/**
 * Process metrics
 */
export interface ProcessMetrics {
  count: number;
  runningCount: number;
  zombieCount: number;
  processes: ProcessInfo[];
}

/**
 * Single process information
 */
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  rss: number;
  state: string;
}

/**
 * Metrics snapshot with all measurements
 */
export interface Metrics {
  timestamp: Date;
  containerId: string;
  containerName: string;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  processes: ProcessMetrics;
}

/**
 * Health check configuration
 */
export interface HealthCheck {
  type: HealthCheckType;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  startPeriod?: number; // milliseconds
  endpoint?: string; // for HTTP/gRPC
  command?: string[]; // for EXEC
  port?: number; // for TCP
}

/**
 * Health check result
 */
export interface HealthResult {
  timestamp: Date;
  status: 'healthy' | 'unhealthy' | 'unknown';
  failureCount: number;
  lastFailureTime?: Date;
  message?: string;
  duration: number; // milliseconds
}

/**
 * Health status
 */
export interface HealthStatus {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  checks: HealthResult[];
  lastUpdate: Date;
  consecutiveFailures: number;
}

/**
 * Restart policy configuration
 */
export interface RestartPolicyConfig {
  policy: RestartPolicy;
  maximumRetryCount?: number;
  delaySeconds?: number;
}

/**
 * Container configuration for creation
 */
export interface ContainerConfig {
  image: string;
  name: string;
  command?: string[];
  entrypoint?: string[];
  env?: Record<string, string>;
  ports?: PortMapping[];
  volumes?: VolumeMount[];
  resources?: ResourceLimits;
  restartPolicy?: RestartPolicyConfig;
  networks?: string[];
  labels?: Record<string, string>;
  workingDir?: string;
  user?: string;
  privileged?: boolean;
  capAdd?: string[];
  capDrop?: string[];
  healthCheck?: HealthCheck;
  stopTimeout?: number; // seconds
  stopSignal?: string; // e.g., 'SIGTERM'
}

/**
 * Container data structure
 */
export interface Container {
  id: string;
  name: string;
  image: string;
  imageId: string;
  state: ContainerState;
  status: string;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  exitCode?: number;
  ports: PortMapping[];
  volumes: VolumeMount[];
  resources: ResourceLimits;
  restartCount: number;
  labels: Record<string, string>;
  mounts: VolumeMount[];
  networkSettings: NetworkSettings;
  health?: HealthStatus;
}

/**
 * Container network settings
 */
export interface NetworkSettings {
  bridge: string;
  gateway: string;
  ipAddress: string;
  ipPrefixLen: number;
  macAddress: string;
  networks: Record<string, NetworkConfig>;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  ipAddress: string;
  gateway: string;
  ipPrefixLen: number;
  aliases: string[];
}

/**
 * Container status information
 */
export interface ContainerStatus {
  id: string;
  name: string;
  state: ContainerState;
  running: boolean;
  paused: boolean;
  restartCount: number;
  uptime: number; // milliseconds
  memory: MemoryMetrics;
  cpu: CPUMetrics;
  health?: HealthStatus;
  exitCode?: number;
}

/**
 * Image data structure
 */
export interface Image {
  id: string;
  repoTags: string[];
  size: number; // bytes
  virtualSize: number; // bytes
  created: Date;
  labels: Record<string, string>;
}

/**
 * Detailed image information
 */
export interface ImageDetails extends Image {
  architecture: string;
  os: string;
  osVersion?: string;
  config: ImageConfig;
  history: ImageHistory[];
  layers: ImageLayer[];
}

/**
 * Image configuration
 */
export interface ImageConfig {
  env?: string[];
  cmd?: string[];
  entrypoint?: string[];
  workingDir?: string;
  user?: string;
  exposedPorts?: Record<string, unknown>;
  labels?: Record<string, string>;
  volumes?: Record<string, unknown>;
}

/**
 * Image history entry
 */
export interface ImageHistory {
  id: string;
  created: Date;
  createdBy: string;
  size: number;
  comment: string;
}

/**
 * Image layer
 */
export interface ImageLayer {
  digest: string;
  size: number;
}

/**
 * Build configuration
 */
export interface BuildConfig {
  dockerfile?: string;
  buildargs?: Record<string, string>;
  labels?: Record<string, string>;
  target?: string;
  networkMode?: string;
  cacheFrom?: string[];
  squash?: boolean;
  nocache?: boolean;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  url: string;
  username?: string;
  password?: string;
  email?: string;
  serverAddress?: string;
}

/**
 * Service dependency
 */
export interface ServiceDependency {
  serviceId: string;
  serviceName: string;
  dependencyType: 'weak' | 'strong'; // strong = must be healthy
  minimumReplicas?: number;
}

/**
 * Service data structure
 */
export interface Service {
  id: string;
  name: string;
  version: string;
  type: ServiceType;
  containerId?: string;
  containerIds?: string[];
  image: string;
  replicas: number;
  desiredReplicas: number;
  status: ServiceStatus;
  healthCheck: HealthCheck;
  dependencies: ServiceDependency[];
  metadata: Record<string, unknown>;
  labels: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  lastHealthCheck?: Date;
  environment: Record<string, string>;
  resources: ResourceLimits;
}

/**
 * Deployment plan
 */
export interface DeploymentPlan {
  id: string;
  steps: DeploymentStep[];
  totalSteps: number;
  estimatedDuration: number; // milliseconds
}

/**
 * Single deployment step
 */
export interface DeploymentStep {
  order: number;
  action: 'pull' | 'create' | 'start' | 'health_check' | 'route' | 'scale';
  targetService: string;
  expectedDuration: number;
  retryable: boolean;
  rollbackAction?: string;
}

/**
 * Deployment specification
 */
export interface DeploymentSpec {
  serviceId: string;
  serviceName: string;
  image: string;
  version: string;
  strategy: DeploymentStrategy;
  replicas: number;
  maxSurge?: number;
  maxUnavailable?: number;
  canaryPercentage?: number; // 0-100
  canaryDuration?: number; // milliseconds
  healthCheck: HealthCheck;
  environment: Record<string, string>;
  resources: ResourceLimits;
  progressDeadlineSeconds?: number;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  deploymentId: string;
  serviceId: string;
  status: 'success' | 'partial' | 'failed' | 'rolled_back';
  createdContainers: string[];
  failedContainers: string[];
  duration: number; // milliseconds
  startedAt: Date;
  completedAt: Date;
  error?: Error;
  rollbackReason?: string;
}

/**
 * Deployment event for monitoring
 */
export interface DeploymentEvent {
  timestamp: Date;
  deploymentId: string;
  eventType: 'started' | 'progressing' | 'completed' | 'failed' | 'rolled_back';
  message: string;
  progress: number; // 0-100
  error?: Error;
}

/**
 * Scaling policy
 */
export interface ScalingPolicy {
  id: string;
  serviceId: string;
  minReplicas: number;
  maxReplicas: number;
  targetMetric: MetricType;
  targetValue: number;
  targetPercentage?: number;
  cooldownUp: number; // milliseconds
  cooldownDown: number; // milliseconds
  scaleUpIncrement: number;
  scaleDownDecrement: number;
  enabled: boolean;
}

/**
 * Scaling decision
 */
export interface ScalingDecision {
  serviceId: string;
  currentReplicas: number;
  desiredReplicas: number;
  reason: string;
  confidence: number; // 0-1
  metricValue: number;
  threshold: number;
}

/**
 * Scaling event
 */
export interface ScalingEvent {
  timestamp: Date;
  serviceId: string;
  previousReplicas: number;
  newReplicas: number;
  reason: string;
  duration: number; // milliseconds
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  id: string;
  containerId: string;
  condition: string; // e.g., 'cpu > 80 for 5m'
  level: AlertLevel;
  actions: AlertAction[];
  enabled: boolean;
}

/**
 * Alert action
 */
export interface AlertAction {
  type: 'webhook' | 'email' | 'slack' | 'pagerduty' | 'custom';
  target: string;
  payload?: Record<string, unknown>;
}

/**
 * Alert
 */
export interface Alert {
  id: string;
  containerId: string;
  timestamp: Date;
  level: AlertLevel;
  title: string;
  message: string;
  tags: Record<string, string>;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * Configuration entity
 */
export interface Config {
  id: string;
  name: string;
  version: number;
  data: Record<string, unknown>;
  encrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
  versions: ConfigVersion[];
}

/**
 * Configuration version
 */
export interface ConfigVersion {
  version: number;
  data: Record<string, unknown>;
  createdAt: Date;
  createdBy: string;
}

/**
 * Secret entity
 */
export interface Secret {
  id: string;
  name: string;
  value: string; // encrypted
  type: 'api_key' | 'password' | 'certificate' | 'token' | 'custom';
  createdAt: Date;
  rotatedAt?: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
}

/**
 * Lifecycle event
 */
export interface LifecycleEvent {
  timestamp: Date;
  containerId: string;
  eventType: 'start' | 'stop' | 'pause' | 'unpause' | 'restart' | 'remove' | 'health_change';
  previousState?: ContainerState;
  newState?: ContainerState;
  reason?: string;
}

/**
 * Docker event from daemon
 */
export interface DockerEvent {
  Type: string;
  Action: string;
  Actor: {
    ID: string;
    Attributes: Record<string, string>;
  };
  time: number;
  timeNano: number;
}

/**
 * Statistics snapshot
 */
export interface StatsSnapshot {
  read: string;
  preread: string;
  pidsStats?: {
    current: number;
  };
  blkioStats?: {
    ioServiceBytesRecursive: unknown[];
  };
  numProcs: number;
  storageStats?: Record<string, unknown>;
  cpuStats?: {
    cpuUsage?: {
      totalUsage: number;
      percpuUsage: number[];
      usageInKernelmode: number;
      usageInUsermode: number;
    };
    systemCpuUsage: number;
    onlineCpus: number;
    throttlingData?: {
      periods: number;
      throttledPeriods: number;
      throttledTime: number;
    };
  };
  precpuStats?: Record<string, unknown>;
  memoryStats?: {
    usage: number;
    maxUsage: number;
    stats: Record<string, number>;
    limit: number;
  };
  memorySwapStats?: {
    usage: number;
    maxUsage: number;
  };
  networks?: Record<string, NetworkStats>;
}

/**
 * Network statistics
 */
export interface NetworkStats {
  rxBytes: number;
  rxPackets: number;
  rxErrors: number;
  rxDropped: number;
  txBytes: number;
  txPackets: number;
  txErrors: number;
  txDropped: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Export all types
 */
export type ContainerStateType = ContainerState;
export type ServiceTypeType = ServiceType;
export type ServiceStatusType = ServiceStatus;
export type DeploymentStrategyType = DeploymentStrategy;
export type HealthCheckTypeType = HealthCheckType;
export type MetricTypeType = MetricType;
export type RestartPolicyType = RestartPolicy;
export type AlertLevelType = AlertLevel;
