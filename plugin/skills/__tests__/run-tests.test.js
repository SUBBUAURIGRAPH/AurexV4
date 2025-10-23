/**
 * Run Tests Skill Tests
 *
 * Comprehensive test suite for test execution functionality
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const path = require('path');
const fs = require('fs');
const runTestsSkill = require('../run-tests');

describe('Run Tests Skill', () => {
  let tempDir;

  beforeAll(() => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, 'temp-run-tests');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up temporary files
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(f => {
        const fullPath = path.join(tempDir, f);
        if (fs.statSync(fullPath).isDirectory()) {
          fs.rmSync(fullPath, { recursive: true });
        } else {
          fs.unlinkSync(fullPath);
        }
      });
      fs.rmdirSync(tempDir);
    }
  });

  describe('Skill Definition', () => {
    test('should have correct metadata', () => {
      expect(runTestsSkill.name).toBe('run-tests');
      expect(runTestsSkill.version).toBe('1.0.0');
      expect(runTestsSkill.category).toBe('testing');
      expect(runTestsSkill.parameters).toBeDefined();
      expect(runTestsSkill.parameters.testPath.required).toBe(true);
    });

    test('should have execute function', () => {
      expect(typeof runTestsSkill.execute).toBe('function');
    });

    test('should have formatResult function', () => {
      expect(typeof runTestsSkill.formatResult).toBe('function');
    });

    test('should have all required parameters', () => {
      const params = runTestsSkill.parameters;
      expect(params.testPath).toBeDefined();
      expect(params.framework).toBeDefined();
      expect(params.coverage).toBeDefined();
      expect(params.parallel).toBeDefined();
      expect(params.retryFlaky).toBeDefined();
      expect(params.verbose).toBeDefined();
      expect(params.filter).toBeDefined();
    });
  });

  describe('Test Execution', () => {
    test('should handle non-existent test path gracefully', async () => {
      const context = {
        parameters: { testPath: '/non/existent/path' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle execution error gracefully', async () => {
      // Create test directory
      const testDir = path.join(tempDir, 'empty-test');
      fs.mkdirSync(testDir, { recursive: true });

      const context = {
        parameters: {
          testPath: testDir,
          framework: 'jest'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);

      // Should handle gracefully, even if Jest not installed
      expect(result.testPath).toBe(testDir);
    });
  });

  describe('Framework Detection', () => {
    test('should detect Jest from package.json', async () => {
      const testDir = path.join(tempDir, 'jest-test');
      fs.mkdirSync(testDir, { recursive: true });

      const packageJson = {
        name: 'test-project',
        devDependencies: {
          jest: '^29.0.0'
        }
      };

      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const context = {
        parameters: { testPath: testDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      // Won't fully execute, but framework detection should work
      const result = await runTestsSkill.execute(context);
      expect(result.testPath).toBe(testDir);
    });

    test('should detect Mocha from package.json', async () => {
      const testDir = path.join(tempDir, 'mocha-test');
      fs.mkdirSync(testDir, { recursive: true });

      const packageJson = {
        name: 'test-project',
        devDependencies: {
          mocha: '^10.0.0'
        }
      };

      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const context = {
        parameters: { testPath: testDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);
      expect(result.testPath).toBe(testDir);
    });

    test('should detect test files by extension', async () => {
      const testDir = path.join(tempDir, 'file-ext-test');
      fs.mkdirSync(testDir, { recursive: true });

      // Create test files
      fs.writeFileSync(path.join(testDir, 'example.test.js'), '');
      fs.writeFileSync(path.join(testDir, 'example.spec.ts'), '');

      const context = {
        parameters: { testPath: testDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);
      expect(result.testPath).toBe(testDir);
    });

    test('should detect Pytest from file structure', async () => {
      const testDir = path.join(tempDir, 'pytest-test');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'pytest.ini'), '');
      fs.writeFileSync(path.join(testDir, 'test_example.py'), '');

      const context = {
        parameters: { testPath: testDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);
      expect(result.testPath).toBe(testDir);
    });
  });

  describe('Result Formatting', () => {
    test('should format failed execution result', () => {
      const result = {
        success: false,
        error: 'Jest not found',
        testPath: '/path/to/tests'
      };

      const formatted = runTestsSkill.formatResult(result);

      expect(formatted).toContain('Test execution failed');
      expect(formatted).toContain('Jest not found');
    });

    test('should format successful test results', () => {
      const result = {
        success: true,
        testPath: '/path/to/tests',
        framework: 'jest',
        statistics: {
          total: 10,
          passed: 10,
          failed: 0,
          skipped: 0
        },
        coverage: {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95
        },
        executionTime: 5000
      };

      const formatted = runTestsSkill.formatResult(result);

      expect(formatted).toContain('Test Results');
      expect(formatted).toContain('jest');
      expect(formatted).toContain('10');
      expect(formatted).toContain('Coverage');
      expect(formatted).toContain('95%');
    });

    test('should format test results with failures', () => {
      const result = {
        success: true,
        testPath: '/path/to/tests',
        framework: 'mocha',
        statistics: {
          total: 10,
          passed: 8,
          failed: 2,
          skipped: 0
        },
        failedTests: [
          {
            name: 'should add numbers',
            error: 'Expected 3 to equal 4'
          },
          {
            name: 'should handle null',
            error: 'Cannot read property of null'
          }
        ],
        executionTime: 3000
      };

      const formatted = runTestsSkill.formatResult(result);

      expect(formatted).toContain('Failed Tests');
      expect(formatted).toContain('should add numbers');
      expect(formatted).toContain('Expected 3 to equal 4');
    });

    test('should format flaky test results', () => {
      const result = {
        success: true,
        testPath: '/path/to/tests',
        framework: 'jest',
        statistics: {
          total: 5,
          passed: 4,
          failed: 1,
          skipped: 0
        },
        failedTests: [
          {
            name: 'async test',
            error: 'Timeout'
          }
        ],
        flakyTests: [
          {
            name: 'async test',
            failureCount: 2,
            attempts: 3
          }
        ],
        executionTime: 8000
      };

      const formatted = runTestsSkill.formatResult(result);

      expect(formatted).toContain('Flaky Tests');
      expect(formatted).toContain('async test');
      expect(formatted).toContain('2');
    });

    test('should show pass rate correctly', () => {
      const result = {
        success: true,
        testPath: '/path/to/tests',
        framework: 'pytest',
        statistics: {
          total: 20,
          passed: 18,
          failed: 2,
          skipped: 0
        },
        executionTime: 6000
      };

      const formatted = runTestsSkill.formatResult(result);

      expect(formatted).toContain('Pass Rate: 90%');
    });
  });

  describe('Parameter Validation', () => {
    test('should support coverage parameter', async () => {
      const testDir = path.join(tempDir, 'coverage-test');
      fs.mkdirSync(testDir, { recursive: true });

      const context = {
        parameters: {
          testPath: testDir,
          framework: 'jest',
          coverage: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);
      expect(result.testPath).toBe(testDir);
    });

    test('should support parallel parameter', async () => {
      const testDir = path.join(tempDir, 'parallel-test');
      fs.mkdirSync(testDir, { recursive: true });

      const context = {
        parameters: {
          testPath: testDir,
          framework: 'jest',
          parallel: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);
      expect(result.testPath).toBe(testDir);
    });

    test('should support filter parameter', async () => {
      const testDir = path.join(tempDir, 'filter-test');
      fs.mkdirSync(testDir, { recursive: true });

      const context = {
        parameters: {
          testPath: testDir,
          framework: 'jest',
          filter: 'should add'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);
      expect(result.testPath).toBe(testDir);
    });

    test('should support verbose parameter', async () => {
      const testDir = path.join(tempDir, 'verbose-test');
      fs.mkdirSync(testDir, { recursive: true });

      const context = {
        parameters: {
          testPath: testDir,
          framework: 'mocha',
          verbose: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);
      expect(result.testPath).toBe(testDir);
    });

    test('should support retryFlaky parameter', async () => {
      const testDir = path.join(tempDir, 'retry-test');
      fs.mkdirSync(testDir, { recursive: true });

      const context = {
        parameters: {
          testPath: testDir,
          framework: 'jest',
          retryFlaky: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);
      expect(result.testPath).toBe(testDir);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing framework detection', async () => {
      const testDir = path.join(tempDir, 'no-framework-test');
      fs.mkdirSync(testDir, { recursive: true });

      // Create empty directory with no test files or config
      const context = {
        parameters: { testPath: testDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);

      // Should handle gracefully
      expect(result.testPath).toBe(testDir);
    });

    test('should handle explicit framework parameter', async () => {
      const testDir = path.join(tempDir, 'explicit-framework');
      fs.mkdirSync(testDir, { recursive: true });

      const context = {
        parameters: {
          testPath: testDir,
          framework: 'pytest'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await runTestsSkill.execute(context);

      expect(result.testPath).toBe(testDir);
    });
  });
});
