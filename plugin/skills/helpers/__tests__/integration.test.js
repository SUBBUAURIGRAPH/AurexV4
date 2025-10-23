/**
 * Integration tests for Helper Utilities
 * Tests the complete pipeline of analysis tools working together
 *
 * @module integration.test
 */

const ASTParser = require('../ast-parser');
const LanguageDetector = require('../language-detector');
const PatternMatcher = require('../pattern-matcher');
const ReportGenerator = require('../report-generator');
const fs = require('fs');

jest.mock('fs');

describe('Helper Utilities Integration', () => {
  let astParser;
  let languageDetector;
  let patternMatcher;
  let reportGenerator;

  beforeEach(() => {
    astParser = new ASTParser();
    languageDetector = new LanguageDetector();
    patternMatcher = new PatternMatcher();
    reportGenerator = new ReportGenerator();
  });

  describe('complete analysis pipeline', () => {
    test('should perform complete security analysis on JavaScript file', () => {
      const filePath = '/project/src/auth.js';
      const sourceCode = `
        const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";

        function authenticateUser(userId) {
          const query = "SELECT * FROM users WHERE id = " + userId;
          return db.execute(query);
        }

        function processInput(userInput) {
          return eval(userInput);
        }
      `;

      // Step 1: Detect language
      const langMeta = languageDetector.detectLanguageFromFile(filePath);
      expect(langMeta.language).toBe('javascript');

      // Step 2: Parse AST
      const ast = astParser.parseJavaScript(sourceCode);
      expect(ast.type).toBe('Program');
      expect(ast.body.length).toBeGreaterThan(0);

      // Step 3: Find security issues
      const secretFindings = patternMatcher.matchSecretPatterns(sourceCode);
      const sqlFindings = patternMatcher.matchSQLInjectionPatterns(sourceCode);
      const securityFindings = patternMatcher.matchSecurityPatterns(sourceCode, langMeta.language);

      // Verify findings
      expect(secretFindings.length).toBeGreaterThan(0);
      expect(sqlFindings.length).toBeGreaterThan(0);
      expect(securityFindings.length).toBeGreaterThan(0);

      // Step 4: Aggregate all findings
      const allFindings = [...secretFindings, ...sqlFindings, ...securityFindings];

      // Step 5: Generate reports
      const jsonReport = reportGenerator.generateJSONReport(allFindings);
      const markdownReport = reportGenerator.generateMarkdownReport(allFindings);
      const htmlReport = reportGenerator.generateHTMLReport(allFindings);
      const consoleReport = reportGenerator.formatForConsole(allFindings);

      // Verify all reports generated successfully
      expect(jsonReport).toBeDefined();
      expect(JSON.parse(jsonReport).findings.length).toBe(allFindings.length);
      expect(markdownReport).toContain('# Security Analysis Report');
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(consoleReport).toContain('SECURITY ANALYSIS REPORT');
    });

    test('should analyze Python project with multiple issue types', () => {
      const filePath = '/project/app.py';
      const sourceCode = `
import pickle
import hashlib

AWS_SECRET = "aws_secret_access_key=abcd1234efgh5678ijkl9012mnop3456qrstuvwx"

def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return db.execute(query)

def load_data(data):
    return pickle.loads(data)

def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()
      `;

      // Language detection
      const langMeta = languageDetector.detectLanguageFromFile(filePath);
      expect(langMeta.language).toBe('python');

      // Parse AST
      const ast = astParser.parsePython(sourceCode);
      expect(ast.type).toBe('Module');

      // Pattern matching
      const secrets = patternMatcher.matchSecretPatterns(sourceCode);
      const sqlInjections = patternMatcher.matchSQLInjectionPatterns(sourceCode);
      const securityIssues = patternMatcher.matchSecurityPatterns(sourceCode, 'python');

      // Verify Python-specific patterns detected
      expect(secrets.some(f => f.name.includes('AWS'))).toBe(true);
      expect(sqlInjections.some(f => f.name.includes('Python'))).toBe(true);
      expect(securityIssues.some(f => f.name === 'Pickle Deserialization')).toBe(true);
      expect(securityIssues.some(f => f.name === 'Weak Crypto')).toBe(true);

      // Generate comprehensive report
      const allFindings = [...secrets, ...sqlInjections, ...securityIssues];
      const report = reportGenerator.generateMarkdownReport(allFindings);

      expect(report).toContain('## Critical Severity Issues');
      expect(report).toContain('Pickle Deserialization');
    });

    test('should handle Java project analysis', () => {
      const filePath = '/project/src/Main.java';
      const sourceCode = `
package com.example;

public class UserService {
    private static final String API_KEY = "sk_live_EXAMPLE_KEY_DO_NOT_USE";

    public void executeCommand(String command) {
        Runtime.getRuntime().exec(command);
    }

    public User getUser(String userId) {
        String sql = "SELECT * FROM users WHERE id = " + userId;
        return db.executeQuery(sql);
    }
}
      `;

      // Detect Java
      const langMeta = languageDetector.detectLanguageFromFile(filePath);
      expect(langMeta.language).toBe('java');

      // Parse Java AST
      const ast = astParser.parseJava(sourceCode);
      expect(ast.type).toBe('CompilationUnit');
      expect(ast.package).toBe('com.example');

      // Find Java-specific issues
      const secrets = patternMatcher.matchSecretPatterns(sourceCode);
      const sqlInjections = patternMatcher.matchSQLInjectionPatterns(sourceCode);
      const securityIssues = patternMatcher.matchSecurityPatterns(sourceCode, 'java');

      expect(secrets.some(f => f.name.includes('API Key'))).toBe(true);
      expect(sqlInjections.some(f => f.name.includes('Java'))).toBe(true);
      expect(securityIssues.some(f => f.name === 'Runtime.exec()')).toBe(true);

      // Generate report with severity filtering
      const allFindings = [...secrets, ...sqlInjections, ...securityIssues];
      const criticalIssues = reportGenerator.filterBySeverity(allFindings, 'critical');

      expect(criticalIssues.length).toBeGreaterThan(0);
    });
  });

  describe('project-wide analysis', () => {
    test('should analyze entire project structure', () => {
      const projectRoot = '/path/to/project';

      // Mock project structure
      fs.existsSync.mockImplementation((path) => {
        return path.includes('package.json') || path.includes('jest.config.js');
      });

      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: {
          react: '^18.0.0',
          express: '^4.18.0'
        },
        devDependencies: {
          jest: '^29.0.0'
        }
      }));

      fs.readdirSync.mockReturnValue([
        { name: 'index.js', isDirectory: () => false, isFile: () => true },
        { name: 'auth.js', isDirectory: () => false, isFile: () => true },
        { name: 'utils.py', isDirectory: () => false, isFile: () => true }
      ]);

      // Detect project type
      const projectMeta = languageDetector.detectProjectType(projectRoot);
      expect(projectMeta.primaryLanguage).toBe('javascript');
      expect(projectMeta.frameworks).toContain('react');
      expect(projectMeta.frameworks).toContain('express');

      // Detect test framework
      const testFramework = languageDetector.detectTestFramework(projectRoot);
      expect(testFramework).toBe('jest');

      // Analyze directory
      const dirStats = languageDetector.analyzeDirectory(projectRoot);
      expect(dirStats.totalFiles).toBe(3);
      expect(dirStats.languages.javascript).toBe(2);
      expect(dirStats.languages.python).toBe(1);
    });

    test('should handle monorepo detection and analysis', () => {
      const projectRoot = '/path/to/monorepo';

      fs.existsSync.mockImplementation((path) => {
        return path.includes('lerna.json') || path.includes('package.json');
      });

      fs.readFileSync.mockReturnValue(JSON.stringify({}));

      const projectMeta = languageDetector.detectProjectType(projectRoot);

      expect(projectMeta.isMonorepo).toBe(true);
    });
  });

  describe('AST-based pattern detection', () => {
    test('should combine AST parsing with pattern matching', () => {
      const code = `
        function processPayment(cardNumber) {
          const apiKey = "sk_live_abcdefghijklmnop123456";

          // TODO: Add proper validation
          const sql = "INSERT INTO payments VALUES ('" + cardNumber + "')";

          return eval(paymentLogic);
        }
      `;

      // Parse AST to find function declarations
      const ast = astParser.parseJavaScript(code);
      const functions = astParser.findNodes(ast, node => node.type === 'FunctionDeclaration');
      expect(functions.length).toBeGreaterThan(0);

      // Use pattern matcher on the same code
      const allFindings = [
        ...patternMatcher.matchSecretPatterns(code),
        ...patternMatcher.matchSQLInjectionPatterns(code),
        ...patternMatcher.matchSecurityPatterns(code, 'javascript')
      ];

      // Should find multiple issue types
      expect(allFindings.some(f => f.type === 'secret')).toBe(true);
      expect(allFindings.some(f => f.type === 'sql-injection')).toBe(true);
      expect(allFindings.some(f => f.type === 'security')).toBe(true);

      // Generate prioritized report
      const sortedFindings = allFindings.sort((a, b) =>
        patternMatcher.scoreSeverity(b) - patternMatcher.scoreSeverity(a)
      );

      expect(sortedFindings[0].severity).toBe('critical');
    });

    test('should traverse AST to gather context for findings', () => {
      const code = `
        class AuthService {
          authenticate(username, password) {
            const query = "SELECT * FROM users WHERE name = '" + username + "'";
            return this.db.execute(query);
          }
        }
      `;

      const ast = astParser.parseJavaScript(code);

      // Find class declarations
      const classes = astParser.findNodes(ast, node => node.type === 'ClassDeclaration');
      expect(classes.length).toBe(1);
      expect(classes[0].name).toBe('AuthService');

      // Find SQL injection in the same code
      const sqlInjections = patternMatcher.matchSQLInjectionPatterns(code);
      expect(sqlInjections.length).toBeGreaterThan(0);

      // Context: The SQL injection is in the AuthService class
      // This demonstrates how AST and pattern matching work together
    });
  });

  describe('multi-format reporting consistency', () => {
    test('should maintain consistency across all report formats', () => {
      const findings = [
        {
          type: 'secret',
          name: 'AWS Access Key',
          severity: 'critical',
          match: 'AKIA***',
          line: 5
        },
        {
          type: 'sql-injection',
          name: 'SQL Concatenation',
          severity: 'high',
          match: 'SELECT...',
          line: 10
        }
      ];

      const jsonReport = JSON.parse(reportGenerator.generateJSONReport(findings));
      const markdownReport = reportGenerator.generateMarkdownReport(findings);
      const htmlReport = reportGenerator.generateHTMLReport(findings);
      const consoleReport = reportGenerator.formatForConsole(findings);

      // All reports should reflect same totals
      expect(jsonReport.summary.total).toBe(2);
      expect(markdownReport).toContain('| Total Issues | 2 |');
      expect(htmlReport).toContain('<div class="metric-value">2</div>');
      expect(consoleReport).toContain('Total Issues: 2');

      // All reports should show same severity counts
      expect(jsonReport.summary.bySeverity.critical).toBe(1);
      expect(jsonReport.summary.bySeverity.high).toBe(1);
    });
  });

  describe('performance with large codebases', () => {
    test('should handle large files efficiently', () => {
      // Generate large code file
      const largeCode = 'const x = 1;\n'.repeat(1000);

      const startTime = Date.now();

      // Parse
      const ast = astParser.parseJavaScript(largeCode);

      // Pattern match
      const findings = patternMatcher.matchSecurityPatterns(largeCode, 'javascript');

      // Generate report
      const report = reportGenerator.generateJSONReport(findings);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(executionTime).toBeLessThan(1000);
      expect(ast).toBeDefined();
      expect(report).toBeDefined();
    });

    test('should handle multiple files in sequence', () => {
      const files = [
        { path: 'file1.js', code: 'const api_key = "test123456789012345678";' },
        { path: 'file2.py', code: 'def test():\n    pass' },
        { path: 'file3.java', code: 'public class Test {}' }
      ];

      const allFindings = [];

      for (const file of files) {
        const langMeta = languageDetector.detectLanguageFromFile(file.path);
        const secrets = patternMatcher.matchSecretPatterns(file.code);
        const security = patternMatcher.matchSecurityPatterns(file.code, langMeta.language);

        allFindings.push(...secrets, ...security);
      }

      // Should aggregate findings from all files
      expect(allFindings.length).toBeGreaterThanOrEqual(0);

      // Generate combined report
      const report = reportGenerator.generateMarkdownReport(allFindings);
      expect(report).toContain('# Security Analysis Report');
    });
  });

  describe('error handling across pipeline', () => {
    test('should gracefully handle parse errors', () => {
      const brokenCode = 'function broken( { this is not valid }';

      expect(() => {
        const ast = astParser.parseJavaScript(brokenCode);
        const findings = patternMatcher.matchSecurityPatterns(brokenCode, 'javascript');
        const report = reportGenerator.generateJSONReport(findings);
      }).not.toThrow();
    });

    test('should handle missing project files', () => {
      fs.existsSync.mockReturnValue(false);

      const projectRoot = '/nonexistent/project';

      expect(() => {
        const meta = languageDetector.detectProjectType(projectRoot);
        const testFramework = languageDetector.detectTestFramework(projectRoot);
      }).not.toThrow();
    });

    test('should handle empty findings gracefully', () => {
      const emptyFindings = [];

      const jsonReport = reportGenerator.generateJSONReport(emptyFindings);
      const markdownReport = reportGenerator.generateMarkdownReport(emptyFindings);
      const htmlReport = reportGenerator.generateHTMLReport(emptyFindings);

      expect(jsonReport).toContain('"total": 0');
      expect(markdownReport).toContain('No security issues detected');
      expect(htmlReport).toContain('<!DOCTYPE html>');
    });
  });

  describe('custom pattern integration', () => {
    test('should support custom patterns in analysis pipeline', () => {
      const code = 'const CUSTOM_SECRET = "my-custom-api-key-12345";';

      const customPatterns = [
        { name: 'Custom API Key', pattern: /my-custom-api-key-\w+/, severity: 'high' }
      ];

      const customFindings = patternMatcher.matchCustomPattern(code, customPatterns);
      const standardFindings = patternMatcher.matchSecretPatterns(code);

      const allFindings = [...customFindings, ...standardFindings];

      expect(customFindings.length).toBeGreaterThan(0);
      expect(customFindings[0].type).toBe('custom');

      const report = reportGenerator.generateMarkdownReport(allFindings);
      expect(report).toContain('Custom API Key');
    });
  });
});
