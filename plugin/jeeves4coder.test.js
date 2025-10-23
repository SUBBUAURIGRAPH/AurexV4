/**
 * Jeeves4Coder Plugin - Unit Tests
 * Test suite for plugin functionality
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const Jeeves4CoderPlugin = require('./jeeves4coder');

describe('Jeeves4Coder Plugin', () => {
  let plugin;

  beforeEach(() => {
    plugin = new Jeeves4CoderPlugin({ verbose: false });
  });

  // ============================================================================
  // Plugin Initialization Tests
  // ============================================================================

  describe('Plugin Initialization', () => {
    test('should create plugin instance', () => {
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('Jeeves4Coder');
      expect(plugin.version).toBe('1.0.0');
    });

    test('should have default configuration', () => {
      expect(plugin.config.debug).toBe(false);
      expect(plugin.config.verbose).toBe(false);
      expect(plugin.config.reviewDepth).toBe('standard');
      expect(plugin.config.outputFormat).toBe('detailed');
    });

    test('should accept custom configuration', () => {
      const customPlugin = new Jeeves4CoderPlugin({
        debug: true,
        verbose: true,
        reviewDepth: 'deep',
        outputFormat: 'brief'
      });

      expect(customPlugin.config.debug).toBe(true);
      expect(customPlugin.config.verbose).toBe(true);
      expect(customPlugin.config.reviewDepth).toBe('deep');
      expect(customPlugin.config.outputFormat).toBe('brief');
    });
  });

  // ============================================================================
  // Skills Tests
  // ============================================================================

  describe('Skills', () => {
    test('should have 8 skills', () => {
      const skills = plugin.getSkills();
      expect(Object.keys(skills).length).toBe(8);
    });

    test('should include code-review skill', () => {
      const skills = plugin.getSkills();
      expect(skills['code-review']).toBeDefined();
      expect(skills['code-review'].name).toBe('Code Review & Analysis');
    });

    test('should include all required skills', () => {
      const skills = plugin.getSkills();
      const requiredSkills = [
        'code-review',
        'refactor-code',
        'architecture-review',
        'optimize-performance',
        'design-pattern-suggest',
        'test-strategy',
        'documentation-improve',
        'security-audit'
      ];

      requiredSkills.forEach(skill => {
        expect(skills[skill]).toBeDefined();
      });
    });

    test('skills should have required properties', () => {
      const skills = plugin.getSkills();
      const skill = skills['code-review'];

      expect(skill.name).toBeDefined();
      expect(skill.description).toBeDefined();
      expect(skill.duration).toBeDefined();
      expect(skill.parameters).toBeDefined();
      expect(skill.output).toBeDefined();
    });
  });

  // ============================================================================
  // Language Support Tests
  // ============================================================================

  describe('Language Support', () => {
    test('should support 10+ languages', () => {
      const languages = plugin.getLanguages();
      expect(Object.keys(languages).length).toBeGreaterThanOrEqual(10);
    });

    test('should support JavaScript', () => {
      const languages = plugin.getLanguages();
      expect(languages.javascript).toBeDefined();
      expect(languages.javascript.expertise).toBe('expert');
    });

    test('should support Python', () => {
      const languages = plugin.getLanguages();
      expect(languages.python).toBeDefined();
      expect(languages.python.expertise).toBe('expert');
    });

    test('should support TypeScript', () => {
      const languages = plugin.getLanguages();
      expect(languages.typescript).toBeDefined();
      expect(languages.typescript.expertise).toBe('expert');
    });

    test('languages should include frameworks', () => {
      const languages = plugin.getLanguages();
      expect(languages.javascript.frameworks).toBeDefined();
      expect(Array.isArray(languages.javascript.frameworks)).toBe(true);
    });
  });

  // ============================================================================
  // Framework Support Tests
  // ============================================================================

  describe('Framework Support', () => {
    test('should have framework categories', () => {
      const frameworks = plugin.getFrameworks();
      expect(frameworks.frontend).toBeDefined();
      expect(frameworks.backend).toBeDefined();
      expect(frameworks.cloud).toBeDefined();
      expect(frameworks.devops).toBeDefined();
      expect(frameworks.database).toBeDefined();
    });

    test('should support React', () => {
      const frameworks = plugin.getFrameworks();
      const react = frameworks.frontend.react;
      expect(react).toBeDefined();
      expect(react.expertise).toBe('expert');
    });

    test('should support Node.js and Express', () => {
      const frameworks = plugin.getFrameworks();
      expect(frameworks.backend['node.js']).toBeDefined();
      expect(frameworks.backend.express).toBeDefined();
    });

    test('should support Docker and Kubernetes', () => {
      const frameworks = plugin.getFrameworks();
      expect(frameworks.devops.docker).toBeDefined();
      expect(frameworks.devops.kubernetes).toBeDefined();
    });
  });

  // ============================================================================
  // Design Patterns Tests
  // ============================================================================

  describe('Design Patterns', () => {
    test('should have pattern categories', () => {
      const patterns = plugin.getPatterns();
      expect(patterns.creational).toBeDefined();
      expect(patterns.structural).toBeDefined();
      expect(patterns.behavioral).toBeDefined();
      expect(patterns.architectural).toBeDefined();
    });

    test('should include creational patterns', () => {
      const patterns = plugin.getPatterns();
      expect(patterns.creational.length).toBeGreaterThan(0);
      expect(patterns.creational).toContain('Singleton');
      expect(patterns.creational).toContain('Factory');
    });

    test('should include structural patterns', () => {
      const patterns = plugin.getPatterns();
      expect(patterns.structural.length).toBeGreaterThan(0);
      expect(patterns.structural).toContain('Decorator');
      expect(patterns.structural).toContain('Adapter');
    });

    test('should include behavioral patterns', () => {
      const patterns = plugin.getPatterns();
      expect(patterns.behavioral.length).toBeGreaterThan(0);
      expect(patterns.behavioral).toContain('Observer');
      expect(patterns.behavioral).toContain('Strategy');
    });

    test('should include architectural patterns', () => {
      const patterns = plugin.getPatterns();
      expect(patterns.architectural.length).toBeGreaterThan(0);
      expect(patterns.architectural).toContain('MVC');
      expect(patterns.architectural).toContain('Microservices');
    });
  });

  // ============================================================================
  // Code Review Tests
  // ============================================================================

  describe('Code Review', () => {
    const simpleCode = `
      function add(a, b) {
        return a + b;
      }
    `;

    const complexCode = `
      function processData(data) {
        let result = [];
        for (let i = 0; i < data.length; i++) {
          if (data[i] > 10) {
            if (data[i] % 2 === 0) {
              result.push(data[i] * 2);
            }
          }
        }
        return result;
      }
    `;

    test('should perform code review', async () => {
      const review = await plugin.executeCodeReview({
        code: simpleCode,
        language: 'javascript'
      });

      expect(review).toBeDefined();
      expect(review.summary).toBeDefined();
      expect(review.strengths).toBeDefined();
      expect(review.issues).toBeDefined();
      expect(review.suggestions).toBeDefined();
      expect(review.metrics).toBeDefined();
    });

    test('review should have timestamp', async () => {
      const review = await plugin.executeCodeReview({
        code: simpleCode,
        language: 'javascript'
      });

      expect(review.timestamp).toBeDefined();
      expect(new Date(review.timestamp)).toBeInstanceOf(Date);
    });

    test('should identify issues in code', async () => {
      const review = await plugin.executeCodeReview({
        code: complexCode,
        language: 'javascript'
      });

      expect(review.issues).toBeDefined();
      expect(review.issues.critical || review.issues.major || review.issues.minor).toBeDefined();
    });

    test('should provide metrics', async () => {
      const review = await plugin.executeCodeReview({
        code: simpleCode,
        language: 'javascript'
      });

      expect(review.metrics.lines).toBeDefined();
      expect(review.metrics.complexity).toBeDefined();
      expect(review.metrics.documentationRatio).toBeDefined();
    });

    test('should provide recommendations', async () => {
      const review = await plugin.executeCodeReview({
        code: simpleCode,
        language: 'javascript'
      });

      expect(review.recommendations).toBeDefined();
      expect(Array.isArray(review.recommendations)).toBe(true);
    });
  });

  // ============================================================================
  // Code Quality Helper Tests
  // ============================================================================

  describe('Code Quality Helpers', () => {
    test('should detect complexity', () => {
      const simpleCode = 'const x = 5;';
      const complexCode = 'if (a) { if (b) { if (c) { for (let i = 0; i < 10; i++) {} } } }';

      const simpleComplexity = plugin.calculateComplexity(simpleCode);
      const complexComplexity = plugin.calculateComplexity(complexCode);

      expect(simpleComplexity).toBeLessThan(complexComplexity);
      expect(complexComplexity).toBeGreaterThan(0);
      expect(complexComplexity).toBeLessThanOrEqual(10);
    });

    test('should check for magic numbers', () => {
      const withMagicNumbers = 'const timeout = 5000; const retries = 3;';
      const withoutMagicNumbers = 'const timeout = retries;';

      expect(plugin.hasMagicNumbers(withMagicNumbers)).toBe(true);
      expect(plugin.hasMagicNumbers(withoutMagicNumbers)).toBe(false);
    });

    test('should detect documentation', () => {
      const documented = `
        /**
         * Add two numbers
         * @param a First number
         * @param b Second number
         * @returns Sum of a and b
         */
        function add(a, b) {
          return a + b;
        }
      `;

      const undocumented = `
        function add(a, b) {
          return a + b;
        }
      `;

      expect(plugin.hasDocumentation(documented)).toBe(true);
      expect(plugin.hasDocumentation(undocumented)).toBe(false);
    });

    test('should detect error handling', () => {
      const withErrorHandling = `
        try {
          riskyOperation();
        } catch (error) {
          console.error(error);
        }
      `;

      const withoutErrorHandling = 'riskyOperation();';

      expect(plugin.hasErrorHandling(withErrorHandling)).toBe(true);
      expect(plugin.hasErrorHandling(withoutErrorHandling)).toBe(false);
    });
  });

  // ============================================================================
  // Output Formatting Tests
  // ============================================================================

  describe('Output Formatting', () => {
    const mockReview = {
      summary: { lineCount: 10, complexity: 5 },
      strengths: ['Good structure'],
      issues: { critical: [], major: [], minor: [] },
      suggestions: [{ type: 'Refactoring' }],
      metrics: { lines: 10 },
      recommendations: [{ priority: 1, title: 'Security' }],
      timestamp: new Date().toISOString()
    };

    test('should format output as brief', () => {
      const formatted = plugin.formatOutput(mockReview, 'brief');
      expect(formatted.summary).toBeDefined();
      expect(formatted.issues).toBeDefined();
      expect(formatted.recommendations).toBeDefined();
      expect(formatted.recommendations.length).toBeLessThanOrEqual(3);
    });

    test('should format output as standard', () => {
      const formatted = plugin.formatOutput(mockReview, 'standard');
      expect(formatted.summary).toBeDefined();
      expect(formatted.strengths).toBeDefined();
      expect(formatted.issues).toBeDefined();
      expect(formatted.suggestions).toBeDefined();
      expect(formatted.recommendations).toBeDefined();
    });

    test('should format output as detailed', () => {
      const formatted = plugin.formatOutput(mockReview, 'detailed');
      expect(formatted.summary).toBeDefined();
      expect(formatted.strengths).toBeDefined();
      expect(formatted.issues).toBeDefined();
      expect(formatted.suggestions).toBeDefined();
      expect(formatted.metrics).toBeDefined();
      expect(formatted.recommendations).toBeDefined();
      expect(formatted.timestamp).toBeDefined();
    });
  });

  // ============================================================================
  // Plugin Information Tests
  // ============================================================================

  describe('Plugin Information', () => {
    test('should provide plugin info', () => {
      const info = plugin.getInfo();
      expect(info.name).toBe('Jeeves4Coder');
      expect(info.version).toBe('1.0.0');
      expect(info.skills).toBe(8);
      expect(info.languages).toBe(10);
    });

    test('info should include frameworks', () => {
      const info = plugin.getInfo();
      expect(info.frameworks).toBeDefined();
      expect(Array.isArray(info.frameworks) || typeof info.frameworks === 'object').toBe(true);
    });

    test('info should include pattern count', () => {
      const info = plugin.getInfo();
      expect(info.patterns).toBeDefined();
      expect(info.patterns).toBeGreaterThan(20);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle missing code parameter', async () => {
      try {
        await plugin.executeCodeReview({
          language: 'javascript'
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Code parameter is required');
      }
    });

    test('should handle empty code gracefully', async () => {
      const review = await plugin.executeCodeReview({
        code: '',
        language: 'javascript'
      });

      expect(review).toBeDefined();
      expect(review.summary).toBeDefined();
    });

    test('should handle invalid language gracefully', async () => {
      const review = await plugin.executeCodeReview({
        code: 'const x = 5;',
        language: 'unknown-language'
      });

      expect(review).toBeDefined();
      expect(review.summary).toBeDefined();
    });
  });
});

/**
 * Run tests with: npm test jeeves4coder.test.js
 */
