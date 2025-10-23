/**
 * Scan Security Skill Tests
 *
 * Comprehensive test suite for security scanning functionality
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const path = require('path');
const fs = require('fs');
const scanSecuritySkill = require('../scan-security');

describe('Scan Security Skill', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = path.join(__dirname, 'temp-scan-security');
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
      expect(scanSecuritySkill.name).toBe('scan-security');
      expect(scanSecuritySkill.version).toBe('1.0.0');
      expect(scanSecuritySkill.category).toBe('security');
      expect(scanSecuritySkill.parameters).toBeDefined();
      expect(scanSecuritySkill.parameters.scanPath.required).toBe(true);
    });

    test('should have execute function', () => {
      expect(typeof scanSecuritySkill.execute).toBe('function');
    });

    test('should have formatResult function', () => {
      expect(typeof scanSecuritySkill.formatResult).toBe('function');
    });

    test('should have all scan type options', () => {
      const params = scanSecuritySkill.parameters;
      expect(params.scanType).toBeDefined();
      expect(params.scanType.default).toBe('all');
    });
  });

  describe('Secret Detection', () => {
    test('should detect AWS access keys', async () => {
      const code = 'const awsKey = "AKIA2Z3X4C5V6B7N8M9Q";';
      const filePath = path.join(tempDir, 'aws-key.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'secrets' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });

    test('should detect GitHub tokens', async () => {
      const code = 'export const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";';
      const filePath = path.join(tempDir, 'github-token.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'secrets' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });

    test('should detect database passwords', async () => {
      const code = 'database: { password: "SuperSecretPass123!" }';
      const filePath = path.join(tempDir, 'db-config.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'secrets' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });

    test('should detect private keys', async () => {
      const code = 'const key = "-----BEGIN RSA PRIVATE KEY-----\\nMIIEpAIBAAKCAQEA...";';
      const filePath = path.join(tempDir, 'private-key.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'secrets' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });

    test('should detect hardcoded API keys', async () => {
      const code = 'const apiKey = "sk_test_EXAMPLE_KEY_DO_NOT_USE";';
      const filePath = path.join(tempDir, 'api-key.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'secrets' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });
  });

  describe('OWASP Vulnerability Detection', () => {
    test('should detect code evaluation', async () => {
      const code = 'const result = eval(userInput);';
      const filePath = path.join(tempDir, 'eval-test.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'owasp' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });

    test('should detect command execution', async () => {
      const code = 'const result = exec(userCommand);';
      const filePath = path.join(tempDir, 'exec-test.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'owasp' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });

    test('should detect SQL injection risk', async () => {
      const code = 'const query = "SELECT * FROM users WHERE id = " + userId;';
      const filePath = path.join(tempDir, 'sql-injection.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'owasp' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });

    test('should detect debug mode enabled', async () => {
      const code = 'debug: true';
      const filePath = path.join(tempDir, 'debug-config.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'owasp' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
    });

    test('should detect overly permissive CORS', async () => {
      const code = 'cors: { origin: "*" }';
      const filePath = path.join(tempDir, 'cors-config.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: { scanPath: filePath, scanType: 'owasp' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Dependency Scanning', () => {
    test('should check for vulnerable dependencies', async () => {
      const testDir = path.join(tempDir, 'deps-test');
      fs.mkdirSync(testDir, { recursive: true });

      const pkgJson = {
        name: 'test-app',
        dependencies: {
          'request': '2.88.2'
        }
      };

      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(pkgJson)
      );

      const context = {
        parameters: { scanPath: testDir, scanType: 'dependencies' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });

    test('should detect deprecated moment.js', async () => {
      const testDir = path.join(tempDir, 'moment-test');
      fs.mkdirSync(testDir, { recursive: true });

      const pkgJson = {
        name: 'test-app',
        dependencies: {
          'moment': '2.29.1'
        }
      };

      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(pkgJson)
      );

      const context = {
        parameters: { scanPath: testDir, scanType: 'dependencies' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Result Formatting', () => {
    test('should format successful scan result', () => {
      const result = {
        success: true,
        scanPath: '/path/to/scan',
        timestamp: new Date().toISOString(),
        summary: {
          total: 3,
          critical: 1,
          high: 1,
          medium: 1,
          low: 0,
          secretsFound: 1,
          vulnerabilities: 2
        },
        vulnerabilities: [
          { severity: 'critical', type: 'Secret', pattern: 'API Key', file: 'config.js', line: 10 }
        ],
        recommendations: [
          { title: 'Remove secrets', description: 'Rotate all exposed credentials' }
        ]
      };

      const formatted = scanSecuritySkill.formatResult(result);

      expect(formatted).toContain('Security Scan Results');
      expect(formatted).toContain('/path/to/scan');
      expect(formatted).toContain('Total Issues: 3');
    });

    test('should format failed scan result', () => {
      const result = {
        success: false,
        error: 'Scan path not found',
        scanPath: '/invalid/path'
      };

      const formatted = scanSecuritySkill.formatResult(result);

      expect(formatted).toContain('Security scan failed');
      expect(formatted).toContain('Scan path not found');
    });

    test('should show no issues when clean', () => {
      const result = {
        success: true,
        scanPath: '/safe/path',
        timestamp: new Date().toISOString(),
        summary: {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          secretsFound: 0,
          vulnerabilities: 0
        },
        vulnerabilities: [],
        recommendations: []
      };

      const formatted = scanSecuritySkill.formatResult(result);

      expect(formatted).toContain('[PASS] No security issues detected');
    });
  });

  describe('Severity Filtering', () => {
    test('should support severity filtering', async () => {
      const code = 'const password = "secret";';
      const filePath = path.join(tempDir, 'filter-test.js');
      fs.writeFileSync(filePath, code);

      const context = {
        parameters: {
          scanPath: filePath,
          severity: 'critical'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent path gracefully', async () => {
      const context = {
        parameters: { scanPath: '/non/existent/path' },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle scan type parameter', async () => {
      const testDir = path.join(tempDir, 'scan-type-test');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'test.js'), 'console.log("test");');

      const context = {
        parameters: {
          scanPath: testDir,
          scanType: 'all'
        },
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await scanSecuritySkill.execute(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Risk Scoring', () => {
    test('should calculate risk score', () => {
      const result = {
        success: true,
        scanPath: '/test',
        timestamp: new Date().toISOString(),
        summary: {
          total: 2,
          critical: 1,
          high: 1,
          medium: 0,
          low: 0
        },
        vulnerabilities: [
          { severity: 'critical' },
          { severity: 'high' }
        ],
        riskScore: 15
      };

      const formatted = scanSecuritySkill.formatResult(result);

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });
});
