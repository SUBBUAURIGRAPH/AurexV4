/**
 * Comprehensive Review Skill Tests
 *
 * Comprehensive test suite for unified code review functionality
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const path = require('path');
const fs = require('fs');
const comprehensiveReviewSkill = require('../comprehensive-review');

describe('Comprehensive Review Skill', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = path.join(__dirname, 'temp-comprehensive-review');
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
      expect(comprehensiveReviewSkill.name).toBe('comprehensive-review');
      expect(comprehensiveReviewSkill.version).toBe('1.0.0');
      expect(comprehensiveReviewSkill.category).toBe('review');
      expect(comprehensiveReviewSkill.parameters).toBeDefined();
      expect(comprehensiveReviewSkill.parameters.projectPath.required).toBe(true);
    });

    test('should have execute function', () => {
      expect(typeof comprehensiveReviewSkill.execute).toBe('function');
    });

    test('should have formatResult function', () => {
      expect(typeof comprehensiveReviewSkill.formatResult).toBe('function');
    });

    test('should have review depth options', () => {
      const params = comprehensiveReviewSkill.parameters;
      expect(params.depth).toBeDefined();
      expect(params.depth.default).toBe('standard');
    });
  });

  describe('Project Review Execution', () => {
    test('should review simple project', async () => {
      const projectDir = path.join(tempDir, 'simple-project');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() { return 42; }');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.overallScore).toBeDefined();
    });

    test('should review multi-file project', async () => {
      const projectDir = path.join(tempDir, 'multi-file-project');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function main() {}');
      fs.writeFileSync(path.join(projectDir, 'utils.js'), 'function util() {}');
      fs.writeFileSync(path.join(projectDir, 'config.js'), 'const config = {};');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.summary.filesAnalyzed).toBeGreaterThan(0);
    });

    test('should review TypeScript project', async () => {
      const projectDir = path.join(tempDir, 'ts-project');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'main.ts'), 'export function test(): number { return 42; }');
      fs.writeFileSync(path.join(projectDir, 'types.ts'), 'export interface User { name: string; }');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.categories).toBeDefined();
    });
  });

  describe('Review Depth Levels', () => {
    test('should support quick review depth', async () => {
      const projectDir = path.join(tempDir, 'quick-review');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'const x = 1;');

      const context = {
        parameters: {
          projectPath: projectDir,
          depth: 'quick'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.depth).toBe('quick');
    });

    test('should support standard review depth', async () => {
      const projectDir = path.join(tempDir, 'standard-review');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          depth: 'standard'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.depth).toBe('standard');
    });

    test('should support thorough review depth', async () => {
      const projectDir = path.join(tempDir, 'thorough-review');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function complex() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          depth: 'thorough'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.depth).toBe('thorough');
    });

    test('should support complete review depth', async () => {
      const projectDir = path.join(tempDir, 'complete-review');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function complete() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          depth: 'complete'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.depth).toBe('complete');
    });
  });

  describe('Review Summary', () => {
    test('should include overall score in summary', async () => {
      const projectDir = path.join(tempDir, 'score-review');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.overallScore).toBeLessThanOrEqual(100);
    });

    test('should calculate issue severity counts', async () => {
      const projectDir = path.join(tempDir, 'severity-review');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.summary.criticalCount).toBeDefined();
      expect(result.summary.highCount).toBeDefined();
      expect(result.summary.mediumCount).toBeDefined();
      expect(result.summary.lowCount).toBeDefined();
    });

    test('should count analyzed files', async () => {
      const projectDir = path.join(tempDir, 'file-count-review');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'file1.js'), 'function f1() {}');
      fs.writeFileSync(path.join(projectDir, 'file2.js'), 'function f2() {}');
      fs.writeFileSync(path.join(projectDir, 'file3.js'), 'function f3() {}');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.summary.filesAnalyzed).toBe(3);
    });
  });

  describe('Analysis Categories', () => {
    test('should include quality analysis', async () => {
      const projectDir = path.join(tempDir, 'quality-analysis');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.categories.quality).toBeDefined();
      expect(result.categories.quality.score).toBeDefined();
    });

    test('should include security analysis', async () => {
      const projectDir = path.join(tempDir, 'security-analysis');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'const key = "secret";');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.categories.security).toBeDefined();
      expect(result.categories.security.score).toBeDefined();
    });

    test('should include performance analysis', async () => {
      const projectDir = path.join(tempDir, 'performance-analysis');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function slow() {}');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.categories.performance).toBeDefined();
      expect(result.categories.performance.score).toBeDefined();
    });

    test('should include testing analysis', async () => {
      const projectDir = path.join(tempDir, 'testing-analysis');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.test.js'), 'test("test", () => {});');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.categories.testing).toBeDefined();
      expect(result.categories.testing.score).toBeDefined();
    });

    test('should include documentation analysis', async () => {
      const projectDir = path.join(tempDir, 'documentation-analysis');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'README.md'), '# Project');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.categories.documentation).toBeDefined();
      expect(result.categories.documentation.score).toBeDefined();
    });
  });

  describe('Recommendations', () => {
    test('should generate recommendations', async () => {
      const projectDir = path.join(tempDir, 'recommendations');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should include priority levels in recommendations', async () => {
      const projectDir = path.join(tempDir, 'priority-recommendations');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      result.recommendations.forEach(rec => {
        expect(['critical', 'high', 'medium', 'low']).toContain(rec.priority);
      });
    });

    test('should include impact description in recommendations', async () => {
      const projectDir = path.join(tempDir, 'impact-recommendations');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      result.recommendations.forEach(rec => {
        expect(rec.impact).toBeDefined();
        expect(typeof rec.impact).toBe('string');
      });
    });
  });

  describe('Metrics', () => {
    test('should include metrics when enabled', async () => {
      const projectDir = path.join(tempDir, 'metrics-enabled');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          includeMetrics: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
    });

    test('should exclude metrics when disabled', async () => {
      const projectDir = path.join(tempDir, 'metrics-disabled');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          includeMetrics: false
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeNull();
    });

    test('should include code complexity metric', async () => {
      const projectDir = path.join(tempDir, 'complexity-metric');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          includeMetrics: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.complexity).toBeDefined();
    });

    test('should include maintainability metric', async () => {
      const projectDir = path.join(tempDir, 'maintainability-metric');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          includeMetrics: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.maintainability).toBeDefined();
    });

    test('should include technical debt metric', async () => {
      const projectDir = path.join(tempDir, 'debt-metric');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          includeMetrics: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metrics.technicalDebt).toBeDefined();
    });
  });

  describe('Output Formats', () => {
    test('should support summary output format', async () => {
      const projectDir = path.join(tempDir, 'summary-format');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          outputFormat: 'summary'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.format).toBe('summary');
    });

    test('should support detailed output format', async () => {
      const projectDir = path.join(tempDir, 'detailed-format');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          outputFormat: 'detailed'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.format).toBe('detailed');
    });

    test('should support JSON output format', async () => {
      const projectDir = path.join(tempDir, 'json-format');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');

      const context = {
        parameters: {
          projectPath: projectDir,
          outputFormat: 'json'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
    });
  });

  describe('Result Formatting', () => {
    test('should format comprehensive review result', () => {
      const result = {
        success: true,
        path: '/project',
        summary: {
          overallScore: 75,
          depth: 'standard',
          filesAnalyzed: 5,
          totalIssues: 10,
          criticalCount: 1,
          highCount: 2,
          mediumCount: 4,
          lowCount: 3
        },
        categories: {
          quality: { score: 70, issues: 5, patterns: 2 },
          security: { score: 80, vulnerabilities: 2, secrets: 0 },
          performance: { score: 75, bottlenecks: 1, optimizations: 2 },
          testing: { score: 65, testCount: 10, coverage: 60 },
          documentation: { score: 70, documented: 15, total: 25 }
        },
        recommendations: [
          { priority: 'high', title: 'Improve test coverage', impact: 'High' }
        ]
      };

      const formatted = comprehensiveReviewSkill.formatResult(result);

      expect(formatted).toContain('COMPREHENSIVE CODE REVIEW');
      expect(formatted).toContain('Overall Health Score: 75/100');
      expect(formatted).toContain('Files Analyzed: 5');
      expect(formatted).toContain('Issues Found: 10');
    });

    test('should format failed review result', () => {
      const result = {
        success: false,
        error: 'Project path not found',
        path: '/invalid/path'
      };

      const formatted = comprehensiveReviewSkill.formatResult(result);

      expect(formatted).toContain('failed');
      expect(formatted).toContain('Project path not found');
    });

    test('should show categories in formatted output', () => {
      const result = {
        success: true,
        path: '/project',
        summary: {
          overallScore: 80,
          depth: 'standard',
          filesAnalyzed: 3,
          totalIssues: 5,
          criticalCount: 0,
          highCount: 1,
          mediumCount: 2,
          lowCount: 2
        },
        categories: {
          quality: { score: 80, issues: 2, patterns: 1 },
          security: { score: 85, vulnerabilities: 1, secrets: 0 },
          performance: { score: 75, bottlenecks: 1, optimizations: 1 },
          testing: { score: 80, testCount: 20, coverage: 75 },
          documentation: { score: 80, documented: 20, total: 25 }
        },
        recommendations: []
      };

      const formatted = comprehensiveReviewSkill.formatResult(result);

      expect(formatted).toContain('ANALYSIS BY CATEGORY');
      expect(formatted).toContain('Code Quality');
      expect(formatted).toContain('Security');
      expect(formatted).toContain('Performance');
    });

    test('should show recommendations in formatted output', () => {
      const result = {
        success: true,
        path: '/project',
        summary: {
          overallScore: 60,
          depth: 'standard',
          filesAnalyzed: 2,
          totalIssues: 15,
          criticalCount: 2,
          highCount: 4,
          mediumCount: 6,
          lowCount: 3
        },
        categories: {
          quality: { score: 60, issues: 8, patterns: 4 },
          security: { score: 70, vulnerabilities: 3, secrets: 1 },
          performance: { score: 60, bottlenecks: 3, optimizations: 5 },
          testing: { score: 50, testCount: 5, coverage: 40 },
          documentation: { score: 55, documented: 10, total: 30 }
        },
        recommendations: [
          { priority: 'critical', title: 'Address security issues', impact: 'Critical' },
          { priority: 'high', title: 'Increase test coverage', impact: 'High' }
        ]
      };

      const formatted = comprehensiveReviewSkill.formatResult(result);

      expect(formatted).toContain('TOP RECOMMENDATIONS');
      expect(formatted).toContain('critical');
      expect(formatted).toContain('security');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent project path', async () => {
      const context = {
        parameters: { projectPath: '/non/existent/project' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should handle empty project directory', async () => {
      const projectDir = path.join(tempDir, 'empty-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.summary.filesAnalyzed).toBe(0);
    });

    test('should skip node_modules directory', async () => {
      const projectDir = path.join(tempDir, 'skip-nodemodules');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'node_modules'), { recursive: true });

      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');
      fs.writeFileSync(path.join(projectDir, 'node_modules', 'lib.js'), 'function lib() {}');

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.summary.filesAnalyzed).toBe(1);
    });

    test('should handle review timeout gracefully', async () => {
      const projectDir = path.join(tempDir, 'large-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create many files
      for (let i = 0; i < 50; i++) {
        fs.writeFileSync(path.join(projectDir, 'file' + i + '.js'), 'function f' + i + '() {}');
      }

      const context = {
        parameters: { projectPath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await comprehensiveReviewSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.summary.filesAnalyzed).toBeGreaterThan(0);
    });
  });
});
