/**
 * Image Manager - Docker Image Build, Push, Pull & Management
 * Manages Docker image lifecycle including building, registry operations, and cleanup
 *
 * @module docker-manager/imageManager
 * @version 1.0.0
 */

import * as Docker from 'dockerode';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import * as Logger from 'winston';
import { Image, ImageDetails, BuildConfig, RegistryConfig } from './types';

/**
 * ImageManager - Handles Docker image operations
 * Provides image build, push, pull, tag, and cleanup functionality
 */
export class ImageManager extends EventEmitter {
  private docker: Docker;
  private logger: Logger.Logger;
  private imageCache: Map<string, Image> = new Map();

  /**
   * Creates a new ImageManager instance
   *
   * @param dockerSocket - Docker socket path (default: /var/run/docker.sock)
   * @param logger - Winston logger instance
   */
  constructor(dockerSocket: string = '/var/run/docker.sock', logger: Logger.Logger) {
    super();
    this.docker = new Docker({ socketPath: dockerSocket });
    this.logger = logger;
  }

  /**
   * Build Docker image from Dockerfile
   *
   * @param dockerfilePath - Path to Dockerfile
   * @param config - Build configuration
   * @param imageName - Name for built image
   * @returns Image ID
   *
   * @example
   * ```typescript
   * const imageId = await imageManager.buildImage(
   *   '/path/to/Dockerfile',
   *   { target: 'production' },
   *   'aurigraph:strategy-executor-v1'
   * );
   * ```
   */
  async buildImage(dockerfilePath: string, config: BuildConfig, imageName: string): Promise<string> {
    try {
      if (!fs.existsSync(dockerfilePath)) {
        throw new Error(`Dockerfile not found: ${dockerfilePath}`);
      }

      this.logger.info(`Building image: ${imageName}`);

      const buildContext = path.dirname(dockerfilePath);
      const dockerFile = path.basename(dockerfilePath);

      return new Promise((resolve, reject) => {
        this.docker.buildImage(
          buildContext,
          {
            dockerfile: dockerFile,
            t: imageName,
            ...config,
          },
          (err: Error | null, stream?: NodeJS.ReadableStream) => {
            if (err) {
              this.logger.error(`Build failed for ${imageName}`, err);
              reject(err);
              return;
            }

            if (stream) {
              let buildOutput = '';

              stream.on('data', (chunk: Buffer) => {
                const output = chunk.toString();
                buildOutput += output;

                // Parse build output for progress
                try {
                  const line = JSON.parse(output);
                  if (line.stream) {
                    this.logger.debug(`Build: ${line.stream.trim()}`);
                  } else if (line.errorDetail) {
                    this.logger.error(`Build error: ${line.errorDetail.message}`);
                  }
                } catch (e) {
                  // Not JSON, skip parsing
                }
              });

              stream.on('end', () => {
                // Extract image ID from successful build
                if (buildOutput.includes('Successfully built')) {
                  const match = buildOutput.match(/Successfully built (\w+)/);
                  const imageId = match ? match[1] : '';

                  this.logger.info(`Image built successfully: ${imageName} (${imageId})`);

                  this.emit('image-built', { name: imageName, id: imageId });

                  resolve(imageId);
                } else {
                  reject(new Error('Build completed but image ID not found'));
                }
              });

              stream.on('error', (error) => {
                this.logger.error(`Build stream error for ${imageName}`, error);
                reject(error);
              });
            }
          }
        );
      });
    } catch (error) {
      this.logger.error(`Failed to build image ${imageName}`, error);
      throw new Error(`Image build failed: ${error.message}`);
    }
  }

  /**
   * Push image to registry
   *
   * @param imageName - Image name to push
   * @param registry - Registry configuration
   * @returns Push completion status
   *
   * @example
   * ```typescript
   * await imageManager.pushImage(
   *   'myregistry.azurecr.io/aurigraph:latest',
   *   { url: 'myregistry.azurecr.io', username: 'user', password: 'pass' }
   * );
   * ```
   */
  async pushImage(imageName: string, registry: RegistryConfig): Promise<void> {
    try {
      this.logger.info(`Pushing image to registry: ${imageName}`);

      const image = this.docker.getImage(imageName);

      return new Promise((resolve, reject) => {
        image.push(
          {
            authconfig: {
              username: registry.username,
              password: registry.password,
              email: registry.email,
              serveraddress: registry.serverAddress || registry.url,
            },
          },
          (err: Error | null, stream?: NodeJS.ReadableStream) => {
            if (err) {
              this.logger.error(`Push failed for ${imageName}`, err);
              reject(err);
              return;
            }

            if (stream) {
              let pushOutput = '';

              stream.on('data', (chunk: Buffer) => {
                const output = chunk.toString();
                pushOutput += output;

                try {
                  const line = JSON.parse(output);
                  if (line.status && line.id) {
                    this.logger.debug(`Push: ${line.id} - ${line.status}`);
                  } else if (line.error) {
                    this.logger.error(`Push error: ${line.error}`);
                  }
                } catch (e) {
                  // Not JSON
                }
              });

              stream.on('end', () => {
                if (!pushOutput.includes('error')) {
                  this.logger.info(`Image pushed successfully: ${imageName}`);
                  this.emit('image-pushed', { name: imageName });
                  resolve();
                } else {
                  reject(new Error('Push completed with errors'));
                }
              });

              stream.on('error', (error) => {
                this.logger.error(`Push stream error for ${imageName}`, error);
                reject(error);
              });
            }
          }
        );
      });
    } catch (error) {
      this.logger.error(`Failed to push image ${imageName}`, error);
      throw new Error(`Image push failed: ${error.message}`);
    }
  }

  /**
   * Pull image from registry
   *
   * @param imageName - Image name to pull (e.g., 'ubuntu:latest', 'myregistry/image:v1')
   * @param registry - Optional registry configuration
   * @returns Pull completion status
   *
   * @example
   * ```typescript
   * await imageManager.pullImage('aurigraph:latest');
   * ```
   */
  async pullImage(imageName: string, registry?: RegistryConfig): Promise<void> {
    try {
      this.logger.info(`Pulling image: ${imageName}`);

      const options: Docker.PullImageOptions = {
        fromImage: imageName.split(':')[0],
        tag: imageName.includes(':') ? imageName.split(':')[1] : 'latest',
      };

      if (registry?.username && registry?.password) {
        (options as any).authconfig = {
          username: registry.username,
          password: registry.password,
          email: registry.email,
          serveraddress: registry.serverAddress || registry.url,
        };
      }

      return new Promise((resolve, reject) => {
        this.docker.pull(imageName, options, (err: Error | null, stream?: NodeJS.ReadableStream) => {
          if (err) {
            this.logger.error(`Pull failed for ${imageName}`, err);
            reject(err);
            return;
          }

          if (stream) {
            let pullOutput = '';

            stream.on('data', (chunk: Buffer) => {
              const output = chunk.toString();
              pullOutput += output;

              try {
                const line = JSON.parse(output);
                if (line.status) {
                  this.logger.debug(`Pull: ${line.id} - ${line.status}`);
                } else if (line.error) {
                  this.logger.error(`Pull error: ${line.error}`);
                }
              } catch (e) {
                // Not JSON
              }
            });

            stream.on('end', () => {
              if (!pullOutput.includes('error')) {
                this.logger.info(`Image pulled successfully: ${imageName}`);
                this.emit('image-pulled', { name: imageName });
                resolve();
              } else {
                reject(new Error('Pull completed with errors'));
              }
            });

            stream.on('error', (error) => {
              this.logger.error(`Pull stream error for ${imageName}`, error);
              reject(error);
            });
          }
        });
      });
    } catch (error) {
      this.logger.error(`Failed to pull image ${imageName}`, error);
      throw new Error(`Image pull failed: ${error.message}`);
    }
  }

  /**
   * Tag an image
   *
   * @param sourceImage - Source image name or ID
   * @param targetTag - Target tag (e.g., 'myregistry/image:latest')
   * @returns Tagging completion status
   *
   * @example
   * ```typescript
   * await imageManager.tagImage(
   *   'aurigraph:local',
   *   'myregistry.azurecr.io/aurigraph:v1.0.0'
   * );
   * ```
   */
  async tagImage(sourceImage: string, targetTag: string): Promise<void> {
    try {
      this.logger.info(`Tagging image: ${sourceImage} -> ${targetTag}`);

      const image = this.docker.getImage(sourceImage);

      const [repo, tag] = targetTag.includes(':') ? targetTag.split(':') : [targetTag, 'latest'];

      await image.tag({ repo, tag });

      this.logger.info(`Image tagged successfully: ${sourceImage} -> ${targetTag}`);

      this.emit('image-tagged', { source: sourceImage, target: targetTag });
    } catch (error) {
      this.logger.error(`Failed to tag image ${sourceImage}`, error);
      throw new Error(`Image tagging failed: ${error.message}`);
    }
  }

  /**
   * Remove image
   *
   * @param imageName - Image name or ID to remove
   * @param force - Force remove image
   * @returns Removal completion status
   */
  async removeImage(imageName: string, force: boolean = false): Promise<void> {
    try {
      this.logger.info(`Removing image: ${imageName}`);

      const image = this.docker.getImage(imageName);

      await image.remove({ force });

      this.logger.info(`Image removed: ${imageName}`);

      // Remove from cache
      this.imageCache.delete(imageName);

      this.emit('image-removed', { name: imageName });
    } catch (error) {
      this.logger.error(`Failed to remove image ${imageName}`, error);
      throw new Error(`Image removal failed: ${error.message}`);
    }
  }

  /**
   * List images
   *
   * @param filter - Filter criteria
   * @returns Array of images
   */
  async listImages(filter?: string): Promise<Image[]> {
    try {
      const options: Docker.ListImagesOptions = {
        all: true,
      };

      if (filter) {
        options.filters = { reference: [filter] };
      }

      const images = await this.docker.listImages(options);

      return images.map((img) => ({
        id: img.Id,
        repoTags: img.RepoTags || [],
        size: img.Size,
        virtualSize: img.VirtualSize,
        created: new Date(img.Created * 1000),
        labels: img.Labels || {},
      }));
    } catch (error) {
      this.logger.error('Failed to list images', error);
      throw new Error(`Failed to list images: ${error.message}`);
    }
  }

  /**
   * Get detailed image information
   *
   * @param imageName - Image name or ID
   * @returns Detailed image information
   */
  async getImageDetails(imageName: string): Promise<ImageDetails> {
    try {
      // Check cache first
      if (this.imageCache.has(imageName)) {
        return this.imageCache.get(imageName) as ImageDetails;
      }

      const image = this.docker.getImage(imageName);
      const data = await image.inspect();

      const details: ImageDetails = {
        id: data.Id,
        repoTags: data.RepoTags || [],
        size: data.Size,
        virtualSize: data.VirtualSize,
        created: new Date(data.Created),
        labels: data.Config?.Labels || {},
        architecture: data.Architecture,
        os: data.Os,
        osVersion: data.OsVersion,
        config: {
          env: data.Config?.Env,
          cmd: data.Config?.Cmd,
          entrypoint: data.Config?.Entrypoint,
          workingDir: data.Config?.WorkingDir,
          user: data.Config?.User,
          exposedPorts: data.Config?.ExposedPorts,
          labels: data.Config?.Labels,
          volumes: data.Config?.Volumes,
        },
        history: [],
        layers: (data.RootFS?.Layers || []).map((layer, idx) => ({
          digest: layer,
          size: 0, // Size info not directly available from inspect
        })),
      };

      // Cache the result
      this.imageCache.set(imageName, details);

      return details;
    } catch (error) {
      this.logger.error(`Failed to get image details for ${imageName}`, error);
      throw new Error(`Failed to get image details: ${error.message}`);
    }
  }

  /**
   * Clean up dangling images (unused images)
   *
   * @returns Number of images removed
   */
  async cleanupDanglingImages(): Promise<number> {
    try {
      this.logger.info('Cleaning up dangling images');

      const images = await this.docker.listImages({ filters: { dangling: ['true'] } });

      for (const img of images) {
        try {
          const image = this.docker.getImage(img.Id);
          await image.remove({ force: false });
          this.logger.info(`Removed dangling image: ${img.Id.substring(0, 12)}`);
        } catch (error) {
          this.logger.warn(`Failed to remove dangling image ${img.Id}`, error);
        }
      }

      this.logger.info(`Cleanup complete: ${images.length} dangling images removed`);

      this.emit('cleanup-complete', { imagesRemoved: images.length });

      return images.length;
    } catch (error) {
      this.logger.error('Failed to cleanup dangling images', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Prune images (remove unused images)
   *
   * @returns Prune result with space freed
   */
  async pruneImages(): Promise<{ imagesDeleted: number; spaceFreed: number }> {
    try {
      this.logger.info('Pruning unused images');

      const result = await this.docker.pruneImages();

      this.logger.info(
        `Pruned images: ${result.ImagesDeleted?.length || 0} images removed, ${result.SpaceReclaimed || 0} bytes freed`
      );

      this.emit('prune-complete', {
        imagesDeleted: result.ImagesDeleted?.length || 0,
        spaceFreed: result.SpaceReclaimed || 0,
      });

      return {
        imagesDeleted: result.ImagesDeleted?.length || 0,
        spaceFreed: result.SpaceReclaimed || 0,
      };
    } catch (error) {
      this.logger.error('Failed to prune images', error);
      throw new Error(`Prune failed: ${error.message}`);
    }
  }

  /**
   * Get image history
   *
   * @param imageName - Image name or ID
   * @returns Image history entries
   */
  async getImageHistory(imageName: string): Promise<ImageHistory[]> {
    try {
      const image = this.docker.getImage(imageName);
      const history = await image.history();

      return history.map((entry: any) => ({
        id: entry.Id,
        created: new Date(entry.Created * 1000),
        createdBy: entry.CreatedBy || '',
        size: entry.Size || 0,
        comment: entry.Comment || '',
      }));
    } catch (error) {
      this.logger.error(`Failed to get image history for ${imageName}`, error);
      throw new Error(`Failed to get image history: ${error.message}`);
    }
  }

  /**
   * Search for images in Docker Hub
   *
   * @param term - Search term
   * @returns Search results
   */
  async searchImages(term: string): Promise<any[]> {
    try {
      this.logger.info(`Searching for images: ${term}`);

      const results = await this.docker.searchImages({ term });

      this.logger.info(`Found ${results.length} images for: ${term}`);

      return results;
    } catch (error) {
      this.logger.error(`Failed to search images for ${term}`, error);
      throw new Error(`Image search failed: ${error.message}`);
    }
  }

  /**
   * Get image configuration summary
   *
   * @param imageName - Image name or ID
   * @returns Configuration summary
   */
  async getImageConfigSummary(imageName: string): Promise<any> {
    try {
      const details = await this.getImageDetails(imageName);

      return {
        name: details.repoTags[0] || 'unknown',
        size: `${(details.size / 1024 / 1024).toFixed(2)} MB`,
        os: `${details.os}${details.osVersion ? `/${details.osVersion}` : ''}`,
        architecture: details.architecture,
        created: details.created,
        config: {
          workingDir: details.config.workingDir || 'not set',
          user: details.config.user || 'not set',
          entrypoint: details.config.entrypoint?.join(' ') || 'not set',
          cmd: details.config.cmd?.join(' ') || 'not set',
          exposedPorts: Object.keys(details.config.exposedPorts || {}).join(', ') || 'none',
          envCount: (details.config.env || []).length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get image config summary for ${imageName}`, error);
      throw new Error(`Failed to get config summary: ${error.message}`);
    }
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    this.imageCache.clear();
    this.logger.info('Image cache cleared');
  }
}

export interface ImageHistory {
  id: string;
  created: Date;
  createdBy: string;
  size: number;
  comment: string;
}

export default ImageManager;
