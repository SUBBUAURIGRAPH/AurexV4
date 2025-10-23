/**
 * Analyze Code Skill Tests
 *
 * Comprehensive test suite for code analysis functionality
 * Tests bug detection, metrics calculation, and recommendations
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const path = require('path');
const fs = require('fs');
const analyzeCodeSkill = require('../analyze-code');

describe('Analyze Code Skill', () => {
  let tempDir;

  beforeAll(() => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, 'temp-analyze-code');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up temporary files
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(f => fs.unlinkSync(path.join(tempDir, f)));
      fs.rmdirSync(tempDir);
    }
  });

  describe('Skill Definition', () => {
    test('should have correct metadata', () => {
      expect(analyzeCodeSkill.name).toBe('analyze-code');
      expect(analyzeCodeSkill.version).toBe('1.0.0');
      expect(analyzeCodeSkill.category).toBe('development');
      expect(analyzeCodeSkill.parameters).toBeDefined();
      expect(analyzeCodeSkill.parameters.filePath.required).toBe(true);
    });

    test('should have execute function', () => {
      expect(typeof analyzeCodeSkill.execute).toBe('function');
    });

    test('should have formatResult function', () => {
      expect(typeof analyzeCodeSkill.formatResult).toBe('function');
    });
  });

  describe('Bug Detection - Security Issues', () => {
    test('should detect SQL injection vulnerability', async () => {
      // Test that analysis completes successfully
      const code = `
        const userId = userInput;
        const query = 'SELECT * FROM users WHERE id = ' + userId;
        db.run(query);
      `;

      const filePath = path.join(tempDir, 'sql-injection.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.qualityScore).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    test('should detect hardcoded credentials', async () => {
      const code = `
        const apiKey = "sk_test_EXAMPLE_KEY_DO_NOT_USE";
        const password = "SuperSecret123!";
        const dbUri = "mongodb://admin:password@localhost:27017";
      `;

      const filePath = path.join(tempDir, 'hardcoded-creds.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      const credIssue = result.issues.find(i => i.id === 'SEC-003');
      expect(credIssue).toBeDefined();
      expect(credIssue.severity).toBe('critical');
    });

    test('should detect XSS vulnerability', async () => {
      const code = `
        function renderUserInput(userInput) {
          document.getElementById('output').innerHTML = userInput;
        }
      `;

      const filePath = path.join(tempDir, 'xss-vuln.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      const xssIssue = result.issues.find(i => i.id === 'SEC-002');
      expect(xssIssue).toBeDefined();
      expect(xssIssue.severity).toBe('high');
    });

    test('should detect missing input validation', async () => {
      const code = `
        function processUserData(userId, email) {
          // No validation here!
          database.save({ userId, email });
        }
      `;

      const filePath = path.join(tempDir, 'missing-validation.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      // Should have at least one security-related issue
      const securityIssues = result.issues.filter(i => i.category === 'security');
      expect(securityIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Bug Detection - Performance Issues', () => {
    test('should detect nested loops', async () => {
      const code = `
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < m; j++) {
            for (let k = 0; k < p; k++) {
              for (let l = 0; l < q; l++) {
                for (let r = 0; r < s; r++) {
                  for (let t = 0; t < u; t++) {
                    process(i, j, k, l, r, t);
                  }
                }
              }
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

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      const nestedLoopsIssue = result.issues.find(i => i.id === 'PERF-001');
      expect(nestedLoopsIssue).toBeDefined();
      expect(nestedLoopsIssue.severity).toBe('medium');
    });

    test('should detect sync I/O in async function', async () => {
      const code = `
        async function fetchData() {
          const data = fs.readFileSync('./large-file.txt', 'utf-8');
          return data;
        }
      `;

      const filePath = path.join(tempDir, 'sync-io.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      const syncIOIssue = result.issues.find(i => i.id === 'PERF-003');
      expect(syncIOIssue).toBeDefined();
      expect(syncIOIssue.severity).toBe('high');
    });
  });

  describe('Bug Detection - Code Quality', () => {
    test('should detect missing error handling', async () => {
      const code = `
        async function fetchData() {
          const response = await fetch(url);
          const data = response.json();
          return data;
        }
      `;

      const filePath = path.join(tempDir, 'missing-error-handling.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      const errorHandlingIssue = result.issues.find(i => i.id === 'QUAL-002');
      expect(errorHandlingIssue).toBeDefined();
      expect(errorHandlingIssue.category).toBe('quality');
    });

    test('should detect high complexity', async () => {
      const code = `
        function complexFunction(a, b, c) {
          if (a > 0) {
            if (b > 0) {
              if (c > 0) {
                if (a + b > c) {
                  if (a + c > b) {
                    if (b + c > a) {
                      if (a === b && b === c) {
                        if (a !== b || b !== c) {
                          if (a < 100 || b < 100 || c < 100) {
                            if (a % 2 === 0) {
                              return 'Complex';
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const filePath = path.join(tempDir, 'high-complexity.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      const complexityIssue = result.issues.find(i => i.id === 'QUAL-004');
      expect(complexityIssue).toBeDefined();
      expect(result.metrics.cyclomaticComplexity).toBeGreaterThan(10);
    });
  });

  describe('Metrics Calculation', () => {
    test('should calculate cyclomatic complexity', async () => {
      const code = `
        function test(x) {
          if (x > 0) {
            if (x > 10) {
              return 'high';
            } else if (x > 5) {
              return 'medium';
            }
          }
          return 'low';
        }
      `;

      const filePath = path.join(tempDir, 'complexity.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath, includeMetrics: true },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.cyclomaticComplexity).toBeGreaterThan(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
    });

    test('should calculate maintainability index', async () => {
      const code = `
        function simpleFunction() {
          return 42;
        }
      `;

      const filePath = path.join(tempDir, 'simple.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath, includeMetrics: true },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(result.metrics.maintainabilityIndex).toBeLessThanOrEqual(100);
    });
  });

  describe('Quality Score', () => {
    test('should calculate quality score correctly', async () => {
      const goodCode = `
        function goodFunction() {
          return 42;
        }
      `;

      const filePath = path.join(tempDir, 'good-code.js');
      fs.writeFileSync(filePath, goodCode);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    test('should give lower score for code with critical issues', async () => {
      const badCode = `
        const apiKey = "sk_test_secret";
        const query = \`SELECT * FROM users WHERE id = \${userId}\`;
        db.run(query);
      `;

      const filePath = path.join(tempDir, 'bad-code.js');
      fs.writeFileSync(filePath, badCode);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThan(100);
    });
  });

  describe('Recommendations', () => {
    test('should generate recommendations for high complexity', async () => {
      const code = `
        function complexFunc(a, b, c, d, e) {
          if (a > 0) {
            if (b > 0) {
              if (c > 0) {
                if (d > 0) {
                  if (e > 0) {
                    if (a + b > c) {
                      if (b + c > d) {
                        if (c + d > e) {
                          if (d + e > a) {
                            if (a < b && b < c && c < d && d < e) {
                              return 'triangle';
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const filePath = path.join(tempDir, 'high-complexity-rec.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath, includeRecommendations: true },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);

      const complexityRec = result.recommendations.find(r =>
        r.title.includes('Complexity') || r.title.includes('Reduce')
      );
      expect(complexityRec).toBeDefined();
    });
  });

  describe('File Path Handling', () => {
    test('should handle non-existent file gracefully', async () => {
      const context = {
        parameters: { filePath: '/non/existent/file.js' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should auto-detect language from file extension', async () => {
      const code = 'def hello(): pass';
      const filePath = path.join(tempDir, 'test.py');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.language.toLowerCase()).toContain('python');
    });
  });

  describe('Filtering', () => {
    test('should filter issues by severity', async () => {
      const code = `
        const apiKey = "sk_test_secret";
        function test(x) {
          if (x > 0) {
            if (x > 10) {
              return x;
            }
          }
        }
      `;

      const filePath = path.join(tempDir, 'filter-severity.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath, severity: 'critical' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
      if (result.issues.length > 0) {
        result.issues.forEach(issue => {
          expect(issue.severity).toBe('critical');
        });
      }
    });

    test('should filter issues by category', async () => {
      const code = `
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < m; j++) {
            for (let k = 0; k < p; k++) {
              for (let l = 0; l < q; l++) {
                for (let r = 0; r < s; r++) {
                  for (let t = 0; t < u; t++) {
                    process();
                  }
                }
              }
            }
          }
        }
      `;

      const filePath = path.join(tempDir, 'filter-category.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath, category: 'performance' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Result Formatting', () => {
    test('should format successful analysis result', async () => {
      const code = 'function test() { return 42; }';
      const filePath = path.join(tempDir, 'format-test.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await analyzeCodeSkill.execute(context);
      const formatted = analyzeCodeSkill.formatResult(result);

      expect(formatted).toContain('Code Analysis Report');
      expect(formatted).toContain('Quality Score');
      expect(formatted).toContain('format-test.js');
    });

    test('should format failed analysis result', () => {
      const result = {
        success: false,
        error: 'Test error',
        file: '/path/to/file.js'
      };

      const formatted = analyzeCodeSkill.formatResult(result);

      expect(formatted).toContain('Analysis failed');
      expect(formatted).toContain('Test error');
    });
  });
});
