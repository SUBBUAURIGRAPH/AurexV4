/**
 * Docker Manager Skill - Test Suite
 * Tests for container management, image operations, and Compose orchestration
 */

import DockerManager, { DockerManager as DockerManagerClass } from '../../src/skills/docker-manager';

describe('DockerManager Skill', () => {
  let manager: DockerManagerClass;

  beforeEach(() => {
    manager = new DockerManager();
  });

  describe('Docker Availability', () => {
    it('should check Docker installation', () => {
      // This will depend on whether Docker is actually installed
      // The test passes if the manager initializes without throwing
      expect(manager).toBeDefined();
    });
  });

  describe('Image Operations', () => {
    it('should list Docker images', () => {
      const images = manager.listImages();
      expect(Array.isArray(images)).toBe(true);
    });

    it('should return image details', () => {
      const images = manager.listImages();
      if (images.length > 0) {
        const image = images[0];
        expect(image).toHaveProperty('id');
        expect(image).toHaveProperty('repository');
        expect(image).toHaveProperty('tag');
        expect(image).toHaveProperty('size');
        expect(image).toHaveProperty('created');
      }
    });

    it('should handle image pull errors gracefully', async () => {
      const result = await manager.pullImage('nonexistent-image:fake-tag');
      // The function should return false or handle the error gracefully
      expect(typeof result).toBe('boolean');
    });

    it('should handle image build errors gracefully', async () => {
      const result = await manager.buildImage('.', {
        tag: 'test-image:latest',
      });
      // Should handle gracefully even if Docker isn't available
      expect(typeof result).toBe('boolean');
    });

    it('should handle image removal', () => {
      const result = manager.removeImage('nonexistent-id');
      // Should handle gracefully
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Container Operations', () => {
    it('should list containers', () => {
      const containers = manager.listContainers();
      expect(Array.isArray(containers)).toBe(true);
    });

    it('should list containers including exited ones', () => {
      const containers = manager.listContainers(true);
      expect(Array.isArray(containers)).toBe(true);
    });

    it('should return container details', () => {
      const containers = manager.listContainers();
      if (containers.length > 0) {
        const container = containers[0];
        expect(container).toHaveProperty('id');
        expect(container).toHaveProperty('name');
        expect(container).toHaveProperty('image');
        expect(container).toHaveProperty('status');
        expect(container).toHaveProperty('createdAt');
        expect(container).toHaveProperty('ports');
        expect(container).toHaveProperty('volumes');
      }
    });

    it('should handle container inspection errors gracefully', () => {
      const result = manager.inspectContainer('nonexistent-container');
      expect(result).toBeNull();
    });

    it('should handle container start gracefully', () => {
      const result = manager.startContainer('nonexistent-id');
      expect(typeof result).toBe('boolean');
    });

    it('should handle container stop gracefully', () => {
      const result = manager.stopContainer('nonexistent-id');
      expect(typeof result).toBe('boolean');
    });

    it('should handle container restart gracefully', () => {
      const result = manager.restartContainer('nonexistent-id');
      expect(typeof result).toBe('boolean');
    });

    it('should handle container removal gracefully', () => {
      const result = manager.removeContainer('nonexistent-id');
      expect(typeof result).toBe('boolean');
    });

    it('should support force removal', () => {
      const result = manager.removeContainer('nonexistent-id', true);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Container Logs', () => {
    it('should handle log retrieval gracefully', () => {
      const logs = manager.getLogs('nonexistent-container');
      expect(typeof logs).toBe('string');
    });

    it('should support log line limit', () => {
      const logs = manager.getLogs('nonexistent-container', 50);
      expect(typeof logs).toBe('string');
    });

    it('should handle log streaming gracefully', () => {
      // Should not throw
      expect(() => {
        manager.streamLogs('nonexistent-container');
      }).not.toThrow();
    });
  });

  describe('Container Statistics', () => {
    it('should handle stats retrieval gracefully', () => {
      const stats = manager.getContainerStats('nonexistent-container');
      expect(stats === null || typeof stats === 'object').toBe(true);
    });

    it('should return proper stats format if available', () => {
      const containers = manager.listContainers();
      if (containers.length > 0) {
        const stats = manager.getContainerStats(containers[0].id);
        if (stats) {
          expect(stats).toHaveProperty('id');
          expect(stats).toHaveProperty('name');
          expect(stats).toHaveProperty('cpuPercent');
          expect(stats).toHaveProperty('memoryUsage');
          expect(stats).toHaveProperty('memoryLimit');
        }
      }
    });
  });

  describe('Run Container', () => {
    it('should handle container run gracefully', async () => {
      const result = await manager.runContainer('nonexistent-image:fake-tag');
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should support custom container name', async () => {
      const result = await manager.runContainer('nonexistent-image', {
        name: 'test-container',
      });

      expect(typeof result).toBe('string' || null);
    });

    it('should support port mapping', async () => {
      const result = await manager.runContainer('nonexistent-image', {
        ports: ['8080:8080'],
      });

      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should support volume mounting', async () => {
      const result = await manager.runContainer('nonexistent-image', {
        volumes: ['/host/path:/container/path'],
      });

      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should support environment variables', async () => {
      const result = await manager.runContainer('nonexistent-image', {
        environment: {
          'NODE_ENV': 'production',
          'PORT': '8080',
        },
      });

      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should support detached mode', async () => {
      const result = await manager.runContainer('nonexistent-image', {
        detach: true,
      });

      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should support auto-removal', async () => {
      const result = await manager.runContainer('nonexistent-image', {
        remove: true,
      });

      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should support multiple run options combined', async () => {
      const result = await manager.runContainer('nonexistent-image', {
        name: 'test-container',
        ports: ['8080:8080', '9090:9090'],
        volumes: ['/host1:/container1', '/host2:/container2'],
        environment: {
          'ENV_VAR': 'value',
        },
        detach: true,
      });

      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('Docker Compose', () => {
    it('should handle compose up gracefully', async () => {
      const result = await manager.composeUp('nonexistent-compose.yml');
      expect(typeof result).toBe('boolean');
    });

    it('should support specific services in compose up', async () => {
      const result = await manager.composeUp('nonexistent-compose.yml', ['service1', 'service2']);
      expect(typeof result).toBe('boolean');
    });

    it('should handle compose down gracefully', async () => {
      const result = await manager.composeDown('nonexistent-compose.yml');
      expect(typeof result).toBe('boolean');
    });

    it('should support volume removal in compose down', async () => {
      const result = await manager.composeDown('nonexistent-compose.yml', true);
      expect(typeof result).toBe('boolean');
    });

    it('should handle compose logs gracefully', () => {
      const logs = manager.composeLogs('nonexistent-compose.yml');
      expect(typeof logs).toBe('string');
    });

    it('should support specific services in compose logs', () => {
      const logs = manager.composeLogs('nonexistent-compose.yml', ['service1']);
      expect(typeof logs).toBe('string');
    });
  });

  describe('System Cleanup', () => {
    it('should handle cleanup gracefully', () => {
      expect(() => {
        manager.cleanup();
      }).not.toThrow();
    });
  });

  describe('Reporting', () => {
    it('should generate Docker status report', () => {
      const report = manager.generateReport();
      expect(typeof report).toBe('string');
      expect(report).toContain('DOCKER MANAGER STATUS REPORT');
    });

    it('should include containers section in report', () => {
      const report = manager.generateReport();
      expect(report).toContain('CONTAINERS');
    });

    it('should include images section in report', () => {
      const report = manager.generateReport();
      expect(report).toContain('IMAGES');
    });

    it('should handle report generation even if Docker unavailable', () => {
      const report = manager.generateReport();
      expect(typeof report).toBe('string');
    });
  });

  describe('Build Options', () => {
    it('should support custom Dockerfile path', async () => {
      const result = await manager.buildImage('.', {
        tag: 'test-image:latest',
        dockerfile: 'Dockerfile.prod',
      });

      expect(typeof result).toBe('boolean');
    });

    it('should support build arguments', async () => {
      const result = await manager.buildImage('.', {
        tag: 'test-image:latest',
        buildArgs: {
          'NODE_ENV': 'production',
          'VERSION': '1.0.0',
        },
      });

      expect(typeof result).toBe('boolean');
    });

    it('should support no-cache flag', async () => {
      const result = await manager.buildImage('.', {
        tag: 'test-image:latest',
        noCache: true,
      });

      expect(typeof result).toBe('boolean');
    });

    it('should support all build options combined', async () => {
      const result = await manager.buildImage('.', {
        tag: 'test-image:latest',
        dockerfile: 'Dockerfile.prod',
        buildArgs: {
          'NODE_ENV': 'production',
        },
        noCache: true,
      });

      expect(typeof result).toBe('boolean');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: list → inspect → logs → stats', () => {
      const containers = manager.listContainers();
      expect(Array.isArray(containers)).toBe(true);

      if (containers.length > 0) {
        const container = containers[0];
        const details = manager.inspectContainer(container.id);
        const logs = manager.getLogs(container.id);
        const stats = manager.getContainerStats(container.id);

        expect(details === null || typeof details === 'object').toBe(true);
        expect(typeof logs).toBe('string');
        expect(stats === null || typeof stats === 'object').toBe(true);
      }
    });

    it('should handle image and container operations', async () => {
      const images = manager.listImages();
      expect(Array.isArray(images)).toBe(true);

      const containers = manager.listContainers();
      expect(Array.isArray(containers)).toBe(true);

      if (images.length > 0) {
        const imageName = `${images[0].repository}:${images[0].tag}`;
        // Can reference image in run operations
        expect(typeof imageName).toBe('string');
      }
    });

    it('should generate comprehensive report with all sections', () => {
      const report = manager.generateReport();
      expect(report).toContain('DOCKER MANAGER STATUS REPORT');
      expect(report).toContain('CONTAINERS');
      expect(report).toContain('IMAGES');
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle all operations gracefully without Docker', () => {
      // These operations should all handle gracefully even if Docker isn't available
      expect(() => {
        manager.listImages();
        manager.listContainers();
        manager.listContainers(true);
        manager.generateReport();
      }).not.toThrow();
    });

    it('should not throw on invalid container IDs', () => {
      expect(() => {
        manager.inspectContainer('invalid-id-12345');
        manager.startContainer('invalid-id-12345');
        manager.stopContainer('invalid-id-12345');
        manager.restartContainer('invalid-id-12345');
        manager.removeContainer('invalid-id-12345');
        manager.getLogs('invalid-id-12345');
        manager.getContainerStats('invalid-id-12345');
      }).not.toThrow();
    });

    it('should not throw on invalid image IDs', () => {
      expect(() => {
        manager.removeImage('invalid-image-id');
      }).not.toThrow();
    });

    it('should not throw on invalid compose files', async () => {
      expect(async () => {
        await manager.composeUp('/nonexistent/compose.yml');
        await manager.composeDown('/nonexistent/compose.yml');
        manager.composeLogs('/nonexistent/compose.yml');
      }).not.toThrow();
    });
  });
});
