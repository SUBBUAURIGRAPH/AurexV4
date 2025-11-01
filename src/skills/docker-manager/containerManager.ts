/**
 * Container Manager - Core Docker Container Operations
 * Manages container lifecycle, resource limits, health monitoring, and operations
 *
 * @module docker-manager/containerManager
 * @version 1.0.0
 */

import * as Docker from 'dockerode';
import { EventEmitter } from 'events';
import * as Logger from 'winston';
import {
  Container,
  ContainerConfig,
  ContainerState,
  ContainerStatus,
  Metrics,
  CPUMetrics,
  MemoryMetrics,
  NetworkMetrics,
  DiskMetrics,
  ProcessMetrics,
  ResourceLimits,
  StatsSnapshot,
  LifecycleEvent,
  DockerEvent,
} from './types';

/**
 * ContainerManager - Core class for Docker container management
 * Provides object-oriented interface to Docker containers with pooling and lifecycle management
 */
export class ContainerManager extends EventEmitter {
  private docker: Docker;
  private logger: Logger.Logger;
  private containerCache: Map<string, Container> = new Map();
  private statsStreamers: Map<string, NodeJS.ReadableStream> = new Map();
  private eventStream?: NodeJS.ReadableStream;
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Creates a new ContainerManager instance
   *
   * @param dockerSocket - Docker socket path (default: /var/run/docker.sock)
   * @param logger - Winston logger instance
   */
  constructor(dockerSocket: string = '/var/run/docker.sock', logger: Logger.Logger) {
    super();
    this.docker = new Docker({ socketPath: dockerSocket });
    this.logger = logger;
    this.initializeEventListeners();
  }

  /**
   * Initialize Docker event listeners for lifecycle tracking
   */
  private initializeEventListeners(): void {
    this.docker.getEvents(
      { filters: { type: ['container'] } },
      (err: Error | null, stream?: NodeJS.ReadableStream) => {
        if (err) {
          this.logger.error('Failed to initialize Docker event stream', err);
          return;
        }

        if (stream) {
          this.eventStream = stream;
          stream.on('data', (chunk: Buffer) => this.handleDockerEvent(chunk));
          stream.on('error', (error: Error) => {
            this.logger.error('Docker event stream error', error);
            this.eventStream = undefined;
          });
        }
      }
    );
  }

  /**
   * Handle Docker daemon events
   * @private
   */
  private handleDockerEvent(chunk: Buffer): void {
    try {
      const event: DockerEvent = JSON.parse(chunk.toString());

      this.emit('docker-event', event);

      const containerName = event.Actor.Attributes?.name || event.Actor.ID.substring(0, 12);

      switch (event.Action) {
        case 'start':
          this.emit('container-started', { id: event.Actor.ID, name: containerName });
          this.logger.info(`Container started: ${containerName}`);
          break;

        case 'stop':
          this.emit('container-stopped', { id: event.Actor.ID, name: containerName });
          this.logger.info(`Container stopped: ${containerName}`);
          break;

        case 'die':
          this.emit('container-died', { id: event.Actor.ID, name: containerName });
          this.logger.warn(`Container died: ${containerName}`);
          break;

        case 'health_status':
          const healthStatus = event.Actor.Attributes.health;
          this.emit('container-health-change', {
            id: event.Actor.ID,
            name: containerName,
            status: healthStatus,
          });
          break;
      }
    } catch (error) {
      this.logger.error('Error parsing Docker event', error);
    }
  }

  /**
   * Create a new container
   *
   * @param config - Container configuration
   * @returns Container ID
   *
   * @example
   * ```typescript
   * const containerId = await containerManager.createContainer({
   *   image: 'aurigraph:latest',
   *   name: 'strategy-executor-1',
   *   env: { STRATEGY_ID: 'golden-cross' },
   *   resources: { cpuLimit: 2000, memoryLimit: 2147483648 }
   * });
   * ```
   */
  async createContainer(config: ContainerConfig): Promise<string> {
    try {
      this.logger.info(`Creating container: ${config.name}`);

      const createOptions = this.buildCreateOptions(config);

      const container = await this.docker.createContainer(createOptions);

      this.logger.info(`Container created: ${config.name} (${container.id.substring(0, 12)})`);

      this.emit('container-created', { id: container.id, name: config.name });

      return container.id;
    } catch (error) {
      this.logger.error(`Failed to create container ${config.name}`, error);
      throw new Error(`Container creation failed: ${error.message}`);
    }
  }

  /**
   * Build Docker create options from ContainerConfig
   * @private
   */
  private buildCreateOptions(config: ContainerConfig): Docker.ContainerCreateOptions {
    return {
      Image: config.image,
      name: config.name,
      Cmd: config.command,
      Entrypoint: config.entrypoint,
      Env: Object.entries(config.env || {}).map(([k, v]) => `${k}=${v}`),
      ExposedPorts: this.buildExposedPorts(config.ports),
      HostConfig: {
        PortBindings: this.buildPortBindings(config.ports),
        Binds: this.buildBinds(config.volumes),
        RestartPolicy: {
          Name: config.restartPolicy?.policy || 'no',
          MaximumRetryCount: config.restartPolicy?.maximumRetryCount || 0,
        },
        CpuQuota: config.resources?.cpuLimit ? config.resources.cpuLimit * 1000 : 0,
        Memory: config.resources?.memoryLimit || 0,
        MemoryReservation: config.resources?.memoryRequest || 0,
        CpuShares: config.resources?.cpuRequest || 1024,
        CapAdd: config.capAdd,
        CapDrop: config.capDrop,
        Privileged: config.privileged || false,
        StopTimeout: config.stopTimeout,
        StopSignal: config.stopSignal,
      },
      Labels: config.labels || {},
      WorkingDir: config.workingDir,
      User: config.user,
      Healthcheck: this.buildHealthcheck(config.healthCheck),
      NetworkingConfig: {
        EndpointsConfig: this.buildNetworkConfig(config.networks),
      },
    };
  }

  /**
   * Build exposed ports configuration
   * @private
   */
  private buildExposedPorts(ports?: { containerPort: number; protocol?: string }[]): Record<string, unknown> {
    if (!ports) return {};
    const exposed: Record<string, unknown> = {};
    ports.forEach((port) => {
      const key = `${port.containerPort}/${port.protocol || 'tcp'}`;
      exposed[key] = {};
    });
    return exposed;
  }

  /**
   * Build port bindings configuration
   * @private
   */
  private buildPortBindings(ports?: { containerPort: number; hostPort?: number; protocol?: string }[]): Record<string, unknown> {
    if (!ports) return {};
    const bindings: Record<string, unknown> = {};
    ports.forEach((port) => {
      const key = `${port.containerPort}/${port.protocol || 'tcp'}`;
      bindings[key] = [{ HostPort: (port.hostPort || port.containerPort).toString() }];
    });
    return bindings;
  }

  /**
   * Build volume binds
   * @private
   */
  private buildBinds(volumes?: { source: string; target: string; readOnly?: boolean }[]): string[] {
    if (!volumes) return [];
    return volumes.map((v) => {
      const readonly = v.readOnly ? ':ro' : '';
      return `${v.source}:${v.target}${readonly}`;
    });
  }

  /**
   * Build network configuration
   * @private
   */
  private buildNetworkConfig(networks?: string[]): Record<string, unknown> {
    if (!networks || networks.length === 0) return {};
    const config: Record<string, unknown> = {};
    networks.forEach((network) => {
      config[network] = {};
    });
    return config;
  }

  /**
   * Build healthcheck configuration
   * @private
   */
  private buildHealthcheck(healthCheck?: {
    type: string;
    interval: number;
    timeout: number;
    retries: number;
    command?: string[];
  }): Docker.HealthConfig | undefined {
    if (!healthCheck) return undefined;

    return {
      Test: healthCheck.command || ['CMD', 'curl', '-f', 'http://localhost:8080/health'],
      Interval: healthCheck.interval,
      Timeout: healthCheck.timeout,
      Retries: healthCheck.retries,
      StartPeriod: 0,
    };
  }

  /**
   * Start a container
   *
   * @param containerId - Container ID or name
   * @returns Container started successfully
   *
   * @example
   * ```typescript
   * await containerManager.startContainer(containerId);
   * ```
   */
  async startContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      const startTime = Date.now();

      await container.start();

      const duration = Date.now() - startTime;
      this.logger.info(`Container started: ${containerId} (${duration}ms)`);

      // Update cache
      if (this.containerCache.has(containerId)) {
        const cached = this.containerCache.get(containerId)!;
        cached.state = ContainerState.RUNNING;
        cached.startedAt = new Date();
      }

      this.emit('container-started', { id: containerId, duration });
    } catch (error) {
      this.logger.error(`Failed to start container ${containerId}`, error);
      throw new Error(`Failed to start container: ${error.message}`);
    }
  }

  /**
   * Stop a container
   *
   * @param containerId - Container ID or name
   * @param timeout - Graceful shutdown timeout in seconds (default: 10)
   */
  async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: timeout });

      this.logger.info(`Container stopped: ${containerId}`);

      // Update cache
      if (this.containerCache.has(containerId)) {
        const cached = this.containerCache.get(containerId)!;
        cached.state = ContainerState.STOPPED;
        cached.stoppedAt = new Date();
      }

      this.emit('container-stopped', { id: containerId });
    } catch (error) {
      this.logger.error(`Failed to stop container ${containerId}`, error);
      throw new Error(`Failed to stop container: ${error.message}`);
    }
  }

  /**
   * Remove a container
   *
   * @param containerId - Container ID or name
   * @param force - Force remove running container
   */
  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);

      // Stop stats streaming
      const streamer = this.statsStreamers.get(containerId);
      if (streamer) {
        streamer.destroy();
        this.statsStreamers.delete(containerId);
      }

      // Clear health check interval
      const healthInterval = this.healthCheckIntervals.get(containerId);
      if (healthInterval) {
        clearInterval(healthInterval);
        this.healthCheckIntervals.delete(containerId);
      }

      await container.remove({ force });

      this.logger.info(`Container removed: ${containerId}`);

      // Remove from cache
      this.containerCache.delete(containerId);

      this.emit('container-removed', { id: containerId });
    } catch (error) {
      this.logger.error(`Failed to remove container ${containerId}`, error);
      throw new Error(`Failed to remove container: ${error.message}`);
    }
  }

  /**
   * Restart a container
   *
   * @param containerId - Container ID or name
   * @param timeout - Restart timeout in seconds
   */
  async restartContainer(containerId: string, timeout: number = 10): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart({ t: timeout });

      this.logger.info(`Container restarted: ${containerId}`);

      // Update cache
      if (this.containerCache.has(containerId)) {
        const cached = this.containerCache.get(containerId)!;
        cached.state = ContainerState.RESTARTING;
        cached.restartCount++;
      }

      this.emit('container-restarted', { id: containerId });
    } catch (error) {
      this.logger.error(`Failed to restart container ${containerId}`, error);
      throw new Error(`Failed to restart container: ${error.message}`);
    }
  }

  /**
   * Pause a container
   *
   * @param containerId - Container ID or name
   */
  async pauseContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.pause();

      this.logger.info(`Container paused: ${containerId}`);

      if (this.containerCache.has(containerId)) {
        const cached = this.containerCache.get(containerId)!;
        cached.state = ContainerState.PAUSED;
      }

      this.emit('container-paused', { id: containerId });
    } catch (error) {
      this.logger.error(`Failed to pause container ${containerId}`, error);
      throw new Error(`Failed to pause container: ${error.message}`);
    }
  }

  /**
   * Unpause a container
   *
   * @param containerId - Container ID or name
   */
  async unpauseContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.unpause();

      this.logger.info(`Container unpaused: ${containerId}`);

      if (this.containerCache.has(containerId)) {
        const cached = this.containerCache.get(containerId)!;
        cached.state = ContainerState.RUNNING;
      }

      this.emit('container-unpaused', { id: containerId });
    } catch (error) {
      this.logger.error(`Failed to unpause container ${containerId}`, error);
      throw new Error(`Failed to unpause container: ${error.message}`);
    }
  }

  /**
   * Get container status
   *
   * @param containerId - Container ID or name
   * @returns Container status information
   */
  async getContainerStatus(containerId: string): Promise<ContainerStatus> {
    try {
      const container = this.docker.getContainer(containerId);
      const data = await container.inspect();

      const uptime = data.State.Running ? Date.now() - new Date(data.State.StartedAt).getTime() : 0;

      const status: ContainerStatus = {
        id: data.Id,
        name: data.Name.replace(/^\//, ''),
        state: this.parseContainerState(data.State.Status),
        running: data.State.Running,
        paused: data.State.Paused,
        restartCount: data.RestartCount,
        uptime,
        memory: { used: 0, limit: 0, cached: 0, rss: 0, percentageUsed: 0, pageCache: 0 },
        cpu: { usage: 0, userTime: 0, systemTime: 0, throttledTime: 0, cores: 0 },
        exitCode: data.State.ExitCode,
      };

      return status;
    } catch (error) {
      this.logger.error(`Failed to get container status ${containerId}`, error);
      throw new Error(`Failed to get container status: ${error.message}`);
    }
  }

  /**
   * Parse container state from Docker status string
   * @private
   */
  private parseContainerState(status: string): ContainerState {
    const mapping: Record<string, ContainerState> = {
      created: ContainerState.CREATED,
      running: ContainerState.RUNNING,
      paused: ContainerState.PAUSED,
      stopped: ContainerState.STOPPED,
      exited: ContainerState.EXITED,
      dead: ContainerState.DEAD,
      restarting: ContainerState.RESTARTING,
    };
    return mapping[status] || ContainerState.UNKNOWN;
  }

  /**
   * List containers
   *
   * @param filter - Filter criteria (e.g., 'status=running')
   * @returns Array of containers
   */
  async listContainers(filter?: string): Promise<Container[]> {
    try {
      const options: Docker.ContainerListOptions = {
        all: !filter?.includes('status=running'),
      };

      if (filter) {
        options.filters = { status: [filter.split('=')[1]] };
      }

      const containers = await this.docker.listContainers(options);

      return containers.map((c) => ({
        id: c.Id,
        name: c.Names[0].replace(/^\//, ''),
        image: c.Image,
        imageId: c.ImageID,
        state: this.parseContainerState(c.State),
        status: c.Status,
        createdAt: new Date(c.Created * 1000),
        ports: c.Ports.map((p) => ({
          containerPort: p.PrivatePort || 0,
          hostPort: p.PublicPort,
          protocol: p.Type as 'tcp' | 'udp',
        })),
        volumes: [],
        resources: {},
        restartCount: 0,
        labels: c.Labels || {},
        mounts: [],
        networkSettings: { bridge: '', gateway: '', ipAddress: '', ipPrefixLen: 0, macAddress: '', networks: {} },
      }));
    } catch (error) {
      this.logger.error('Failed to list containers', error);
      throw new Error(`Failed to list containers: ${error.message}`);
    }
  }

  /**
   * Get container metrics/stats
   *
   * @param containerId - Container ID or name
   * @returns Container metrics snapshot
   */
  async getMetrics(containerId: string): Promise<Metrics> {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await this.getStats(container);
      const containerData = await container.inspect();

      return this.parseMetrics(containerData, stats);
    } catch (error) {
      this.logger.error(`Failed to get metrics for ${containerId}`, error);
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  /**
   * Get container stats from Docker
   * @private
   */
  private async getStats(container: Docker.Container): Promise<StatsSnapshot> {
    return new Promise((resolve, reject) => {
      container.stats({ stream: false }, (err: Error | null, stream?: NodeJS.ReadableStream) => {
        if (err) {
          reject(err);
          return;
        }

        if (stream) {
          let data = '';
          stream.on('data', (chunk) => {
            data += chunk.toString();
          });
          stream.on('end', () => {
            try {
              const stats = JSON.parse(data);
              resolve(stats);
            } catch (parseError) {
              reject(parseError);
            }
          });
        }
      });
    });
  }

  /**
   * Parse Docker stats into Metrics
   * @private
   */
  private parseMetrics(containerData: Docker.ContainerInspectInfo, stats: StatsSnapshot): Metrics {
    const cpuMetrics = this.calculateCPUMetrics(stats);
    const memoryMetrics = this.calculateMemoryMetrics(stats);
    const networkMetrics = this.calculateNetworkMetrics(stats);

    return {
      timestamp: new Date(),
      containerId: containerData.Id,
      containerName: containerData.Name.replace(/^\//, ''),
      cpu: cpuMetrics,
      memory: memoryMetrics,
      disk: { used: 0, available: 0, readOps: 0, writeOps: 0, readBytes: 0, writeBytes: 0, iopsRead: 0, iopsWrite: 0 },
      network: networkMetrics,
      processes: { count: 0, runningCount: 0, zombieCount: 0, processes: [] },
    };
  }

  /**
   * Calculate CPU metrics
   * @private
   */
  private calculateCPUMetrics(stats: StatsSnapshot): CPUMetrics {
    if (!stats.cpuStats) {
      return { usage: 0, userTime: 0, systemTime: 0, throttledTime: 0, cores: 0 };
    }

    const cpuDelta = (stats.cpuStats.cpuUsage?.totalUsage || 0) - ((stats.precpuStats as any)?.cpuUsage?.totalUsage || 0);
    const systemDelta = (stats.cpuStats.systemCpuUsage || 0) - ((stats.precpuStats as any)?.systemCpuUsage || 0);
    const cores = stats.cpuStats.onlineCpus || 1;

    const cpuPercent = (cpuDelta / systemDelta) * cores * 100;

    return {
      usage: Math.max(0, Math.min(100, cpuPercent)),
      userTime: stats.cpuStats.cpuUsage?.usageInUsermode || 0,
      systemTime: stats.cpuStats.cpuUsage?.usageInKernelmode || 0,
      throttledTime: stats.cpuStats.throttlingData?.throttledTime || 0,
      cores,
    };
  }

  /**
   * Calculate memory metrics
   * @private
   */
  private calculateMemoryMetrics(stats: StatsSnapshot): MemoryMetrics {
    if (!stats.memoryStats) {
      return { used: 0, limit: 0, cached: 0, rss: 0, percentageUsed: 0, pageCache: 0 };
    }

    const used = stats.memoryStats.usage || 0;
    const limit = stats.memoryStats.limit || 0;
    const cached = (stats.memoryStats.stats?.cache as number) || 0;

    return {
      used,
      limit,
      cached,
      rss: (stats.memoryStats.stats?.rss as number) || 0,
      percentageUsed: limit > 0 ? (used / limit) * 100 : 0,
      pageCache: cached,
    };
  }

  /**
   * Calculate network metrics
   * @private
   */
  private calculateNetworkMetrics(stats: StatsSnapshot): NetworkMetrics {
    if (!stats.networks) {
      return { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0, errors: 0, dropped: 0, interfaces: [] };
    }

    let totalBytesIn = 0;
    let totalBytesOut = 0;
    let totalPacketsIn = 0;
    let totalPacketsOut = 0;
    let totalErrors = 0;
    let totalDropped = 0;

    const interfaces = Object.entries(stats.networks).map(([name, metrics]) => ({
      name,
      bytesIn: (metrics as any).rxBytes || 0,
      bytesOut: (metrics as any).txBytes || 0,
      packetsIn: (metrics as any).rxPackets || 0,
      packetsOut: (metrics as any).txPackets || 0,
    }));

    Object.values(stats.networks).forEach((metrics) => {
      const m = metrics as any;
      totalBytesIn += m.rxBytes || 0;
      totalBytesOut += m.txBytes || 0;
      totalPacketsIn += m.rxPackets || 0;
      totalPacketsOut += m.txPackets || 0;
      totalErrors += m.rxErrors || 0;
      totalDropped += m.rxDropped || 0;
    });

    return {
      bytesIn: totalBytesIn,
      bytesOut: totalBytesOut,
      packetsIn: totalPacketsIn,
      packetsOut: totalPacketsOut,
      errors: totalErrors,
      dropped: totalDropped,
      interfaces,
    };
  }

  /**
   * Stream logs from container
   *
   * @param containerId - Container ID or name
   * @param callback - Callback function for log chunks
   */
  async streamLogs(containerId: string, callback: (chunk: string) => void): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);

      await new Promise<void>((resolve, reject) => {
        container.logs(
          { stdout: true, stderr: true, follow: true },
          (err: Error | null, stream?: NodeJS.ReadableStream) => {
            if (err) {
              reject(err);
              return;
            }

            if (stream) {
              stream.on('data', (chunk: Buffer) => {
                callback(chunk.toString());
              });

              stream.on('end', () => {
                resolve();
              });

              stream.on('error', (error) => {
                reject(error);
              });
            }
          }
        );
      });
    } catch (error) {
      this.logger.error(`Failed to stream logs for ${containerId}`, error);
      throw new Error(`Failed to stream logs: ${error.message}`);
    }
  }

  /**
   * Update container resource limits
   *
   * @param containerId - Container ID or name
   * @param limits - New resource limits
   */
  async updateResourceLimits(containerId: string, limits: ResourceLimits): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);

      const updateOptions: Docker.ContainerUpdateOptions = {
        CpuQuota: limits.cpuLimit ? limits.cpuLimit * 1000 : 0,
        Memory: limits.memoryLimit,
        MemoryReservation: limits.memoryRequest,
        CpuShares: limits.cpuRequest,
      };

      await container.update(updateOptions);

      this.logger.info(`Resource limits updated for container: ${containerId}`);

      if (this.containerCache.has(containerId)) {
        const cached = this.containerCache.get(containerId)!;
        cached.resources = limits;
      }

      this.emit('container-updated', { id: containerId, limits });
    } catch (error) {
      this.logger.error(`Failed to update resource limits for ${containerId}`, error);
      throw new Error(`Failed to update resource limits: ${error.message}`);
    }
  }

  /**
   * Cleanup resources and close connections
   */
  async cleanup(): Promise<void> {
    try {
      // Close event stream
      if (this.eventStream) {
        this.eventStream.destroy();
      }

      // Close all stats streamers
      this.statsStreamers.forEach((stream) => stream.destroy());
      this.statsStreamers.clear();

      // Clear all health check intervals
      this.healthCheckIntervals.forEach((interval) => clearInterval(interval));
      this.healthCheckIntervals.clear();

      // Clear cache
      this.containerCache.clear();

      this.logger.info('ContainerManager cleanup complete');
    } catch (error) {
      this.logger.error('Error during cleanup', error);
    }
  }
}

export default ContainerManager;
