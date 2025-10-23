/**
 * SkillExecutor Test Suite
 *
 * Comprehensive tests for the Skill Executor Framework
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const SkillExecutor = require('./skill-executor');
const {
  SkillError,
  SkillNotFoundError,
  SkillValidationError,
  SkillExecutionError,
  SkillTimeoutError
} = require('./skill-executor');
const SkillManager = require('./skill-manager');
const path = require('path');
const fs = require('fs');

// Test helper: Clean up test skills
function cleanupTestSkills(skillsPath) {
  if (fs.existsSync(skillsPath)) {
    const files = fs.readdirSync(skillsPath);
    for (const file of files) {
      if (file.startsWith('test-')) {
        fs.unlinkSync(path.join(skillsPath, file));
      }
    }
  }
}

// Test helper: Create a test skill
function createTestSkill(skillsPath, name, config = {}) {
  const skillContent = `
    module.exports = {
      name: '${name}',
      description: '${config.description || 'Test skill'}',
      version: '1.0.0',
      category: '${config.category || 'test'}',
      tags: ${JSON.stringify(config.tags || ['test'])},
      timeout: ${config.timeout || 5000},
      retries: ${config.retries !== undefined ? config.retries : 1},
      parameters: ${JSON.stringify(config.parameters || {})},
      execute: async function(context) {
        ${config.executeBody || 'return { success: true, message: "Test successful" };'}
      },
      formatResult: ${config.formatResult || 'function(result) { return result; }'}
    };
  `;

  fs.writeFileSync(path.join(skillsPath, `${name}.js`), skillContent);
}

describe('SkillExecutor', () => {
  let executor;
  const testSkillsPath = path.join(__dirname, 'skills');

  beforeAll(() => {
    // Ensure skills directory exists
    if (!fs.existsSync(testSkillsPath)) {
      fs.mkdirSync(testSkillsPath, { recursive: true });
    }
  });

  beforeEach(() => {
    executor = new SkillExecutor({
      skillsPath: testSkillsPath,
      verbose: false
    });
  });

  afterEach(() => {
    // Clean up test skills
    cleanupTestSkills(testSkillsPath);
  });

  /**
   * Test 1: Initialization and Skill Discovery
   */
  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await executor.initialize();

      expect(result.success).toBe(true);
      expect(result.skillsPath).toBe(testSkillsPath);
      expect(typeof result.skillsDiscovered).toBe('number');
    });

    test('should discover existing skills', async () => {
      // Create test skills
      createTestSkill(testSkillsPath, 'test-skill-1');
      createTestSkill(testSkillsPath, 'test-skill-2');

      await executor.initialize();

      const skills = await executor.listSkills();
      const testSkills = skills.filter(s => s.name.startsWith('test-skill'));

      expect(testSkills.length).toBeGreaterThanOrEqual(2);
    });

    test('should not re-initialize if already initialized', async () => {
      await executor.initialize();
      const result = await executor.initialize();

      expect(result.message).toBe('Already initialized');
    });
  });

  /**
   * Test 2: Skill Loading and Caching
   */
  describe('Skill Loading', () => {
    beforeEach(async () => {
      createTestSkill(testSkillsPath, 'test-load-skill', {
        description: 'Test skill for loading'
      });
      await executor.initialize();
    });

    test('should load skill successfully', async () => {
      const skill = await executor.loadSkill('test-load-skill');

      expect(skill).toBeDefined();
      expect(skill.name).toBe('test-load-skill');
      expect(skill.execute).toBeInstanceOf(Function);
    });

    test('should cache loaded skills', async () => {
      await executor.loadSkill('test-load-skill');
      const cachedSkill = executor.skillCache.get('test-load-skill');

      expect(cachedSkill).toBeDefined();
      expect(cachedSkill.name).toBe('test-load-skill');
    });

    test('should throw SkillNotFoundError for missing skill', async () => {
      await expect(executor.loadSkill('non-existent-skill')).rejects.toThrow(SkillNotFoundError);
    });

    test('should reload skill when hot-reload is enabled', async () => {
      executor.hotReload = true;
      await executor.loadSkill('test-load-skill');

      // Modify skill
      createTestSkill(testSkillsPath, 'test-load-skill', {
        description: 'Modified skill'
      });

      await executor.reloadSkill('test-load-skill');
      const skill = executor.skillCache.get('test-load-skill');

      expect(skill).toBeDefined();
    });
  });

  /**
   * Test 3: Parameter Validation
   */
  describe('Parameter Validation', () => {
    beforeEach(async () => {
      createTestSkill(testSkillsPath, 'test-validation', {
        parameters: {
          name: {
            type: 'string',
            required: true
          },
          count: {
            type: 'number',
            required: false
          }
        }
      });
      await executor.initialize();
    });

    test('should validate required parameters', async () => {
      await expect(
        executor.validateParameters('test-validation', {})
      ).rejects.toThrow(SkillValidationError);
    });

    test('should pass validation with correct parameters', async () => {
      const result = await executor.validateParameters('test-validation', {
        name: 'test'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate parameter types', async () => {
      await expect(
        executor.validateParameters('test-validation', {
          name: 123 // Should be string
        })
      ).rejects.toThrow(SkillValidationError);
    });

    test('should allow optional parameters to be omitted', async () => {
      const result = await executor.validateParameters('test-validation', {
        name: 'test'
        // count is optional
      });

      expect(result.valid).toBe(true);
    });
  });

  /**
   * Test 4: Skill Execution
   */
  describe('Skill Execution', () => {
    beforeEach(async () => {
      createTestSkill(testSkillsPath, 'test-execute', {
        parameters: {
          message: {
            type: 'string',
            required: false
          }
        },
        executeBody: `
          const message = context.parameters.message || 'Hello';
          return { success: true, message, timestamp: new Date().toISOString() };
        `
      });
      await executor.initialize();
    });

    test('should execute skill successfully', async () => {
      // Re-initialize to discover the newly created skill
      await executor.initialize();

      const result = await executor.execute('test-execute', {
        message: 'Test message'
      });

      expect(result.success).toBe(true);
      expect(result.skillName).toBe('test-execute');
      expect(result.result.success).toBe(true);
      expect(result.result.message).toBe('Test message');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('should provide execution context', async () => {
      createTestSkill(testSkillsPath, 'test-context', {
        executeBody: `
          return {
            hasLogger: !!context.logger,
            hasHelpers: !!context.helpers,
            hasParameters: !!context.parameters,
            executionId: context.executionId
          };
        `
      });

      executor._initialized = false;
      await executor.initialize();
      const result = await executor.execute('test-context', {});

      expect(result.result.hasLogger).toBe(true);
      expect(result.result.hasHelpers).toBe(true);
      expect(result.result.hasParameters).toBe(true);
      expect(result.result.executionId).toBeDefined();
    });

    test('should track execution metrics', async () => {
      // Re-initialize to discover the skill
      await executor.initialize();

      await executor.execute('test-execute', {});

      const metrics = executor.getMetrics();

      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });

    test('should record execution history', async () => {
      await executor.execute('test-execute', { message: 'Test 1' });
      await executor.execute('test-execute', { message: 'Test 2' });

      const history = executor.getExecutionHistory();

      expect(history.length).toBe(2);
      expect(history[0].skillName).toBe('test-execute');
      expect(history[0].success).toBe(true);
    });
  });

  /**
   * Test 5: Error Handling and Retries
   */
  describe('Error Handling', () => {
    beforeEach(async () => {
      createTestSkill(testSkillsPath, 'test-error', {
        retries: 2,
        executeBody: `
          throw new Error('Test error');
        `
      });

      createTestSkill(testSkillsPath, 'test-retry', {
        retries: 2,
        executeBody: `
          if (!context.attempt) context.attempt = 0;
          context.attempt++;
          if (context.attempt < 2) {
            throw new Error('Retry needed');
          }
          return { success: true, attempts: context.attempt };
        `
      });

      await executor.initialize();
    });

    test('should handle execution errors', async () => {
      await expect(
        executor.execute('test-error', {})
      ).rejects.toThrow(SkillExecutionError);

      const metrics = executor.getMetrics();
      expect(metrics.failedExecutions).toBe(1);
    });

    test('should record failed executions', async () => {
      try {
        await executor.execute('test-error', {});
      } catch (error) {
        // Expected error
      }

      const history = executor.getExecutionHistory();
      expect(history[0].success).toBe(false);
      expect(history[0].error).toBeDefined();
    });

    test('should emit error events', async () => {
      const errorHandler = jest.fn();
      executor.on('execution:error', errorHandler);

      try {
        await executor.execute('test-error', {});
      } catch (error) {
        // Expected error
      }

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0].skillName).toBe('test-error');
    });
  });

  /**
   * Test 6: Timeout Handling
   */
  describe('Timeout Handling', () => {
    beforeEach(async () => {
      createTestSkill(testSkillsPath, 'test-timeout', {
        timeout: 100,
        executeBody: `
          await new Promise(resolve => setTimeout(resolve, 500));
          return { success: true };
        `
      });

      await executor.initialize();
    });

    test('should timeout long-running skills', async () => {
      await expect(
        executor.execute('test-timeout', {})
      ).rejects.toThrow(SkillTimeoutError);
    });

    test('should respect custom timeout in execute options', async () => {
      createTestSkill(testSkillsPath, 'test-custom-timeout', {
        executeBody: `
          await new Promise(resolve => setTimeout(resolve, 200));
          return { success: true };
        `
      });

      executor._initialized = false;
      await executor.initialize();

      await expect(
        executor.execute('test-custom-timeout', {}, { timeout: 100 })
      ).rejects.toThrow(SkillTimeoutError);
    });
  });

  /**
   * Test 7: Result Formatting
   */
  describe('Result Formatting', () => {
    beforeEach(async () => {
      createTestSkill(testSkillsPath, 'test-format', {
        executeBody: `
          return { data: 'raw data', timestamp: new Date().toISOString() };
        `,
        formatResult: `function(result) {
          return {
            formatted: true,
            data: result.data.toUpperCase(),
            timestamp: result.timestamp
          };
        }`
      });

      await executor.initialize();
    });

    test('should format results using skill formatter', async () => {
      const result = await executor.execute('test-format', {});

      expect(result.result.formatted).toBe(true);
      expect(result.result.data).toBe('RAW DATA');
    });

    test('should handle formatter errors gracefully', async () => {
      createTestSkill(testSkillsPath, 'test-bad-format', {
        executeBody: `return { data: 'test' };`,
        formatResult: `function(result) { throw new Error('Format error'); }`
      });

      executor._initialized = false;
      await executor.initialize();

      const result = await executor.execute('test-bad-format', {});
      // Should return unformatted result
      expect(result.result.data).toBe('test');
    });
  });

  /**
   * Test 8: Skill Metadata and Listing
   */
  describe('Skill Metadata', () => {
    beforeEach(async () => {
      createTestSkill(testSkillsPath, 'test-meta-1', {
        description: 'First test skill',
        category: 'testing',
        tags: ['test', 'meta']
      });

      createTestSkill(testSkillsPath, 'test-meta-2', {
        description: 'Second test skill',
        category: 'testing',
        tags: ['test', 'meta']
      });

      await executor.initialize();
    });

    test('should list all skills', async () => {
      const skills = await executor.listSkills();

      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);
    });

    test('should get skill metadata', async () => {
      const metadata = await executor.getSkillMetadata('test-meta-1');

      expect(metadata.name).toBe('test-meta-1');
      expect(metadata.description).toBe('First test skill');
      expect(metadata.version).toBeDefined();
      expect(metadata.timeout).toBeDefined();
    });

    test('should throw error for non-existent skill metadata', async () => {
      await expect(
        executor.getSkillMetadata('non-existent')
      ).rejects.toThrow(SkillNotFoundError);
    });
  });

  /**
   * Test 9: Event Emission
   */
  describe('Event Handling', () => {
    beforeEach(async () => {
      createTestSkill(testSkillsPath, 'test-events', {
        executeBody: `return { success: true };`
      });

      await executor.initialize();
    });

    test('should emit initialization event', async () => {
      const newExecutor = new SkillExecutor({ skillsPath: testSkillsPath });
      const initHandler = jest.fn();
      newExecutor.on('initialized', initHandler);

      await newExecutor.initialize();

      expect(initHandler).toHaveBeenCalled();
    });

    test('should emit success event on successful execution', async () => {
      const successHandler = jest.fn();
      executor.on('execution:success', successHandler);

      await executor.execute('test-events', {});

      expect(successHandler).toHaveBeenCalled();
      expect(successHandler.mock.calls[0][0].skillName).toBe('test-events');
    });
  });

  /**
   * Test 10: Cache Management
   */
  describe('Cache Management', () => {
    beforeEach(async () => {
      createTestSkill(testSkillsPath, 'test-cache', {
        executeBody: `return { success: true };`
      });

      await executor.initialize();
    });

    test('should cache loaded skills', async () => {
      await executor.loadSkill('test-cache');

      expect(executor.skillCache.has('test-cache')).toBe(true);
    });

    test('should clear cache', async () => {
      await executor.loadSkill('test-cache');
      executor.clearCache();

      expect(executor.skillCache.has('test-cache')).toBe(false);
    });

    test('should reload skill', async () => {
      await executor.loadSkill('test-cache');
      const reloaded = await executor.reloadSkill('test-cache');

      expect(reloaded).toBeDefined();
      expect(reloaded.name).toBe('test-cache');
    });
  });
});

/**
 * SkillManager Test Suite
 */
describe('SkillManager', () => {
  let manager;
  const testSkillsPath = path.join(__dirname, 'skills');

  beforeAll(() => {
    if (!fs.existsSync(testSkillsPath)) {
      fs.mkdirSync(testSkillsPath, { recursive: true });
    }
  });

  beforeEach(() => {
    manager = new SkillManager({
      skillsPath: testSkillsPath,
      verbose: false
    });
  });

  afterEach(() => {
    cleanupTestSkills(testSkillsPath);
  });

  test('should initialize successfully', async () => {
    const result = await manager.initialize();

    expect(result.success).toBe(true);
    expect(typeof result.skillsRegistered).toBe('number');
  });

  test('should list skills with filters', async () => {
    createTestSkill(testSkillsPath, 'test-manager-1', {
      category: 'utilities',
      tags: ['util', 'test']
    });

    await manager.initialize();

    const allSkills = manager.listSkills();
    const utilitySkills = manager.listSkills({ category: 'utilities' });

    expect(Array.isArray(allSkills)).toBe(true);
    expect(Array.isArray(utilitySkills)).toBe(true);
  });

  test('should search skills', async () => {
    createTestSkill(testSkillsPath, 'test-search', {
      description: 'A searchable test skill'
    });

    await manager.initialize();

    const results = manager.searchSkills('searchable');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].skillName).toBe('test-search');
  });

  test('should get categories', async () => {
    createTestSkill(testSkillsPath, 'test-cat-1', { category: 'test-category' });
    createTestSkill(testSkillsPath, 'test-cat-2', { category: 'test-category' });

    await manager.initialize();

    const categories = manager.getCategories();

    expect(Array.isArray(categories)).toBe(true);
    expect(categories.find(c => c.name === 'test-category')).toBeDefined();
  });

  test('should generate documentation', async () => {
    createTestSkill(testSkillsPath, 'test-doc', {
      description: 'Skill for testing documentation'
    });

    await manager.initialize();

    const doc = manager.generateDocumentation('test-doc');

    expect(typeof doc).toBe('string');
    expect(doc).toContain('# test-doc');
    expect(doc).toContain('Skill for testing documentation');
  });
});
