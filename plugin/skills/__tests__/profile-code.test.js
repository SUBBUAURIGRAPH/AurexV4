/**
 * Profile Code Skill Tests
 *
 * Comprehensive test suite for performance profiling functionality
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const path = require('path');
const fs = require('fs');
const profileCodeSkill = require('../profile-code');

describe('Profile Code Skill', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = path.join(__dirname, 'temp-profile-code');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
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
      expect(profileCodeSkill.name).toBe('profile-code');
      expect(profileCodeSkill.version).toBe('1.0.0');
      expect(profileCodeSkill.category).toBe('performance');
      expect(profileCodeSkill.parameters).toBeDefined();
      expect(profileCodeSkill.parameters.filePath.required).toBe(true);
    });

    test('should have execute function', () => {
      expect(typeof profileCodeSkill.execute).toBe('function');
    });

    test('should have formatResult function', () => {
      expect(typeof profileCodeSkill.formatResult).toBe('function');
    });

    test('should have all parameter options', () => {
      const params = profileCodeSkill.parameters;
      expect(params.focusArea).toBeDefined();
      expect(params.focusArea.default).toBe('all');
      expect(params.detailedAnalysis).toBeDefined();
      expect(params.detailedAnalysis.default).toBe(true);
    });
  });

  describe('Function Counting', () => {
    test('should count regular functions', async () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
        function subtract(a, b) {
          return a - b;
        }
      `;
      const filePath = path.join(tempDir, 'functions.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.functions).toBeGreaterThan(0);
    });

    test('should count arrow functions', async () => {
      const code = `
        const add = (a, b) => {
          return a + b;
        };
        const subtract = (a, b) => {
          return a - b;
        };
      `;
      const filePath = path.join(tempDir, 'arrow-functions.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.functions).toBeGreaterThan(0);
    });

    test('should count function expressions', async () => {
      const code = `
        const multiply = function(a, b) {
          return a * b;
        };
      `;
      const filePath = path.join(tempDir, 'function-expr.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.functions).toBeGreaterThan(0);
    });
  });

  describe('Loop Detection', () => {
    test('should count for loops', async () => {
      const code = `
        for (let i = 0; i < 10; i++) {
          console.log(i);
        }
        for (let j = 0; j < 20; j++) {
          console.log(j);
        }
      `;
      const filePath = path.join(tempDir, 'for-loops.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.loops).toBeGreaterThan(0);
    });

    test('should count while loops', async () => {
      const code = `
        let i = 0;
        while (i < 10) {
          console.log(i);
          i++;
        }
      `;
      const filePath = path.join(tempDir, 'while-loops.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.loops).toBeGreaterThan(0);
    });

    test('should count forEach operations', async () => {
      const code = `
        arr.forEach(item => {
          console.log(item);
        });
      `;
      const filePath = path.join(tempDir, 'foreach.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.loops).toBeGreaterThan(0);
    });

    test('should count array map operations', async () => {
      const code = `
        const doubled = arr.map(x => x * 2);
      `;
      const filePath = path.join(tempDir, 'map.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.loops).toBeGreaterThan(0);
    });
  });

  describe('Async Operations Detection', () => {
    test('should count async functions', async () => {
      const code = `
        async function fetchData() {
          return await fetch('/api/data');
        }
      `;
      const filePath = path.join(tempDir, 'async.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.asyncOps).toBeGreaterThan(0);
    });

    test('should count Promise operations', async () => {
      const code = `
        new Promise((resolve, reject) => {
          resolve(42);
        }).then(result => console.log(result));
      `;
      const filePath = path.join(tempDir, 'promise.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.asyncOps).toBeGreaterThan(0);
    });

    test('should count await operations', async () => {
      const code = `
        const result = await somePromise();
        const data = await fetch('/api');
      `;
      const filePath = path.join(tempDir, 'await.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.asyncOps).toBeGreaterThan(0);
    });
  });

  describe('Recursive Function Detection', () => {
    test('should detect recursive functions', async () => {
      const code = `
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
      `;
      const filePath = path.join(tempDir, 'recursive.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.recursiveFunctions).toBeGreaterThan(0);
      expect(result.bottlenecks.length).toBeGreaterThan(0);
    });

    test('should suggest iteration replacement', async () => {
      const code = `
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
      `;
      const filePath = path.join(tempDir, 'fib.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.optimizations.length).toBeGreaterThan(0);
      expect(result.optimizations[0].title).toContain('recursion');
    });
  });

  describe('Nested Loop Detection', () => {
    test('should detect deeply nested loops', async () => {
      const code = `
        for (let i = 0; i < 10; i++) {
          for (let j = 0; j < 10; j++) {
            for (let k = 0; k < 10; k++) {
              console.log(i, j, k);
            }
          }
        }
      `;
      const filePath = path.join(tempDir, 'nested-loops.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.nestedLoops).toBeGreaterThan(0);
      expect(result.bottlenecks.length).toBeGreaterThan(0);
    });

    test('should calculate cubic complexity for triple nesting', async () => {
      const code = `
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            for (let k = 0; k < n; k++) {
              // O(n^3)
            }
          }
        }
      `;
      const filePath = path.join(tempDir, 'cubic.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.timeComplexity).toContain('^');
    });

    test('should suggest loop reduction optimization', async () => {
      const code = `
        for (let i = 0; i < 100; i++) {
          for (let j = 0; j < 100; j++) {
            for (let k = 0; k < 100; k++) {
              process.data(i, j, k);
            }
          }
        }
      `;
      const filePath = path.join(tempDir, 'loop-opt.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.optimizations.some(o => o.title.includes('nesting'))).toBe(true);
    });
  });

  describe('JSON Operations Detection', () => {
    test('should detect JSON.stringify usage', async () => {
      const code = `
        const json = JSON.stringify(data);
      `;
      const filePath = path.join(tempDir, 'stringify.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.optimizations.some(o => o.title.includes('serialization'))).toBe(true);
    });

    test('should detect JSON.parse usage', async () => {
      const code = `
        const obj = JSON.parse(jsonString);
      `;
      const filePath = path.join(tempDir, 'parse.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.optimizations.some(o => o.title.includes('serialization'))).toBe(true);
    });
  });

  describe('Regex Detection', () => {
    test('should detect RegExp compilation', async () => {
      const code = `
        const pattern = new RegExp('\\\\d+', 'g');
      `;
      const filePath = path.join(tempDir, 'regex.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      // Check if optimizations array has any items with 'regex' or 'expression' in title
      const hasRegexOptimization = result.optimizations && result.optimizations.length > 0 &&
        result.optimizations.some(o => o.title.toLowerCase().includes('regex') || o.title.toLowerCase().includes('expression'));
      expect(hasRegexOptimization).toBe(true);
    });
  });

  describe('Performance Scoring', () => {
    test('should calculate score for simple code', async () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
      `;
      const filePath = path.join(tempDir, 'simple.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('should lower score for problematic code', async () => {
      const code = `
        function slow() {
          for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 100; j++) {
              for (let k = 0; k < 100; k++) {
                // O(n^3)
              }
            }
          }
        }
      `;
      const filePath = path.join(tempDir, 'slow.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.score).toBeLessThan(100);
    });

    test('should ensure score is between 0 and 100', async () => {
      const code = `
        function test() {
          return 42;
        }
      `;
      const filePath = path.join(tempDir, 'test-score.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Detailed Analysis', () => {
    test('should include detailed metrics when enabled', async () => {
      const code = `
        const add = (a, b) => a + b;
      `;
      const filePath = path.join(tempDir, 'detailed.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          filePath,
          detailedAnalysis: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.detailedMetrics).toBeDefined();
      expect(result.detailedMetrics.linesOfCode).toBeGreaterThan(0);
      expect(result.detailedMetrics.complexity).toBeDefined();
      expect(result.detailedMetrics.asyncRatio).toBeDefined();
    });

    test('should exclude detailed metrics when disabled', async () => {
      const code = `
        const add = (a, b) => a + b;
      `;
      const filePath = path.join(tempDir, 'simple-detail.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          filePath,
          detailedAnalysis: false
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.detailedMetrics).toBeNull();
    });
  });

  describe('Result Formatting', () => {
    test('should format successful profile result', () => {
      const result = {
        success: true,
        file: '/path/to/code.js',
        metrics: {
          functions: 5,
          loops: 3,
          asyncOps: 2,
          timeComplexity: 'O(n^2)',
          recursiveFunctions: 0,
          nestedLoops: 1
        },
        bottlenecks: [
          {
            issue: 'Deeply nested loops',
            line: 10,
            impact: 'O(n^2) complexity'
          }
        ],
        optimizations: [
          {
            title: 'Reduce loop nesting',
            description: 'Nested loops create exponential complexity',
            gain: '40-70%'
          }
        ],
        score: 75
      };

      const formatted = profileCodeSkill.formatResult(result);

      expect(formatted).toContain('Performance Profile');
      expect(formatted).toContain('Performance Metrics');
      expect(formatted).toContain('Functions: 5');
      expect(formatted).toContain('Loops: 3');
      expect(formatted).toContain('Performance Score: 75/100');
    });

    test('should format failed profile result', () => {
      const result = {
        success: false,
        error: 'File not found',
        file: '/invalid/path'
      };

      const formatted = profileCodeSkill.formatResult(result);

      expect(formatted).toContain('Profiling failed');
      expect(formatted).toContain('File not found');
    });

    test('should show bottlenecks in formatted output', () => {
      const result = {
        success: true,
        file: '/test.js',
        metrics: {
          functions: 2,
          loops: 2,
          asyncOps: 0,
          timeComplexity: 'O(n)',
          recursiveFunctions: 1,
          nestedLoops: 0
        },
        bottlenecks: [
          {
            issue: 'Recursive function: factorial',
            line: 5,
            impact: 'Stack overflow risk, consider iteration'
          }
        ],
        optimizations: [
          {
            title: 'Replace recursion with iteration',
            description: 'Recursive functions can cause stack overflow',
            gain: '30-50%'
          }
        ],
        score: 90
      };

      const formatted = profileCodeSkill.formatResult(result);

      expect(formatted).toContain('Performance Bottlenecks');
      expect(formatted).toContain('Recursive function');
    });

    test('should show optimization opportunities', () => {
      const result = {
        success: true,
        file: '/test.js',
        metrics: {
          functions: 1,
          loops: 1,
          asyncOps: 0,
          timeComplexity: 'O(n)',
          recursiveFunctions: 0,
          nestedLoops: 0
        },
        bottlenecks: [],
        optimizations: [
          {
            title: 'Cache serialization results',
            description: 'JSON serialization is expensive',
            gain: '15-30%'
          }
        ],
        score: 95
      };

      const formatted = profileCodeSkill.formatResult(result);

      expect(formatted).toContain('Optimization Opportunities');
      expect(formatted).toContain('Cache serialization');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent file gracefully', async () => {
      const context = {
        parameters: { filePath: '/non/existent/file.js' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('File not found');
    });

    test('should handle empty files', async () => {
      const filePath = path.join(tempDir, 'empty.js');
      fs.writeFileSync(filePath, '');

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.functions).toBe(0);
      expect(result.metrics.loops).toBe(0);
    });

    test('should handle large files', async () => {
      let code = '';
      for (let i = 0; i < 1000; i++) {
        code += `function func${i}() { return ${i}; }\n`;
      }

      const filePath = path.join(tempDir, 'large.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.functions).toBeGreaterThan(100);
    });
  });

  describe('Bottleneck Limiting', () => {
    test('should limit bottlenecks to 5 items', async () => {
      let code = '';
      for (let i = 0; i < 10; i++) {
        code += `
          function func${i}() {
            for (let j = 0; j < 10; j++) {
              for (let k = 0; k < 10; k++) {
                for (let l = 0; l < 10; l++) {
                  // deep nesting
                }
              }
            }
          }
        `;
      }

      const filePath = path.join(tempDir, 'many-bottlenecks.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await profileCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.bottlenecks.length).toBeLessThanOrEqual(5);
    });
  });
});
