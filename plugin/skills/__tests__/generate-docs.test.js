/**
 * Generate Docs Skill Tests
 *
 * Comprehensive test suite for documentation generation functionality
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const path = require('path');
const fs = require('fs');
const generateDocsSkill = require('../generate-docs');

describe('Generate Docs Skill', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = path.join(__dirname, 'temp-generate-docs');
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
      expect(generateDocsSkill.name).toBe('generate-docs');
      expect(generateDocsSkill.version).toBe('1.0.0');
      expect(generateDocsSkill.category).toBe('documentation');
      expect(generateDocsSkill.parameters).toBeDefined();
      expect(generateDocsSkill.parameters.sourcePath.required).toBe(true);
    });

    test('should have execute function', () => {
      expect(typeof generateDocsSkill.execute).toBe('function');
    });

    test('should have formatResult function', () => {
      expect(typeof generateDocsSkill.formatResult).toBe('function');
    });

    test('should have all doc type options', () => {
      const params = generateDocsSkill.parameters;
      expect(params.docType).toBeDefined();
      expect(params.docType.default).toBe('comprehensive');
      expect(params.targetFormat).toBeDefined();
      expect(params.targetFormat.default).toBe('markdown');
    });
  });

  describe('JavaScript File Documentation', () => {
    test('should extract functions from JS files', async () => {
      const code = `
        function add(a, b) {
          return a + b;
        }

        const subtract = (x, y) => {
          return x - y;
        };
      `;
      const filePath = path.join(tempDir, 'math.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.functionsFound).toBeGreaterThan(0);
    });

    test('should extract classes from JS files', async () => {
      const code = `
        class Calculator {
          add(a, b) {
            return a + b;
          }
        }
      `;
      const filePath = path.join(tempDir, 'calculator.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.classesFound).toBeGreaterThan(0);
    });

    test('should extract async functions', async () => {
      const code = `
        async function fetchData() {
          return await fetch('/api/data');
        }
      `;
      const filePath = path.join(tempDir, 'async.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.functionsFound).toBeGreaterThan(0);
    });

    test('should extract arrow function expressions', async () => {
      const code = `
        const multiply = (a, b) => a * b;
        const divide = (a, b) => {
          return a / b;
        };
      `;
      const filePath = path.join(tempDir, 'arrows.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.functionsFound).toBeGreaterThan(0);
    });
  });

  describe('TypeScript File Documentation', () => {
    test('should extract interfaces from TS files', async () => {
      const code = `
        interface User {
          name: string;
          email: string;
        }

        interface Admin extends User {
          role: string;
        }
      `;
      const filePath = path.join(tempDir, 'types.ts');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.interfacesFound).toBeGreaterThan(0);
    });

    test('should extract TypeScript classes with generics', async () => {
      const code = `
        class Repository<T> {
          async get(id: number): Promise<T> {
            return null as any;
          }
        }
      `;
      const filePath = path.join(tempDir, 'generic-repo.ts');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.classesFound).toBeGreaterThan(0);
    });
  });

  describe('Python File Documentation', () => {
    test('should extract functions from Python files', async () => {
      const code = `
        def add(a, b):
            return a + b

        def subtract(x, y):
            return x - y
      `;
      const filePath = path.join(tempDir, 'math.py');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.functionsFound).toBeGreaterThan(0);
    });

    test('should extract classes from Python files', async () => {
      const code = `
        class Calculator:
            def add(self, a, b):
                return a + b

        class AdvancedCalculator(Calculator):
            def multiply(self, a, b):
                return a * b
      `;
      const filePath = path.join(tempDir, 'calc.py');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.classesFound).toBeGreaterThan(0);
    });
  });

  describe('Documentation Type Generation', () => {
    test('should generate API documentation', async () => {
      const code = `
        function getUserById(id) {
          return database.get(id);
        }
      `;
      const filePath = path.join(tempDir, 'api.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          docType: 'api'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.type).toBe('api');
      expect(result.sections.length).toBeGreaterThan(0);
    });

    test('should generate README documentation', async () => {
      const code = `
        function hello(name) {
          return 'Hello ' + name;
        }
      `;
      const filePath = path.join(tempDir, 'readme.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          docType: 'readme'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.type).toBe('readme');
    });

    test('should generate examples documentation', async () => {
      const code = `
        function multiply(a, b) {
          return a * b;
        }
      `;
      const filePath = path.join(tempDir, 'examples.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          docType: 'examples'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.type).toBe('examples');
    });

    test('should generate comprehensive documentation', async () => {
      const code = `
        function test(param1, param2) {
          return param1 + param2;
        }
      `;
      const filePath = path.join(tempDir, 'comprehensive.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          docType: 'comprehensive'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.type).toBe('comprehensive');
      expect(result.sections.length).toBeGreaterThan(0);
    });
  });

  describe('Documentation with Examples', () => {
    test('should include usage examples when enabled', async () => {
      const code = `
        function greet(name) {
          return 'Hello ' + name;
        }
      `;
      const filePath = path.join(tempDir, 'with-examples.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          includeExamples: true
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.examples).toBeDefined();
    });

    test('should exclude examples when disabled', async () => {
      const code = `
        function test() {
          return 42;
        }
      `;
      const filePath = path.join(tempDir, 'no-examples.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          includeExamples: false
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.examples.length).toBe(0);
    });
  });

  describe('Directory Documentation', () => {
    test('should document entire directories', async () => {
      const projectDir = path.join(tempDir, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      const file1 = 'function func1(a, b) { return a + b; }';
      const file2 = 'class MyClass { method() {} }';

      fs.writeFileSync(path.join(projectDir, 'file1.js'), file1);
      fs.writeFileSync(path.join(projectDir, 'file2.js'), file2);

      const context = {
        parameters: { sourcePath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.filesDocumented).toBeGreaterThan(0);
    });

    test('should handle directories with multiple file types', async () => {
      const projectDir = path.join(tempDir, 'mixed-project');
      fs.mkdirSync(projectDir, { recursive: true });

      fs.writeFileSync(path.join(projectDir, 'index.js'), 'function test() {}');
      fs.writeFileSync(path.join(projectDir, 'types.ts'), 'interface User {}');
      fs.writeFileSync(path.join(projectDir, 'utils.py'), 'def helper(): pass');

      const context = {
        parameters: { sourcePath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.filesDocumented).toBeGreaterThan(0);
    });

    test('should skip directories like node_modules', async () => {
      const projectDir = path.join(tempDir, 'smart-project');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'node_modules'), { recursive: true });

      fs.writeFileSync(path.join(projectDir, 'main.js'), 'function main() {}');
      fs.writeFileSync(path.join(projectDir, 'node_modules', 'lib.js'), 'function lib() {}');

      const context = {
        parameters: { sourcePath: projectDir },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      // Should only document main.js, not node_modules
      expect(result.metadata.filesDocumented).toBeLessThanOrEqual(1);
    });
  });

  describe('Output Formats', () => {
    test('should support markdown format', async () => {
      const code = 'function test() {}';
      const filePath = path.join(tempDir, 'markdown.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          targetFormat: 'markdown'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.format).toBe('markdown');
    });

    test('should support JSON format', async () => {
      const code = 'function test() {}';
      const filePath = path.join(tempDir, 'json.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          targetFormat: 'json'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
    });

    test('should support HTML format', async () => {
      const code = 'function test() {}';
      const filePath = path.join(tempDir, 'html.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          targetFormat: 'html'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
    });
  });

  describe('Documentation Generation', () => {
    test('should generate markdown content', async () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
      `;
      const filePath = path.join(tempDir, 'content.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);
    });

    test('should include function signatures in markdown', async () => {
      const code = `
        function multiply(x, y, z) {
          return x * y * z;
        }
      `;
      const filePath = path.join(tempDir, 'signatures.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('multiply');
    });
  });

  describe('Result Formatting', () => {
    test('should format successful generation result', () => {
      const result = {
        success: true,
        path: '/test/file.js',
        type: 'comprehensive',
        format: 'markdown',
        metadata: {
          type: 'comprehensive',
          filesDocumented: 1,
          functionsFound: 5,
          classesFound: 2,
          interfacesFound: 0
        },
        summary: 'Comprehensive documentation for file.js',
        sections: [
          {
            title: 'API Reference - Functions',
            description: '5 functions documented'
          }
        ],
        examples: [
          {
            title: 'Using function()',
            description: 'Example of function'
          }
        ]
      };

      const formatted = generateDocsSkill.formatResult(result);

      expect(formatted).toContain('Generated Documentation');
      expect(formatted).toContain('Files Documented: 1');
      expect(formatted).toContain('Functions: 5');
      expect(formatted).toContain('Classes: 2');
    });

    test('should format failed generation result', () => {
      const result = {
        success: false,
        error: 'Source path not found',
        path: '/invalid/path'
      };

      const formatted = generateDocsSkill.formatResult(result);

      expect(formatted).toContain('Documentation generation failed');
      expect(formatted).toContain('Source path not found');
    });

    test('should show sections in formatted output', () => {
      const result = {
        success: true,
        path: '/test.js',
        type: 'api',
        format: 'markdown',
        metadata: {
          type: 'api',
          filesDocumented: 1,
          functionsFound: 3,
          classesFound: 1,
          interfacesFound: 0
        },
        summary: 'API documentation',
        sections: [
          {
            title: 'API Reference - Functions',
            description: '3 functions documented'
          },
          {
            title: 'API Reference - Classes',
            description: '1 class documented'
          }
        ],
        examples: []
      };

      const formatted = generateDocsSkill.formatResult(result);

      expect(formatted).toContain('Documentation Sections');
      expect(formatted).toContain('API Reference');
    });

    test('should show examples in formatted output', () => {
      const result = {
        success: true,
        path: '/test.js',
        type: 'examples',
        format: 'markdown',
        metadata: {
          type: 'examples',
          filesDocumented: 1,
          functionsFound: 2,
          classesFound: 0,
          interfacesFound: 0
        },
        summary: 'Examples documentation',
        sections: [],
        examples: [
          {
            title: 'Example 1',
            description: 'First usage example'
          },
          {
            title: 'Example 2',
            description: 'Second usage example'
          }
        ]
      };

      const formatted = generateDocsSkill.formatResult(result);

      expect(formatted).toContain('Usage Examples');
      expect(formatted).toContain('Example 1');
    });

    test('should show warnings in formatted output', () => {
      const result = {
        success: true,
        path: '/test.js',
        type: 'comprehensive',
        format: 'markdown',
        metadata: {
          type: 'comprehensive',
          filesDocumented: 1,
          functionsFound: 2,
          classesFound: 0,
          interfacesFound: 0
        },
        summary: 'Partial documentation',
        sections: [],
        examples: [],
        warnings: [
          '2 functions lack JSDoc comments',
          'No classes found in source'
        ]
      };

      const formatted = generateDocsSkill.formatResult(result);

      expect(formatted).toContain('Documentation Warnings');
      expect(formatted).toContain('JSDoc');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent files gracefully', async () => {
      const context = {
        parameters: { sourcePath: '/non/existent/file.js' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    test('should handle empty files', async () => {
      const filePath = path.join(tempDir, 'empty.js');
      fs.writeFileSync(filePath, '');

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.functionsFound).toBe(0);
    });

    test('should handle files with no documentable items', async () => {
      const code = '// This is just a comment\nconst x = 42;';
      const filePath = path.join(tempDir, 'plain.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should handle very large files', async () => {
      let code = '';
      for (let i = 0; i < 1000; i++) {
        code += 'function func' + i + '() { return ' + i + '; }\n';
      }

      const filePath = path.join(tempDir, 'large.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { sourcePath: filePath },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata.functionsFound).toBeGreaterThan(100);
    });
  });

  describe('Documentation Sections', () => {
    test('should generate API section for API docs', async () => {
      const code = 'function getData() {}';
      const filePath = path.join(tempDir, 'api-section.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          docType: 'api'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.sections.some(s => s.title.includes('API'))).toBe(true);
    });

    test('should generate examples section', async () => {
      const code = 'function process(data) { return data; }';
      const filePath = path.join(tempDir, 'examples-section.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          docType: 'examples'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.sections.some(s => s.title.includes('Usage'))).toBe(true);
    });

    test('should generate architecture section', async () => {
      const code = 'class Application {}';
      const filePath = path.join(tempDir, 'arch-section.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          sourcePath: filePath,
          docType: 'architecture'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await generateDocsSkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.sections.some(s => s.title.includes('Architecture'))).toBe(true);
    });
  });
});
