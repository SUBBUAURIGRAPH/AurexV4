/**
 * Integration Test - Skill Executor Framework
 *
 * Tests the complete integration of SkillExecutor with example skills
 *
 * @version 1.0.0
 */

const SkillExecutor = require('./skill-executor');
const SkillManager = require('./skill-manager');
const path = require('path');

describe('Integration Tests', () => {
  let executor;
  let manager;
  const skillsPath = path.join(__dirname, 'skills');

  beforeAll(async () => {
    executor = new SkillExecutor({
      skillsPath,
      verbose: false
    });

    manager = new SkillManager({
      skillsPath,
      verbose: false
    });

    await executor.initialize();
    await manager.initialize();
  });

  describe('Hello World Skill', () => {
    test('should execute hello-world skill with default parameters', async () => {
      const result = await executor.execute('hello-world', {});

      expect(result.success).toBe(true);
      expect(result.result.output).toBe('Hello, World!');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should execute hello-world skill with custom name', async () => {
      const result = await executor.execute('hello-world', {
        name: 'Developer'
      });

      expect(result.success).toBe(true);
      expect(result.result.output).toBe('Hello, Developer!');
    });

    test('should execute hello-world skill with custom greeting', async () => {
      const result = await executor.execute('hello-world', {
        name: 'World',
        greeting: 'Greetings'
      });

      expect(result.success).toBe(true);
      expect(result.result.output).toBe('Greetings, World!');
    });

    test('should execute hello-world skill with uppercase option', async () => {
      const result = await executor.execute('hello-world', {
        name: 'World',
        uppercase: true
      });

      expect(result.success).toBe(true);
      expect(result.result.output).toBe('HELLO, WORLD!');
    });
  });

  describe('File Analyzer Skill', () => {
    test('should analyze the hello-world skill file', async () => {
      const filePath = path.join(skillsPath, 'hello-world.js');

      const result = await executor.execute('file-analyzer', {
        filePath,
        includeContent: false
      });

      expect(result.success).toBe(true);
      expect(result.result.file.name).toBe('hello-world.js');
      expect(result.result.file.type).toBe('code');
    });
  });

  describe('Skill Manager Integration', () => {
    test('should list available skills', () => {
      const skills = manager.listSkills();

      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);

      const helloWorld = skills.find(s => s.name === 'hello-world');
      expect(helloWorld).toBeDefined();
    });

    test('should search for skills', () => {
      const results = manager.searchSkills('hello');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].skillName).toBe('hello-world');
    });

    test('should get skill categories', () => {
      const categories = manager.getCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    test('should generate documentation for hello-world skill', () => {
      const doc = manager.generateDocumentation('hello-world');

      expect(typeof doc).toBe('string');
      expect(doc).toContain('# hello-world');
      expect(doc).toContain('hello world skill');
    });
  });

  describe('Performance Metrics', () => {
    test('should track execution metrics', async () => {
      await executor.execute('hello-world', {});
      await executor.execute('hello-world', {});

      const metrics = executor.getMetrics();

      expect(metrics.totalExecutions).toBeGreaterThanOrEqual(2);
      expect(metrics.successfulExecutions).toBeGreaterThanOrEqual(2);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
    });

    test('should maintain execution history', async () => {
      await executor.execute('hello-world', { name: 'Test' });

      const history = executor.getExecutionHistory(5);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].skillName).toBe('hello-world');
    });
  });
});
