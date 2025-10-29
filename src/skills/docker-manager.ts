/**
 * Docker Manager Skill
 * Container lifecycle management and Docker Compose orchestration
 * Agent: DevOps Engineer
 * Version: 1.0.0
 */

import { execSync, spawn } from 'child_process';

// Types for docker manager
interface Container {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused' | 'exited';
  createdAt: Date;
  startedAt?: Date;
  ports: string[];
  volumes: string[];
}

interface ContainerStats {
  id: string;
  name: string;
  cpuPercent: number;
  memoryUsage: string;
  memoryLimit: string;
  networkInput: string;
  networkOutput: string;
  pids: number;
}

interface Image {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: Date;
}

interface BuildOptions {
  dockerfile?: string;
  tag: string;
  buildArgs?: Record<string, string>;
  noCache?: boolean;
}

interface RunOptions {
  name?: string;
  ports?: string[];
  volumes?: string[];
  environment?: Record<string, string>;
  detach?: boolean;
  remove?: boolean;
}

/**
 * Docker Manager Class
 * Manages Docker containers, images, and Compose orchestration
 */
export class DockerManager {
  private dockerAvailable: boolean;
  private containers: Map<string, Container>;
  private images: Map<string, Image>;

  constructor() {
    this.dockerAvailable = this.checkDockerInstalled();
    this.containers = new Map();
    this.images = new Map();
  }

  /**
   * Check if Docker is installed and running
   */
  private checkDockerInstalled(): boolean {
    try {
      execSync('docker --version', { stdio: 'pipe' });
      return true;
    } catch {
      console.warn('Docker is not installed or not in PATH');
      return false;
    }
  }

  /**
   * Ensure Docker is available
   */
  private ensureDocker(): void {
    if (!this.dockerAvailable) {
      throw new Error('Docker is not installed or not available');
    }
  }

  /**
   * Pull an image from registry
   */
  async pullImage(imageName: string): Promise<boolean> {
    try {
      this.ensureDocker();
      console.log(`Pulling image: ${imageName}`);
      execSync(`docker pull ${imageName}`, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error(`Error pulling image ${imageName}:`, error);
      return false;
    }
  }

  /**
   * Build a Docker image
   */
  async buildImage(contextPath: string, options: BuildOptions): Promise<boolean> {
    try {
      this.ensureDocker();

      let command = `docker build -t ${options.tag}`;

      if (options.dockerfile) {
        command += ` -f ${options.dockerfile}`;
      }

      if (options.noCache) {
        command += ' --no-cache';
      }

      if (options.buildArgs) {
        Object.entries(options.buildArgs).forEach(([key, value]) => {
          command += ` --build-arg ${key}=${value}`;
        });
      }

      command += ` ${contextPath}`;

      console.log(`Building image: ${options.tag}`);
      execSync(command, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error(`Error building image:`, error);
      return false;
    }
  }

  /**
   * List all images
   */
  listImages(): Image[] {
    try {
      this.ensureDocker();

      const output = execSync('docker images --format "{{.ID}}\t{{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"', {
        encoding: 'utf-8',
      });

      const images: Image[] = [];
      output.split('\n').forEach(line => {
        if (line.trim()) {
          const [id, repo, tag, size, created] = line.split('\t');
          images.push({
            id: id.substring(0, 12),
            repository: repo,
            tag,
            size,
            created: new Date(created),
          });
        }
      });

      return images;
    } catch (error) {
      console.error('Error listing images:', error);
      return [];
    }
  }

  /**
   * Remove an image
   */
  removeImage(imageId: string, force: boolean = false): boolean {
    try {
      this.ensureDocker();

      const command = `docker rmi ${force ? '-f' : ''} ${imageId}`;
      console.log(`Removing image: ${imageId}`);
      execSync(command, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error(`Error removing image:`, error);
      return false;
    }
  }

  /**
   * Run a container
   */
  async runContainer(image: string, options: RunOptions = {}): Promise<string | null> {
    try {
      this.ensureDocker();

      let command = 'docker run';

      if (options.detach) {
        command += ' -d';
      }

      if (options.name) {
        command += ` --name ${options.name}`;
      }

      if (options.ports) {
        options.ports.forEach(port => {
          command += ` -p ${port}`;
        });
      }

      if (options.volumes) {
        options.volumes.forEach(volume => {
          command += ` -v ${volume}`;
        });
      }

      if (options.environment) {
        Object.entries(options.environment).forEach(([key, value]) => {
          command += ` -e ${key}=${value}`;
        });
      }

      if (options.remove) {
        command += ' --rm';
      }

      command += ` ${image}`;

      console.log(`Running container from image: ${image}`);
      const result = execSync(command, { encoding: 'utf-8' });

      const containerId = result.trim();
      if (containerId) {
        this.containers.set(containerId, {
          id: containerId,
          name: options.name || containerId.substring(0, 12),
          image,
          status: 'running',
          createdAt: new Date(),
          startedAt: new Date(),
          ports: options.ports || [],
          volumes: options.volumes || [],
        });
      }

      return containerId;
    } catch (error) {
      console.error('Error running container:', error);
      return null;
    }
  }

  /**
   * List all containers
   */
  listContainers(includeExited: boolean = false): Container[] {
    try {
      this.ensureDocker();

      const format = '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}';
      const command = `docker ps ${includeExited ? '-a' : ''} --format "${format}"`;

      const output = execSync(command, { encoding: 'utf-8' });

      const containers: Container[] = [];
      output.split('\n').forEach(line => {
        if (line.trim()) {
          const [id, name, image, status, ports] = line.split('\t');
          const statusMatch = status.match(/(\w+)/);
          containers.push({
            id: id.substring(0, 12),
            name: name || id.substring(0, 12),
            image,
            status: (statusMatch?.[1]?.toLowerCase() as any) || 'unknown',
            createdAt: new Date(),
            ports: ports ? ports.split(',') : [],
            volumes: [],
          });
        }
      });

      return containers;
    } catch (error) {
      console.error('Error listing containers:', error);
      return [];
    }
  }

  /**
   * Get container details
   */
  inspectContainer(containerId: string): Container | null {
    try {
      this.ensureDocker();

      const output = execSync(`docker inspect ${containerId}`, { encoding: 'utf-8' });
      const data = JSON.parse(output)[0];

      return {
        id: data.Id.substring(0, 12),
        name: data.Name.substring(1),
        image: data.Config.Image,
        status: (data.State.Status as any) || 'unknown',
        createdAt: new Date(data.Created),
        startedAt: data.State.StartedAt ? new Date(data.State.StartedAt) : undefined,
        ports: Object.keys(data.NetworkSettings.Ports || {}).map(p => p.split('/')[0]),
        volumes: Object.keys(data.Mounts || {}).map(v => v),
      };
    } catch (error) {
      console.error(`Error inspecting container:`, error);
      return null;
    }
  }

  /**
   * Start a container
   */
  startContainer(containerId: string): boolean {
    try {
      this.ensureDocker();

      console.log(`Starting container: ${containerId}`);
      execSync(`docker start ${containerId}`, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error(`Error starting container:`, error);
      return false;
    }
  }

  /**
   * Stop a container
   */
  stopContainer(containerId: string, timeout: number = 10): boolean {
    try {
      this.ensureDocker();

      console.log(`Stopping container: ${containerId}`);
      execSync(`docker stop -t ${timeout} ${containerId}`, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error(`Error stopping container:`, error);
      return false;
    }
  }

  /**
   * Restart a container
   */
  restartContainer(containerId: string, timeout: number = 10): boolean {
    try {
      this.ensureDocker();

      console.log(`Restarting container: ${containerId}`);
      execSync(`docker restart -t ${timeout} ${containerId}`, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error(`Error restarting container:`, error);
      return false;
    }
  }

  /**
   * Remove a container
   */
  removeContainer(containerId: string, force: boolean = false): boolean {
    try {
      this.ensureDocker();

      const command = `docker rm ${force ? '-f' : ''} ${containerId}`;
      console.log(`Removing container: ${containerId}`);
      execSync(command, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error(`Error removing container:`, error);
      return false;
    }
  }

  /**
   * Get container logs
   */
  getLogs(containerId: string, lines: number = 100): string {
    try {
      this.ensureDocker();

      const output = execSync(`docker logs --tail ${lines} ${containerId}`, {
        encoding: 'utf-8',
      });

      return output;
    } catch (error) {
      console.error(`Error getting logs:`, error);
      return '';
    }
  }

  /**
   * Stream container logs (follow mode)
   */
  streamLogs(containerId: string): void {
    try {
      this.ensureDocker();

      const child = spawn('docker', ['logs', '-f', containerId]);

      child.stdout?.on('data', (data) => {
        console.log(data.toString());
      });

      child.stderr?.on('data', (data) => {
        console.error(data.toString());
      });
    } catch (error) {
      console.error(`Error streaming logs:`, error);
    }
  }

  /**
   * Get container statistics
   */
  getContainerStats(containerId: string): ContainerStats | null {
    try {
      this.ensureDocker();

      const output = execSync(`docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}" ${containerId}`, {
        encoding: 'utf-8',
      });

      const lines = output.trim().split('\n');
      if (lines.length < 2) {
        return null;
      }

      const data = lines[1].split('\t');
      const memoryUsage = data[2].split(' / ')[0];
      const memoryLimit = data[2].split(' / ')[1];
      const networkInput = data[3].split(' / ')[0];
      const networkOutput = data[3].split(' / ')[1];

      return {
        id: containerId.substring(0, 12),
        name: '',
        cpuPercent: parseFloat(data[1]),
        memoryUsage,
        memoryLimit,
        networkInput,
        networkOutput,
        pids: parseInt(data[4]),
      };
    } catch (error) {
      console.error(`Error getting container stats:`, error);
      return null;
    }
  }

  /**
   * Docker Compose up
   */
  async composeUp(filePath: string, services?: string[]): Promise<boolean> {
    try {
      this.ensureDocker();

      let command = `docker-compose -f ${filePath} up -d`;

      if (services) {
        command += ` ${services.join(' ')}`;
      }

      console.log('Starting Docker Compose services...');
      execSync(command, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error('Error starting Docker Compose:', error);
      return false;
    }
  }

  /**
   * Docker Compose down
   */
  async composeDown(filePath: string, removeVolumes: boolean = false): Promise<boolean> {
    try {
      this.ensureDocker();

      let command = `docker-compose -f ${filePath} down`;

      if (removeVolumes) {
        command += ' -v';
      }

      console.log('Stopping Docker Compose services...');
      execSync(command, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error('Error stopping Docker Compose:', error);
      return false;
    }
  }

  /**
   * Docker Compose logs
   */
  composeLogs(filePath: string, services?: string[], follow: boolean = false): string {
    try {
      this.ensureDocker();

      let command = `docker-compose -f ${filePath} logs`;

      if (follow) {
        command += ' -f';
      }

      if (services) {
        command += ` ${services.join(' ')}`;
      }

      if (!follow) {
        return execSync(command, { encoding: 'utf-8' });
      } else {
        const child = spawn('docker-compose', ['-f', filePath, 'logs', '-f', ...(services || [])]);

        child.stdout?.on('data', (data) => {
          console.log(data.toString());
        });

        child.stderr?.on('data', (data) => {
          console.error(data.toString());
        });

        return '';
      }
    } catch (error) {
      console.error('Error getting Docker Compose logs:', error);
      return '';
    }
  }

  /**
   * Clean up unused resources
   */
  cleanup(): void {
    try {
      this.ensureDocker();

      console.log('Cleaning up unused Docker resources...');
      execSync('docker system prune -f', { stdio: 'inherit' });
      console.log('Cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Generate Docker status report
   */
  generateReport(): string {
    try {
      this.ensureDocker();

      const containers = this.listContainers(true);
      const images = this.listImages();

      let report = `
================================================================================
                      DOCKER MANAGER STATUS REPORT
================================================================================

DOCKER STATUS
-------------
`;

      try {
        const versionOutput = execSync('docker --version', { encoding: 'utf-8' });
        report += `${versionOutput.trim()}\n`;

        const infoOutput = execSync('docker info --format "Containers: {{.Containers}}, Running: {{.ContainersRunning}}, Images: {{.Images}}, Storage Driver: {{.Driver}}"', {
          encoding: 'utf-8',
        });
        report += `${infoOutput.trim()}\n`;
      } catch {
        report += 'Docker info unavailable\n';
      }

      report += `
CONTAINERS (${containers.length})
${containers.length > 0 ? '----------' : ''}
`;

      containers.forEach(container => {
        report += `
${container.name} (${container.id})
  Image: ${container.image}
  Status: ${container.status}
  Created: ${container.createdAt.toISOString()}
  ${container.ports.length > 0 ? `Ports: ${container.ports.join(', ')}` : ''}
`;
      });

      report += `
IMAGES (${images.length})
${images.length > 0 ? '------' : ''}
`;

      images.slice(0, 10).forEach(image => {
        report += `
${image.repository}:${image.tag}
  ID: ${image.id}
  Size: ${image.size}
  Created: ${image.created.toISOString()}
`;
      });

      if (images.length > 10) {
        report += `\n... and ${images.length - 10} more images\n`;
      }

      report += `
================================================================================
`;

      return report;
    } catch (error) {
      console.error('Error generating report:', error);
      return 'Error generating Docker report';
    }
  }
}

export default DockerManager;
